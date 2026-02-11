import path from "path"  // 导入路径模块
import os from "os"  // 导入操作系统模块
import fs from "fs/promises"  // 导入文件系统 Promise 模块
import z from "zod"  // 导入 Zod 数据验证库
import { Identifier } from "../id/id"  // 导入标识符工具
import { MessageV2 } from "./message-v2"  // 导入消息 V2 模块
import { Log } from "../util/log"  // 导入日志工具
import { SessionRevert } from "./revert"  // 导入会话回滚模块
import { Session } from "."  // 导入会话模块
import { Agent } from "../agent/agent"  // 导入智能体模块
import { Provider } from "../provider/provider"  // 导入提供商模块
import { type Tool as AITool, tool, jsonSchema, type ToolCallOptions } from "ai"  // 导入 AI 工具类型
import { SessionCompaction } from "./compaction"  // 导入会话压缩模块
import { Instance } from "../project/instance"  // 导入项目实例模块
import { Bus } from "../bus"  // 导入总线模块
import { ProviderTransform } from "../provider/transform"  // 导入提供商转换模块
import { SystemPrompt } from "./system"  // 导入系统提示词模块
import { Plugin } from "../plugin"  // 导入插件模块
import PROMPT_PLAN from "../session/prompt/plan.txt"  // 导入计划提示词
import BUILD_SWITCH from "../session/prompt/build-switch.txt"  // 导入构建切换提示词
import MAX_STEPS from "../session/prompt/max-steps.txt"  // 导入最大步骤提示词
import { defer } from "../util/defer"  // 导入延迟执行工具
import { clone } from "remeda"  // 导入克隆工具
import { ToolRegistry } from "../tool/registry"  // 导入工具注册表
import { MCP } from "../mcp"  // 导入 MCP 模块
import { LSP } from "../lsp"  // 导入 LSP 模块
import { ReadTool } from "../tool/read"  // 导入读取工具
import { ListTool } from "../tool/ls"  // 导入列表工具
import { FileTime } from "../file/time"  // 导入文件时间模块
import { Flag } from "../flag/flag"  // 导入标志模块
import { ulid } from "ulid"  // 导入 ULID 生成器
import { spawn } from "child_process"  // 导入子进程模块
import { Command } from "../command"  // 导入命令模块
import { $, fileURLToPath } from "bun"  // 导入 Bun 工具
import { ConfigMarkdown } from "../config/markdown"  // 导入 Markdown 配置模块
import { SessionSummary } from "./summary"  // 导入会话摘要模块
import { NamedError } from "@opencode-ai/util/error"  // 导入命名错误类
import { fn } from "@/util/fn"  // 导入函数工具
import { SessionProcessor } from "./processor"  // 导入会话处理器模块
import { TaskTool } from "@/tool/task"  // 导入任务工具
import { Tool } from "@/tool/tool"  // 导入工具模块
import { PermissionNext } from "@/permission/next"  // 导入权限模块
import { SessionStatus } from "./status"  // 导入会话状态模块
import { LLM } from "./llm"  // 导入 LLM 模块
import { iife } from "@/util/iife"  // 导入立即执行函数工具
import { Shell } from "@/shell/shell"  // 导入 Shell 模块

// @ts-ignore
globalThis.AI_SDK_LOG_WARNINGS = false  // 禁用 AI SDK 日志警告

export namespace SessionPrompt {
  const log = Log.create({ service: "session.prompt" })  // 创建日志实例
  export const OUTPUT_TOKEN_MAX = Flag.OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX || 32_000  // 输出 token 最大值

  const state = Instance.state(  // 创建实例状态
    () => {
      const data: Record<  // 数据记录类型
        string,
        {
          abort: AbortController  // 中止控制器
          callbacks: {  // 回调函数数组
            resolve(input: MessageV2.WithParts): void  // 解析函数
            reject(): void  // 拒绝函数
          }[]
        }
      > = {}
      return data
    },
    async (current) => {  // 清理函数
      for (const item of Object.values(current)) {
        item.abort.abort()  // 中止所有控制器
      }
    },
  )

  export function assertNotBusy(sessionID: string) {  // 断言会话不忙碌
    const match = state()[sessionID]
    if (match) throw new Session.BusyError(sessionID)  // 如果忙碌，抛出错误
  }

  export const PromptInput = z.object({  // 提示词输入类型
    sessionID: Identifier.schema("session"),  // 会话 ID
    messageID: Identifier.schema("message").optional(),  // 消息 ID（可选）
    model: z  // 模型（可选）
      .object({
        providerID: z.string(),  // 提供商 ID
        modelID: z.string(),  // 模型 ID
      })
      .optional(),
    agent: z.string().optional(),  // 智能体（可选）
    noReply: z.boolean().optional(),  // 不回复（可选）
    tools: z  // 工具（可选，已弃用）
      .record(z.string(), z.boolean())
      .optional()
      .describe(
        "@deprecated tools and permissions have been merged, you can set permissions on the session itself now",  // 工具和权限已合并，现在可以在会话本身上设置权限
      ),
    system: z.string().optional(),  // 系统提示词（可选）
    variant: z.string().optional(),  // 变体（可选）
    parts: z.array(  // 部分数组
      z.discriminatedUnion("type", [  // 根据类型区分
        MessageV2.TextPart.omit({  // 文本部分输入
          messageID: true,
          sessionID: true,
        })
          .partial({
            id: true,
          })
          .meta({
            ref: "TextPartInput",  // 引用名称
          }),
        MessageV2.FilePart.omit({  // 文件部分输入
          messageID: true,
          sessionID: true,
        })
          .partial({
            id: true,
          })
          .meta({
            ref: "FilePartInput",  // 引用名称
          }),
        MessageV2.AgentPart.omit({  // 智能体部分输入
          messageID: true,
          sessionID: true,
        })
          .partial({
            id: true,
          })
          .meta({
            ref: "AgentPartInput",  // 引用名称
          }),
        MessageV2.SubtaskPart.omit({  // 子任务部分输入
          messageID: true,
          sessionID: true,
        })
          .partial({
            id: true,
          })
          .meta({
            ref: "SubtaskPartInput",  // 引用名称
          }),
      ]),
    ),
  })
  export type PromptInput = z.infer<typeof PromptInput>  // 提示词输入类型

  export const prompt = fn(PromptInput, async (input) => {  // 提示词函数
    const session = await Session.get(input.sessionID)  // 获取会话
    await SessionRevert.cleanup(session)  // 清理回滚

    const message = await createUserMessage(input)  // 创建用户消息
    await Session.touch(input.sessionID)  // 更新会话时间

    // this is backwards compatibility for allowing `tools` to be specified when
    // prompting
    // 这是向后兼容性，允许在提示时指定 `tools`
    const permissions: PermissionNext.Ruleset = []  // 权限规则集
    for (const [tool, enabled] of Object.entries(input.tools ?? {})) {  // 遍历工具
      permissions.push({  // 添加权限规则
        permission: tool,  // 工具名称
        action: enabled ? "allow" : "deny",  // 允许或拒绝
        pattern: "*",  // 匹配所有模式
      })
    }
    if (permissions.length > 0) {  // 如果有权限规则
      session.permission = permissions  // 设置会话权限
      await Session.update(session.id, (draft) => {  // 更新会话
        draft.permission = permissions  // 设置权限
      })
    }

    if (input.noReply === true) {  // 如果不回复
      return message  // 返回消息
    }

    return loop(input.sessionID)  // 返回循环结果
  })

