import { NamedError } from "@opencode-ai/util/error" // 导入命名错误类
import z from "zod" // 导入 Zod 数据验证库

export namespace Message {
  export const OutputLengthError = NamedError.create("MessageOutputLengthError", z.object({})) // 输出长度错误
  export const AuthError = NamedError.create(
    // 认证错误
    "ProviderAuthError",
    z.object({
      providerID: z.string(), // 提供商 ID
      message: z.string(), // 错误消息
    }),
  )

  export const ToolCall = z // 工具调用
    .object({
      state: z.literal("call"), // 状态为调用
      step: z.number().optional(), // 步骤号
      toolCallId: z.string(), // 工具调用 ID
      toolName: z.string(), // 工具名称
      args: z.custom<Required<unknown>>(), // 调用参数
    })
    .meta({
      ref: "ToolCall", // 引用名称
    })
  export type ToolCall = z.infer<typeof ToolCall> // 工具调用类型

  export const ToolPartialCall = z // 工具部分调用
    .object({
      state: z.literal("partial-call"), // 状态为部分调用
      step: z.number().optional(), // 步骤号
      toolCallId: z.string(), // 工具调用 ID
      toolName: z.string(), // 工具名称
      args: z.custom<Required<unknown>>(), // 调用参数
    })
    .meta({
      ref: "ToolPartialCall", // 引用名称
    })
  export type ToolPartialCall = z.infer<typeof ToolPartialCall> // 工具部分调用类型

  export const ToolResult = z // 工具结果
    .object({
      state: z.literal("result"), // 状态为结果
      step: z.number().optional(), // 步骤号
      toolCallId: z.string(), // 工具调用 ID
      toolName: z.string(), // 工具名称
      args: z.custom<Required<unknown>>(), // 调用参数
      result: z.string(), // 执行结果
    })
    .meta({
      ref: "ToolResult", // 引用名称
    })
  export type ToolResult = z.infer<typeof ToolResult> // 工具结果类型

  export const ToolInvocation = z.discriminatedUnion("state", [ToolCall, ToolPartialCall, ToolResult]).meta({
    // 工具调用（根据状态区分）
    ref: "ToolInvocation", // 引用名称
  })
  export type ToolInvocation = z.infer<typeof ToolInvocation> // 工具调用类型

  export const TextPart = z // 文本部分
    .object({
      type: z.literal("text"), // 类型为文本
      text: z.string(), // 文本内容
    })
    .meta({
      ref: "TextPart", // 引用名称
    })
  export type TextPart = z.infer<typeof TextPart> // 文本部分类型

  export const ReasoningPart = z // 推理部分
    .object({
      type: z.literal("reasoning"), // 类型为推理
      text: z.string(), // 推理文本
      providerMetadata: z.record(z.string(), z.any()).optional(), // 提供商元数据
    })
    .meta({
      ref: "ReasoningPart", // 引用名称
    })
  export type ReasoningPart = z.infer<typeof ReasoningPart> // 推理部分类型

  export const ToolInvocationPart = z // 工具调用部分
    .object({
      type: z.literal("tool-invocation"), // 类型为工具调用
      toolInvocation: ToolInvocation, // 工具调用
    })
    .meta({
      ref: "ToolInvocationPart", // 引用名称
    })
  export type ToolInvocationPart = z.infer<typeof ToolInvocationPart> // 工具调用部分类型

  export const SourceUrlPart = z // 来源 URL 部分
    .object({
      type: z.literal("source-url"), // 类型为来源 URL
      sourceId: z.string(), // 来源 ID
      url: z.string(), // URL 地址
      title: z.string().optional(), // 标题
      providerMetadata: z.record(z.string(), z.any()).optional(), // 提供商元数据
    })
    .meta({
      ref: "SourceUrlPart", // 引用名称
    })
  export type SourceUrlPart = z.infer<typeof SourceUrlPart> // 来源 URL 部分类型

  export const FilePart = z // 文件部分
    .object({
      type: z.literal("file"), // 类型为文件
      mediaType: z.string(), // 媒体类型
      filename: z.string().optional(), // 文件名
      url: z.string(), // 文件 URL
    })
    .meta({
      ref: "FilePart", // 引用名称
    })
  export type FilePart = z.infer<typeof FilePart> // 文件部分类型

  export const StepStartPart = z // 步骤开始部分
    .object({
      type: z.literal("step-start"), // 类型为步骤开始
    })
    .meta({
      ref: "StepStartPart", // 引用名称
    })
  export type StepStartPart = z.infer<typeof StepStartPart> // 步骤开始部分类型

  export const MessagePart = z // 消息部分
    .discriminatedUnion("type", [TextPart, ReasoningPart, ToolInvocationPart, SourceUrlPart, FilePart, StepStartPart]) // 根据类型区分
    .meta({
      ref: "MessagePart", // 引用名称
    })
  export type MessagePart = z.infer<typeof MessagePart> // 消息部分类型

  export const Info = z // 消息信息
    .object({
      id: z.string(), // 消息 ID
      role: z.enum(["user", "assistant"]), // 角色：用户或助手
      parts: z.array(MessagePart), // 消息部分列表
      metadata: z // 元数据
        .object({
          time: z.object({
            // 时间信息
            created: z.number(), // 创建时间
            completed: z.number().optional(), // 完成时间
          }),
          error: z // 错误信息
            .discriminatedUnion("name", [AuthError.Schema, NamedError.Unknown.Schema, OutputLengthError.Schema]) // 根据名称区分
            .optional(),
          sessionID: z.string(), // 会话 ID
          tool: z.record(
            // 工具信息
            z.string(),
            z
              .object({
                title: z.string(), // 标题
                snapshot: z.string().optional(), // 快照
                time: z.object({
                  // 时间信息
                  start: z.number(), // 开始时间
                  end: z.number(), // 结束时间
                }),
              })
              .catchall(z.any()),
          ),
          assistant: z // 助手信息
            .object({
              system: z.string().array(), // 系统提示词列表
              modelID: z.string(), // 模型 ID
              providerID: z.string(), // 提供商 ID
              path: z.object({
                // 路径信息
                cwd: z.string(), // 当前工作目录
                root: z.string(), // 工作树根目录
              }),
              cost: z.number(), // 成本
              summary: z.boolean().optional(), // 是否为摘要
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
            })
            .optional(),
          snapshot: z.string().optional(), // 快照
        })
        .meta({ ref: "MessageMetadata" }), // 引用名称
    })
    .meta({
      ref: "Message", // 引用名称
    })
  export type Info = z.infer<typeof Info> // 消息信息类型
}
