import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js"
import type {
  OAuthClientInformation,
  OAuthClientInformationFull,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js"
import { Log } from "../util/log"
import { McpAuth } from "./auth"

const log = Log.create({ service: "mcp.oauth" }) // 创建OAuth服务日志记录器

const OAUTH_CALLBACK_PORT = 19876 // OAuth回调服务器端口号
const OAUTH_CALLBACK_PATH = "/mcp/oauth/callback" // OAuth回调路径

// MCP OAuth配置接口
export interface McpOAuthConfig {
  clientId?: string // OAuth客户端ID(可选,用于预注册的客户端)
  clientSecret?: string // OAuth客户端密钥(可选)
  scope?: string // OAuth授权范围(可选)
}

// MCP OAuth回调接口
export interface McpOAuthCallbacks {
  onRedirect: (url: URL) => void | Promise<void> // 重定向到授权URL时的回调函数
}

// MCP OAuth提供者类,实现OAuthClientProvider接口
// 负责管理MCP服务器的OAuth认证流程,包括客户端注册、令牌管理等
export class McpOAuthProvider implements OAuthClientProvider {
  // 构造函数,初始化OAuth提供者
  constructor(
    private mcpName: string, // MCP服务器名称
    private serverUrl: string, // MCP服务器URL
    private config: McpOAuthConfig, // OAuth配置
    private callbacks: McpOAuthCallbacks, // OAuth回调函数
  ) {}

  // 获取OAuth回调URL
  get redirectUrl(): string {
    return `http://127.0.0.1:${OAUTH_CALLBACK_PORT}${OAUTH_CALLBACK_PATH}`
  }

  // 获取OAuth客户端元数据
  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [this.redirectUrl], // 重定向URI列表
      client_name: "OpenCode", // 客户端名称
      client_uri: "https://opencode.ai", // 客户端URI
      grant_types: ["authorization_code", "refresh_token"], // 授权类型
      response_types: ["code"], // 响应类型
      token_endpoint_auth_method: this.config.clientSecret ? "client_secret_post" : "none", // 令牌端点认证方法
    }
  }

  // 获取OAuth客户端信息
  // 优先使用配置中的预注册客户端,其次使用动态注册的客户端信息
  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    // 首先检查配置(预注册的客户端)
    if (this.config.clientId) {
      return {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }
    }

    // 检查存储的客户端信息(来自动态注册)
    // 使用 getForUrl 来验证凭据是否属于当前服务器URL
    const entry = await McpAuth.getForUrl(this.mcpName, this.serverUrl)
    if (entry?.clientInfo) {
      // 检查客户端密钥是否已过期
      if (entry.clientInfo.clientSecretExpiresAt && entry.clientInfo.clientSecretExpiresAt < Date.now() / 1000) {
        log.info("客户端密钥已过期,需要重新注册", { mcpName: this.mcpName })
        return undefined
      }
      return {
        client_id: entry.clientInfo.clientId,
        client_secret: entry.clientInfo.clientSecret,
      }
    }

    // 没有客户端信息或URL已更改 - 将触发动态注册
    return undefined
  }

  // 保存动态注册的客户端信息
  async saveClientInformation(info: OAuthClientInformationFull): Promise<void> {
    await McpAuth.updateClientInfo(
      this.mcpName,
      {
        clientId: info.client_id,
        clientSecret: info.client_secret,
        clientIdIssuedAt: info.client_id_issued_at,
        clientSecretExpiresAt: info.client_secret_expires_at,
      },
      this.serverUrl,
    )
    log.info("已保存动态注册的客户端", {
      mcpName: this.mcpName,
      clientId: info.client_id,
    })
  }

  // 获取OAuth令牌
  async tokens(): Promise<OAuthTokens | undefined> {
    // 使用 getForUrl 来验证令牌是否属于当前服务器URL
    const entry = await McpAuth.getForUrl(this.mcpName, this.serverUrl)
    if (!entry?.tokens) return undefined

    return {
      access_token: entry.tokens.accessToken, // 访问令牌
      token_type: "Bearer", // 令牌类型
      refresh_token: entry.tokens.refreshToken, // 刷新令牌
      expires_in: entry.tokens.expiresAt // 令牌过期时间(秒)
        ? Math.max(0, Math.floor(entry.tokens.expiresAt - Date.now() / 1000))
        : undefined,
      scope: entry.tokens.scope, // 授权范围
    }
  }

  // 保存OAuth令牌
  async saveTokens(tokens: OAuthTokens): Promise<void> {
    await McpAuth.updateTokens(
      this.mcpName,
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_in ? Date.now() / 1000 + tokens.expires_in : undefined,
        scope: tokens.scope,
      },
      this.serverUrl,
    )
    log.info("已保存OAuth令牌", { mcpName: this.mcpName })
  }

  // 重定向到授权页面
  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    log.info("重定向到授权页面", { mcpName: this.mcpName, url: authorizationUrl.toString() })
    await this.callbacks.onRedirect(authorizationUrl)
  }

  // 保存代码验证器(用于PKCE流程)
  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    await McpAuth.updateCodeVerifier(this.mcpName, codeVerifier)
  }

  // 获取代码验证器
  async codeVerifier(): Promise<string> {
    const entry = await McpAuth.get(this.mcpName)
    if (!entry?.codeVerifier) {
      throw new Error(`未为MCP服务器保存代码验证器: ${this.mcpName}`)
    }
    return entry.codeVerifier
  }

  // 保存OAuth状态参数(用于CSRF防护)
  async saveState(state: string): Promise<void> {
    await McpAuth.updateOAuthState(this.mcpName, state)
  }

  // 获取OAuth状态参数
  async state(): Promise<string> {
    const entry = await McpAuth.get(this.mcpName)
    if (!entry?.oauthState) {
      throw new Error(`未为MCP服务器保存OAuth状态: ${this.mcpName}`)
    }
    return entry.oauthState
  }
}

// 导出OAuth回调配置常量
export { OAUTH_CALLBACK_PATH, OAUTH_CALLBACK_PORT }