  export async function resolvePromptParts(template: string): Promise<PromptInput["parts"]> {  // 解析提示词部分
    const parts: PromptInput["parts"] = [  // 部分数组
      {
        type: "text",  // 类型为文本
        text: template,  // 模板文本
      },
    ]
    const files = ConfigMarkdown.files(template)  // 获取文件引用
    const seen = new Set<string>()  // 已处理的文件集合
    await Promise.all(  // 并行处理所有文件
      files.map(async (match) => {
        const name = match[1]  // 文件名
        if (seen.has(name)) return  // 如果已处理，跳过
        seen.add(name)  // 标记为已处理
        const filepath = name.startsWith("~/")  // 判断是否为家目录路径
          ? path.join(os.homedir(), name.slice(2))  // 拼接家目录
          : path.resolve(Instance.worktree, name)  // 解析为工作树路径

        const stats = await fs.stat(filepath).catch(() => undefined)  // 获取文件状态
        if (!stats) {  // 如果文件不存在
          const agent = await Agent.get(name)  // 尝试获取智能体
          if (agent) {  // 如果找到智能体
            parts.push({  // 添加智能体部分
              type: "agent",  // 类型为智能体
              name: agent.name,  // 智能体名称
            })
          }
          return
        }

        if (stats.isDirectory()) {  // 如果是目录
          parts.push({  // 添加目录部分
            type: "file",  // 类型为文件
            url: `file://${filepath}`,  // 文件 URL
            filename: name,  // 文件名
            mime: "application/x-directory",  // MIME 类型为目录
          })
          return
        }

        parts.push({  // 添加文件部分
          type: "file",  // 类型为文件
          url: `file://${filepath}`,  // 文件 URL
          filename: name,  // 文件名
          mime: "text/plain",  // MIME 类型为纯文本
        })
      }),
    )
    return parts  // 返回部分列表
  }

  function start(sessionID: string) {  // 启动会话
    const s = state()  // 获取状态
    if (s[sessionID]) return  // 如果已存在，返回
    const controller = new AbortController()  // 创建中止控制器
    s[sessionID] = {  // 设置会话状态
      abort: controller,  // 中止控制器
      callbacks: [],  // 回调函数数组
    }
    return controller.signal  // 返回中止信号
  }

  export function cancel(sessionID: string) {  // 取消会话
    log.info("cancel", { sessionID })  // 记录取消日志
    const s = state()  // 获取状态
    const match = s[sessionID]  // 查找会话
    if (!match) return  // 如果不存在，返回
    match.abort.abort()  // 中止控制器
    for (const item of match.callbacks) {  // 遍历回调函数
      item.reject()  // 拒绝所有回调
    }
    delete s[sessionID]  // 删除会话状态
    SessionStatus.set(sessionID, { type: "idle" })  // 设置会话状态为空闲
    return
  }

