import type { Agent } from "@/agent/agent" // 导入智能体类型
import { Config } from "@/config/config" // 导入配置管理器
import { Flag } from "@/flag/flag" // 导入标志管理器
import { PermissionNext } from "@/permission/next" // 导入权限管理器
import { Plugin } from "@/plugin" // 导入插件管理器
import { Instance } from "@/project/instance" // 导入实例类
import { Provider } from "@/provider/provider" // 导入提供商类
import { ProviderTransform } from "@/provider/transform" // 导入提供商转换工具
import { Log } from "@/util/log" // 导入日志工具
import {
  extractReasoningMiddleware,
  streamText, // 导入流式文本生成函数
  wrapLanguageModel, // 导入包装语言模型函数
  type ModelMessage, // 导入模型消息类型
  type StreamTextResult, // 导入流式文本结果类型
  type Tool, // 导入工具类型
  type ToolSet, // 导入工具集类型
} from "ai"
import { clone, mergeDeep, pipe } from "remeda" // 导入工具函数
import type { MessageV2 } from "./message-v2" // 导入消息类型
import { SystemPrompt } from "./system" // 导入系统提示词模块

export namespace LLM {
  const log = Log.create({ service: "llm" }) // 创建 LLM 的日志记录器

  export const OUTPUT_TOKEN_MAX = Flag.OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX || 32_000 // 最大输出 token 数

  export type StreamInput = {
    // 流式输入类型
    user: MessageV2.User // 用户消息
    sessionID: string // 会话 ID
    model: Provider.Model // 模型
    agent: Agent.Info // 智能体信息
    system: string[] // 系统提示词
    abort: AbortSignal // 中止信号
    messages: ModelMessage[] // 消息列表
    small?: boolean // 是否使用小模型
    tools: Record<string, Tool> // 工具集合
    retries?: number // 重试次数
  }

  export type StreamOutput = StreamTextResult<ToolSet, unknown> // 流式输出类型

