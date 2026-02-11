import { Agent } from "@/agent/agent" // 导入代理类
import { Bus } from "@/bus" // 导入总线工具
import { BusEvent } from "@/bus/bus-event" // 导入总线事件类型
import { Config } from "@/config/config" // 导入配置管理器
import { Plugin } from "@/plugin" // 导入插件管理器
import { fn } from "@/util/fn" // 导入函数工具
import z from "zod" // 导入 Zod 数据验证库
import { Session } from "." // 导入会话模块
import { Identifier } from "../id/id" // 导入标识符工具
import { Instance } from "../project/instance" // 导入实例类
import { Provider } from "../provider/provider" // 导入提供商类
import { Log } from "../util/log" // 导入日志工具
import { Token } from "../util/token" // 导入 Token 工具
import { MessageV2 } from "./message-v2" // 导入消息类
import { SessionProcessor } from "./processor" // 导入会话处理器
import { SessionPrompt } from "./prompt" // 导入会话提示词模块

export namespace SessionCompaction {
  const log = Log.create({ service: "session.compaction" }) // 创建会话压缩的日志记录器

  export const Event = {
    Compacted: BusEvent.define(
      // 定义会话压缩完成事件
      "session.compacted",
      z.object({
        sessionID: z.string(), // 会话 ID
      }),
    ),
  }

  export async function isOverflow(input: { tokens: MessageV2.Assistant["tokens"]; model: Provider.Model }) {
    const config = await Config.get() // 获取配置
    if (config.compaction?.auto === false) return false // 如果禁用自动压缩，返回 false
    const context = input.model.limit.context // 获取模型的上下文限制
    if (context === 0) return false // 如果上下文限制为 0，返回 false
    const count = input.tokens.input + input.tokens.cache.read + input.tokens.output // 计算总 token 数
    const output = Math.min(input.model.limit.output, SessionPrompt.OUTPUT_TOKEN_MAX) || SessionPrompt.OUTPUT_TOKEN_MAX // 计算 output token 数
    const usable = context - output // 计算可用的 token 数
    return count > usable // 判断是否溢出
  }

  export const PRUNE_MINIMUM = 20_000 // 最小修剪 token 数
  export const PRUNE_PROTECT = 40_000 // 修剪保护 token 数

  const PRUNE_PROTECTED_TOOLS = ["skill"] // 受保护的工具列表

  // 向后遍历消息部分，直到有 40_000 个 token 的工具调用。然后删除之前工具调用的输出。
  // 目标是丢弃不再相关的旧工具调用。
  export async function prune(input: { sessionID: string }) {
    const config = await Config.get() // 获取配置
    if (config.compaction?.prune === false) return // 如果禁用修剪，直接返回
    log.info("pruning") // 记录开始修剪
    const msgs = await Session.messages({ sessionID: input.sessionID }) // 获取会话的所有消息
    let total = 0 // 总 token 数
    let pruned = 0 // 已修剪的 token 数
    const toPrune = [] // 待修剪的消息部分列表
    let turns = 0 // 回合数

    loop: for (let msgIndex = msgs.length - 1; msgIndex >= 0; msgIndex--) {
      // 向后遍历消息
      const msg = msgs[msgIndex] // 获取当前消息
      if (msg.info.role === "user") turns++ // 如果是用户消息，回合数加 1
      if (turns < 2) continue // 如果回合数小于 2，跳过
      if (msg.info.role === "assistant" && msg.info.summary) break loop // 如果是助手消息且有摘要，停止循环
      for (let partIndex = msg.parts.length - 1; partIndex >= 0; partIndex--) {
        // 向后遍历消息部分
        const part = msg.parts[partIndex] // 获取当前消息部分
        if (part.type === "tool")
          if (part.state.status === "completed") {
            // 如果是工具类型
            // 如果工具调用已完成
            if (PRUNE_PROTECTED_TOOLS.includes(part.tool)) continue // 如果是受保护工具，跳过

            if (part.state.time.compacted) break loop // 如果已经压缩过，停止循环
            const estimate = Token.estimate(part.state.output) // 估算 token 数
            total += estimate // 累加总 token 数
            if (total > PRUNE_PROTECT) {
              // 如果总 token 数超过保护阈值
              pruned += estimate // 累加已修剪的 token 数
              toPrune.push(part) // 添加到待修剪列表
            }
          }
      }
    }
    log.info("found", { pruned, total }) // 记录找到的修剪信息
    if (pruned > PRUNE_MINIMUM) {
      // 如果修剪的 token 数超过最小阈值
      for (const part of toPrune) {
        // 遍历待修剪的消息部分
        if (part.state.status === "completed") {
          // 如果工具调用已完成
          part.state.time.compacted = Date.now() // 记录压缩时间
          await Session.updatePart(part) // 更新消息部分
        }
      }
      log.info("pruned", { count: toPrune.length }) // 记录修剪完成
    }
  }