  export const loop = fn(Identifier.schema("session"), async (sessionID) => {  // 循环函数
    const abort = start(sessionID)  // 启动会话
    if (!abort) {  // 如果已存在
      return new Promise<MessageV2.WithParts>((resolve, reject) => {  // 返回 Promise
        const callbacks = state()[sessionID].callbacks  // 获取回调函数数组
        callbacks.push({ resolve, reject })  // 添加回调函数
      })
    }

    using _ = defer(() => cancel(sessionID))  // 延迟取消会话

    let step = 0  // 步骤计数器
    const session = await Session.get(sessionID)  // 获取会话
    while (true) {  // 主循环
      SessionStatus.set(sessionID, { type: "busy" })  // 设置会话状态为忙碌
      log.info("loop", { step, sessionID })  // 记录循环日志
      if (abort.aborted) break  // 如果已中止，退出循环
      let msgs = await MessageV2.filterCompacted(MessageV2.stream(sessionID))  // 获取过滤后的消息

      let lastUser: MessageV2.User | undefined  // 最后的用户消息
      let lastAssistant: MessageV2.Assistant | undefined  // 最后的助手消息
      let lastFinished: MessageV2.Assistant | undefined  // 最后完成的助手消息
      let tasks: (MessageV2.CompactionPart | MessageV2.SubtaskPart)[] = []  // 任务列表
      for (let i = msgs.length - 1; i >= 0; i--) {  // 从后往前遍历消息
        const msg = msgs[i]  // 获取消息
        if (!lastUser && msg.info.role === "user") lastUser = msg.info as MessageV2.User  // 查找最后用户消息
        if (!lastAssistant && msg.info.role === "assistant") lastAssistant = msg.info as MessageV2.Assistant  // 查找最后助手消息
        if (!lastFinished && msg.info.role === "assistant" && msg.info.finish)  // 查找最后完成的助手消息
          lastFinished = msg.info as MessageV2.Assistant
        if (lastUser && lastFinished) break  // 如果找到用户和完成消息，停止遍历
        const task = msg.parts.filter((part) => part.type === "compaction" || part.type === "subtask")  // 过滤任务部分
        if (task && !lastFinished) {  // 如果有任务且未完成
          tasks.push(...task)  // 添加任务到列表
        }
      }

      if (!lastUser) throw new Error("在流中未找到用户消息。这不应该发生。")  // 如果没有用户消息，抛出错误
      if (
        lastAssistant?.finish &&  // 如果助手已完成
        !["tool-calls", "unknown"].includes(lastAssistant.finish) &&  // 且完成原因不是工具调用或未知
        lastUser.id < lastAssistant.id  // 且用户消息在助手消息之前
      ) {
        log.info("exiting loop", { sessionID })  // 记录退出循环日志
        break  // 退出循环
      }

      step++  // 增加步骤计数
      if (step === 1)  // 如果是第一步
        ensureTitle({  // 确保标题
          session,
          modelID: lastUser.model.modelID,  // 模型 ID
          providerID: lastUser.model.providerID,  // 提供商 ID
          message: msgs.find((m) => m.info.role === "user")!,  // 用户消息
          history: msgs,  // 消息历史
        })

      const model = await Provider.getModel(lastUser.model.providerID, lastUser.model.modelID)  // 获取模型
      const task = tasks.pop()  // 获取下一个任务

      // pending subtask
      // 待处理的子任务
      // TODO: centralize "invoke tool" logic
      // TODO: 集中化"调用工具"逻辑
      if (task?.type === "subtask") {  // 如果是子任务
        const taskTool = await TaskTool.init()  // 初始化任务工具
        const assistantMessage = (await Session.updateMessage({  // 更新助手消息
          id: Identifier.ascending("message"),  // 生成消息 ID
          role: "assistant",  // 角色为助手
          parentID: lastUser.id,  // 父消息 ID
          sessionID,
          mode: task.agent,  // 模式
          agent: task.agent,  // 智能体
          path: {  // 路径信息
            cwd: Instance.directory,  // 当前工作目录
            root: Instance.worktree,  // 工作树根目录
          },
          cost: 0,  // 成本
          tokens: {  // token 统计
            input: 0,  // 输入 token
            output: 0,  // 输出 token
            reasoning: 0,  // 推理 token
            cache: { read: 0, write: 0 },  // 缓存 token
          },
          modelID: model.id,  // 模型 ID
          providerID: model.providerID,  // 提供商 ID
          time: {  // 时间信息
            created: Date.now(),  // 创建时间
          },
        })) as MessageV2.Assistant
        let part = (await Session.updatePart({  // 更新部分
          id: Identifier.ascending("part"),  // 生成部分 ID
          messageID: assistantMessage.id,  // 消息 ID
          sessionID: assistantMessage.sessionID,  // 会话 ID
          type: "tool",  // 类型为工具
          callID: ulid(),  // 调用 ID
          tool: TaskTool.id,  // 工具 ID
          state: {  // 状态
            status: "running",  // 状态为运行中
            input: {  // 输入参数
              prompt: task.prompt,  // 提示词
              description: task.description,  // 描述
              subagent_type: task.agent,  // 子智能体类型
              command: task.command,  // 命令
            },
            time: {  // 时间信息
              start: Date.now(),  // 开始时间
            },
          },
        })) as MessageV2.ToolPart
        const taskArgs = {  // 任务参数
          prompt: task.prompt,  // 提示词
          description: task.description,  // 描述
          subagent_type: task.agent,  // 子智能体类型
          command: task.command,  // 命令
        }
        await Plugin.trigger(  // 触发插件
          "tool.execute.before",  // 工具执行前事件
          {
            tool: "task",  // 工具名称
            sessionID,  // 会话 ID
            callID: part.id,  // 调用 ID
          },
          { args: taskArgs },  // 参数
        )
        let executionError: Error | undefined  // 执行错误
        const taskAgent = await Agent.get(task.agent)  // 获取任务智能体
        const taskCtx: Tool.Context = {  // 任务上下文
          agent: task.agent,  // 智能体
          messageID: assistantMessage.id,  // 消息 ID
          sessionID: sessionID,  // 会话 ID
          abort,  // 中止信号
          async metadata(input) {  // 更新元数据
            await Session.updatePart({  // 更新部分
              ...part,  // 复制现有部分
              type: "tool",  // 类型为工具
              state: {  // 状态
                ...part.state,  // 复制现有状态
                ...input,  // 合并输入
              },
            } satisfies MessageV2.ToolPart)
          },
          async ask(req) {  // 询问权限
            await PermissionNext.ask({  // 询问权限
              ...req,  // 请求参数
              sessionID: sessionID,  // 会话 ID
              ruleset: PermissionNext.merge(taskAgent.permission, session.permission ?? []),  // 合并权限规则
            })
          },
        }
        const result = await taskTool.execute(taskArgs, taskCtx).catch((error) => {  // 执行任务工具
          executionError = error  // 记录执行错误
          log.error("subtask execution failed", { error, agent: task.agent, description: task.description })  // 记录错误日志
          return undefined  // 返回 undefined
        })
        await Plugin.trigger(  // 触发插件
          "tool.execute.after",  // 工具执行后事件
          {
            tool: "task",  // 工具名称
            sessionID,  // 会话 ID
            callID: part.id,  // 调用 ID
          },
          result,  // 结果
        )
        assistantMessage.finish = "tool-calls"  // 设置完成原因
        assistantMessage.time.completed = Date.now()  // 设置完成时间
        await Session.updateMessage(assistantMessage)  // 更新消息
        if (result && part.state.status === "running") {  // 如果有结果且正在运行
          await Session.updatePart({  // 更新部分
            ...part,  // 复制现有部分
            state: {  // 状态
              status: "completed",  // 状态为已完成
              input: part.state.input,  // 输入参数
              title: result.title,  // 标题
              metadata: result.metadata,  // 元数据
              output: result.output,  // 输出结果
              attachments: result.attachments,  // 附件
              time: {  // 时间信息
                ...part.state.time,  // 复制现有时间
                end: Date.now(),  // 结束时间
              },
            },
          } satisfies MessageV2.ToolPart)
        }
        if (!result) {  // 如果没有结果
          await Session.updatePart({  // 更新部分
            ...part,  // 复制现有部分
            state: {  // 状态
              status: "error",  // 状态为错误
              error: executionError ? `工具执行失败：${executionError.message}` : "工具执行失败",  // 错误信息
              time: {  // 时间信息
                start: part.state.status === "running" ? part.state.time.start : Date.now(),  // 开始时间
                end: Date.now(),  // 结束时间
              },
              metadata: part.metadata,  // 元数据
              input: part.state.input,  // 输入参数
            },
          } satisfies MessageV2.ToolPart)
        }

        // Add synthetic user message to prevent certain reasoning models from erroring
        // If we create assistant messages w/ out user ones following mid loop thinking signatures
        // will be missing and it can cause errors for models like gemini for example
        // 添加合成用户消息以防止某些推理模型出错
        // 如果我们创建助手消息而没有用户消息跟随中间循环思考签名
        // 将会缺失，这可能导致像 gemini 这样的模型出错
        const summaryUserMsg: MessageV2.User = {  // 创建摘要用户消息
          id: Identifier.ascending("message"),  // 生成消息 ID
          sessionID,  // 会话 ID
          role: "user",  // 角色为用户
          time: {  // 时间信息
            created: Date.now(),  // 创建时间
          },
          agent: lastUser.agent,  // 智能体
          model: lastUser.model,  // 模型
        }
        await Session.updateMessage(summaryUserMsg)  // 更新消息
        await Session.updatePart({  // 更新部分
          id: Identifier.ascending("part"),  // 生成部分 ID
          messageID: summaryUserMsg.id,  // 消息 ID
          sessionID,  // 会话 ID
          type: "text",  // 类型为文本
          text: "Summarize task tool output above and continue with your task.",  // 文本内容
          synthetic: true,  // 合成标记
        } satisfies MessageV2.TextPart)

        continue  // 继续循环
      }

      // pending compaction
      // 待处理的压缩
      if (task?.type === "compaction") {  // 如果是压缩任务
        const result = await SessionCompaction.process({  // 处理压缩
          messages: msgs,  // 消息列表
          parentID: lastUser.id,  // 父消息 ID
          abort,  // 中止信号
          sessionID,  // 会话 ID
          auto: task.auto,  // 是否自动
        })
        if (result === "stop") break  // 如果结果为停止，退出循环
        continue  // 继续循环
      }

      // context overflow, needs compaction
      // 上下文溢出，需要压缩
      if (
        lastFinished &&  // 如果有完成的助手消息
        lastFinished.summary !== true &&  // 且不是摘要
        (await SessionCompaction.isOverflow({ tokens: lastFinished.tokens, model }))  // 且 token 溢出
      ) {
        await SessionCompaction.create({  // 创建压缩
          sessionID,  // 会话 ID
          agent: lastUser.agent,  // 智能体
          model: lastUser.model,  // 模型
          auto: true,  // 自动压缩
        })
        continue  // 继续循环
      }

      // normal processing
      // 正常处理
      const agent = await Agent.get(lastUser.agent)  // 获取智能体
      const maxSteps = agent.steps ?? Infinity  // 最大步骤数
      const isLastStep = step >= maxSteps  // 是否为最后一步
      msgs = insertReminders({  // 插入提醒
        messages: msgs,  // 消息列表
        agent,  // 智能体
      })

      const processor = SessionProcessor.create({  // 创建处理器
        assistantMessage: (await Session.updateMessage({  // 更新助手消息
          id: Identifier.ascending("message"),  // 生成消息 ID
          parentID: lastUser.id,  // 父消息 ID
          role: "assistant",  // 角色为助手
          mode: agent.name,  // 模式
          agent: agent.name,  // 智能体
          path: {  // 路径信息
            cwd: Instance.directory,  // 当前工作目录
            root: Instance.worktree,  // 工作树根目录
          },
          cost: 0,  // 成本
          tokens: {  // token 统计
            input: 0,  // 输入 token
            output: 0,  // 输出 token
            reasoning: 0,  // 推理 token
            cache: { read: 0, write: 0 },  // 缓存 token
          },
          modelID: model.id,  // 模型 ID
          providerID: model.providerID,  // 提供商 ID
          time: {  // 时间信息
            created: Date.now(),  // 创建时间
          },
          sessionID,  // 会话 ID
        })) as MessageV2.Assistant,
        sessionID: sessionID,  // 会话 ID
        model,  // 模型
        abort,  // 中止信号
      })
      const tools = await resolveTools({  // 解析工具
        agent,  // 智能体
        session,  // 会话
        model,  // 模型
        tools: lastUser.tools,  // 工具配置
        processor,  // 处理器
      })

      if (step === 1) {  // 如果是第一步
        SessionSummary.summarize({  // 生成摘要
          sessionID: sessionID,  // 会话 ID
          messageID: lastUser.id,  // 消息 ID
        })
      }

      const sessionMessages = clone(msgs)  // 克隆消息

      await Plugin.trigger("experimental.chat.messages.transform", {}, { messages: sessionMessages })  // 触发插件转换消息

      const result = await processor.process({  // 处理流
        user: lastUser,  // 用户消息
        agent,  // 智能体
        abort,  // 中止信号
        sessionID,  // 会话 ID
        system: [...(await SystemPrompt.environment()), ...(await SystemPrompt.custom())],  // 系统提示词
        messages: [  // 消息列表
          ...MessageV2.toModelMessage(sessionMessages),  // 转换为模型消息
          ...(isLastStep  // 如果是最后一步
            ? [
                {
                  role: "assistant" as const,  // 角色为助手
                  content: MAX_STEPS,  // 最大步骤提示词
                },
              ]
            : []),
        ],
        tools,  // 工具
        model,  // 模型
      })
      if (result === "stop") break  // 如果结果为停止，退出循环
      if (result === "compact") {  // 如果结果为压缩
        await SessionCompaction.create({  // 创建压缩
          sessionID,  // 会话 ID
          agent: lastUser.agent,  // 智能体
          model: lastUser.model,  // 模型
          auto: true,  // 自动压缩
        })
      }
      continue  // 继续循环
    }
    SessionCompaction.prune({ sessionID })  // 清理压缩
    for await (const item of MessageV2.stream(sessionID)) {  // 遍历消息流
      if (item.info.role === "user") continue  // 跳过用户消息
      const queued = state()[sessionID]?.callbacks ?? []  // 获取队列回调
      for (const q of queued) {  // 遍历队列回调
        q.resolve(item)  // 解析回调
      }
      return item  // 返回消息
    }
    throw new Error("不可能")  // 不应该到达这里
  })

