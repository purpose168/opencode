import { Provider } from "@/provider/provider" // 导入提供商模块

import { fn } from "@/util/fn" // 导入函数工具
import z from "zod" // 导入 Zod 验证库
import { Session } from "." // 导入会话模块

import { Identifier } from "@/id/id" // 导入标识符工具
import { Snapshot } from "@/snapshot" // 导入快照管理模块
import { MessageV2 } from "./message-v2" // 导入消息 V2 模块

import { Bus } from "@/bus" // 导入事件总线
import { Instance } from "@/project/instance" // 导入实例管理模块
import { Storage } from "@/storage/storage" // 导入存储模块
import { Log } from "@/util/log" // 导入日志工具
import path from "path" // 导入路径处理模块

import { Agent } from "@/agent/agent" // 导入智能体模块
import { LLM } from "./llm" // 导入 LLM 模块

export namespace SessionSummary {
  const log = Log.create({ service: "session.summary" }) // 创建日志实例

  /**
   * 生成会话和消息摘要
   * @param input - 包含会话 ID 和消息 ID 的输入参数
   */
  export const summarize = fn(
    // 定义摘要生成函数
    z.object({
      sessionID: z.string(), // 会话 ID
      messageID: z.string(), // 消息 ID
    }),
    async (input) => {
      const all = await Session.messages({ sessionID: input.sessionID }) // 获取会话的所有消息
      await Promise.all([
        // 并行执行会话摘要和消息摘要生成
        summarizeSession({ sessionID: input.sessionID, messages: all }), // 生成会话摘要
        summarizeMessage({ messageID: input.messageID, messages: all }), // 生成消息摘要
      ])
    },
  )

  /**
   * 生成会话摘要，统计代码变更信息
   * @param input - 包含会话 ID 和消息列表的输入参数
   */
  async function summarizeSession(input: { sessionID: string; messages: MessageV2.WithParts[] }) {
    const files = new Set( // 收集所有涉及的文件
      input.messages
        .flatMap((x) => x.parts) // 展平所有消息部分
        .filter((x) => x.type === "patch") // 筛选补丁类型
        .flatMap((x) => x.files) // 展平文件列表
        .map((x) => path.relative(Instance.worktree, x)), // 转换为相对路径
    )
    const diffs = await computeDiff({ messages: input.messages }).then(
      (
        x, // 计算差异
      ) =>
        x.filter((x) => {
          return files.has(x.file) // 筛选涉及到的文件差异
        }),
    )
    await Session.update(input.sessionID, (draft) => {
      // 更新会话摘要
      draft.summary = {
        additions: diffs.reduce((sum, x) => sum + x.additions, 0), // 统计新增行数
        deletions: diffs.reduce((sum, x) => sum + x.deletions, 0), // 统计删除行数
        files: diffs.length, // 统计变更文件数
      }
    })
    await Storage.write(["session_diff", input.sessionID], diffs) // 保存差异信息
    Bus.publish(Session.Event.Diff, {
      // 发布差异事件
      sessionID: input.sessionID,
      diff: diffs,
    })
  }

