import { Bus } from "@/bus" // 事件总线
import { TuiEvent } from "@/cli/cmd/tui/event" // TUI事件
import { withTimeout } from "@/util/timeout" // 超时处理
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js" // 未授权错误
import { Client } from "@modelcontextprotocol/sdk/client/index.js" // MCP客户端
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js" // SSE传输
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js" // 标准输入输出传输
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js" // HTTP传输
import {
  CallToolResultSchema,
  type Tool as MCPToolDef,
  ToolListChangedNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js" // MCP类型定义
import { NamedError } from "@opencode-ai/util/error" // 命名错误
import { dynamicTool, jsonSchema, type JSONSchema7, type Tool } from "ai" // AI SDK工具相关类型
import open from "open" // 打开浏览器
import z from "zod/v4" // 数据验证
import { BusEvent } from "../bus/bus-event" // 总线事件
import { Config } from "../config/config" // 配置管理
import { Installation } from "../installation" // 安装信息
import { Instance } from "../project/instance" // 项目实例
import { Log } from "../util/log" // 日志工具
import { McpAuth } from "./auth" // MCP认证
import { McpOAuthCallback } from "./oauth-callback" // OAuth回调
import { McpOAuthProvider } from "./oauth-provider" // OAuth提供者

export namespace MCP {
  const log = Log.create({ service: "mcp" }) // 创建MCP服务日志记录器

  // 定义MCP工具变更事件
  export const ToolsChanged = BusEvent.define(
    "mcp.tools.changed",
    z.object({
      server: z.string(),
    }),
  )

  // 定义MCP失败错误
  export const Failed = NamedError.create(
    "MCPFailed",
    z.object({
      name: z.string(),
    }),
  )

  type MCPClient = Client // MCP客户端类型别名

  // MCP状态定义
  export const Status = z
    .discriminatedUnion("status", [
      z
        .object({
          status: z.literal("connected"), // 已连接状态
        })
        .meta({
          ref: "MCPStatusConnected",
        }),
      z
        .object({
          status: z.literal("disabled"), // 已禁用状态
        })
        .meta({
          ref: "MCPStatusDisabled",
        }),
      z
        .object({
          status: z.literal("failed"), // 失败状态
          error: z.string(),
        })
        .meta({
          ref: "MCPStatusFailed",
        }),
      z
        .object({
          status: z.literal("needs_auth"), // 需要认证状态
        })
        .meta({
          ref: "MCPStatusNeedsAuth",
        }),
      z
        .object({
          status: z.literal("needs_client_registration"), // 需要客户端注册状态
          error: z.string(),
        })
        .meta({
          ref: "MCPStatusNeedsClientRegistration",
        }),
    ])
    .meta({
      ref: "MCPStatus",
    })
  export type Status = z.infer<typeof Status>

  // 为 MCP 客户端注册通知处理器
  function registerNotificationHandlers(client: MCPClient, serverName: string) {
    client.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
      log.info("收到工具列表变更通知", { server: serverName })
      Bus.publish(ToolsChanged, { server: serverName })
    })
  }

  // 将 MCP 工具定义转换为 AI SDK 工具类型
  async function convertMcpTool(mcpTool: MCPToolDef, client: MCPClient): Promise<Tool> {
    const inputSchema = mcpTool.inputSchema

    // 先展开,然后覆盖 type 以确保它始终是 "object"
    const schema: JSONSchema7 = {
      ...(inputSchema as JSONSchema7),
      type: "object",
      properties: (inputSchema.properties ?? {}) as JSONSchema7["properties"],
      additionalProperties: false,
    }
    const config = await Config.get()

    return dynamicTool({
      description: mcpTool.description ?? "",
      inputSchema: jsonSchema(schema),
      execute: async (args: unknown) => {
        return client.callTool(
          {
            name: mcpTool.name,
            arguments: args as Record<string, unknown>,
          },
          CallToolResultSchema,
          {
            resetTimeoutOnProgress: true,
            timeout: config.experimental?.mcp_timeout,
          },
        )
      },
    })
  }

  // 存储 OAuth 服务器的传输以允许完成认证
  type TransportWithAuth = StreamableHTTPClientTransport | SSEClientTransport
  const pendingOAuthTransports = new Map<string, TransportWithAuth>()

  // 提示缓存类型
  type PromptInfo = Awaited<ReturnType<MCPClient["listPrompts"]>>["prompts"][number]

  // MCP状态管理
  const state = Instance.state(
    async () => {
      const cfg = await Config.get()
      const config = cfg.mcp ?? {}
      const clients: Record<string, MCPClient> = {}
      const status: Record<string, Status> = {}

      await Promise.all(
        Object.entries(config).map(async ([key, mcp]) => {
          // 如果被配置禁用,则标记为禁用而不尝试连接
          if (mcp.enabled === false) {
            status[key] = { status: "disabled" }
            return
          }

          const result = await create(key, mcp).catch(() => undefined)
          if (!result) return

          status[key] = result.status

          if (result.mcpClient) {
            clients[key] = result.mcpClient
          }
        }),
      )
      return {
        status,
        clients,
      }
    },
    async (state) => {
      await Promise.all(
        Object.values(state.clients).map((client) =>
          client.close().catch((error) => {
            log.error("关闭MCP客户端失败", {
              error,
            })
          }),
        ),
      )
      pendingOAuthTransports.clear()
    },
  )

  // 为特定客户端获取提示的辅助函数
  async function fetchPromptsForClient(clientName: string, client: Client) {
    const prompts = await client.listPrompts().catch((e) => {
      log.error("获取提示失败", { clientName, error: e.message })
      return undefined
    })

    if (!prompts) {
      return
    }

    const commands: Record<string, PromptInfo & { client: string }> = {}

    for (const prompt of prompts.prompts) {
      const sanitizedClientName = clientName.replace(/[^a-zA-Z0-9_-]/g, "_")
      const sanitizedPromptName = prompt.name.replace(/[^a-zA-Z0-9_-]/g, "_")
      const key = sanitizedClientName + ":" + sanitizedPromptName

      commands[key] = { ...prompt, client: clientName }
    }
    return commands
  }

  // 添加MCP服务器
  export async function add(name: string, mcp: Config.Mcp) {
    const s = await state()
    const result = await create(name, mcp)
    if (!result) {
      const status = {
        status: "failed" as const,
        error: "未知错误",
      }
      s.status[name] = status
      return {
        status,
      }
    }
    if (!result.mcpClient) {
      s.status[name] = result.status
      return {
        status: s.status,
      }
    }
    s.clients[name] = result.mcpClient
    s.status[name] = result.status

    return {
      status: s.status,
    }
  }

  // 创建MCP客户端连接
  async function create(key: string, mcp: Config.Mcp) {
    if (mcp.enabled === false) {
      log.info("MCP服务器已禁用", { key })
      return {
        mcpClient: undefined,
        status: { status: "disabled" as const },
      }
    }
    log.info("发现MCP配置", { key, type: mcp.type })
    let mcpClient: MCPClient | undefined
    let status: Status | undefined = undefined

    if (mcp.type === "remote") {
      // 对于远程服务器,OAuth 默认启用,除非明确使用 oauth: false 禁用
      const oauthDisabled = mcp.oauth === false
      const oauthConfig = typeof mcp.oauth === "object" ? mcp.oauth : undefined
      let authProvider: McpOAuthProvider | undefined

      if (!oauthDisabled) {
        authProvider = new McpOAuthProvider(
          key,
          mcp.url,
          {
            clientId: oauthConfig?.clientId,
            clientSecret: oauthConfig?.clientSecret,
            scope: oauthConfig?.scope,
          },
          {
            onRedirect: async (url) => {
              log.info("OAuth重定向请求", { key, url: url.toString() })
              // 存储 URL - 实际的浏览器打开由 startAuth 处理
            },
          },
        )
      }

      const transports: Array<{ name: string; transport: TransportWithAuth }> = [
        {
          name: "StreamableHTTP",
          transport: new StreamableHTTPClientTransport(new URL(mcp.url), {
            authProvider,
            requestInit: mcp.headers ? { headers: mcp.headers } : undefined,
          }),
        },
        {
          name: "SSE",
          transport: new SSEClientTransport(new URL(mcp.url), {
            authProvider,
            requestInit: mcp.headers ? { headers: mcp.headers } : undefined,
          }),
        },
      ]

      let lastError: Error | undefined
      for (const { name, transport } of transports) {
        try {
          const client = new Client({
            name: "opencode",
            version: Installation.VERSION,
          })
          await client.connect(transport)
          registerNotificationHandlers(client, key)
          mcpClient = client
          log.info("已连接", { key, transport: name })
          status = { status: "connected" }
          break
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))

          // 处理 OAuth 特定错误
          if (error instanceof UnauthorizedError) {
            log.info("MCP服务器需要认证", { key, transport: name })

            // 检查这是否是"需要注册"错误
            if (lastError.message.includes("registration") || lastError.message.includes("client_id")) {
              status = {
                status: "needs_client_registration" as const,
                error: "服务器不支持动态客户端注册。请在配置中提供 clientId。",
              }
              // 为 needs_client_registration 显示提示
              Bus.publish(TuiEvent.ToastShow, {
                title: "需要MCP认证",
                message: `服务器 "${key}" 需要预先注册的客户端 ID。请在配置中添加 clientId。`,
                variant: "warning",
                duration: 8000,
              }).catch((e) => log.debug("显示提示失败", { error: e }))
            } else {
              // 存储传输供稍后的 finishAuth 调用使用
              pendingOAuthTransports.set(key, transport)
              status = { status: "needs_auth" as const }
              // 为 needs_auth 显示提示
              Bus.publish(TuiEvent.ToastShow, {
                title: "需要MCP认证",
                message: `服务器 "${key}" 需要认证。运行: opencode mcp auth ${key}`,
                variant: "warning",
                duration: 8000,
              }).catch((e) => log.debug("显示提示失败", { error: e }))
            }
            break
          }

          log.debug("传输连接失败", {
            key,
            transport: name,
            url: mcp.url,
            error: lastError.message,
          })
          status = {
            status: "failed" as const,
            error: lastError.message,
          }
        }
      }
    }

    if (mcp.type === "local") {
      const [cmd, ...args] = mcp.command
      const cwd = Instance.directory
      const transport = new StdioClientTransport({
        stderr: "ignore",
        command: cmd,
        args,
        cwd,
        env: {
          ...process.env,
          ...(cmd === "opencode" ? { BUN_BE_BUN: "1" } : {}),
          ...mcp.environment,
        },
      })

      try {
        const client = new Client({
          name: "opencode",
          version: Installation.VERSION,
        })
        await client.connect(transport)
        registerNotificationHandlers(client, key)
        mcpClient = client
        status = {
          status: "connected",
        }
      } catch (error) {
        log.error("本地MCP启动失败", {
          key,
          command: mcp.command,
          cwd,
          error: error instanceof Error ? error.message : String(error),
        })
        status = {
          status: "failed" as const,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }

    if (!status) {
      status = {
        status: "failed" as const,
        error: "未知错误",
      }
    }

    if (!mcpClient) {
      return {
        mcpClient: undefined,
        status,
      }
    }

    const result = await withTimeout(mcpClient.listTools(), mcp.timeout ?? 5000).catch((err) => {
      log.error("从客户端获取工具失败", { key, error: err })
      return undefined
    })
    if (!result) {
      await mcpClient.close().catch((error) => {
        log.error("关闭MCP客户端失败", {
          error,
        })
      })
      status = {
        status: "failed",
        error: "获取工具失败",
      }
      return {
        mcpClient: undefined,
        status: {
          status: "failed" as const,
          error: "获取工具失败",
        },
      }
    }

    log.info("create()成功创建客户端", { key, toolCount: result.tools.length })
    return {
      mcpClient,
      status,
    }
  }

  // 获取所有MCP服务器的状态
  export async function status() {
    const s = await state()
    const cfg = await Config.get()
    const config = cfg.mcp ?? {}
    const result: Record<string, Status> = {}

    // 包含配置中的所有 MCP,不仅是已连接的
    for (const key of Object.keys(config)) {
      result[key] = s.status[key] ?? { status: "disabled" }
    }

    return result
  }

  // 获取所有MCP客户端
  export async function clients() {
    return state().then((state) => state.clients)
  }

  // 连接指定的MCP服务器
  export async function connect(name: string) {
    const cfg = await Config.get()
    const config = cfg.mcp ?? {}
    const mcp = config[name]
    if (!mcp) {
      log.error("未找到MCP配置", { name })
      return
    }

    const result = await create(name, { ...mcp, enabled: true })

    if (!result) {
      const s = await state()
      s.status[name] = {
        status: "failed",
        error: "连接时发生未知错误",
      }
      return
    }

    const s = await state()
    s.status[name] = result.status
    if (result.mcpClient) {
      s.clients[name] = result.mcpClient
    }
  }

  // 断开指定的MCP服务器连接
  export async function disconnect(name: string) {
    const s = await state()
    const client = s.clients[name]
    if (client) {
      await client.close().catch((error) => {
        log.error("关闭MCP客户端失败", { name, error })
      })
      delete s.clients[name]
    }
    s.status[name] = { status: "disabled" }
  }

  // 获取所有MCP服务器的工具
  export async function tools() {
    const result: Record<string, Tool> = {}
    const s = await state()
    const clientsSnapshot = await clients()

    for (const [clientName, client] of Object.entries(clientsSnapshot)) {
      // 仅包含已连接 MCP 的工具(跳过禁用的)
      if (s.status[clientName]?.status !== "connected") {
        continue
      }

      const toolsResult = await client.listTools().catch((e) => {
        log.error("获取工具失败", { clientName, error: e.message })
        const failedStatus = {
          status: "failed" as const,
          error: e instanceof Error ? e.message : String(e),
        }
        s.status[clientName] = failedStatus
        delete s.clients[clientName]
        return undefined
      })
      if (!toolsResult) {
        continue
      }
      for (const mcpTool of toolsResult.tools) {
        const sanitizedClientName = clientName.replace(/[^a-zA-Z0-9_-]/g, "_")
        const sanitizedToolName = mcpTool.name.replace(/[^a-zA-Z0-9_-]/g, "_")
        result[sanitizedClientName + "_" + sanitizedToolName] = await convertMcpTool(mcpTool, client)
      }
    }
    return result
  }

  // 获取所有MCP服务器的提示
  export async function prompts() {
    const s = await state()
    const clientsSnapshot = await clients()

    const prompts = Object.fromEntries<PromptInfo & { client: string }>(
      (
        await Promise.all(
          Object.entries(clientsSnapshot).map(async ([clientName, client]) => {
            if (s.status[clientName]?.status !== "connected") {
              return []
            }

            return Object.entries((await fetchPromptsForClient(clientName, client)) ?? {})
          }),
        )
      ).flat(),
    )

    return prompts
  }

  // 获取指定客户端的提示
  export async function getPrompt(clientName: string, name: string, args?: Record<string, string>) {
    const clientsSnapshot = await clients()
    const client = clientsSnapshot[clientName]

    if (!client) {
      log.warn("未找到提示的客户端", {
        clientName,
      })
      return undefined
    }

    const result = await client
      .getPrompt({
        name: name,
        arguments: args,
      })
      .catch((e) => {
        log.error("从MCP服务器获取提示失败", {
          clientName,
          promptName: name,
          error: e.message,
        })
        return undefined
      })

    return result
  }

  /**
   * 为MCP服务器启动OAuth认证流程
   * 返回应在浏览器中打开的授权URL
   */
  export async function startAuth(mcpName: string): Promise<{ authorizationUrl: string }> {
    const cfg = await Config.get()
    const mcpConfig = cfg.mcp?.[mcpName]

    if (!mcpConfig) {
      throw new Error(`未找到MCP服务器: ${mcpName}`)
    }

    if (mcpConfig.type !== "remote") {
      throw new Error(`MCP服务器 ${mcpName} 不是远程服务器`)
    }

    if (mcpConfig.oauth === false) {
      throw new Error(`MCP服务器 ${mcpName} 已明确禁用OAuth`)
    }

    // 启动回调服务器
    await McpOAuthCallback.ensureRunning()

    // 在创建提供者之前生成并存储加密安全的状态参数
    // SDK 将调用 provider.state() 来读取此值
    const oauthState = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    await McpAuth.updateOAuthState(mcpName, oauthState)

    // 为此流程创建新的认证提供者
    // OAuth 配置是可选的 - 如果未提供,我们将使用自动发现
    const oauthConfig = typeof mcpConfig.oauth === "object" ? mcpConfig.oauth : undefined
    let capturedUrl: URL | undefined
    const authProvider = new McpOAuthProvider(
      mcpName,
      mcpConfig.url,
      {
        clientId: oauthConfig?.clientId,
        clientSecret: oauthConfig?.clientSecret,
        scope: oauthConfig?.scope,
      },
      {
        onRedirect: async (url) => {
          capturedUrl = url
        },
      },
    )

    // 使用认证提供者创建传输
    const transport = new StreamableHTTPClientTransport(new URL(mcpConfig.url), {
      authProvider,
    })

    // 尝试连接 - 这将触发 OAuth 流程
    try {
      const client = new Client({
        name: "opencode",
        version: Installation.VERSION,
      })
      await client.connect(transport)
      // 如果我们到达这里,说明已经认证
      return { authorizationUrl: "" }
    } catch (error) {
      if (error instanceof UnauthorizedError && capturedUrl) {
        // 为 finishAuth 存储传输
        pendingOAuthTransports.set(mcpName, transport)
        return { authorizationUrl: capturedUrl.toString() }
      }
      throw error
    }
  }

  /**
   * 在用户在浏览器中授权后完成OAuth认证
   * 打开浏览器并等待回调
   */
  export async function authenticate(mcpName: string): Promise<Status> {
    const { authorizationUrl } = await startAuth(mcpName)

    if (!authorizationUrl) {
      // 已经认证
      const s = await state()
      return s.status[mcpName] ?? { status: "connected" }
    }

    // 获取在 startAuth() 中已生成和存储的状态
    const oauthState = await McpAuth.getOAuthState(mcpName)
    if (!oauthState) {
      throw new Error("未找到OAuth状态 - 这不应该发生")
    }

    // SDK 已经向授权 URL 添加了状态参数
    // 我们只需要打开浏览器
    log.info("为OAuth打开浏览器", { mcpName, url: authorizationUrl, state: oauthState })
    await open(authorizationUrl)

    // 使用 OAuth 状态参数等待回调
    const code = await McpOAuthCallback.waitForCallback(oauthState)

    // 验证并清除状态
    const storedState = await McpAuth.getOAuthState(mcpName)
    if (storedState !== oauthState) {
      await McpAuth.clearOAuthState(mcpName)
      throw new Error("OAuth状态不匹配 - 可能是CSRF攻击")
    }

    await McpAuth.clearOAuthState(mcpName)

    // 完成认证
    return finishAuth(mcpName, code)
  }

  /**
   * 使用授权代码完成OAuth认证
   */
  export async function finishAuth(mcpName: string, authorizationCode: string): Promise<Status> {
    const transport = pendingOAuthTransports.get(mcpName)

    if (!transport) {
      throw new Error(`MCP服务器没有待处理的OAuth流程: ${mcpName}`)
    }

    try {
      // 在传输上调用finishAuth
      await transport.finishAuth(authorizationCode)

      // 成功认证后清除代码验证器
      await McpAuth.clearCodeVerifier(mcpName)

      // 现在尝试重新连接
      const cfg = await Config.get()
      const mcpConfig = cfg.mcp?.[mcpName]

      if (!mcpConfig) {
        throw new Error(`未找到MCP服务器: ${mcpName}`)
      }

      // 重新添加 MCP 服务器以建立连接
      pendingOAuthTransports.delete(mcpName)
      const result = await add(mcpName, mcpConfig)

      const statusRecord = result.status as Record<string, Status>
      return statusRecord[mcpName] ?? { status: "failed", error: "认证后发生未知错误" }
    } catch (error) {
      log.error("完成OAuth失败", { mcpName, error })
      return {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * 移除MCP服务器的OAuth凭证
   */
  export async function removeAuth(mcpName: string): Promise<void> {
    await McpAuth.remove(mcpName)
    McpOAuthCallback.cancelPending(mcpName)
    pendingOAuthTransports.delete(mcpName)
    await McpAuth.clearOAuthState(mcpName)
    log.info("已移除OAuth凭证", { mcpName })
  }

  /**
   * 检查MCP服务器是否支持OAuth(远程服务器默认支持OAuth,除非明确禁用)
   */
  export async function supportsOAuth(mcpName: string): Promise<boolean> {
    const cfg = await Config.get()
    const mcpConfig = cfg.mcp?.[mcpName]
    return mcpConfig?.type === "remote" && mcpConfig.oauth !== false
  }

  /**
   * 检查MCP服务器是否有存储的OAuth令牌
   */
  export async function hasStoredTokens(mcpName: string): Promise<boolean> {
    const entry = await McpAuth.get(mcpName)
    return !!entry?.tokens
  }

  export type AuthStatus = "authenticated" | "expired" | "not_authenticated"

  /**
   * 获取MCP服务器的认证状态
   */
  export async function getAuthStatus(mcpName: string): Promise<AuthStatus> {
    const hasTokens = await hasStoredTokens(mcpName)
    if (!hasTokens) return "not_authenticated"
    const expired = await McpAuth.isTokenExpired(mcpName)
    return expired ? "expired" : "authenticated"
  }
}
