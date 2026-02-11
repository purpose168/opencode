import { BusEvent } from "@/bus/bus-event" // 导入总线事件类型
import { ProviderTransform } from "@/provider/transform" // 导入提供商转换工具
import { Snapshot } from "@/snapshot" // 导入快照模块
import { Storage } from "@/storage/storage" // 导入存储工具
import { fn } from "@/util/fn" // 导入函数工具
import { iife } from "@/util/iife" // 导入立即执行函数工具
import { NamedError } from "@opencode-ai/util/error" // 导入命名错误类
import { APICallError, convertToModelMessages, LoadAPIKeyError, type ModelMessage, type UIMessage } from "ai" // 导入 AI 相关类型和函数
import { type SystemError } from "bun" // 导入系统错误类型
import { STATUS_CODES } from "http" // 导入 HTTP 状态码
import z from "zod" // 导入 Zod 数据验证库
import { Identifier } from "../id/id" // 导入标识符工具
import { LSP } from "../lsp" // 导入 LSP 模块

export namespace MessageV2 {
  export const OutputLengthError = NamedError.create("MessageOutputLengthError", z.object({})) // 输出长度错误
  export const AbortedError = NamedError.create("MessageAbortedError", z.object({ message: z.string() })) // 中止错误
  export const AuthError = NamedError.create(
    // 认证错误
    "ProviderAuthError",
    z.object({
      providerID: z.string(), // 提供商 ID
      message: z.string(), // 错误消息
    }),
  )
  export const APIError = NamedError.create(
    // API 错误
    "APIError",
    z.object({
      message: z.string(), // 错误消息
      statusCode: z.number().optional(), // 状态码
      isRetryable: z.boolean(), // 是否可重试
      responseHeaders: z.record(z.string(), z.string()).optional(), // 响应头
      responseBody: z.string().optional(), // 响应体
      metadata: z.record(z.string(), z.string()).optional(), // 元数据
    }),
  )
  export type APIError = z.infer<typeof APIError.Schema> // API 错误类型

  const PartBase = z.object({
    // 消息部分基础类型
    id: z.string(), // 部分 ID
    sessionID: z.string(), // 会话 ID
    messageID: z.string(), // 消息 ID
  })

  export const SnapshotPart = PartBase.extend({
    // 快照部分
    type: z.literal("snapshot"), // 类型为快照
    snapshot: z.string(), // 快照内容
  }).meta({
    ref: "SnapshotPart", // 引用名称
  })
  export type SnapshotPart = z.infer<typeof SnapshotPart> // 快照部分类型

  export const PatchPart = PartBase.extend({
    // 补丁部分
    type: z.literal("patch"), // 类型为补丁
    hash: z.string(), // 哈希值
    files: z.string().array(), // 文件列表
  }).meta({
    ref: "PatchPart", // 引用名称
  })
  export type PatchPart = z.infer<typeof PatchPart> // 补丁部分类型

  export const TextPart = PartBase.extend({
    // 文本部分
    type: z.literal("text"), // 类型为文本
    text: z.string(), // 文本内容
    synthetic: z.boolean().optional(), // 是否为合成消息
    ignored: z.boolean().optional(), // 是否被忽略
    time: z // 时间信息
      .object({
        start: z.number(), // 开始时间
        end: z.number().optional(), // 结束时间
      })
      .optional(),
    metadata: z.record(z.string(), z.any()).optional(), // 元数据
  }).meta({
    ref: "TextPart", // 引用名称
  })
  export type TextPart = z.infer<typeof TextPart> // 文本部分类型

  export const ReasoningPart = PartBase.extend({
    // 推理部分
    type: z.literal("reasoning"), // 类型为推理
    text: z.string(), // 推理文本
    metadata: z.record(z.string(), z.any()).optional(), // 元数据
    time: z.object({
      // 时间信息
      start: z.number(), // 开始时间
      end: z.number().optional(), // 结束时间
    }),
  }).meta({
    ref: "ReasoningPart", // 引用名称
  })
  export type ReasoningPart = z.infer<typeof ReasoningPart> // 推理部分类型

  const FilePartSourceBase = z.object({
    // 文件部分来源基础类型
    text: z // 文本来源
      .object({
        value: z.string(), // 文本值
        start: z.number().int(), // 开始位置
        end: z.number().int(), // 结束位置
      })
      .meta({
        ref: "FilePartSourceText", // 引用名称
      }),
  })

