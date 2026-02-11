/**
 * ACP (Agent Client Protocol) 类型定义
 * 包含 ACP 会话状态和配置的类型接口
 */
import type { McpServer } from "@agentclientprotocol/sdk"
import type { OpencodeClient } from "@opencode-ai/sdk/v2"

/**
 * ACP 会话状态接口
 * 描述 ACP 会话的状态信息
 */
export interface ACPSessionState {
  id: string                       // 会话 ID
  cwd: string                      // 工作目录
  mcpServers: McpServer[]          // MCP 服务器列表
  createdAt: Date                  // 会话创建时间
  model?: {                        // 可选的模型配置
    providerID: string             // 模型提供商 ID
    modelID: string                 // 模型 ID
  }
  modeId?: string                   // 可选的模式 ID
}

/**
 * ACP 配置接口
 * 描述 ACP 智能体的配置信息
 */
export interface ACPConfig {
  sdk: OpencodeClient                         // Opencode 客户端 SDK
  defaultModel?: {                             // 可选的默认模型配置
    providerID: string                          // 默认模型提供商 ID
    modelID: string                             // 默认模型 ID
  }
}