  export async function process(input: {
    parentID: string
    messages: MessageV2.WithParts[]
    sessionID: string
    abort: AbortSignal
    auto: boolean
  }) {
    const userMessage = input.messages.findLast((m) => m.info.id === input.parentID)!.info as MessageV2.User // 获取用户消息
    const agent = await Agent.get("compaction") // 获取压缩代理
    const model = agent.model // 获取模型
      ? await Provider.getModel(agent.model.providerID, agent.model.modelID) // 使用代理的模型
      : await Provider.getModel(userMessage.model.providerID, userMessage.model.modelID) // 使用用户消息的模型
    const msg = (await Session.updateMessage({
      // 创建助手消息
      id: Identifier.ascending("message"), // 生成消息 ID
      role: "assistant", // 设置角色为助手
      parentID: input.parentID, // 设置父消息 ID
      sessionID: input.sessionID, // 设置会话 ID
      mode: "compaction", // 设置模式为压缩
      agent: "compaction", // 设置代理为压缩
      summary: true, // 标记为摘要
      path: {
        cwd: Instance.directory, // 当前工作目录
        root: Instance.worktree, // 工作树根目录
      },
      cost: 0, // 成本为 0
      tokens: {
        output: 0, // 输出 token 数
        input: 0, // 输入 token 数
        reasoning: 0, // 推理 token 数
        cache: { read: 0, write: 0 }, // 缓存 token 数
      },
      modelID: model.id, // 模型 ID
      providerID: model.providerID, // 提供商 ID
      time: {
        created: Date.now(), // 创建时间
      },
    })) as MessageV2.Assistant
    const processor = SessionProcessor.create({
      // 创建会话处理器
      assistantMessage: msg, // 助手消息
      sessionID: input.sessionID, // 会话 ID
      model, // 模型
      abort: input.abort, // 中止信号
    })
    // 允许插件注入上下文或替换压缩提示词
    const compacting = await Plugin.trigger(
      // 触发插件事件
      "experimental.session.compacting", // 事件名称
      { sessionID: input.sessionID }, // 事件数据
      { context: [], prompt: undefined }, // 默认值
    )
    const defaultPrompt =
      "提供详细的提示词以继续我们的对话。重点关注对继续对话有帮助的信息，包括我们做了什么、我们在做什么、我们正在处理哪些文件，以及考虑到新会话将无法访问我们的对话，我们接下来要做什么。" // 默认提示词
    const promptText = compacting.prompt ?? [defaultPrompt, ...compacting.context].join("\n\n") // 构建提示词文本
    const result = await processor.process({
      // 处理消息
      user: userMessage, // 用户消息
      agent, // 代理
      abort: input.abort, // 中止信号
      sessionID: input.sessionID, // 会话 ID
      tools: {}, // 工具列表
      system: [], // 系统消息
      messages: [
        // 消息列表
        ...MessageV2.toModelMessage(input.messages), // 转换为模型消息
        {
          role: "user", // 用户角色
          content: [
            // 内容
            {
              type: "text", // 文本类型
              text: promptText, // 提示词文本
            },
          ],
        },
      ],
      model, // 模型
    })

    if (result === "continue" && input.auto) {
      // 如果结果是继续且是自动模式
      const continueMsg = await Session.updateMessage({
        // 创建继续消息
        id: Identifier.ascending("message"), // 生成消息 ID
        role: "user", // 设置角色为用户
        sessionID: input.sessionID, // 设置会话 ID
        time: {
          created: Date.now(), // 创建时间
        },
        agent: userMessage.agent, // 代理
        model: userMessage.model, // 模型
      })
      await Session.updatePart({
        // 更新消息部分
        id: Identifier.ascending("part"), // 生成部分 ID
        messageID: continueMsg.id, // 消息 ID
        sessionID: input.sessionID, // 会话 ID
        type: "text", // 类型为文本
        synthetic: true, // 标记为合成消息
        text: "如果还有后续步骤，请继续", // 文本内容
        time: {
          start: Date.now(), // 开始时间
          end: Date.now(), // 结束时间
        },
      })
    }
    if (processor.message.error) return "stop" // 如果有错误，返回停止
    Bus.publish(Event.Compacted, { sessionID: input.sessionID }) // 发布压缩完成事件
    return "continue" // 返回继续
  }

  export const create = fn(
    // 创建会话压缩的函数
    z.object({
      sessionID: Identifier.schema("session"), // 会话 ID
      agent: z.string(), // 代理
      model: z.object({
        providerID: z.string(), // 提供商 ID
        modelID: z.string(), // 模型 ID
      }),
      auto: z.boolean(), // 自动模式
    }),
    async (input) => {
      const msg = await Session.updateMessage({
        // 创建消息
        id: Identifier.ascending("message"), // 生成消息 ID
        role: "user", // 设置角色为用户
        model: input.model, // 模型
        sessionID: input.sessionID, // 会话 ID
        agent: input.agent, // 代理
        time: {
          created: Date.now(), // 创建时间
        },
      })
      await Session.updatePart({
        // 更新消息部分
        id: Identifier.ascending("part"), // 生成部分 ID
        messageID: msg.id, // 消息 ID
        sessionID: msg.sessionID, // 会话 ID
        type: "compaction", // 类型为压缩
        auto: input.auto, // 自动模式
      })
    },
  )
}