  export const FileSource = FilePartSourceBase.extend({
    // 文件来源
    type: z.literal("file"), // 类型为文件
    path: z.string(), // 文件路径
  }).meta({
    ref: "FileSource", // 引用名称
  })

  export const SymbolSource = FilePartSourceBase.extend({
    // 符号来源
    type: z.literal("symbol"), // 类型为符号
    path: z.string(), // 文件路径
    range: LSP.Range, // 范围
    name: z.string(), // 符号名称
    kind: z.number().int(), // 符号类型
  }).meta({
    ref: "SymbolSource", // 引用名称
  })

  export const FilePartSource = z.discriminatedUnion("type", [FileSource, SymbolSource]).meta({
    // 文件部分来源
    ref: "FilePartSource", // 引用名称
  })

  export const FilePart = PartBase.extend({
    // 文件部分
    type: z.literal("file"), // 类型为文件
    mime: z.string(), // MIME 类型
    filename: z.string().optional(), // 文件名
    url: z.string(), // 文件 URL
    source: FilePartSource.optional(), // 来源
  }).meta({
    ref: "FilePart", // 引用名称
  })
  export type FilePart = z.infer<typeof FilePart> // 文件部分类型

  export const AgentPart = PartBase.extend({
    // 智能体部分
    type: z.literal("agent"), // 类型为智能体
    name: z.string(), // 智能体名称
    source: z // 来源
      .object({
        value: z.string(), // 文本值
        start: z.number().int(), // 开始位置
        end: z.number().int(), // 结束位置
      })
      .optional(),
  }).meta({
    ref: "AgentPart", // 引用名称
  })
  export type AgentPart = z.infer<typeof AgentPart> // 智能体部分类型

  export const CompactionPart = PartBase.extend({
    // 压缩部分
    type: z.literal("compaction"), // 类型为压缩
    auto: z.boolean(), // 是否自动
  }).meta({
    ref: "CompactionPart", // 引用名称
  })
  export type CompactionPart = z.infer<typeof CompactionPart> // 压缩部分类型

  export const SubtaskPart = PartBase.extend({
    // 子任务部分
    type: z.literal("subtask"), // 类型为子任务
    prompt: z.string(), // 提示词
    description: z.string(), // 描述
    agent: z.string(), // 智能体
    command: z.string().optional(), // 命令
  })
  export type SubtaskPart = z.infer<typeof SubtaskPart> // 子任务部分类型

  export const RetryPart = PartBase.extend({
    // 重试部分
    type: z.literal("retry"), // 类型为重试
    attempt: z.number(), // 尝试次数
    error: APIError.Schema, // 错误
    time: z.object({
      // 时间信息
      created: z.number(), // 创建时间
    }),
  }).meta({
    ref: "RetryPart", // 引用名称
  })
  export type RetryPart = z.infer<typeof RetryPart> // 重试部分类型

  export const StepStartPart = PartBase.extend({
    // 步骤开始部分
    type: z.literal("step-start"), // 类型为步骤开始
    snapshot: z.string().optional(), // 快照
  }).meta({
    ref: "StepStartPart", // 引用名称
  })
  export type StepStartPart = z.infer<typeof StepStartPart> // 步骤开始部分类型

  export const StepFinishPart = PartBase.extend({
    // 步骤完成部分
    type: z.literal("step-finish"), // 类型为步骤完成
    reason: z.string(), // 原因
    snapshot: z.string().optional(), // 快照
    cost: z.number(), // 成本
    tokens: z.object({
      // token 统计
      input: z.number(), // 输入 token
      output: z.number(), // 输出 token
      reasoning: z.number(), // 推理 token
      cache: z.object({
        // 缓存 token
        read: z.number(), // 读取 token
        write: z.number(), // 写入 token
      }),
    }),
  }).meta({
    ref: "StepFinishPart", // 引用名称
  })
  export type StepFinishPart = z.infer<typeof StepFinishPart> // 步骤完成部分类型

  export const ToolStatePending = z // 工具状态：待处理
    .object({
      status: z.literal("pending"), // 状态为待处理
      input: z.record(z.string(), z.any()), // 输入参数
      raw: z.string(), // 原始数据
    })
    .meta({
      ref: "ToolStatePending", // 引用名称
    })