  async function lastModel(sessionID: string) {  // 获取最后使用的模型
    for await (const item of MessageV2.stream(sessionID)) {  // 遍历消息流
      if (item.info.role === "user" && item.info.model) return item.info.model  // 返回用户消息的模型
    }
    return Provider.defaultModel()  // 返回默认模型
  }

  async function resolveTools(input: {  // 解析工具
    agent: Agent.Info  // 智能体信息
    model: Provider.Model  // 模型
    session: Session.Info  // 会话信息
    tools?: Record<string, boolean>  // 工具配置
    processor: SessionProcessor.Info  // 处理器信息
  }) {
    using _ = log.time("resolveTools")  // 记录解析工具时间
    const tools: Record<string, AITool> = {}  // 工具记录

    const context = (args: any, options: ToolCallOptions): Tool.Context => ({  // 创建工具上下文
      sessionID: input.session.id,  // 会话 ID
      abort: options.abortSignal!,  // 中止信号
      messageID: input.processor.message.id,  // 消息 ID
      callID: options.toolCallId,  // 调用 ID
      extra: { model: input.model },  // 额外信息
      agent: input.agent.name,  // 智能体名称
      metadata: async (val: { title?: string; metadata?: any }) => {  // 更新元数据
        const match = input.processor.partFromToolCall(options.toolCallId)  // 查找工具调用部分
        if (match && match.state.status === "running") {  // 如果找到且正在运行
          await Session.updatePart({  // 更新部分
            ...match,  // 复制现有部分
            state: {  // 状态
              title: val.title,  // 标题
              metadata: val.metadata,  // 元数据
              status: "running",  // 状态为运行中
              input: args,  // 输入参数
              time: {  // 时间信息
                start: Date.now(),  // 开始时间
              },
            },
          })
        }
      },
      async ask(req) {  // 询问权限
        await PermissionNext.ask({  // 询问权限
          ...req,  // 请求参数
          sessionID: input.session.id,  // 会话 ID
          tool: { messageID: input.processor.message.id, callID: options.toolCallId },  // 工具信息
          ruleset: PermissionNext.merge(input.agent.permission, input.session.permission ?? []),  // 合并权限规则
        })
      },
    })

    for (const item of await ToolRegistry.tools(input.model.providerID)) {  // 遍历工具注册表
      const schema = ProviderTransform.schema(input.model, z.toJSONSchema(item.parameters))  // 转换参数模式
      tools[item.id] = tool({  // 创建工具
        id: item.id as any,  // 工具 ID
        description: item.description,  // 描述
        inputSchema: jsonSchema(schema as any),  // 输入模式
        async execute(args, options) {  // 执行函数
          const ctx = context(args, options)  // 创建上下文
          await Plugin.trigger(  // 触发插件
            "tool.execute.before",  // 工具执行前事件
            {
              tool: item.id,  // 工具 ID
              sessionID: ctx.sessionID,  // 会话 ID
              callID: ctx.callID,  // 调用 ID
            },
            {
              args,  // 参数
            },
          )
          const result = await item.execute(args, ctx)  // 执行工具
          await Plugin.trigger(  // 触发插件
            "tool.execute.after",  // 工具执行后事件
            {
              tool: item.id,  // 工具 ID
              sessionID: ctx.sessionID,  // 会话 ID
              callID: ctx.callID,  // 调用 ID
            },
            result,  // 结果
          )
          return result  // 返回结果
        },
        toModelOutput(result) {  // 转换为模型输出
          return {
            type: "text",  // 类型为文本
            value: result.output,  // 输出值
          }
        },
      })
    }

    for (const [key, item] of Object.entries(await MCP.tools())) {  // 遍历 MCP 工具
      const execute = item.execute  // 获取执行函数
      if (!execute) continue  // 如果没有执行函数，跳过

      // Wrap execute to add plugin hooks and format output
      // 包装执行函数以添加插件钩子和格式化输出
      item.execute = async (args, opts) => {
        const ctx = context(args, opts)  // 创建上下文

        await Plugin.trigger(  // 触发插件
          "tool.execute.before",  // 工具执行前事件
          {
            tool: key,  // 工具 ID
            sessionID: ctx.sessionID,  // 会话 ID
            callID: opts.toolCallId,  // 调用 ID
          },
          {
            args,  // 参数
          },
        )

        await ctx.ask({  // 询问权限
          permission: key,  // 权限
          metadata: {},  // 元数据
          patterns: ["*"],  // 模式
          always: ["*"],  // 总是询问
        })

        const result = await execute(args, opts)  // 执行工具

        await Plugin.trigger(  // 触发插件
          "tool.execute.after",  // 工具执行后事件
          {
            tool: key,  // 工具 ID
            sessionID: ctx.sessionID,  // 会话 ID
            callID: opts.toolCallId,  // 调用 ID
          },
          result,  // 结果
        )

        const textParts: string[] = []  // 文本部分列表
        const attachments: MessageV2.FilePart[] = []  // 附件列表

        for (const contentItem of result.content) {  // 遍历内容
          if (contentItem.type === "text") {  // 如果是文本
            textParts.push(contentItem.text)  // 添加文本
          } else if (contentItem.type === "image") {  // 如果是图像
            attachments.push({  // 添加附件
              id: Identifier.ascending("part"),  // 生成部分 ID
              sessionID: input.session.id,  // 会话 ID
              messageID: input.processor.message.id,  // 消息 ID
              type: "file",  // 类型为文件
              mime: contentItem.mimeType,  // MIME 类型
              url: `data:${contentItem.mimeType};base64,${contentItem.data}`,  // 数据 URL
            })
          }
          // Add support for other types if needed
          // 如果需要，添加对其他类型的支持
        }

        return {  // 返回结果
          title: "",  // 标题
          metadata: result.metadata ?? {},  // 元数据
          output: textParts.join("\n\n"),  // 输出文本
          attachments,  // 附件
          content: result.content,  // 直接返回内容以保持输出到模型时的顺序
        }
      }
      item.toModelOutput = (result) => {  // 转换为模型输出
        return {
          type: "text",  // 类型为文本
          value: result.output,  // 输出值
        }
      }
      tools[key] = item  // 添加工具到记录
    }
    return tools  // 返回工具记录
  }

