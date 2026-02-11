import {
  RequestError,
  type Agent as ACPAgent,
  type AgentSideConnection,
  type AuthenticateRequest,
  type AuthMethod,
  type CancelNotification,
  type InitializeRequest,
  type InitializeResponse,
  type LoadSessionRequest,
  type NewSessionRequest,
  type PermissionOption,
  type PlanEntry,
  type PromptRequest,
  type SetSessionModelRequest,
  type SetSessionModeRequest,
  type SetSessionModeResponse,
  type ToolCallContent,
  type ToolKind,
} from "@agentclientprotocol/sdk"
import { Log } from "../util/log"
import { ACPSessionManager } from "./session"
import type { ACPConfig, ACPSessionState } from "./types"
import { Provider } from "../provider/provider"
import { Agent as AgentModule } from "../agent/agent"
import { Installation } from "@/installation"
import { MessageV2 } from "@/session/message-v2"
import { Config } from "@/config/config"
import { Todo } from "@/session/todo"
import { z } from "zod"
import { LoadAPIKeyError } from "ai"
import type { OpencodeClient, SessionMessageResponse } from "@opencode-ai/sdk/v2"

/**
 * ACP (Agent Client Protocol) 命名空间
 * 实现了 ACP 协议的智能体端功能，用于与客户端通信
 */
export namespace ACP {
  const log = Log.create({ service: "acp-agent" })

  /**
   * 初始化 ACP 智能体
   * @param sdk Opencode 客户端 SDK
   * @returns 创建智能体实例的工厂函数
   */
  export async function init({ sdk }: { sdk: OpencodeClient }) {
    const model = await defaultModel({ sdk })
    return {
      create: (connection: AgentSideConnection, fullConfig: ACPConfig) => {
        if (!fullConfig.defaultModel) {
          fullConfig.defaultModel = model
        }
        return new Agent(connection, fullConfig)
      },
    }
  }

  /**
   * ACP 智能体类，实现了 ACPAgent 接口
   * 用于处理客户端的请求和事件
   */
  export class Agent implements ACPAgent {
    private connection: AgentSideConnection
    private config: ACPConfig
    private sdk: OpencodeClient
    private sessionManager

    /**
     * 构造函数
     * @param connection 智能体端连接
     * @param config ACP 配置
     */
    constructor(connection: AgentSideConnection, config: ACPConfig) {
      this.connection = connection
      this.config = config
      this.sdk = config.sdk
      this.sessionManager = new ACPSessionManager(this.sdk)
    }

