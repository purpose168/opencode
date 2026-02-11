import type { LanguageModelV2FinishReason } from "@ai-sdk/provider"

/**
 * 映射OpenAI响应的完成原因
 * 将OpenAI API返回的完成原因转换为标准的LanguageModelV2FinishReason格式
 * 
 * @param finishReason - OpenAI API返回的完成原因字符串,可能为null或undefined
 * @param hasFunctionCall - 是否存在客户端工具调用的标志(非OpenAI执行的工具调用)
 * @returns 标准化的完成原因类型
 */
export function mapOpenAIResponseFinishReason({
  finishReason, // OpenAI API返回的完成原因
  hasFunctionCall, // 检查是否存在客户端工具调用的标志(非OpenAI执行的工具调用)
}: {
  finishReason: string | null | undefined // 完成原因:字符串、null或undefined
  // 检查是否存在客户端工具调用的标志(非OpenAI执行的工具调用)
  hasFunctionCall: boolean // 是否存在函数调用
}): LanguageModelV2FinishReason {
  // 返回语言模型V2完成原因类型
  switch (
    finishReason // 根据完成原因进行分支处理
  ) {
    case undefined: // 未定义
    case null: // 为null
      return hasFunctionCall ? "tool-calls" : "stop" // 如果存在函数调用则返回tool-calls,否则返回stop
    case "max_output_tokens": // 达到最大输出令牌数
      return "length" // 返回length表示因长度限制而停止
    case "content_filter": // 内容过滤
      return "content-filter" // 返回content-filter表示因内容过滤而停止
    default: // 默认情况
      return hasFunctionCall ? "tool-calls" : "unknown" // 如果存在函数调用则返回tool-calls,否则返回unknown
  }
}