  async function createUserMessage(input: PromptInput) {  // 创建用户消息
    const agent = await Agent.get(input.agent ?? (await Agent.defaultAgent()))  // 获取智能体
    const info: MessageV2.Info = {  // 消息信息
      id: input.messageID ?? Identifier.ascending("message"),  // 消息 ID
      role: "user",  // 角色为用户
      sessionID: input.sessionID,  // 会话 ID
      time: {  // 时间信息
        created: Date.now(),  // 创建时间
      },
      tools: input.tools,  // 工具配置
      agent: agent.name,  // 智能体名称
      model: input.model ?? agent.model ?? (await lastModel(input.sessionID)),  // 模型
      system: input.system,  // 系统提示词
      variant: input.variant,  // 变体
    }

    const parts = await Promise.all(  // 并行处理所有部分
      input.parts.map(async (part): Promise<MessageV2.Part[]> => {  // 映射部分
        if (part.type === "file") {  // 如果是文件部分
          const url = new URL(part.url)  // 解析 URL
          switch (url.protocol) {  // 根据 URL 协议处理
            case "data:":  // 数据 URL
              if (part.mime === "text/plain") {  // 如果是纯文本
                return [
                  {
                    id: Identifier.ascending("part"),  // 生成部分 ID
                    messageID: info.id,  // 消息 ID
                    sessionID: input.sessionID,  // 会话 ID
                    type: "text",  // 类型为文本
                    synthetic: true,  // 合成标记
                    text: `Called Read tool with the following input: ${JSON.stringify({ filePath: part.filename })}`,  // 调用 Read 工具的输入
                  },
                  {
                    id: Identifier.ascending("part"),  // 生成部分 ID
                    messageID: info.id,  // 消息 ID
                    sessionID: input.sessionID,  // 会话 ID
                    type: "text",  // 类型为文本
                    synthetic: true,  // 合成标记
                    text: Buffer.from(part.url, "base64url").toString(),  // 解码 base64url
                  },
                  {
                    ...part,  // 复制现有部分
                    id: part.id ?? Identifier.ascending("part"),  // 部分 ID
                    messageID: info.id,  // 消息 ID
                    sessionID: input.sessionID,  // 会话 ID
                  },
                ]
              }
              break
            case "file:":  // 文件 URL
              log.info("file", { mime: part.mime })  // 记录文件日志
              // have to normalize, symbol search returns absolute paths
              // 需要规范化，符号搜索返回绝对路径
              // Decode pathname since URL constructor doesn't automatically decode it
              // 解码路径名，因为 URL 构造函数不会自动解码
              const filepath = fileURLToPath(part.url)  // 转换为文件路径
              const stat = await Bun.file(filepath).stat()  // 获取文件状态

              if (stat.isDirectory()) {  // 如果是目录
                part.mime = "application/x-directory"  // 设置 MIME 类型为目录
              }

              if (part.mime === "text/plain") {  // 如果是纯文本
                let offset: number | undefined = undefined  // 偏移量
                let limit: number | undefined = undefined  // 限制
                const range = {  // 范围
                  start: url.searchParams.get("start"),  // 开始位置
                  end: url.searchParams.get("end"),  // 结束位置
                }
                if (range.start != null) {  // 如果有开始位置
                  const filePathURI = part.url.split("?")[0]  // 文件路径 URI
                  let start = parseInt(range.start)  // 解析开始位置
                  let end = range.end ? parseInt(range.end) : undefined  // 解析结束位置
                  // some LSP servers (eg, gopls) don't give full range in
                  // workspace/symbol searches, so we'll try to find
                  // symbol in document to get full range
                  // 一些 LSP 服务器（例如 gopls）在工作区/符号搜索中不提供完整范围
                  // 所以我们将尝试在文档中查找符号以获取完整范围
                  if (start === end) {  // 如果开始和结束相同
                    const symbols = await LSP.documentSymbol(filePathURI)  // 获取文档符号
                    for (const symbol of symbols) {  // 遍历符号
                      let range: LSP.Range | undefined  // 符号范围
                      if ("range" in symbol) {  // 如果有范围属性
                        range = symbol.range  // 使用范围
                      } else if ("location" in symbol) {  // 如果有位置属性
                        range = symbol.location.range  // 使用位置的范围
                      }
                      if (range?.start?.line && range?.start?.line === start) {  // 如果找到匹配的符号
                        start = range.start.line  // 使用符号的开始行
                        end = range?.end?.line ?? start  // 使用符号的结束行
                        break  // 停止遍历
                      }
                    }
                  }
                  offset = Math.max(start - 1, 0)  // 计算偏移量
                  if (end) {  // 如果有结束位置
                    limit = end - offset  // 计算限制
                  }
                }
                const args = { filePath: filepath, offset, limit }  // 文件读取参数

                const pieces: MessageV2.Part[] = [  // 部分列表
                  {
                    id: Identifier.ascending("part"),  // 生成部分 ID
                    messageID: info.id,  // 消息 ID
                    sessionID: input.sessionID,  // 会话 ID
                    type: "text",  // 类型为文本
                    synthetic: true,  // 合成标记
                    text: `Called Read tool with the following input: ${JSON.stringify(args)}`,  // 调用 Read 工具的输入
                  },
                ]

                await ReadTool.init()  // 初始化 Read 工具
                  .then(async (t) => {  // 然后执行
                    const model = await Provider.getModel(info.model.providerID, info.model.modelID)  // 获取模型
                    const readCtx: Tool.Context = {  // 读取上下文
                      sessionID: input.sessionID,  // 会话 ID
                      abort: new AbortController().signal,  // 中止信号
                      agent: input.agent!,  // 智能体
                      messageID: info.id,  // 消息 ID
                      extra: { bypassCwdCheck: true, model },  // 额外信息
                      metadata: async () => {},  // 元数据更新函数
                      ask: async () => {},  // 权限询问函数
                    }
                    const result = await t.execute(args, readCtx)  // 执行读取
                    pieces.push({  // 添加结果部分
                      id: Identifier.ascending("part"),  // 生成部分 ID
                      messageID: info.id,  // 消息 ID
                      sessionID: input.sessionID,  // 会话 ID
                      type: "text",  // 类型为文本
                      synthetic: true,  // 合成标记
                      text: result.output,  // 输出文本
                    })
                    if (result.attachments?.length) {  // 如果有附件
                      pieces.push(  // 添加附件
                        ...result.attachments.map((attachment) => ({  // 映射附件
                          ...attachment,  // 复制附件
                          synthetic: true,  // 合成标记
                          filename: attachment.filename ?? part.filename,  // 文件名
                          messageID: info.id,  // 消息 ID
                          sessionID: input.sessionID,  // 会话 ID
                        })),
                      )
                    } else {  // 如果没有附件
                      pieces.push({  // 添加文件部分
                        ...part,  // 复制现有部分
                        id: part.id ?? Identifier.ascending("part"),  // 部分 ID
                        messageID: info.id,  // 消息 ID
                        sessionID: input.sessionID,  // 会话 ID
                      })
                    }
                  })
                  .catch((error) => {  // 捕获错误
                    log.error("failed to read file", { error })  // 记录错误日志
                    const message = error instanceof Error ? error.message : error.toString()  // 错误消息
                    Bus.publish(Session.Event.Error, {  // 发布错误事件
                      sessionID: input.sessionID,  // 会话 ID
                      error: new NamedError.Unknown({  // 创建未知错误
                        message,  // 错误消息
                      }).toObject(),  // 转换为对象
                    })
                    pieces.push({  // 添加错误部分
                      id: Identifier.ascending("part"),  // 生成部分 ID
                      messageID: info.id,  // 消息 ID
                      sessionID: input.sessionID,  // 会话 ID
                      type: "text",  // 类型为文本
                      synthetic: true,  // 合成标记
                      text: `Read tool failed to read ${filepath} with the following error: ${message}`,  // 错误文本
                    })
                  })

                return pieces  // 返回部分列表
              }

              if (part.mime === "application/x-directory") {  // 如果是目录
                const args = { path: filepath }  // 目录参数
                const listCtx: Tool.Context = {  // 列表上下文
                  sessionID: input.sessionID,  // 会话 ID
                  abort: new AbortController().signal,  // 中止信号
                  agent: input.agent!,  // 智能体
                  messageID: info.id,  // 消息 ID
                  extra: { bypassCwdCheck: true },  // 额外信息
                  metadata: async () => {},  // 元数据更新函数
                  ask: async () => {},  // 权限询问函数
                }
                const result = await ListTool.init().then((t) => t.execute(args, listCtx))  // 执行列表工具
                return [  // 返回部分列表
                  {
                    id: Identifier.ascending("part"),  // 生成部分 ID
                    messageID: info.id,  // 消息 ID
                    sessionID: input.sessionID,  // 会话 ID
                    type: "text",  // 类型为文本
                    synthetic: true,  // 合成标记
                    text: `Called list tool with the following input: ${JSON.stringify(args)}`,  // 调用列表工具的输入
                  },
                  {
                    id: Identifier.ascending("part"),  // 生成部分 ID
                    messageID: info.id,  // 消息 ID
                    sessionID: input.sessionID,  // 会话 ID
                    type: "text",  // 类型为文本
                    synthetic: true,  // 合成标记
                    text: result.output,  // 输出文本
                  },
                  {
                    ...part,  // 复制现有部分
                    id: part.id ?? Identifier.ascending("part"),  // 部分 ID
                    messageID: info.id,  // 消息 ID
                    sessionID: input.sessionID,  // 会话 ID
                  },
                ]
              }

              const file = Bun.file(filepath)  // 获取文件
              FileTime.read(input.sessionID, filepath)  // 读取文件时间
              return [  // 返回部分列表
                {
                  id: Identifier.ascending("part"),  // 生成部分 ID
                  messageID: info.id,  // 消息 ID
                  sessionID: input.sessionID,  // 会话 ID
                  type: "text",  // 类型为文本
                  text: `Called Read tool with the following input: {"filePath":"${filepath}"}`,  // 调用 Read 工具的输入
                  synthetic: true,  // 合成标记
                },
                {
                  id: part.id ?? Identifier.ascending("part"),  // 部分 ID
                  messageID: info.id,  // 消息 ID
                  sessionID: input.sessionID,  // 会话 ID
                  type: "file",  // 类型为文件
                  url: `data:${part.mime};base64,` + Buffer.from(await file.bytes()).toString("base64"),  // 数据 URL
                  mime: part.mime,  // MIME 类型
                  filename: part.filename!,  // 文件名
                  source: part.source,  // 来源
                },
              ]
          }
        }

        if (part.type === "agent") {  // 如果是智能体部分
          return [
            {
              id: Identifier.ascending("part"),  // 生成部分 ID
              ...part,  // 复制现有部分
              messageID: info.id,  // 消息 ID
              sessionID: input.sessionID,  // 会话 ID
            },
            {
              id: Identifier.ascending("part"),  // 生成部分 ID
              messageID: info.id,  // 消息 ID
              sessionID: input.sessionID,  // 会话 ID
              type: "text",  // 类型为文本
              synthetic: true,  // 合成标记
              text:  // 文本内容
                "Use the above message and context to generate a prompt and call task tool with subagent: " +
                part.name,  // 使用上述消息和上下文生成提示词并调用任务工具，子智能体为
            },
          ]
        }

        return [  // 返回部分列表
          {
            id: Identifier.ascending("part"),  // 生成部分 ID
            ...part,  // 复制现有部分
            messageID: info.id,  // 消息 ID
            sessionID: input.sessionID,  // 会话 ID
          },
        ]
      }),
    ).then((x) => x.flat())  // 展平数组

    await Plugin.trigger(  // 触发插件
      "chat.message",  // 聊天消息事件
      {
        sessionID: input.sessionID,  // 会话 ID
        agent: input.agent,  // 智能体
        model: input.model,  // 模型
        messageID: input.messageID,  // 消息 ID
      },
      {
        message: info,  // 消息信息
        parts,  // 部分列表
      },
    )

    await Session.updateMessage(info)  // 更新消息
    for (const part of parts) {  // 遍历部分
      await Session.updatePart(part)  // 更新部分
    }

    return {  // 返回带部分的消息
      info,  // 消息信息
      parts,  // 部分列表
    }
  }