    /**
     * 设置事件订阅
     * @param session ACP 会话状态
     */
    private setupEventSubscriptions(session: ACPSessionState) {
      const sessionId = session.id
      const directory = session.cwd

      // 权限选项
      const options: PermissionOption[] = [
        { optionId: "once", kind: "allow_once", name: "允许一次" },
        { optionId: "always", kind: "allow_always", name: "始终允许" },
        { optionId: "reject", kind: "reject_once", name: "拒绝" },
      ]

      // 订阅 SDK 事件
      this.config.sdk.event.subscribe({ directory }).then(async (events) => {
        for await (const event of events.stream) {
          switch (event.type) {
            case "permission.asked":
              try {
                const permission = event.properties
                // 向客户端请求权限
                const res = await this.connection
                  .requestPermission({
                    sessionId,
                    toolCall: {
                      toolCallId: permission.tool?.callID ?? permission.id,
                      status: "pending",
                      title: permission.permission,
                      rawInput: permission.metadata,
                      kind: toToolKind(permission.permission),
                      locations: toLocations(permission.permission, permission.metadata),
                    },
                    options,
                  })
                  .catch(async (error) => {
                    log.error("向 ACP 请求权限失败", {
                      error,
                      permissionID: permission.id,
                      sessionID: permission.sessionID,
                    })
                    // 失败时默认拒绝权限
                    await this.config.sdk.permission.reply({
                      requestID: permission.id,
                      reply: "reject",
                      directory,
                    })
                    return
                  })
                if (!res) return
                if (res.outcome.outcome !== "selected") {
                  // 如果没有选择权限，拒绝
                  await this.config.sdk.permission.reply({
                    requestID: permission.id,
                    reply: "reject",
                    directory,
                  })
                  return
                }
                // 根据客户端的选择回复权限
                await this.config.sdk.permission.reply({
                  requestID: permission.id,
                  reply: res.outcome.optionId as "once" | "always" | "reject",
                  directory,
                })
              } catch (err) {
                log.error("处理权限时发生意外错误", { error: err })
              } finally {
                break
              }

            case "message.part.updated":
              log.info("消息部分更新", { event: event.properties })
              try {
                const props = event.properties
                const { part } = props

                // 获取完整消息
                const message = await this.config.sdk.session
                  .message(
                    {
                      sessionID: part.sessionID,
                      messageID: part.messageID,
                      directory,
                    },
                    { throwOnError: true },
                  )
                  .then((x) => x.data)
                  .catch((err) => {
                    log.error("获取消息时发生意外错误", { error: err })
                    return undefined
                  })

                if (!message || message.info.role !== "assistant") return

                if (part.type === "tool") {
                  switch (part.state.status) {
                    case "pending":
                      // 发送工具调用待处理状态
                      await this.connection
                        .sessionUpdate({
                          sessionId,
                          update: {
                            sessionUpdate: "tool_call",
                            toolCallId: part.callID,
                            title: part.tool,
                            kind: toToolKind(part.tool),
                            status: "pending",
                            locations: [],
                            rawInput: {},
                          },
                        })
                        .catch((err) => {
                          log.error("向 ACP 发送工具待处理状态失败", { error: err })
                        })
                      break
                    case "running":
                      // 发送工具调用进行中状态
                      await this.connection
                        .sessionUpdate({
                          sessionId,
                          update: {
                            sessionUpdate: "tool_call_update",
                            toolCallId: part.callID,
                            status: "in_progress",
                            locations: toLocations(part.tool, part.state.input),
                            rawInput: part.state.input,
                          },
                        })
                        .catch((err) => {
                          log.error("向 ACP 发送工具进行中状态失败", { error: err })
                        })
                      break
                    case "completed":
                      const kind = toToolKind(part.tool)
                      const content: ToolCallContent[] = [
                        {
                          type: "content",
                          content: {
                            type: "text",
                            text: part.state.output,
                          },
                        },
                      ]

                      if (kind === "edit") {
                        // 处理编辑工具的差异
                        const input = part.state.input
                        const filePath = typeof input["filePath"] === "string" ? input["filePath"] : ""
                        const oldText = typeof input["oldString"] === "string" ? input["oldString"] : ""
                        const newText =
                          typeof input["newString"] === "string"
                            ? input["newString"]
                            : typeof input["content"] === "string"
                              ? input["content"]
                              : ""
                        content.push({
                          type: "diff",
                          path: filePath,
                          oldText,
                          newText,
                        })
                      }

                      if (part.tool === "todowrite") {
                        // 处理待办事项工具的输出
                        const parsedTodos = z.array(Todo.Info).safeParse(JSON.parse(part.state.output))
                        if (parsedTodos.success) {
                          await this.connection
                            .sessionUpdate({
                              sessionId,
                              update: {
                                sessionUpdate: "plan",
                                entries: parsedTodos.data.map((todo) => {
                                  const status: PlanEntry["status"] =
                                    todo.status === "cancelled" ? "completed" : (todo.status as PlanEntry["status"])
                                  return {
                                    priority: "medium",
                                    status,
                                    content: todo.content,
                                  }
                                }),
                              },
                            })
                            .catch((err) => {
                              log.error("发送待办事项会话更新失败", { error: err })
                            })
                        } else {
                          log.error("解析待办事项输出失败", { error: parsedTodos.error })
                        }
                      }

                      // 发送工具调用完成状态
                      await this.connection
                        .sessionUpdate({
                          sessionId,
                          update: {
                            sessionUpdate: "tool_call_update",
                            toolCallId: part.callID,
                            status: "completed",
                            kind,
                            content,
                            title: part.state.title,
                            rawOutput: {
                              output: part.state.output,
                              metadata: part.state.metadata,
                            },
                          },
                        })
                        .catch((err) => {
                          log.error("向 ACP 发送工具完成状态失败", { error: err })
                        })
                      break
                    case "error":
                      // 发送工具调用错误状态
                      await this.connection
                        .sessionUpdate({
                          sessionId,
                          update: {
                            sessionUpdate: "tool_call_update",
                            toolCallId: part.callID,
                            status: "failed",
                            content: [
                              {
                                type: "content",
                                content: {
                                  type: "text",
                                  text: part.state.error,
                                },
                              },
                            ],
                            rawOutput: {
                              error: part.state.error,
                            },
                          },
                        })
                        .catch((err) => {
                          log.error("向 ACP 发送工具错误状态失败", { error: err })
                        })
                      break
                  }
                } else if (part.type === "text") {
                  // 处理文本部分更新
                  const delta = props.delta
                  if (delta && part.synthetic !== true) {
                    await this.connection
                      .sessionUpdate({
                        sessionId,
                        update: {
                          sessionUpdate: "agent_message_chunk",
                          content: {
                            type: "text",
                            text: delta,
                          },
                        },
                      })
                      .catch((err) => {
                        log.error("向 ACP 发送文本失败", { error: err })
                      })
                  }
                } else if (part.type === "reasoning") {
                  // 处理推理部分更新
                  const delta = props.delta
                  if (delta) {
                    await this.connection
                      .sessionUpdate({
                        sessionId,
                        update: {
                          sessionUpdate: "agent_thought_chunk",
                          content: {
                            type: "text",
                            text: delta,
                          },
                        },
                      })
                      .catch((err) => {
                        log.error("向 ACP 发送推理失败", { error: err })
                      })
                  }
                }
              } finally {
                break
              }
          }
        }
      })
    }

