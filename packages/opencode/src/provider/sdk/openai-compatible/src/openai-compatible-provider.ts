import { OpenAICompatibleChatLanguageModel } from "@ai-sdk/openai-compatible"
import type { LanguageModelV2 } from "@ai-sdk/provider"
import { type FetchFunction, withoutTrailingSlash, withUserAgentSuffix } from "@ai-sdk/provider-utils"
import { OpenAIResponsesLanguageModel } from "./responses/openai-responses-language-model"

// 导入版本或定义版本
const VERSION = "0.1.0" // 版本号

export type OpenaiCompatibleModelId = string // OpenAI兼容模型ID类型

export interface OpenaiCompatibleProviderSettings {
  /**
   * 用于请求身份验证的API密钥
   */
  apiKey?: string // API密钥(可选)

  /**
   * OpenAI兼容API调用的基础URL
   */
  baseURL?: string // 基础URL(可选)

  /**
   * 提供者名称
   */
  name?: string // 提供者名称(可选)

  /**
   * 包含在请求中的自定义请求头
   */
  headers?: Record<string, string> // 自定义请求头(可选)

  /**
   * 自定义fetch实现
   */
  fetch?: FetchFunction // fetch函数(可选)
}

export interface OpenaiCompatibleProvider {
  (modelId: OpenaiCompatibleModelId): LanguageModelV2 // 函数调用形式
  chat(modelId: OpenaiCompatibleModelId): LanguageModelV2 // 聊天模型
  responses(modelId: OpenaiCompatibleModelId): LanguageModelV2 // 响应模型
  languageModel(modelId: OpenaiCompatibleModelId): LanguageModelV2 // 语言模型

  // embeddingModel(modelId: any): EmbeddingModelV2 // 嵌入模型(未实现)

  // imageModel(modelId: any): ImageModelV2 // 图像模型(未实现)
}

/**
 * 创建OpenAI兼容提供者实例
 *
 * @param options - 提供者配置选项
 * @returns OpenAI兼容提供者实例
 */
export function createOpenaiCompatible(options: OpenaiCompatibleProviderSettings = {}): OpenaiCompatibleProvider {
  const baseURL = withoutTrailingSlash(options.baseURL ?? "https://api.openai.com/v1") // 基础URL,去除尾部斜杠

  if (!baseURL) {
    throw new Error("baseURL是必需的") // 如果没有baseURL则抛出错误
  }

  // 合并请求头:默认值在前,然后是用户覆盖
  const headers = {
    // 默认的OpenAI兼容请求头(可以被用户覆盖)
    ...(options.apiKey && { Authorization: `Bearer ${options.apiKey}` }), // 如果有API密钥则添加授权头
    ...options.headers, // 用户自定义请求头
  }

  // 获取请求头函数,添加用户代理后缀
  const getHeaders = () => withUserAgentSuffix(headers, `ai-sdk/openai-compatible/${VERSION}`)

  // 创建聊天模型函数
  const createChatModel = (modelId: OpenaiCompatibleModelId) => {
    return new OpenAICompatibleChatLanguageModel(modelId, {
      provider: `${options.name ?? "openai-compatible"}.chat`, // 提供者名称
      headers: getHeaders, // 请求头函数
      url: ({ path }) => `${baseURL}${path}`, // URL构建函数
      fetch: options.fetch, // fetch函数
    })
  }

  // 创建响应模型函数
  const createResponsesModel = (modelId: OpenaiCompatibleModelId) => {
    return new OpenAIResponsesLanguageModel(modelId, {
      provider: `${options.name ?? "openai-compatible"}.responses`, // 提供者名称
      headers: getHeaders, // 请求头函数
      url: ({ path }) => `${baseURL}${path}`, // URL构建函数
      fetch: options.fetch, // fetch函数
    })
  }

  // 创建语言模型函数(默认为聊天模型)
  const createLanguageModel = (modelId: OpenaiCompatibleModelId) => createChatModel(modelId)

  // 提供者函数
  const provider = function (modelId: OpenaiCompatibleModelId) {
    return createChatModel(modelId) // 返回聊天模型
  }

  provider.languageModel = createLanguageModel // 语言模型方法
  provider.chat = createChatModel // 聊天模型方法
  provider.responses = createResponsesModel // 响应模型方法

  return provider as OpenaiCompatibleProvider // 返回提供者实例
}

// 默认的OpenAI兼容提供者实例
export const openaiCompatible = createOpenaiCompatible() // 创建默认提供者实例