  export type ToolStatePending = z.infer<typeof ToolStatePending> // 待处理状态类型

  export const ToolStateRunning = z // 工具状态：运行中
    .object({
      status: z.literal("running"), // 状态为运行中
      input: z.record(z.string(), z.any()), // 输入参数
      title: z.string().optional(), // 标题
      metadata: z.record(z.string(), z.any()).optional(), // 元数据
      time: z.object({
        // 时间信息
        start: z.number(), // 开始时间
      }),
    })
    .meta({
      ref: "ToolStateRunning", // 引用名称
    })
  export type ToolStateRunning = z.infer<typeof ToolStateRunning> // 运行中状态类型

  export const ToolStateCompleted = z // 工具状态：已完成
    .object({
      status: z.literal("completed"), // 状态为已完成
      input: z.record(z.string(), z.any()), // 输入参数
      output: z.string(), // 输出结果
      title: z.string(), // 标题
      metadata: z.record(z.string(), z.any()), // 元数据
      time: z.object({
        // 时间信息
        start: z.number(), // 开始时间
        end: z.number(), // 结束时间
        compacted: z.number().optional(), // 压缩时间
      }),
      attachments: FilePart.array().optional(), // 附件
    })
    .meta({
      ref: "ToolStateCompleted", // 引用名称
    })
  export type ToolStateCompleted = z.infer<typeof ToolStateCompleted> // 已完成状态类型

  export const ToolStateError = z // 工具状态：错误
    .object({
      status: z.literal("error"), // 状态为错误
      input: z.record(z.string(), z.any()), // 输入参数
      error: z.string(), // 错误信息
      metadata: z.record(z.string(), z.any()).optional(), // 元数据
      time: z.object({
        // 时间信息
        start: z.number(), // 开始时间
        end: z.number(), // 结束时间
      }),
    })
    .meta({
      ref: "ToolStateError", // 引用名称
    })
  export type ToolStateError = z.infer<typeof ToolStateError> // 错误状态类型

  export const ToolState = z // 工具状态
    .discriminatedUnion("status", [ToolStatePending, ToolStateRunning, ToolStateCompleted, ToolStateError]) // 根据状态区分
    .meta({
      ref: "ToolState", // 引用名称
    })

  export const ToolPart = PartBase.extend({
    // 工具部分
    type: z.literal("tool"), // 类型为工具
    callID: z.string(), // 调用 ID
    tool: z.string(), // 工具名称
    state: ToolState, // 工具状态
    metadata: z.record(z.string(), z.any()).optional(), // 元数据
  }).meta({
    ref: "ToolPart", // 引用名称
  })
  export type ToolPart = z.infer<typeof ToolPart> // 工具部分类型

  const Base = z.object({
    // 消息基础类型
    id: z.string(), // 消息 ID
    sessionID: z.string(), // 会话 ID
  })

  export const User = Base.extend({
    // 用户消息
    role: z.literal("user"), // 角色为用户
    time: z.object({
      // 时间信息
      created: z.number(), // 创建时间
    }),
    summary: z // 摘要
      .object({
        title: z.string().optional(), // 标题
        body: z.string().optional(), // 正文
        diffs: Snapshot.FileDiff.array(), // 文件差异列表
      })
      .optional(),
    agent: z.string(), // 智能体
    model: z.object({
      // 模型
      providerID: z.string(), // 提供商 ID
      modelID: z.string(), // 模型 ID
    }),
    system: z.string().optional(), // 系统提示词
    tools: z.record(z.string(), z.boolean()).optional(), // 工具配置
    variant: z.string().optional(), // 变体
  }).meta({
    ref: "UserMessage", // 引用名称
  })
  export type User = z.infer<typeof User> // 用户消息类型

  export const Part = z // 消息部分
    .discriminatedUnion("type", [
      // 根据类型区分
      TextPart, // 文本部分
      SubtaskPart, // 子任务部分
      ReasoningPart, // 推理部分
      FilePart, // 文件部分
      ToolPart, // 工具部分
      StepStartPart, // 步骤开始部分
      StepFinishPart, // 步骤完成部分
      SnapshotPart, // 快照部分
      PatchPart, // 补丁部分
      AgentPart, // 智能体部分
      RetryPart, // 重试部分
      CompactionPart, // 压缩部分
    ])
    .meta({
      ref: "Part", // 引用名称
    })
  export type Part = z.infer<typeof Part> // 消息部分类型