  function insertReminders(input: { messages: MessageV2.WithParts[]; agent: Agent.Info }) {  // 插入提醒
    const userMessage = input.messages.findLast((msg) => msg.info.role === "user")  // 查找最后用户消息
    if (!userMessage) return input.messages  // 如果没有用户消息，返回原消息列表
    if (input.agent.name === "plan") {  // 如果智能体是计划
      userMessage.parts.push({  // 添加计划提醒
        id: Identifier.ascending("part"),  // 生成部分 ID
        messageID: userMessage.info.id,  // 消息 ID
        sessionID: userMessage.info.sessionID,  // 会话 ID
        type: "text",  // 类型为文本
        // TODO (for mr dax): update to use anthropic full fledged one (see plan-reminder-anthropic.txt)
        // TODO（给 dax 先生）：更新为使用 anthropic 完整版本（参见 plan-reminder-anthropic.txt）
        text: PROMPT_PLAN,  // 计划提示词
        synthetic: true,  // 合成标记
      })
    }
    const wasPlan = input.messages.some((msg) => msg.info.role === "assistant" && msg.info.agent === "plan")  // 是否使用过计划智能体
    if (wasPlan && input.agent.name === "build") {  // 如果使用过计划且当前是构建智能体
      userMessage.parts.push({  // 添加构建切换提醒
        id: Identifier.ascending("part"),  // 生成部分 ID
        messageID: userMessage.info.id,  // 消息 ID
        sessionID: userMessage.info.sessionID,  // 会话 ID
        type: "text",  // 类型为文本
        text: BUILD_SWITCH,  // 构建切换提示词
        synthetic: true,  // 合成标记
      })
    }
    return input.messages  // 返回消息列表
  }

