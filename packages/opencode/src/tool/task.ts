import { defer } from "@/util/defer" // 延迟清理工具
import { iife } from "@/util/iife" // 立即执行函数工具
import z from "zod" // 数据验证库
import { Agent } from "../agent/agent" // Agent管理
import { Bus } from "../bus" // 事件总线
import { Config } from "../config/config" // 配置管理
import { Identifier } from "../id/id" // 标识符生成器
import { Session } from "../session" // 会话管理
import { MessageV2 } from "../session/message-v2" // 消息V2类
import { SessionPrompt } from "../session/prompt" // 会话提示
import DESCRIPTION from "./task.txt" // 任务描述文件
import { Tool } from "./tool" // 工具基类

export const TaskTool = Tool.define("task", async () => {
  const agents = await Agent.list().then((x) => x.filter((a) => a.mode !== "primary")) // 获取所有非主要代理
  const description = DESCRIPTION.replace(
    "{agents}",
    agents.map((a) => `- ${a.name}: ${a.description ?? "此子代理只能由用户手动调用。"}`).join("\n"),
  )
  return {
    description,
    parameters: z.object({
      description: z.string().describe("任务的简短描述（3-5个词）"),
      prompt: z.string().describe("代理要执行的任务"),
      subagent_type: z.string().describe("用于此任务的专业代理类型"),
      session_id: z.string().describe("要继续的现有任务会话").optional(),
      command: z.string().describe("触发此任务的命令").optional(),
    }),
    async execute(params, ctx) {
      const config = await Config.get() // 获取配置
      await ctx.ask({
        permission: "task",
        patterns: [params.subagent_type],
        always: ["*"],
        metadata: {
          description: params.description,
          subagent_type: params.subagent_type,
        },
      })

      const agent = await Agent.get(params.subagent_type) // 获取指定代理
      if (!agent) throw new Error(`未知的代理类型：${params.subagent_type} 不是有效的代理类型`)
      const session = await iife(async () => {
        if (params.session_id) {
          const found = await Session.get(params.session_id).catch(() => {})
          if (found) return found // 如果找到现有会话则返回
        }

        return await Session.create({
          // 创建新会话
          parentID: ctx.sessionID,
          title: params.description + ` (@${agent.name} 子代理)`,
          permission: [
            {
              permission: "todowrite",
              pattern: "*",
              action: "deny",
            },
            {
              permission: "todoread",
              pattern: "*",
              action: "deny",
            },
            {
              permission: "task",
              pattern: "*",
              action: "deny",
            },
            ...(config.experimental?.primary_tools?.map((t) => ({
              pattern: "*",
              action: "allow" as const,
              permission: t,
            })) ?? []),
          ],
        })
      })
      const msg = await MessageV2.get({ sessionID: ctx.sessionID, messageID: ctx.messageID })
      if (msg.info.role !== "assistant") throw new Error("不是助手消息")

      ctx.metadata({
        title: params.description,
        metadata: {
          sessionId: session.id,
        },
      })

      const messageID = Identifier.ascending("message") // 生成消息ID
      const parts: Record<string, { id: string; tool: string; state: { status: string; title?: string } }> = {}
      const unsub = Bus.subscribe(MessageV2.Event.PartUpdated, async (evt) => {
        // 订阅消息部分更新事件
        if (evt.properties.part.sessionID !== session.id) return
        if (evt.properties.part.messageID === messageID) return
        if (evt.properties.part.type !== "tool") return
        const part = evt.properties.part
        parts[part.id] = {
          id: part.id,
          tool: part.tool,
          state: {
            status: part.state.status,
            title: part.state.status === "completed" ? part.state.title : undefined,
          },
        }
        ctx.metadata({
          title: params.description,
          metadata: {
            summary: Object.values(parts).sort((a, b) => a.id.localeCompare(b.id)),
            sessionId: session.id,
          },
        })
      })

      const model = agent.model ?? {
        // 使用代理的模型或默认模型
        modelID: msg.info.modelID,
        providerID: msg.info.providerID,
      }

      function cancel() {
        SessionPrompt.cancel(session.id) // 取消会话提示
      }
      ctx.abort.addEventListener("abort", cancel)
      using _ = defer(() => ctx.abort.removeEventListener("abort", cancel)) // 清理事件监听器
      const promptParts = await SessionPrompt.resolvePromptParts(params.prompt) // 解析提示部分

      const result = await SessionPrompt.prompt({
        // 发送提示
        messageID,
        sessionID: session.id,
        model: {
          modelID: model.modelID,
          providerID: model.providerID,
        },
        agent: agent.name,
        tools: {
          todowrite: false,
          todoread: false,
          task: false,
          ...Object.fromEntries((config.experimental?.primary_tools ?? []).map((t) => [t, false])),
        },
        parts: promptParts,
      })
      unsub() // 取消订阅
      const messages = await Session.messages({ sessionID: session.id }) // 获取会话消息
      const summary = messages
        .filter((x) => x.info.role === "assistant")
        .flatMap((msg) => msg.parts.filter((x: any) => x.type === "tool") as MessageV2.ToolPart[])
        .map((part) => ({
          id: part.id,
          tool: part.tool,
          state: {
            status: part.state.status,
            title: part.state.status === "completed" ? part.state.title : undefined,
          },
        }))
      const text = result.parts.findLast((x) => x.type === "text")?.text ?? "" // 获取最后的文本部分

      const output = text + "\n\n" + ["<task_metadata>", `session_id: ${session.id}`, "</task_metadata>"].join("\n")

      return {
        title: params.description,
        metadata: {
          summary,
          sessionId: session.id,
        },
        output,
      }
    },
  }
})
