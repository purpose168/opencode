import { Agent } from "@/agent/agent" // 导入智能体模块
import { Bus } from "@/bus" // 导入总线模块
import { Config } from "@/config/config" // 导入配置模块
import { Identifier } from "@/id/id" // 导入标识符工具
import { PermissionNext } from "@/permission/next" // 导入权限模块
import { Plugin } from "@/plugin" // 导入插件模块
import type { Provider } from "@/provider/provider" // 导入提供商类型
import { Snapshot } from "@/snapshot" // 导入快照模块
import { Log } from "@/util/log" // 导入日志工具
import { Session } from "." // 导入会话模块
import { SessionCompaction } from "./compaction" // 导入会话压缩模块
import { LLM } from "./llm" // 导入 LLM 模块
import { MessageV2 } from "./message-v2" // 导入消息 V2 模块
import { SessionRetry } from "./retry" // 导入会话重试模块
import { SessionStatus } from "./status" // 导入会话状态模块
import { SessionSummary } from "./summary" // 导入会话摘要模块

export namespace SessionProcessor {
  const DOOM_LOOP_THRESHOLD = 3 // 死循环检测阈值
  const log = Log.create({ service: "session.processor" }) // 创建日志实例

  export type Info = Awaited<ReturnType<typeof create>> // 处理器信息类型
  export type Result = Awaited<ReturnType<Info["process"]>> // 处理结果类型