  export const ShellInput = z.object({  // Shell 输入类型
    sessionID: Identifier.schema("session"),  // 会话 ID
    agent: z.string(),  // 智能体
    model: z  // 模型（可选）
      .object({
        providerID: z.string(),  // 提供商 ID
        modelID: z.string(),  // 模型 ID
      })
      .optional(),
    command: z.string(),  // 命令
  })
  export type ShellInput = z.infer<typeof ShellInput>  // Shell 输入类型
  export async function shell(input: ShellInput) {  // Shell 函数
    const abort = start(input.sessionID)  // 启动会话
    if (!abort) {  // 如果已存在
      throw new Session.BusyError(input.sessionID)  // 抛出忙碌错误
    }
    using _ = defer(() => cancel(input.sessionID))  // 延迟取消会话

    const session = await Session.get(input.sessionID)  // 获取会话
    if (session.revert) {  // 如果需要回滚
      SessionRevert.cleanup(session)  // 清理回滚
    }
    const agent = await Agent.get(input.agent)  // 获取智能体
    const model = input.model ?? agent.model ?? (await lastModel(input.sessionID))  // 获取模型
    const userMsg: MessageV2.User = {  // 用户消息
      id: Identifier.ascending("message"),  // 生成消息 ID
      sessionID: input.sessionID,  // 会话 ID
      time: {  // 时间信息
        created: Date.now(),  // 创建时间
      },
      role: "user",  // 角色为用户
      agent: input.agent,  // 智能体
      model: {  // 模型
        providerID: model.providerID,  // 提供商 ID
        modelID: model.modelID,  // 模型 ID
      },
    }
    await Session.updateMessage(userMsg)  // 更新消息
    const userPart: MessageV2.Part = {  // 用户部分
      type: "text",  // 类型为文本
      id: Identifier.ascending("part"),  // 生成部分 ID
      messageID: userMsg.id,  // 消息 ID
      sessionID: input.sessionID,  // 会话 ID
      text: "The following tool was executed by the user",  // 文本内容
      synthetic: true,  // 合成标记
    }
    await Session.updatePart(userPart)  // 更新部分

    const msg: MessageV2.Assistant = {  // 助手消息
      id: Identifier.ascending("message"),  // 生成消息 ID
      sessionID: input.sessionID,  // 会话 ID
      parentID: userMsg.id,  // 父消息 ID
      mode: input.agent,  // 模式
      agent: input.agent,  // 智能体
      cost: 0,  // 成本
      path: {  // 路径信息
        cwd: Instance.directory,  // 当前工作目录
        root: Instance.worktree,  // 工作树根目录
      },
      time: {  // 时间信息
        created: Date.now(),  // 创建时间
      },
      role: "assistant",  // 角色为助手
      tokens: {  // token 统计
        input: 0,  // 输入 token
        output: 0,  // 输出 token
        reasoning: 0,  // 推理 token
        cache: { read: 0, write: 0 },  // 缓存 token
      },
      modelID: model.modelID,  // 模型 ID
      providerID: model.providerID,  // 提供商 ID
    }
    await Session.updateMessage(msg)  // 更新消息
    const part: MessageV2.Part = {  // 工具部分
      type: "tool",  // 类型为工具
      id: Identifier.ascending("part"),  // 生成部分 ID
      messageID: msg.id,  // 消息 ID
      sessionID: input.sessionID,  // 会话 ID
      tool: "bash",  // 工具名称
      callID: ulid(),  // 调用 ID
      state: {  // 状态
        status: "running",  // 状态为运行中
        time: {  // 时间信息
          start: Date.now(),  // 开始时间
        },
        input: {  // 输入参数
          command: input.command,  // 命令
        },
      },
    }
    await Session.updatePart(part)  // 更新部分
    const shell = Shell.preferred()  // 获取首选 Shell
    const shellName = (  // Shell 名称
      process.platform === "win32" ? path.win32.basename(shell, ".exe") : path.basename(shell)  // Windows 或其他平台
    ).toLowerCase()

    const invocations: Record<string, { args: string[] }> = {  // Shell 调用配置
      nu: {  // Nushell
        args: ["-c", input.command],  // 参数
      },
      fish: {  // Fish
        args: ["-c", input.command],  // 参数
      },
      zsh: {  // Zsh
        args: [  // 参数
          "-c",  // 命令模式
          "-l",  // 登录模式
          `
            [[ -f ~/.zshenv ]] && source ~/.zshenv >/dev/null 2>&1 || true
            [[ -f "\${ZDOTDIR:-$HOME}/.zshrc" ]] && source "\${ZDOTDIR:-$HOME}/.zshrc" >/dev/null 2>&1 || true
            eval ${JSON.stringify(input.command)}
          `,  // Shell 脚本
        ],
      },
      bash: {  // Bash
        args: [  // 参数
          "-c",  // 命令模式
          "-l",  // 登录模式
          `
            shopt -s expand_aliases  // 启用别名扩展
            [[ -f ~/.bashrc ]] && source ~/.bashrc >/dev/null 2>&1 || true
            eval ${JSON.stringify(input.command)}
          `,  // Shell 脚本
        ],
      },
      // Windows cmd
      // Windows 命令提示符
      cmd: {
        args: ["/c", input.command],  // 参数
      },
      // Windows PowerShell
      // Windows PowerShell
      powershell: {
        args: ["-NoProfile", "-Command", input.command],  // 参数
      },
      pwsh: {  // PowerShell Core
        args: ["-NoProfile", "-Command", input.command],  // 参数
      },
      // Fallback: any shell that doesn't match those above
      // 回退：任何不匹配上述内容的 Shell
      //  - No -l, for max compatibility
      //  - 无 -l，以获得最大兼容性
      "": {
        args: ["-c", `${input.command}`],  // 参数
      },
    }

    const matchingInvocation = invocations[shellName] ?? invocations[""]  // 匹配的调用配置
    const args = matchingInvocation?.args  // 参数

    const proc = spawn(shell, args, {  // 生成子进程
      cwd: Instance.directory,  // 工作目录
      detached: process.platform !== "win32",  // 是否分离（非 Windows）
      stdio: ["ignore", "pipe", "pipe"],  // 标准输入输出
      env: {  // 环境变量
        ...process.env,  // 继承现有环境变量
        TERM: "dumb",  // 终端类型
      },
    })

    let output = ""  // 输出文本

    proc.stdout?.on("data", (chunk) => {  // 标准输出处理
      output += chunk.toString()  // 追加输出
      if (part.state.status === "running") {  // 如果正在运行
        part.state.metadata = {  // 更新元数据
          output: output,  // 输出文本
          description: "",  // 描述
        }
        Session.updatePart(part)  // 更新部分
      }
    })

    proc.stderr?.on("data", (chunk) => {  // 标准错误处理
      output += chunk.toString()  // 追加输出
      if (part.state.status === "running") {  // 如果正在运行
        part.state.metadata = {  // 更新元数据
          output: output,  // 输出文本
          description: "",  // 描述
        }
        Session.updatePart(part)  // 更新部分
      }
    })

    let aborted = false  // 是否中止
    let exited = false  // 是否退出

    const kill = () => Shell.killTree(proc, { exited: () => exited })  // 杀死进程树
    if (abort.aborted) {  // 如果已中止
      aborted = true  // 设置中止标志
      await kill()  // 杀死进程
    }

    const abortHandler = () => {  // 中止处理函数
      aborted = true  // 设置中止标志
      void kill()  // 杀死进程
    }

    abort.addEventListener("abort", abortHandler, { once: true })  // 添加中止事件监听器

    await new Promise<void>((resolve) => {  // 等待进程退出
      proc.on("close", () => {  // 进程关闭事件
        exited = true  // 设置退出标志
        abort.removeEventListener("abort", abortHandler)  // 移除中止事件监听器
        resolve()  // 解析 Promise
      })
    })

    if (aborted) {  // 如果已中止
      output += "\n\n" + ["<metadata>", "User aborted the command", "</metadata>"].join("\n")  // 添加中止信息
    }
    msg.time.completed = Date.now()  // 设置完成时间
    await Session.updateMessage(msg)  // 更新消息
    if (part.state.status === "running") {  // 如果正在运行
      part.state = {  // 更新状态
        status: "completed",  // 状态为已完成
        time: {  // 时间信息
          ...part.state.time,  // 复制现有时间
          end: Date.now(),  // 结束时间
        },
        input: part.state.input,  // 输入参数
        title: "",  // 标题
        metadata: {  // 元数据
          output,  // 输出文本
          description: "",  // 描述
        },
        output,  // 输出文本
      }
      await Session.updatePart(part)  // 更新部分
    }
    return { info: msg, parts: [part] }  // 返回带部分的消息
  }