  export const Assistant = Base.extend({
    // 助手消息
    role: z.literal("assistant"), // 角色为助手
    time: z.object({
      // 时间信息
      created: z.number(), // 创建时间
      completed: z.number().optional(), // 完成时间
    }),
    error: z // 错误信息
      .discriminatedUnion("name", [
        // 根据名称区分
        AuthError.Schema, // 认证错误
        NamedError.Unknown.Schema, // 未知错误
        OutputLengthError.Schema, // 输出长度错误
        AbortedError.Schema, // 中止错误
        APIError.Schema, // API 错误
      ])
      .optional(),
    parentID: z.string(), // 父消息 ID
    modelID: z.string(), // 模型 ID
    providerID: z.string(), // 提供商 ID
    /**
     * @deprecated
     */
    mode: z.string(), // 模式（已弃用）
    agent: z.string(), // 智能体
    path: z.object({
      // 路径信息
      cwd: z.string(), // 当前工作目录
      root: z.string(), // 工作树根目录
    }),
    summary: z.boolean().optional(), // 是否为摘要
    cost: z.number(), // 成本
    tokens: z.object({
      // token 统计
      input: z.number(), // 输入 token
      output: z.number(), // 输出 token
      reasoning: z.number(), // 推理 token
      cache: z.object({
        // 缓存 token
        read: z.number(), // 读取 token
        write: z.number(), // 写入 token
      }),
    }),
    finish: z.string().optional(), // 完成原因
  }).meta({
    ref: "AssistantMessage", // 引用名称
  })
  export type Assistant = z.infer<typeof Assistant> // 助手消息类型

  export const Info = z.discriminatedUnion("role", [User, Assistant]).meta({
    // 消息信息
    ref: "Message", // 引用名称
  })
  export type Info = z.infer<typeof Info> // 消息信息类型

  export const Event = {
    // 消息事件
    Updated: BusEvent.define(
      // 消息更新事件
      "message.updated",
      z.object({
        info: Info, // 消息信息
      }),
    ),
    Removed: BusEvent.define(
      // 消息删除事件
      "message.removed",
      z.object({
        sessionID: z.string(), // 会话 ID
        messageID: z.string(), // 消息 ID
      }),
    ),
    PartUpdated: BusEvent.define(
      // 消息部分更新事件
      "message.part.updated",
      z.object({
        part: Part, // 消息部分
        delta: z.string().optional(), // 增量内容
      }),
    ),
    PartRemoved: BusEvent.define(
      // 消息部分删除事件
      "message.part.removed",
      z.object({
        sessionID: z.string(), // 会话 ID
        messageID: z.string(), // 消息 ID
        partID: z.string(), // 部分 ID
      }),
    ),
  }

  export const WithParts = z.object({
    // 带部分的消息
    info: Info, // 消息信息
    parts: z.array(Part), // 消息部分列表
  })
  export type WithParts = z.infer<typeof WithParts> // 带部分的消息类型