    /**
     * 初始化 ACP 智能体
     * @param params 初始化请求参数
     * @returns 初始化响应
     */
    async initialize(params: InitializeRequest): Promise<InitializeResponse> {
      log.info("初始化", { protocolVersion: params.protocolVersion })

      // 认证方法配置
      const authMethod: AuthMethod = {
        description: "在终端中运行 `opencode auth login`",
        name: "使用 opencode 登录",
        id: "opencode-login",
      }

      // 如果客户端支持终端认证能力，使用该能力
      if (params.clientCapabilities?._meta?.["terminal-auth"] === true) {
        authMethod._meta = {
          "terminal-auth": {
            command: "opencode",
            args: ["auth", "login"],
            label: "OpenCode 登录",
          },
        }
      }

      return {
        protocolVersion: 1, // ACP 协议版本
        agentCapabilities: {
          loadSession: true, // 支持加载会话
          mcpCapabilities: {
            http: true, // 支持 HTTP MCP
            sse: true, // 支持 SSE MCP
          },
          promptCapabilities: {
            embeddedContext: true, // 支持嵌入上下文
            image: true, // 支持图像
          },
        },
        authMethods: [authMethod], // 认证方法
        agentInfo: {
          name: "OpenCode", // 智能体名称
          version: Installation.VERSION, // 版本号
        },
      }
    }

    /**
     * 认证方法（未实现）
     * @param _params 认证请求参数
     */
    async authenticate(_params: AuthenticateRequest) {
      throw new Error("认证功能未实现")
    }

    /**
     * 创建新会话
     * @param params 新会话请求参数
     * @returns 新会话响应
     */
    async newSession(params: NewSessionRequest) {
      const directory = params.cwd
      try {
        // 获取默认模型
        const model = await defaultModel(this.config, directory)

        // 创建 ACP 会话状态
        const state = await this.sessionManager.create(params.cwd, params.mcpServers, model)
        const sessionId = state.id

        log.info("创建会话", { sessionId, mcpServers: params.mcpServers.length })

        // 加载会话模式
        const load = await this.loadSessionMode({
          cwd: directory,
          mcpServers: params.mcpServers,
          sessionId,
        })

        // 设置事件订阅
        this.setupEventSubscriptions(state)

        return {
          sessionId,
          models: load.models,
          modes: load.modes,
          _meta: {},
        }
      } catch (e) {
        const error = MessageV2.fromError(e, {
          providerID: this.config.defaultModel?.providerID ?? "unknown",
        })
        if (LoadAPIKeyError.isInstance(error)) {
          throw RequestError.authRequired()
        }
        throw e
      }
    }