  export async function stream(input: StreamInput) {
    // 流式生成文本的函数
    const l = log // 创建日志记录器
      .clone()
      .tag("providerID", input.model.providerID) // 添加提供商 ID 标签
      .tag("modelID", input.model.id) // 添加模型 ID 标签
      .tag("sessionID", input.sessionID) // 添加会话 ID 标签
      .tag("small", (input.small ?? false).toString()) // 添加小模型标签
      .tag("agent", input.agent.name) // 添加智能体名称标签
    l.info("stream", {
      // 记录流式生成日志
      modelID: input.model.id,
      providerID: input.model.providerID,
    })
    const [language, cfg] = await Promise.all([Provider.getLanguage(input.model), Config.get()]) // 获取语言模型和配置

    const system = SystemPrompt.header(input.model.providerID) // 获取系统提示词头部
    system.push(
      // 添加系统提示词
      [
        // use agent prompt otherwise provider prompt
        ...(input.agent.prompt ? [input.agent.prompt] : SystemPrompt.provider(input.model)), // 使用智能体提示词或提供商提示词
        // any custom prompt passed into this call
        ...input.system, // 自定义提示词
        // any custom prompt from last user message
        ...(input.user.system ? [input.user.system] : []), // 用户消息的自定义提示词
      ]
        .filter((x) => x) // 过滤空值
        .join("\n"), // 连接成字符串
    )

    const header = system[0] // 保存头部
    const original = clone(system) // 克隆原始系统提示词
    await Plugin.trigger("experimental.chat.system.transform", {}, { system }) // 触发插件事件转换系统提示词
    if (system.length === 0) {
      // 如果系统提示词为空
      system.push(...original) // 恢复原始系统提示词
    }
    // rejoin to maintain 2-part structure for caching if header unchanged
    if (system.length > 2 && system[0] === header) {
      // 如果头部未改变且长度大于 2
      const rest = system.slice(1) // 获取剩余部分
      system.length = 0 // 清空数组
      system.push(header, rest.join("\n")) // 重新组合为两部分
    }

    const provider = await Provider.getProvider(input.model.providerID) // 获取提供商
    const small = input.small ? ProviderTransform.smallOptions(input.model) : {} // 小模型选项
    const variant = input.model.variants && input.user.variant ? input.model.variants[input.user.variant] : {} // 模型变体
    const options = pipe(
      // 合并选项
      ProviderTransform.options(input.model, input.sessionID, provider.options), // 提供商选项
      mergeDeep(small), // 小模型选项
      mergeDeep(input.model.options), // 模型选项
      mergeDeep(input.agent.options), // 智能体选项
      mergeDeep(variant), // 变体选项
    )

    const params = await Plugin.trigger(
      // 触发插件事件获取参数
      "chat.params",
      {
        sessionID: input.sessionID,
        agent: input.agent,
        model: input.model,
        provider: Provider.getProvider(input.model.providerID),
        message: input.user,
      },
      {
        temperature: input.model.capabilities.temperature // 温度参数
          ? (input.agent.temperature ?? ProviderTransform.temperature(input.model))
          : undefined,
        topP: input.agent.topP ?? ProviderTransform.topP(input.model), // topP 参数
        topK: ProviderTransform.topK(input.model), // topK 参数
        options, // 选项
      },
    )

    l.info("params", {
      // 记录参数日志
      params,
    })

    const maxOutputTokens = ProviderTransform.maxOutputTokens(
      // 计算最大输出 token 数
      input.model.api.npm,
      params.options,
      input.model.limit.output,
      OUTPUT_TOKEN_MAX,
    )

    const tools = await resolveTools(input) // 解析工具

    return streamText({
      // 流式生成文本
      onError(error) {
        // 错误处理
        l.error("stream error", {
          // 记录错误日志
          error,
        })
      },
      async experimental_repairToolCall(failed) {
        // 修复工具调用
        const lower = failed.toolCall.toolName.toLowerCase() // 转换为小写
        if (lower !== failed.toolCall.toolName && tools[lower]) {
          // 如果小写工具名存在且不同
          l.info("repairing tool call", {
            // 记录修复日志
            tool: failed.toolCall.toolName,
            repaired: lower,
          })
          return {
            // 返回修复后的工具调用
            ...failed.toolCall,
            toolName: lower,
          }
        }
        return {
          // 返回无效工具调用
          ...failed.toolCall,
          input: JSON.stringify({
            // 错误信息
            tool: failed.toolCall.toolName,
            error: failed.error.message,
          }),
          toolName: "invalid",
        }
      },
      temperature: params.temperature, // 温度参数
      topP: params.topP, // topP 参数
      topK: params.topK, // topK 参数
      providerOptions: ProviderTransform.providerOptions(input.model, params.options), // 提供商选项
      activeTools: Object.keys(tools).filter((x) => x !== "invalid"), // 激活的工具
      tools, // 工具集合
      maxOutputTokens, // 最大输出 token 数
      abortSignal: input.abort, // 中止信号
      headers: {
        // 请求头
        ...(input.model.providerID.startsWith("opencode") // 如果是 opencode 提供商
          ? {
              "x-opencode-project": Instance.project.id, // 项目 ID
              "x-opencode-session": input.sessionID, // 会话 ID
              "x-opencode-request": input.user.id, // 请求 ID
              "x-opencode-client": Flag.OPENCODE_CLIENT, // 客户端 ID
            }
          : undefined),
        ...input.model.headers, // 模型请求头
      },
      maxRetries: input.retries ?? 0, // 最大重试次数
      messages: [
        // 消息列表
        ...system.map(
          // 系统消息
          (x): ModelMessage => ({
            role: "system",
            content: x,
          }),
        ),
        ...input.messages, // 用户消息
      ],
      model: wrapLanguageModel({
        // 包装语言模型
        model: language, // 语言模型
        middleware: [
          // 中间件
          {
            async transformParams(args) {
              // 转换参数
              if (args.type === "stream") {
                // 如果是流式生成
                // @ts-expect-error
                args.params.prompt = ProviderTransform.message(args.params.prompt, input.model) // 转换消息
              }
              return args.params // 返回参数
            },
          },
          extractReasoningMiddleware({ tagName: "think", startWithReasoning: false }), // 提取推理中间件
        ],
      }),
      experimental_telemetry: { isEnabled: cfg.experimental?.openTelemetry }, // 遥测配置
    })
  }

  async function resolveTools(input: Pick<StreamInput, "tools" | "agent" | "user">) {
    // 解析工具的函数
    const disabled = PermissionNext.disabled(Object.keys(input.tools), input.agent.permission) // 获取禁用的工具
    for (const tool of Object.keys(input.tools)) {
      // 遍历工具
      if (input.user.tools?.[tool] === false || disabled.has(tool)) {
        // 如果工具被禁用
        delete input.tools[tool] // 删除工具
      }
    }
    return input.tools // 返回工具集合
  }
}
