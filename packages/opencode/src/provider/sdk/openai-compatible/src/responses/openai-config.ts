import type { FetchFunction } from "@ai-sdk/provider-utils"

/**
 * OpenAI配置类型定义
 * 定义了与OpenAI API交互所需的配置选项
 */
export type OpenAIConfig = {
  provider: string // 提供者标识符
  url: (options: { modelId: string; path: string }) => string // URL生成函数,根据模型ID和路径构建完整的API URL
  headers: () => Record<string, string | undefined> // HTTP请求头生成函数,返回包含认证信息等请求头的对象
  fetch?: FetchFunction // 可选的自定义fetch函数,用于HTTP请求
  generateId?: () => string // 可选的ID生成函数,用于生成唯一标识符
  /**
   * 用于在Responses API中识别文件ID的文件ID前缀
   * 当未定义时,所有文件数据都被视为base64内容
   *
   * 示例:
   * - OpenAI: ['file-'] 用于类似 'file-abc123' 的ID
   * - Azure OpenAI: ['assistant-'] 用于类似 'assistant-abc123' 的ID
   */
  fileIdPrefixes?: readonly string[] // 文件ID前缀数组(可选),用于识别文件ID
}