    /**
     * 加载会话
     * @param params 加载会话请求参数
     * @returns 会话响应
     */
    async loadSession(params: LoadSessionRequest) {
      const directory = params.cwd
      const sessionId = params.sessionId

      try {
        // 获取默认模型
        const model = await defaultModel(this.config, directory)

        // 加载 ACP 会话状态
        const state = await this.sessionManager.load(sessionId, params.cwd, params.mcpServers, model)

        log.info("加载会话", { sessionId, mcpServers: params.mcpServers.length })

        // 加载会话模式
        const mode = await this.loadSessionMode({
          cwd: directory,
          mcpServers: params.mcpServers,
          sessionId,
        })

        // 设置事件订阅
        this.setupEventSubscriptions(state)

        // 重放会话历史
        const messages = await this.sdk.session
          .messages(
            {
              sessionID: sessionId,
              directory,
            },
            { throwOnError: true },
          )
          .then((x) => x.data)
          .catch((err) => {
            log.error("获取消息时发生意外错误", { error: err })
            return undefined
          })

        for (const msg of messages ?? []) {
          log.debug("重放消息", msg)
          await this.processMessage(msg)
        }

        return mode
      } catch (e) {
        const error = MessageV2.fromError(e, {
          providerID: this.config.defaultModel?.providerID ?? "unknown",
        })
        if (LoadAPIKeyError.isInstance(error)) {
          throw RequestError.authRequired()
        }
        throw e
      }
    }

    /**
     * 处理会话消息
     * @param message 会话消息响应
     */
    private async processMessage(message: SessionMessageResponse) {
      log.debug("处理消息", message)
      if (message.info.role !== "assistant" && message.info.role !== "user") return
      const sessionId = message.info.sessionID

      for (const part of message.parts) {
        if (part.type === "tool") {
          switch (part.state.status) {
            case "pending":
              await this.connection
                .sessionUpdate({
                  sessionId,
                  update: {
                    sessionUpdate: "tool_call",
                    toolCallId: part.callID,
                    title: part.tool,
                    kind: toToolKind(part.tool),
                    status: "pending",
                    locations: [],
                    rawInput: {},
                  },
                })
                .catch((err) => {
                  log.error("向 ACP 发送工具待处理状态失败", { error: err })
                })
              break
            case "running":
              await this.connection
                .sessionUpdate({
                  sessionId,
                  update: {
                    sessionUpdate: "tool_call_update",
                    toolCallId: part.callID,
                    status: "in_progress",
                    locations: toLocations(part.tool, part.state.input),
                    rawInput: part.state.input,
                  },
                })
                .catch((err) => {
                  log.error("向 ACP 发送工具进行中状态失败", { error: err })
                })
              break
            case "completed":
              const kind = toToolKind(part.tool)
              const content: ToolCallContent[] = [
                {
                  type: "content",
                  content: {
                    type: "text",
                    text: part.state.output,
                  },
                },
              ]

              if (kind === "edit") {
                // 处理编辑工具的差异
                const input = part.state.input
                const filePath = typeof input["filePath"] === "string" ? input["filePath"] : ""
                const oldText = typeof input["oldString"] === "string" ? input["oldString"] : ""
                const newText =
                  typeof input["newString"] === "string"
                    ? input["newString"]
                    : typeof input["content"] === "string"
                      ? input["content"]
                      : ""
                content.push({
                  type: "diff",
                  path: filePath,
                  oldText,
                  newText,
                })
              }

              if (part.tool === "todowrite") {
                // 处理待办事项工具的输出
                const parsedTodos = z.array(Todo.Info).safeParse(JSON.parse(part.state.output))
                if (parsedTodos.success) {
                  await this.connection
                    .sessionUpdate({
                      sessionId,
                      update: {
                        sessionUpdate: "plan",
                        entries: parsedTodos.data.map((todo) => {
                          const status: PlanEntry["status"] =
                            todo.status === "cancelled" ? "completed" : (todo.status as PlanEntry["status"])
                          return {
                            priority: "medium",
                            status,
                            content: todo.content,
                          }
                        }),
                      },
                    })
                    .catch((err) => {
                      log.error("发送待办事项会话更新失败", { error: err })
                    })
                } else {
                  log.error("解析待办事项输出失败", { error: parsedTodos.error })
                }
              }

              // 发送工具调用完成状态
              await this.connection
                .sessionUpdate({
                  sessionId,
                  update: {
                    sessionUpdate: "tool_call_update",
                    toolCallId: part.callID,
                    status: "completed",
                    kind,
                    content,
                    title: part.state.title,
                    rawOutput: {
                      output: part.state.output,
                      metadata: part.state.metadata,
                    },
                  },
                })
                .catch((err) => {
                  log.error("向 ACP 发送工具完成状态失败", { error: err })
                })
              break
            case "error":
              // 发送工具调用错误状态
              await this.connection
                .sessionUpdate({
                  sessionId,
                  update: {
                    sessionUpdate: "tool_call_update",
                    toolCallId: part.callID,
                    status: "failed",
                    content: [
                      {
                        type: "content",
                        content: {
                          type: "text",
                          text: part.state.error,
                        },
                      },
                    ],
                    rawOutput: {
                      error: part.state.error,
                    },
                  },
                })
                .catch((err) => {
                  log.error("向 ACP 发送工具错误状态失败", { error: err })
                })
              break
          }
        } else if (part.type === "text") {
          // 处理文本部分
          if (part.text) {
            await this.connection
              .sessionUpdate({
                sessionId,
                update: {
                  sessionUpdate: message.info.role === "user" ? "user_message_chunk" : "agent_message_chunk",
                  content: {
                    type: "text",
                    text: part.text,
                  },
                },
              })
              .catch((err) => {
                log.error("向 ACP 发送文本失败", { error: err })
              })
          }
        } else if (part.type === "reasoning") {
          // 处理推理部分
          if (part.text) {
            await this.connection
              .sessionUpdate({
                sessionId,
                update: {
                  sessionUpdate: "agent_thought_chunk",
                  content: {
                    type: "text",
                    text: part.text,
                  },
                },
              })
              .catch((err) => {
                log.error("向 ACP 发送推理失败", { error: err })
              })
          }
        }
      }
    }