  export function toModelMessage(input: WithParts[]): ModelMessage[] {
    // 转换为模型消息
    const result: UIMessage[] = [] // 结果数组

    for (const msg of input) {
      // 遍历消息
      if (msg.parts.length === 0) continue // 如果没有部分，跳过

      if (msg.info.role === "user") {
        // 如果是用户消息
        const userMessage: UIMessage = {
          // 创建用户消息
          id: msg.info.id,
          role: "user",
          parts: [],
        }
        result.push(userMessage)
        for (const part of msg.parts) {
          // 遍历消息部分
          if (part.type === "text" && !part.ignored)
            // 如果是文本部分且未被忽略
            userMessage.parts.push({
              // 添加文本部分
              type: "text",
              text: part.text,
            })
          // text/plain and directory files are converted into text parts, ignore them
          if (part.type === "file" && part.mime !== "text/plain" && part.mime !== "application/x-directory")
            // 如果是文件部分且不是纯文本或目录
            userMessage.parts.push({
              // 添加文件部分
              type: "file",
              url: part.url,
              mediaType: part.mime,
              filename: part.filename,
            })

          if (part.type === "compaction") {
            // 如果是压缩部分
            userMessage.parts.push({
              // 添加文本部分
              type: "text",
              text: "What did we do so far?",
            })
          }
          if (part.type === "subtask") {
            // 如果是子任务部分
            userMessage.parts.push({
              // 添加文本部分
              type: "text",
              text: "The following tool was executed by the user",
            })
          }
        }
      }

      if (msg.info.role === "assistant") {
        // 如果是助手消息
        if (
          msg.info.error && // 如果有错误
          !(
            MessageV2.AbortedError.isInstance(msg.info.error) && // 且不是中止错误
            msg.parts.some((part) => part.type !== "step-start" && part.type !== "reasoning") // 且有非步骤开始和推理的部分
          )
        ) {
          continue // 跳过
        }
        const assistantMessage: UIMessage = {
          // 创建助手消息
          id: msg.info.id,
          role: "assistant",
          parts: [],
        }
        result.push(assistantMessage)
        for (const part of msg.parts) {
          // 遍历消息部分
          if (part.type === "text")
            // 如果是文本部分
            assistantMessage.parts.push({
              // 添加文本部分
              type: "text",
              text: part.text,
              providerMetadata: part.metadata,
            })
          if (part.type === "step-start")
            // 如果是步骤开始部分
            assistantMessage.parts.push({
              // 添加步骤开始部分
              type: "step-start",
            })
          if (part.type === "tool") {
            // 如果是工具部分
            if (part.state.status === "completed") {
              // 如果工具已完成
              if (part.state.attachments?.length) {
                // 如果有附件
                result.push({
                  // 添加用户消息
                  id: Identifier.ascending("message"),
                  role: "user",
                  parts: [
                    {
                      type: "text",
                      text: `Tool ${part.tool} returned an attachment:`, // 工具返回了附件
                    },
                    ...part.state.attachments.map((attachment) => ({
                      // 映射附件
                      type: "file" as const,
                      url: attachment.url,
                      mediaType: attachment.mime,
                      filename: attachment.filename,
                    })),
                  ],
                })
              }
              assistantMessage.parts.push({
                // 添加工具调用部分
                type: ("tool-" + part.tool) as `tool-${string}`,
                state: "output-available",
                toolCallId: part.callID,
                input: part.state.input,
                output: part.state.time.compacted ? "[Old tool result content cleared]" : part.state.output, // 如果已压缩，显示清除信息
                callProviderMetadata: part.metadata,
              })
            }
            if (part.state.status === "error")
              // 如果工具出错
              assistantMessage.parts.push({
                // 添加工具调用部分
                type: ("tool-" + part.tool) as `tool-${string}`,
                state: "output-error",
                toolCallId: part.callID,
                input: part.state.input,
                errorText: part.state.error,
                callProviderMetadata: part.metadata,
              })
          }
          if (part.type === "reasoning") {
            // 如果是推理部分
            assistantMessage.parts.push({
              // 添加推理部分
              type: "reasoning",
              text: part.text,
              providerMetadata: part.metadata,
            })
          }
        }
      }
    }

    return convertToModelMessages(result.filter((msg) => msg.parts.some((part) => part.type !== "step-start"))) // 转换为模型消息并过滤步骤开始部分
  }

  export const stream = fn(Identifier.schema("session"), async function* (sessionID) {
    // 流式读取消息
    const list = await Array.fromAsync(await Storage.list(["message", sessionID])) // 获取消息列表
    for (let i = list.length - 1; i >= 0; i--) {
      // 从后往前遍历
      yield await get({
        // 生成消息
        sessionID,
        messageID: list[i][2],
      })
    }
  })

  export const parts = fn(Identifier.schema("message"), async (messageID) => {
    const result = [] as MessageV2.Part[]
    for (const item of await Storage.list(["part", messageID])) {
      const read = await Storage.read<MessageV2.Part>(item)
      result.push(read)
    }
    result.sort((a, b) => (a.id > b.id ? 1 : -1)) // 按 ID 排序
    return result
  })