  export const CommandInput = z.object({  // 命令输入类型
    messageID: Identifier.schema("message").optional(),  // 消息 ID（可选）
    sessionID: Identifier.schema("session"),  // 会话 ID
    agent: z.string().optional(),  // 智能体（可选）
    model: z.string().optional(),  // 模型（可选）
    arguments: z.string(),  // 参数
    command: z.string(),  // 命令
    variant: z.string().optional(),  // 变体（可选）
  })
  export type CommandInput = z.infer<typeof CommandInput>  // 命令输入类型
  const bashRegex = /!`([^`]+)`/g  // Bash 正则表达式
  const argsRegex = /(?:[^\s"']+|"[^"]*"|'[^']*')+/g  // 参数正则表达式
  const placeholderRegex = /\$(\d+)/g  // 占位符正则表达式
  const quoteTrimRegex = /^["']|["']$/g  // 引号修剪正则表达式
  /**
   * Regular expression to match @ file references in text
   * Matches @ followed by file paths, excluding commas, periods at end of sentences, and backticks
   * Does not match when preceded by word characters or backticks (to avoid email addresses and quoted references)
   */
  /**
   * 匹配文本中 @ 文件引用的正则表达式
   * 匹配 @ 后跟文件路径，排除逗号、句末的句号和反引号
   * 不匹配前面有单词字符或反引号的情况（以避免电子邮件地址和引用）
   */

  export async function command(input: CommandInput) {  // 命令函数
    log.info("command", input)  // 记录命令日志
    const command = await Command.get(input.command)  // 获取命令
    const agentName = command.agent ?? input.agent ?? (await Agent.defaultAgent())  // 智能体名称

    const raw = input.arguments.match(argsRegex) ?? []  // 匹配参数
    const args = raw.map((arg) => arg.replace(quoteTrimRegex, ""))  // 修剪引号

    const templateCommand = await command.template  // 模板命令

    const placeholders = templateCommand.match(placeholderRegex) ?? []  // 匹配占位符
    let last = 0  // 最后占位符位置
    for (const item of placeholders) {  // 遍历占位符
      const value = Number(item.slice(1))  // 占位符值
      if (value > last) last = value  // 更新最后位置
    }

    // Let's final placeholder swallow any extra arguments so prompts read naturally
    // 让最后一个占位符吞掉所有额外参数，以便提示词自然读取
    const withArgs = templateCommand.replaceAll(placeholderRegex, (_, index) => {  // 替换占位符
      const position = Number(index)  // 占位符位置
      const argIndex = position - 1  // 参数索引
      if (argIndex >= args.length) return ""  // 如果参数索引超出范围，返回空字符串
      if (position === last) return args.slice(argIndex).join(" ")  // 如果是最后占位符，返回剩余参数
      return args[argIndex]  // 返回对应参数
    })
    let template = withArgs.replaceAll("$ARGUMENTS", input.arguments)  // 替换参数占位符

    const shell = ConfigMarkdown.shell(template)  // 获取 Shell 命令
    if (shell.length > 0) {  // 如果有 Shell 命令
      const results = await Promise.all(  // 并行执行所有 Shell 命令
        shell.map(async ([, cmd]) => {  // 映射 Shell 命令
          try {  // 尝试执行
            return await $`${{ raw: cmd }}`.quiet().nothrow().text()  // 执行命令
          } catch (error) {  // 捕获错误
            return `Error executing command: ${error instanceof Error ? error.message : String(error)}`  // 返回错误信息
          }
        }),
      )
      let index = 0  // 结果索引
      template = template.replace(bashRegex, () => results[index++])  // 替换 Bash 命令
    }
    template = template.trim()  // 修剪模板

    const model = await (async () => {  // 获取模型
      if (command.model) {  // 如果命令有模型
        return Provider.parseModel(command.model)  // 解析模型
      }
      if (command.agent) {  // 如果命令有智能体
        const cmdAgent = await Agent.get(command.agent)