    /**
     * 加载会话模式
     * @param params 加载会话请求参数
     * @returns 会话模式响应
     */
    private async loadSessionMode(params: LoadSessionRequest) {
      const directory = params.cwd
      const model = await defaultModel(this.config, directory)
      const sessionId = params.sessionId

      // 获取可用的模型提供商
      const providers = await this.sdk.config.providers({ directory }).then((x) => x.data!.providers)
      // 按名称排序提供商
      const entries = providers.sort((a, b) => {
        const nameA = a.name.toLowerCase()
        const nameB = b.name.toLowerCase()
        if (nameA < nameB) return -1
        if (nameA > nameB) return 1
        return 0
      })
      // 生成可用模型列表
      const availableModels = entries.flatMap((provider) => {
        const models = Provider.sort(Object.values(provider.models))
        return models.map((model) => ({
          modelId: `${provider.id}/${model.id}`,
          name: `${provider.name}/${model.name}`,
        }))
      })

      // 获取可用的智能体
      const agents = await this.config.sdk.app
        .agents(
          {
            directory,
          },
          { throwOnError: true },
        )
        .then((resp) => resp.data!)

      // 获取可用的命令
      const commands = await this.config.sdk.command
        .list(
          {
            directory,
          },
          { throwOnError: true },
        )
        .then((resp) => resp.data!)

      // 生成可用命令列表
      const availableCommands = commands.map((command) => ({
        name: command.name,
        description: command.description ?? "",
      }))
      const names = new Set(availableCommands.map((c) => c.name))
      // 如果没有 compact 命令，添加它
      if (!names.has("compact"))
        availableCommands.push({
          name: "compact",
          description: "压缩会话",
        })

      // 生成可用模式列表
      const availableModes = agents
        .filter((agent) => agent.mode !== "subagent" && !agent.hidden)
        .map((agent) => ({
          id: agent.name,
          name: agent.name,
          description: agent.description,
        }))

      // 获取默认智能体名称
      const defaultAgentName = await AgentModule.defaultAgent()
      // 确定当前模式 ID
      const currentModeId = availableModes.find((m) => m.name === defaultAgentName)?.id ?? availableModes[0].id

      // 处理 MCP 服务器配置
      const mcpServers: Record<string, Config.Mcp> = {}
      for (const server of params.mcpServers) {
        if ("type" in server) {
          // 远程 MCP 服务器
          mcpServers[server.name] = {
            url: server.url,
            headers: server.headers.reduce<Record<string, string>>((acc, { name, value }) => {
              acc[name] = value
              return acc
            }, {}),
            type: "remote",
          }
        } else {
          // 本地 MCP 服务器
          mcpServers[server.name] = {
            type: "local",
            command: [server.command, ...server.args],
            environment: server.env.reduce<Record<string, string>>((acc, { name, value }) => {
              acc[name] = value
              return acc
            }, {}),
          }
        }
      }

      // 添加 MCP 服务器
      await Promise.all(
        Object.entries(mcpServers).map(async ([key, mcp]) => {
          await this.sdk.mcp
            .add(
              {
                directory,
                name: key,
                config: mcp,
              },
              { throwOnError: true },
            )
            .catch((error) => {
              log.error("添加 MCP 服务器失败", { name: key, error })
            })
        }),
      )

      // 异步发送可用命令更新
      setTimeout(() => {
        this.connection.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: "available_commands_update",
            availableCommands,
          },
        })
      }, 0)

      return {
        sessionId,
        models: {
          currentModelId: `${model.providerID}/${model.modelID}`,
          availableModels,
        },
        modes: {
          availableModes,
          currentModeId,
        },
        _meta: {},
      }
    }

    /**
     * 设置会话模型
     * @param params 设置会话模型请求参数
     * @returns 设置会话模型响应
     */
    async setSessionModel(params: SetSessionModelRequest) {
      const session = this.sessionManager.get(params.sessionId)

      // 解析模型 ID
      const model = Provider.parseModel(params.modelId)

      // 设置会话模型
      this.sessionManager.setModel(session.id, {
        providerID: model.providerID,
        modelID: model.modelID,
      })

      return {
        _meta: {},
      }
    }

    /**
     * 设置会话模式
     * @param params 设置会话模式请求参数
     * @returns 设置会话模式响应
     */
    async setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse | void> {
      this.sessionManager.get(params.sessionId)
      await this.config.sdk.app
        .agents({}, { throwOnError: true })
        .then((x) => x.data)
        .then((agent) => {
          if (!agent) throw new Error(`未找到智能体: ${params.modeId}`)
        })
      this.sessionManager.setMode(params.sessionId, params.modeId)
    }

    /**
     * 处理用户提示
     * @param params 提示请求参数
     * @returns 提示响应
     */
    async prompt(params: PromptRequest) {
      const sessionID = params.sessionId
      const session = this.sessionManager.get(sessionID)
      const directory = session.cwd

      // 获取会话模型
      const current = session.model
      const model = current ?? (await defaultModel(this.config, directory))
      if (!current) {
        this.sessionManager.setModel(session.id, model)
      }
      // 获取会话智能体
      const agent = session.modeId ?? (await AgentModule.defaultAgent())

      // 处理提示内容
      const parts: Array<
        { type: "text"; text: string } | { type: "file"; url: string; filename: string; mime: string }
      > = []
      for (const part of params.prompt) {
        switch (part.type) {
          case "text":
            parts.push({
              type: "text" as const,
              text: part.text,
            })
            break
          case "image":
            if (part.data) {
              parts.push({
                type: "file",
                url: `data:${part.mimeType};base64,${part.data}`,
                filename: "image",
                mime: part.mimeType,
              })
            } else if (part.uri && part.uri.startsWith("http:")) {
              parts.push({
                type: "file",
                url: part.uri,
                filename: "image",
                mime: part.mimeType,
              })
            }
            break

          case "resource_link":
            const parsed = parseUri(part.uri)
            parts.push(parsed)
            break

          case "resource":
            const resource = part.resource
            if ("text" in resource) {
              parts.push({
                type: "text",
                text: resource.text,
              })
            }
            break

          default:
            break
        }
      }

      log.info("处理后的提示部分", { parts })

      // 解析命令
      const cmd = (() => {
        const text = parts
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("")
          .trim()

        if (!text.startsWith("/")) return

        const [name, ...rest] = text.slice(1).split(/\s+/)
        return { name, args: rest.join(" ").trim() }
      })()

      const done = {
        stopReason: "end_turn" as const,
        _meta: {},
      }

      if (!cmd) {
        // 发送普通提示
        await this.sdk.session.prompt({
          sessionID,
          model: {
            providerID: model.providerID,
            modelID: model.modelID,
          },
          parts,
          agent,
          directory,
        })
        return done
      }

      // 处理命令
      const command = await this.config.sdk.command
        .list({ directory }, { throwOnError: true })
        .then((x) => x.data!.find((c) => c.name === cmd.name))
      if (command) {
        await this.sdk.session.command({
          sessionID,
          command: command.name,
          arguments: cmd.args,
          model: model.providerID + "/" + model.modelID,
          agent,
          directory,
        })
        return done
      }

      // 处理内置命令
      switch (cmd.name) {
        case "compact":
          await this.config.sdk.session.summarize(
            {
              sessionID,
              directory,
              providerID: model.providerID,
              modelID: model.modelID,
            },
            { throwOnError: true },
          )
          break
      }

      return done
    }

    /**
     * 取消操作
     * @param params 取消通知参数
     */
    async cancel(params: CancelNotification) {
      const session = this.sessionManager.get(params.sessionId)
      await this.config.sdk.session.abort(
        {
          sessionID: params.sessionId,
          directory: session.cwd,
        },
        { throwOnError: true },
      )
    }
  }

  /**
   * 将工具名称转换为工具类型
   * @param toolName 工具名称
   * @returns 工具类型
   */
  function toToolKind(toolName: string): ToolKind {
    const tool = toolName.toLocaleLowerCase()
    switch (tool) {
      case "bash":
        return "execute"
      case "webfetch":
        return "fetch"

      case "edit":
      case "patch":
      case "write":
        return "edit"

      case "grep":
      case "glob":
      case "context7_resolve_library_id":
      case "context7_get_library_docs":
        return "search"

      case "list":
      case "read":
        return "read"

      default:
        return "other"
    }
  }

  /**
   * 从工具输入中提取位置信息
   * @param toolName 工具名称
   * @param input 工具输入
   * @returns 位置信息数组
   */
  function toLocations(toolName: string, input: Record<string, any>): { path: string }[] {
    const tool = toolName.toLocaleLowerCase()
    switch (tool) {
      case "read":
      case "edit":
      case "write":
        return input["filePath"] ? [{ path: input["filePath"] }] : []
      case "glob":
      case "grep":
        return input["path"] ? [{ path: input["path"] }] : []
      case "bash":
        return []
      case "list":
        return input["path"] ? [{ path: input["path"] }] : []
      default:
        return []
    }
  }

  /**
   * 获取默认模型配置
   * @param config ACP 配置
   * @param cwd 工作目录
   * @returns 默认模型配置
   */
  async function defaultModel(config: ACPConfig, cwd?: string) {
    const sdk = config.sdk
    const configured = config.defaultModel
    if (configured) return configured

    const model = await sdk.config
      .get({ directory: cwd }, { throwOnError: true })
      .then((resp) => {
        const cfg = resp.data
        if (!cfg || !cfg.model) return undefined
        const parsed = Provider.parseModel(cfg.model)
        return {
          providerID: parsed.providerID,
          modelID: parsed.modelID,
        }
      })
      .catch((error) => {
        log.error("加载用户配置获取默认模型失败", { error })
        return undefined
      })

    return model ?? { providerID: "opencode", modelID: "big-pickle" }
  }

  /**
   * 解析 URI
   * @param uri URI 字符串
   * @returns 解析后的资源对象
   */
  function parseUri(
    uri: string,
  ): { type: "file"; url: string; filename: string; mime: string } | { type: "text"; text: string } {
    try {
      if (uri.startsWith("file://")) {
        const path = uri.slice(7)
        const name = path.split("/").pop() || path
        return {
          type: "file",
          url: uri,
          filename: name,
          mime: "text/plain",
        }
      }
      if (uri.startsWith("zed://")) {
        const url = new URL(uri)
        const path = url.searchParams.get("path")
        if (path) {
          const name = path.split("/").pop() || path
          return {
            type: "file",
            url: `file://${path}`,
            filename: name,
            mime: "text/plain",
          }
        }
      }
      return {
        type: "text",
        text: uri,
      }
    } catch {
      return {
        type: "text",
        text: uri,
      }
    }
  }
}