  export const get = fn(
    // 获取消息
    z.object({
      sessionID: Identifier.schema("session"), // 会话 ID
      messageID: Identifier.schema("message"), // 消息 ID
    }),
    async (input) => {
      return {
        // 返回带部分的消息
        info: await Storage.read<MessageV2.Info>(["message", input.sessionID, input.messageID]), // 读取消息信息
        parts: await parts(input.messageID), // 读取消息部分
      }
    },
  )

  export async function filterCompacted(stream: AsyncIterable<MessageV2.WithParts>) {
    // 过滤压缩的消息
    const result = [] as MessageV2.WithParts[] // 结果数组
    const completed = new Set<string>() // 已完成的会话 ID 集合
    for await (const msg of stream) {
      // 遍历消息流
      result.push(msg) // 添加到结果
      if (
        msg.info.role === "user" && // 如果是用户消息
        completed.has(msg.info.id) && // 且已完成
        msg.parts.some((part) => part.type === "compaction") // 且有压缩部分
      )
        break // 停止遍历
      if (msg.info.role === "assistant" && msg.info.summary && msg.info.finish) completed.add(msg.info.parentID) // 如果是助手消息且有摘要和完成原因，添加父消息 ID
    }
    result.reverse() // 反转数组
    return result
  }

  export function fromError(e: unknown, ctx: { providerID: string }) {
    // 从错误创建错误对象
    switch (true) {
      case e instanceof DOMException && e.name === "AbortError": // 如果是中止错误
        return new MessageV2.AbortedError( // 创建中止错误
          { message: e.message },
          {
            cause: e,
          },
        ).toObject()
      case MessageV2.OutputLengthError.isInstance(e): // 如果是输出长度错误
        return e
      case LoadAPIKeyError.isInstance(e): // 如果是加载 API 密钥错误
        return new MessageV2.AuthError( // 创建认证错误
          {
            providerID: ctx.providerID,
            message: e.message,
          },
          { cause: e },
        ).toObject()
      case (e as SystemError)?.code === "ECONNRESET": // 如果是连接重置错误
        return new MessageV2.APIError( // 创建 API 错误
          {
            message: "Connection reset by server", // 连接被服务器重置
            isRetryable: true, // 可重试
            metadata: {
              code: (e as SystemError).code ?? "", // 错误码
              syscall: (e as SystemError).syscall ?? "", // 系统调用
              message: (e as SystemError).message ?? "", // 错误消息
            },
          },
          { cause: e },
        ).toObject()
      case APICallError.isInstance(e): // 如果是 API 调用错误
        const message = iife(() => {
          // 立即执行函数计算错误消息
          let msg = e.message
          if (msg === "") {
            // 如果消息为空
            if (e.responseBody) return e.responseBody // 返回响应体
            if (e.statusCode) {
              // 如果有状态码
              const err = STATUS_CODES[e.statusCode] // 获取状态码描述
              if (err) return err
            }
            return "Unknown error" // 未知错误
          }
          const transformed = ProviderTransform.error(ctx.providerID, e) // 转换错误消息
          if (transformed !== msg) {
            // 如果转换成功
            return transformed
          }
          if (!e.responseBody || (e.statusCode && msg !== STATUS_CODES[e.statusCode])) {
            // 如果没有响应体或状态码不匹配
            return msg
          }

          try {
            // 尝试解析响应体
            const body = JSON.parse(e.responseBody)
            // try to extract common error message fields
            const errMsg = body.message || body.error || body.error?.message // 提取错误消息
            if (errMsg && typeof errMsg === "string") {
              // 如果找到错误消息
              return `${msg}: ${errMsg}`
            }
          } catch {}

          return `${msg}: ${e.responseBody}` // 返回错误消息和响应体
        }).trim()

        return new MessageV2.APIError( // 创建 API 错误
          {
            message,
            statusCode: e.statusCode, // 状态码
            isRetryable: e.isRetryable, // 是否可重试
            responseHeaders: e.responseHeaders, // 响应头
            responseBody: e.responseBody, // 响应体
          },
          { cause: e },
        ).toObject()
      case e instanceof Error: // 如果是普通错误
        return new NamedError.Unknown({ message: e.toString() }, { cause: e }).toObject() // 创建未知错误
      default: // 其他情况
        return new NamedError.Unknown({ message: JSON.stringify(e) }, { cause: e }).toObject() // 创建未知错误
    }
  }
}