  export function create(input: {
    // 创建会话处理器
    assistantMessage: MessageV2.Assistant // 助手消息
    sessionID: string // 会话 ID
    model: Provider.Model // 模型
    abort: AbortSignal // 中止信号
  }) {
    const toolcalls: Record<string, MessageV2.ToolPart> = {} // 工具调用记录
    let snapshot: string | undefined // 快照
    let blocked = false // 是否被阻止
    let attempt = 0 // 尝试次数
    let needsCompaction = false // 是否需要压缩

    const result = {
      get message() {
        // 获取消息
        return input.assistantMessage
      },
      partFromToolCall(toolCallID: string) {
        // 根据工具调用 ID 获取部分
        return toolcalls[toolCallID]
      },
      async process(streamInput: LLM.StreamInput) {
        // 处理流式输入
        log.info("process") // 记录处理日志
        needsCompaction = false // 重置压缩标志
        const shouldBreak = (await Config.get()).experimental?.continue_loop_on_deny !== true // 是否在拒绝时中断循环
        while (true) {
          // 主循环
          try {
            let currentText: MessageV2.TextPart | undefined // 当前文本部分
            let reasoningMap: Record<string, MessageV2.ReasoningPart> = {} // 推理部分映射
            const stream = await LLM.stream(streamInput) // 获取 LLM 流

            for await (const value of stream.fullStream) {
              // 遍历流
              input.abort.throwIfAborted() // 检查是否中止
              switch (value.type) {
                case "start": // 开始
                  SessionStatus.set(input.sessionID, { type: "busy" }) // 设置会话状态为忙碌
                  break

                case "reasoning-start": // 推理开始
                  if (value.id in reasoningMap) {
                    // 如果已存在
                    continue
                  }
                  reasoningMap[value.id] = {
                    // 创建推理部分
                    id: Identifier.ascending("part"), // 生成部分 ID
                    messageID: input.assistantMessage.id, // 消息 ID
                    sessionID: input.assistantMessage.sessionID, // 会话 ID
                    type: "reasoning", // 类型为推理
                    text: "", // 推理文本
                    time: {
                      // 时间信息
                      start: Date.now(), // 开始时间
                    },
                    metadata: value.providerMetadata, // 提供商元数据
                  }
                  break

                case "reasoning-delta": // 推理增量
                  if (value.id in reasoningMap) {
                    // 如果存在
                    const part = reasoningMap[value.id] // 获取推理部分
                    part.text += value.text // 追加文本
                    if (value.providerMetadata) part.metadata = value.providerMetadata // 更新元数据
                    if (part.text) await Session.updatePart({ part, delta: value.text }) // 更新部分
                  }
                  break

                case "reasoning-end": // 推理结束
                  if (value.id in reasoningMap) {
                    // 如果存在
                    const part = reasoningMap[value.id] // 获取推理部分
                    part.text = part.text.trimEnd() // 去除尾部空格

                    part.time = {
                      // 更新时间
                      ...part.time,
                      end: Date.now(), // 结束时间
                    }
                    if (value.providerMetadata) part.metadata = value.providerMetadata // 更新元数据
                    await Session.updatePart(part) // 更新部分
                    delete reasoningMap[value.id] // 删除映射
                  }
                  break

                case "tool-input-start": // 工具输入开始
                  const part = await Session.updatePart({
                    // 更新部分
                    id: toolcalls[value.id]?.id ?? Identifier.ascending("part"), // 使用现有 ID 或生成新 ID
                    messageID: input.assistantMessage.id, // 消息 ID
                    sessionID: input.assistantMessage.sessionID, // 会话 ID
                    type: "tool", // 类型为工具
                    tool: value.toolName, // 工具名称
                    callID: value.id, // 调用 ID
                    state: {
                      // 状态
                      status: "pending", // 状态为待处理
                      input: {}, // 输入参数
                      raw: "", // 原始数据
                    },
                  })
                  toolcalls[value.id] = part as MessageV2.ToolPart // 记录工具调用
                  break

                case "tool-input-delta": // 工具输入增量
                  break

                case "tool-input-end": // 工具输入结束
                  break

                case "tool-call": {
                  // 工具调用
                  const match = toolcalls[value.toolCallId] // 查找匹配的工具调用
                  if (match) {
                    // 如果找到
                    const part = await Session.updatePart({
                      // 更新部分
                      ...match, // 复制现有部分
                      tool: value.toolName, // 工具名称
                      state: {
                        // 状态
                        status: "running", // 状态为运行中
                        input: value.input, // 输入参数
                        time: {
                          // 时间信息
                          start: Date.now(), // 开始时间
                        },
                      },
                      metadata: value.providerMetadata, // 提供商元数据
                    })
                    toolcalls[value.toolCallId] = part as MessageV2.ToolPart // 更新工具调用记录

                    const parts = await MessageV2.parts(input.assistantMessage.id) // 获取消息部分
                    const lastThree = parts.slice(-DOOM_LOOP_THRESHOLD) // 获取最后三个部分

                    if (
                      // 检测死循环
                      lastThree.length === DOOM_LOOP_THRESHOLD && // 数量足够
                      lastThree.every(
                        // 所有部分都满足条件
                        (p) =>
                          p.type === "tool" && // 类型为工具
                          p.tool === value.toolName && // 工具名称相同
                          p.state.status !== "pending" && // 状态不是待处理
                          JSON.stringify(p.state.input) === JSON.stringify(value.input), // 输入参数相同
                      )
                    ) {
                      const agent = await Agent.get(input.assistantMessage.agent) // 获取智能体
                      await PermissionNext.ask({
                        // 询问权限
                        permission: "doom_loop", // 权限类型为死循环
                        patterns: [value.toolName], // 模式为工具名称
                        sessionID: input.assistantMessage.sessionID, // 会话 ID
                        metadata: {
                          // 元数据
                          tool: value.toolName, // 工具名称
                          input: value.input, // 输入参数
                        },
                        always: [value.toolName], // 总是询问的工具
                        ruleset: agent.permission, // 权限规则集
                      })
                    }
                  }
                  break
                }
                case "tool-result": {
                  // 工具结果
                  const match = toolcalls[value.toolCallId] // 查找匹配的工具调用
                  if (match && match.state.status === "running") {
                    // 如果找到且正在运行
                    await Session.updatePart({
                      // 更新部分
                      ...match, // 复制现有部分
                      state: {
                        // 状态
                        status: "completed", // 状态为已完成
                        input: value.input, // 输入参数
                        output: value.output.output, // 输出结果
                        metadata: value.output.metadata, // 输出元数据
                        title: value.output.title, // 标题
                        time: {
                          // 时间信息
                          start: match.state.time.start, // 开始时间
                          end: Date.now(), // 结束时间
                        },
                        attachments: value.output.attachments, // 附件
                      },
                    })

                    delete toolcalls[value.toolCallId] // 删除工具调用记录
                  }
                  break
                }

                case "tool-error": {
                  // 工具错误
                  const match = toolcalls[value.toolCallId] // 查找匹配的工具调用
                  if (match && match.state.status === "running") {
                    // 如果找到且正在运行
                    await Session.updatePart({
                      // 更新部分
                      ...match, // 复制现有部分
                      state: {
                        // 状态
                        status: "error", // 状态为错误
                        input: value.input, // 输入参数
                        error: (value.error as any).toString(), // 错误信息
                        time: {
                          // 时间信息
                          start: match.state.time.start, // 开始时间
                          end: Date.now(), // 结束时间
                        },
                      },
                    })

                    if (value.error instanceof PermissionNext.RejectedError) {
                      // 如果是拒绝错误
                      blocked = shouldBreak // 设置阻止标志
                    }
                    delete toolcalls[value.toolCallId] // 删除工具调用记录
                  }
                  break
                }
                case "error": // 错误
                  throw value.error // 抛出错误

                case "start-step": // 开始步骤
                  snapshot = await Snapshot.track() // 跟踪快照
                  await Session.updatePart({
                    // 更新部分
                    id: Identifier.ascending("part"), // 生成部分 ID
                    messageID: input.assistantMessage.id, // 消息 ID
                    sessionID: input.sessionID, // 会话 ID
                    snapshot, // 快照
                    type: "step-start", // 类型为步骤开始
                  })
                  break

                case "finish-step": // 完成步骤
                  const usage = Session.getUsage({
                    // 获取使用情况
                    model: input.model, // 模型
                    usage: value.usage, // 使用量
                    metadata: value.providerMetadata, // 提供商元数据
                  })
                  input.assistantMessage.finish = value.finishReason // 设置完成原因
                  input.assistantMessage.cost += usage.cost // 累加成本
                  input.assistantMessage.tokens = usage.tokens // 设置 token 统计
                  await Session.updatePart({
                    // 更新部分
                    id: Identifier.ascending("part"), // 生成部分 ID
                    reason: value.finishReason, // 完成原因
                    snapshot: await Snapshot.track(), // 跟踪快照
                    messageID: input.assistantMessage.id, // 消息 ID
                    sessionID: input.assistantMessage.sessionID, // 会话 ID
                    type: "step-finish", // 类型为步骤完成
                    tokens: usage.tokens, // token 统计
                    cost: usage.cost, // 成本
                  })
                  await Session.updateMessage(input.assistantMessage) // 更新消息
                  if (snapshot) {
                    // 如果有快照
                    const patch = await Snapshot.patch(snapshot) // 生成补丁
                    if (patch.files.length) {
                      // 如果有文件变更
                      await Session.updatePart({
                        // 更新部分
                        id: Identifier.ascending("part"), // 生成部分 ID
                        messageID: input.assistantMessage.id, // 消息 ID
                        sessionID: input.sessionID, // 会话 ID
                        type: "patch", // 类型为补丁
                        hash: patch.hash, // 哈希值
                        files: patch.files, // 文件列表
                      })
                    }
                    snapshot = undefined // 清除快照
                  }
                  SessionSummary.summarize({
                    // 生成摘要
                    sessionID: input.sessionID, // 会话 ID
                    messageID: input.assistantMessage.parentID, // 父消息 ID
                  })
                  if (await SessionCompaction.isOverflow({ tokens: usage.tokens, model: input.model })) {
                    // 检查是否溢出
                    needsCompaction = true // 设置压缩标志
                  }
                  break

                case "text-start": // 文本开始
                  currentText = {
                    // 创建文本部分
                    id: Identifier.ascending("part"), // 生成部分 ID
                    messageID: input.assistantMessage.id, // 消息 ID
                    sessionID: input.assistantMessage.sessionID, // 会话 ID
                    type: "text", // 类型为文本
                    text: "", // 文本内容
                    time: {
                      // 时间信息
                      start: Date.now(), // 开始时间
                    },
                    metadata: value.providerMetadata, // 提供商元数据
                  }
                  break

                case "text-delta": // 文本增量
                  if (currentText) {
                    // 如果有当前文本
                    currentText.text += value.text // 追加文本
                    if (value.providerMetadata) currentText.metadata = value.providerMetadata // 更新元数据
                    if (currentText.text)
                      // 如果有文本
                      await Session.updatePart({
                        // 更新部分
                        part: currentText, // 当前部分
                        delta: value.text, // 增量文本
                      })
                  }
                  break

                case "text-end": // 文本结束
                  if (currentText) {
                    // 如果有当前文本
                    currentText.text = currentText.text.trimEnd() // 去除尾部空格
                    const textOutput = await Plugin.trigger(
                      // 触发插件
                      "experimental.text.complete", // 事件名称
                      {
                        sessionID: input.sessionID, // 会话 ID
                        messageID: input.assistantMessage.id, // 消息 ID
                        partID: currentText.id, // 部分 ID
                      },
                      { text: currentText.text }, // 文本内容
                    )
                    currentText.text = textOutput.text // 更新文本
                    currentText.time = {
                      // 更新时间
                      start: Date.now(), // 开始时间
                      end: Date.now(), // 结束时间
                    }
                    if (value.providerMetadata) currentText.metadata = value.providerMetadata // 更新元数据
                    await Session.updatePart(currentText) // 更新部分
                  }
                  currentText = undefined // 清除当前文本
                  break

                case "finish": // 完成
                  break

                default: // 默认情况
                  log.info("unhandled", {
                    // 记录未处理的事件
                    ...value,
                  })
                  continue
              }
              if (needsCompaction) break // 如果需要压缩，中断循环
            }
          } catch (e: any) {
            // 捕获错误
            log.error("process", {
              // 记录错误
              error: e,
              stack: JSON.stringify(e.stack),
            })
            const error = MessageV2.fromError(e, { providerID: input.model.providerID }) // 转换错误
            const retry = SessionRetry.retryable(error) // 检查是否可重试
            if (retry !== undefined) {
              // 如果可重试
              attempt++ // 增加尝试次数
              const delay = SessionRetry.delay(attempt, error.name === "APIError" ? error : undefined) // 计算延迟
              SessionStatus.set(input.sessionID, {
                // 设置会话状态
                type: "retry", // 类型为重试
                attempt, // 尝试次数
                message: retry, // 重试消息
                next: Date.now() + delay, // 下次重试时间
              })
              await SessionRetry.sleep(delay, input.abort).catch(() => {}) // 等待延迟
              continue // 继续循环
            }
            input.assistantMessage.error = error // 设置错误
            Bus.publish(Session.Event.Error, {
              // 发布错误事件
              sessionID: input.assistantMessage.sessionID, // 会话 ID
              error: input.assistantMessage.error, // 错误
            })
          }
          if (snapshot) {
            // 如果有快照
            const patch = await Snapshot.patch(snapshot) // 生成补丁
            if (patch.files.length) {
              // 如果有文件变更
              await Session.updatePart({
                // 更新部分
                id: Identifier.ascending("part"), // 生成部分 ID
                messageID: input.assistantMessage.id, // 消息 ID
                sessionID: input.sessionID, // 会话 ID
                type: "patch", // 类型为补丁
                hash: patch.hash, // 哈希值
                files: patch.files, // 文件列表
              })
            }
            snapshot = undefined // 清除快照
          }
          const p = await MessageV2.parts(input.assistantMessage.id) // 获取消息部分
          for (const part of p) {
            // 遍历部分
            if (part.type === "tool" && part.state.status !== "completed" && part.state.status !== "error") {
              // 如果是工具且未完成
              await Session.updatePart({
                // 更新部分
                ...part, // 复制现有部分
                state: {
                  // 状态
                  ...part.state, // 复制现有状态
                  status: "error", // 状态为错误
                  error: "Tool execution aborted", // 错误信息
                  time: {
                    // 时间信息
                    start: Date.now(), // 开始时间
                    end: Date.now(), // 结束时间
                  },
                },
              })
            }
          }
          input.assistantMessage.time.completed = Date.now() // 设置完成时间
          await Session.updateMessage(input.assistantMessage) // 更新消息
          if (needsCompaction) return "compact" // 如果需要压缩，返回压缩
          if (blocked) return "stop" // 如果被阻止，返回停止
          if (input.assistantMessage.error) return "stop" // 如果有错误，返回停止
          return "continue" // 返回继续
        }
      },
    }
    return result
  }
}
