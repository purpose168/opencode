import fs from "fs/promises" // 文件系统Promise API
import path from "path" // 路径处理模块
import z from "zod" // 数据验证库
import { Global } from "../global" // 全局配置

export namespace McpAuth {
  // 访问令牌数据结构
  export const Tokens = z.object({
    accessToken: z.string(), // 访问令牌
    refreshToken: z.string().optional(), // 刷新令牌(可选)
    expiresAt: z.number().optional(), // 过期时间戳(可选)
    scope: z.string().optional(), // 权限范围(可选)
  })
  export type Tokens = z.infer<typeof Tokens>

  // 客户端信息数据结构
  export const ClientInfo = z.object({
    clientId: z.string(), // 客户端ID
    clientSecret: z.string().optional(), // 客户端密钥(可选)
    clientIdIssuedAt: z.number().optional(), // 客户端ID颁发时间(可选)
    clientSecretExpiresAt: z.number().optional(), // 客户端密钥过期时间(可选)
  })
  export type ClientInfo = z.infer<typeof ClientInfo>

  // 认证条目数据结构
  export const Entry = z.object({
    tokens: Tokens.optional(), // 令牌信息(可选)
    clientInfo: ClientInfo.optional(), // 客户端信息(可选)
    codeVerifier: z.string().optional(), // 代码验证器(可选)
    oauthState: z.string().optional(), // OAuth状态(可选)
    serverUrl: z.string().optional(), // 跟踪这些凭证所属的服务器URL
  })
  export type Entry = z.infer<typeof Entry>

  // 认证数据文件路径
  const filepath = path.join(Global.Path.data, "mcp-auth.json")

  // 获取指定MCP的认证条目
  export async function get(mcpName: string): Promise<Entry | undefined> {
    const data = await all()
    return data[mcpName]
  }

  /**
   * 获取认证条目并验证其是否用于正确的URL
   * 如果URL已更改则返回undefined(凭证无效)
   */
  export async function getForUrl(mcpName: string, serverUrl: string): Promise<Entry | undefined> {
    const entry = await get(mcpName)
    if (!entry) return undefined

    // 如果没有存储serverUrl,这是来自旧版本 - 认为无效
    if (!entry.serverUrl) return undefined

    // 如果URL已更改,凭证无效
    if (entry.serverUrl !== serverUrl) return undefined

    return entry
  }

  // 获取所有认证条目
  export async function all(): Promise<Record<string, Entry>> {
    const file = Bun.file(filepath)
    return file.json().catch(() => ({}))
  }

  // 设置指定MCP的认证条目
  export async function set(mcpName: string, entry: Entry, serverUrl?: string): Promise<void> {
    const file = Bun.file(filepath)
    const data = await all()
    // 如果提供了serverUrl,始终更新它
    if (serverUrl) {
      entry.serverUrl = serverUrl
    }
    await Bun.write(file, JSON.stringify({ ...data, [mcpName]: entry }, null, 2))
    await fs.chmod(file.name!, 0o600) // 设置文件权限为仅所有者可读写
  }

  // 删除指定MCP的认证条目
  export async function remove(mcpName: string): Promise<void> {
    const file = Bun.file(filepath)
    const data = await all()
    delete data[mcpName]
    await Bun.write(file, JSON.stringify(data, null, 2))
    await fs.chmod(file.name!, 0o600) // 设置文件权限为仅所有者可读写
  }

  // 更新指定MCP的令牌信息
  export async function updateTokens(mcpName: string, tokens: Tokens, serverUrl?: string): Promise<void> {
    const entry = (await get(mcpName)) ?? {}
    entry.tokens = tokens
    await set(mcpName, entry, serverUrl)
  }

  // 更新指定MCP的客户端信息
  export async function updateClientInfo(mcpName: string, clientInfo: ClientInfo, serverUrl?: string): Promise<void> {
    const entry = (await get(mcpName)) ?? {}
    entry.clientInfo = clientInfo
    await set(mcpName, entry, serverUrl)
  }

  // 更新指定MCP的代码验证器
  export async function updateCodeVerifier(mcpName: string, codeVerifier: string): Promise<void> {
    const entry = (await get(mcpName)) ?? {}
    entry.codeVerifier = codeVerifier
    await set(mcpName, entry)
  }

  // 清除指定MCP的代码验证器
  export async function clearCodeVerifier(mcpName: string): Promise<void> {
    const entry = await get(mcpName)
    if (entry) {
      delete entry.codeVerifier
      await set(mcpName, entry)
    }
  }

  // 更新指定MCP的OAuth状态
  export async function updateOAuthState(mcpName: string, oauthState: string): Promise<void> {
    const entry = (await get(mcpName)) ?? {}
    entry.oauthState = oauthState
    await set(mcpName, entry)
  }

  // 获取指定MCP的OAuth状态
  export async function getOAuthState(mcpName: string): Promise<string | undefined> {
    const entry = await get(mcpName)
    return entry?.oauthState
  }

  // 清除指定MCP的OAuth状态
  export async function clearOAuthState(mcpName: string): Promise<void> {
    const entry = await get(mcpName)
    if (entry) {
      delete entry.oauthState
      await set(mcpName, entry)
    }
  }

  /**
   * 检查存储的令牌是否已过期
   * 如果不存在令牌则返回null,如果没有过期时间或未过期则返回false,如果已过期则返回true
   */
  export async function isTokenExpired(mcpName: string): Promise<boolean | null> {
    const entry = await get(mcpName)
    if (!entry?.tokens) return null
    if (!entry.tokens.expiresAt) return false
    return entry.tokens.expiresAt < Date.now() / 1000
  }
}