  /**
   * 生成消息摘要，包括差异统计、标题和内容摘要
   * @param input - 包含消息 ID 和消息列表的输入参数
   */
  async function summarizeMessage(input: { messageID: string; messages: MessageV2.WithParts[] }) {
    const messages = input.messages.filter(
      // 筛选相关消息
      (m) => m.info.id === input.messageID || (m.info.role === "assistant" && m.info.parentID === input.messageID),
    )
    const msgWithParts = messages.find((m) => m.info.id === input.messageID)! // 获取目标消息
    const userMsg = msgWithParts.info as MessageV2.User // 转换为用户消息类型
    const diffs = await computeDiff({ messages }) // 计算差异
    userMsg.summary = {
      // 更新消息摘要
      ...userMsg.summary,
      diffs,
    }
    await Session.updateMessage(userMsg) // 更新消息

    const assistantMsg = messages.find((m) => m.info.role === "assistant")!.info as MessageV2.Assistant // 获取助手消息
    const small = // 获取小模型或默认模型
      (await Provider.getSmallModel(assistantMsg.providerID)) ??
      (await Provider.getModel(assistantMsg.providerID, assistantMsg.modelID))

    const textPart = msgWithParts.parts.find((p) => p.type === "text" && !p.synthetic) as MessageV2.TextPart // 获取非合成的文本部分
    if (textPart && !userMsg.summary?.title) {
      // 如果存在文本部分且没有标题
      const agent = await Agent.get("title") // 获取标题生成智能体
      const stream = await LLM.stream({
        // 调用 LLM 生成标题
        agent,
        user: userMsg,
        tools: {},
        model: agent.model ? await Provider.getModel(agent.model.providerID, agent.model.modelID) : small, // 使用智能体模型或小模型
        small: true,
        messages: [
          {
            role: "user" as const,
            content: `
              The following is the text to summarize:
              <text>
              ${textPart?.text ?? ""}
              </text>
            `,
          },
        ],
        abort: new AbortController().signal, // 中止信号
        sessionID: userMsg.sessionID,
        system: [],
        retries: 3, // 重试次数
      })
      const result = await stream.text // 获取生成的标题
      log.info("title", { title: result }) // 记录标题
      userMsg.summary.title = result // 设置标题
      await Session.updateMessage(userMsg) // 更新消息
    }

    if (
      // 如果存在非工具调用完成的步骤
      messages.some(
        (m) =>
          m.info.role === "assistant" && m.parts.some((p) => p.type === "step-finish" && p.reason !== "tool-calls"),
      )
    ) {
      if (diffs.length > 0) {
        // 如果存在差异
        for (const msg of messages) {
          // 遍历消息
          for (const part of msg.parts) {
            // 遍历消息部分
            if (part.type === "tool" && part.state.status === "completed") {
              // 如果是已完成的工具
              part.state.output = "[TOOL OUTPUT PRUNED]" // 清理工具输出
            }
          }
        }
        const summaryAgent = await Agent.get("summary") // 获取摘要生成智能体
        const stream = await LLM.stream({
          // 调用 LLM 生成内容摘要
          agent: summaryAgent,
          user: userMsg,
          tools: {},
          model: summaryAgent.model
            ? await Provider.getModel(summaryAgent.model.providerID, summaryAgent.model.modelID)
            : small, // 使用智能体模型或小模型
          small: true,
          messages: [
            ...MessageV2.toModelMessage(messages), // 转换为模型消息格式
            {
              role: "user" as const,
              content: `Summarize the above conversation according to your system prompts.`, // 根据系统提示词总结上述对话
            },
          ],
          abort: new AbortController().signal, // 中止信号
          sessionID: userMsg.sessionID,
          system: [],
          retries: 3, // 重试次数
        })
        const result = await stream.text // 获取生成的摘要
        if (result) {
          // 如果生成成功
          userMsg.summary.body = result // 设置内容摘要
        }
      }
      await Session.updateMessage(userMsg) // 更新消息
    }
  }

  /**
   * 获取会话差异信息
   * @param input - 包含会话 ID 和可选消息 ID 的输入参数
   * @returns Promise<Snapshot.FileDiff[]> - 文件差异列表
   */
  export const diff = fn(
    // 定义差异获取函数
    z.object({
      sessionID: Identifier.schema("session"), // 会话 ID
      messageID: Identifier.schema("message").optional(), // 消息 ID（可选）
    }),
    async (input) => {
      return Storage.read<Snapshot.FileDiff[]>(["session_diff", input.sessionID]).catch(() => []) // 读取差异信息，失败则返回空数组
    },
  )

  /**
   * 计算消息列表中的代码差异
   * @param input - 包含消息列表的输入参数
   * @returns Promise<Snapshot.FileDiff[]> - 文件差异列表
   */
  async function computeDiff(input: { messages: MessageV2.WithParts[] }) {
    let from: string | undefined // 起始快照 ID
    let to: string | undefined // 结束快照 ID

    // 扫描助手消息以找到最早的起始快照和最新的结束快照
    for (const item of input.messages) {
      if (!from) {
        // 如果还未找到起始快照
        for (const part of item.parts) {
          // 遍历消息部分
          if (part.type === "step-start" && part.snapshot) {
            // 如果是步骤开始且包含快照
            from = part.snapshot // 设置起始快照
            break
          }
        }
      }

      for (const part of item.parts) {
        // 遍历消息部分
        if (part.type === "step-finish" && part.snapshot) {
          // 如果是步骤结束且包含快照
          to = part.snapshot // 设置结束快照
          break
        }
      }
    }

    if (from && to) return Snapshot.diffFull(from, to) // 如果找到起始和结束快照，计算完整差异
    return [] // 否则返回空数组
  }
}
