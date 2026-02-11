import { Bus } from "@/bus"; // 导入总线模块
import { BusEvent } from "@/bus/bus-event"; // 导入总线事件模块
import { GlobalBus } from "@/bus/global"; // 导入全局总线模块
import { TuiEvent } from "@/cli/cmd/tui/event"; // 导入TUI事件
import { Installation } from "@/installation"; // 导入安装模块
import { PermissionNext } from "@/permission/next"; // 导入权限模块
import { Pty } from "@/pty"; // 导入PTY(Pseudo Terminal，伪终端)模块
import { SessionStatus } from "@/session/status"; // 导入会话状态模块
import { SessionSummary } from "@/session/summary"; // 导入会话摘要模块
import { Snapshot } from "@/snapshot"; // 导入快照模块
import { NamedError } from "@opencode-ai/util/error"; // 导入命名错误类
import { Hono } from "hono"; // 导入Hono框架，用于构建Web API
import { describeRoute, generateSpecs, openAPIRouteHandler, resolver, validator } from "hono-openapi"; // 导入OpenAPI相关工具
import { upgradeWebSocket, websocket } from "hono/bun"; // 导入WebSocket升级工具
import { cors } from "hono/cors"; // 导入CORS中间件
import { proxy } from "hono/proxy"; // 导入代理工具
import { stream, streamSSE } from "hono/streaming"; // 导入流式响应工具
import type { ContentfulStatusCode } from "hono/utils/http-status"; // 导入HTTP状态码类型
import { filter, mapValues, pipe, sortBy } from "remeda"; // 导入函数式编程工具
import z from "zod"; // 导入Zod库，用于数据验证和模式定义
import { zodToJsonSchema } from "zod-to-json-schema"; // 导入Zod到JSON Schema转换工具
import { Agent } from "../agent/agent"; // 导入代理模块
import { Auth } from "../auth"; // 导入认证模块
import { Command } from "../command"; // 导入命令模块
import { Config } from "../config/config"; // 导入配置模块
import { File } from "../file"; // 导入文件模块
import { Ripgrep } from "../file/ripgrep"; // 导入Ripgrep文件搜索工具
import { Format } from "../format"; // 导入格式化模块
import { Global } from "../global"; // 导入全局模块
import { LSP } from "../lsp"; // 导入LSP(Language Server Protocol)模块
import { MCP } from "../mcp"; // 导入MCP(Model Context Protocol)模块
import { InstanceBootstrap } from "../project/bootstrap"; // 导入实例引导模块
import { Instance } from "../project/instance"; // 导入项目实例模块
import { Vcs } from "../project/vcs"; // 导入版本控制系统模块
import { ProviderAuth } from "../provider/auth"; // 导入提供者认证模块
import { ModelsDev } from "../provider/models"; // 导入模型开发模块
import { Provider } from "../provider/provider"; // 导入提供者模块
import { Session } from "../session"; // 导入会话模块
import { SessionCompaction } from "../session/compaction"; // 导入会话压缩模块
import { MessageV2 } from "../session/message-v2"; // 导入消息V2模块
import { SessionPrompt } from "../session/prompt"; // 导入会话提示模块
import { SessionRevert } from "../session/revert"; // 导入会话回滚模块
import { Todo } from "../session/todo"; // 导入待办事项模块
import { Storage } from "../storage/storage"; // 导入存储模块
import { ToolRegistry } from "../tool/registry"; // 导入工具注册表
import { lazy } from "../util/lazy"; // 导入懒加载工具
import { Log } from "../util/log"; // 导入日志工具模块
import { errors } from "./error"; // 导入错误处理模块
import { MDNS } from "./mdns"; // 导入mDNS服务模块
import { ProjectRoute } from "./project"; // 导入项目路由
import { TuiRoute } from "./tui"; // 导入TUI路由

// @ts-ignore 此全局变量用于防止ai-sdk向stdout输出警告日志 https://github.com/vercel/ai/blob/2dc67e0ef538307f21368db32d5a12345d98831b/packages/ai/src/logger/log-warnings.ts#L85
globalThis.AI_SDK_LOG_WARNINGS = false

export namespace Server {
  // 服务器命名空间
  const log = Log.create({ service: "server" }) // 创建服务器日志记录器

  let _url: URL | undefined // 服务器URL
  let _corsWhitelist: string[] = [] // CORS白名单

  export function url(): URL {
    // 获取服务器URL
    return _url ?? new URL("http://localhost:4096") // 如果未设置，返回默认URL
  }

  export const Event = {
    // 服务器事件定义
    Connected: BusEvent.define("server.connected", z.object({})), // 服务器连接事件
    Disposed: BusEvent.define("global.disposed", z.object({})), // 全局释放事件
  }

  const app = new Hono() // 创建Hono应用实例
  export const App = lazy(() =>
    app
      .onError((err, c) => {
        // 全局错误处理中间件
        log.error("failed", {
          error: err,
        })
        if (err instanceof NamedError) {
          // 如果是命名错误
          let status: ContentfulStatusCode
          if (err instanceof Storage.NotFoundError)
            status = 404 // 未找到错误返回404
          else if (err instanceof Provider.ModelNotFoundError)
            status = 400 // 模型未找到错误返回400
          else status = 500 // 其他错误返回500
          return c.json(err.toObject(), { status })
        }
        const message = err instanceof Error && err.stack ? err.stack : err.toString() // 获取错误信息
        return c.json(new NamedError.Unknown({ message }).toObject(), {
          status: 500,
        })
      })
      .use(async (c, next) => {
        // 请求日志中间件
        const skipLogging = c.req.path === "/log" // 跳过日志路径的日志记录
        if (!skipLogging) {
          log.info("request", {
            method: c.req.method,
            path: c.req.path,
          })
        }
        const timer = log.time("request", {
          // 创建请求计时器
          method: c.req.method,
          path: c.req.path,
        })
        await next()
        if (!skipLogging) {
          timer.stop() // 停止计时器
        }
      })
      .use(
        cors({
          // CORS配置中间件
          origin(input) {
            if (!input) return

            if (input.startsWith("http://localhost:")) return input // 允许localhost
            if (input.startsWith("http://127.0.0.1:")) return input // 允许127.0.0.1
            if (input === "tauri://localhost" || input === "http://tauri.localhost") return input // 允许Tauri本地地址

            // *.opencode.ai (仅HTTPS，根据需要调整)
            if (/^https:\/\/([a-z0-9-]+\.)*opencode\.ai$/.test(input)) {
              return input
            }
            if (_corsWhitelist.includes(input)) {
              // 检查白名单
              return input
            }

            return
          },
        }),
      )
      .get(
        "/global/health",
        describeRoute({
          summary: "获取健康状态", // Get health
          description: "获取OpenCode服务器的健康信息。", // Get health information about the OpenCode server.
          operationId: "global.health", // 操作ID
          responses: {
            200: {
              description: "健康信息", // Health information
              content: {
                "application/json": {
                  schema: resolver(z.object({ healthy: z.literal(true), version: z.string() })),
                },
              },
            },
          },
        }),
        async (c) => {
          return c.json({ healthy: true, version: Installation.VERSION })
        },
      )
      .get(
        "/global/event",
        describeRoute({
          summary: "获取全局事件", // Get global events
          description: "使用服务器发送事件(SSE)订阅OpenCode系统的全局事件。", // Subscribe to global events from the OpenCode system using server-sent events.
          operationId: "global.event", // 操作ID
          responses: {
            200: {
              description: "事件流", // Event stream
              content: {
                "text/event-stream": {
                  schema: resolver(
                    z
                      .object({
                        directory: z.string(),
                        payload: BusEvent.payloads(),
                      })
                      .meta({
                        ref: "GlobalEvent",
                      }),
                  ),
                },
              },
            },
          },
        }),
        async (c) => {
          log.info("global event connected") // 记录全局事件连接日志
          return streamSSE(c, async (stream) => {
            // 使用SSE流式传输
            stream.writeSSE({
              data: JSON.stringify({
                payload: {
                  type: "server.connected",
                  properties: {},
                },
              }),
            })
            async function handler(event: any) {
              await stream.writeSSE({
                data: JSON.stringify(event),
              })
            }
            GlobalBus.on("event", handler) // 监听全局总线事件

            // 每30秒发送心跳以防止WKWebView超时（默认60秒）
            const heartbeat = setInterval(() => {
              stream.writeSSE({
                data: JSON.stringify({
                  payload: {
                    type: "server.heartbeat",
                    properties: {},
                  },
                }),
              })
            }, 30000)

            await new Promise<void>((resolve) => {
              stream.onAbort(() => {
                // 当流中断时清理资源
                clearInterval(heartbeat)
                GlobalBus.off("event", handler)
                resolve()
                log.info("global event disconnected")
              })
            })
          })
        },
      )
      .post(
        "/global/dispose",
        describeRoute({
          summary: "释放实例", // Dispose instance
          description: "清理并释放所有OpenCode实例，释放所有资源。", // Clean up and dispose all OpenCode instances, releasing all resources.
          operationId: "global.dispose", // 操作ID
          responses: {
            200: {
              description: "全局已释放", // Global disposed
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        async (c) => {
          await Instance.disposeAll() // 释放所有实例
          GlobalBus.emit("event", {
            // 发送全局释放事件
            directory: "global",
            payload: {
              type: Event.Disposed.type,
              properties: {},
            },
          })
          return c.json(true)
        },
      )
      .use(async (c, next) => {
        // 实例提供中间件
        const directory = c.req.query("directory") || c.req.header("x-opencode-directory") || process.cwd() // 获取目录
        return Instance.provide({
          // 提供实例上下文
          directory,
          init: InstanceBootstrap,
          async fn() {
            return next()
          },
        })
      })
      .get(
        "/doc",
        openAPIRouteHandler(app, {
          // OpenAPI文档路由
          documentation: {
            info: {
              title: "opencode",
              version: "0.0.3",
              description: "opencode api",
            },
            openapi: "3.1.1",
          },
        }),
      )
      .use(validator("query", z.object({ directory: z.string().optional() }))) // 验证查询参数

      .route("/project", ProjectRoute) // 挂载项目路由

      .get(
        "/pty",
        describeRoute({
          summary: "列出PTY会话", // List PTY sessions
          description: "获取OpenCode管理的所有活动伪终端(PTY)会话列表。", // Get a list of all active pseudo-terminal (PTY) sessions managed by OpenCode.
          operationId: "pty.list", // 操作ID
          responses: {
            200: {
              description: "会话列表", // List of sessions
              content: {
                "application/json": {
                  schema: resolver(Pty.Info.array()),
                },
              },
            },
          },
        }),
        async (c) => {
          return c.json(Pty.list())
        },
      )
      .post(
        "/pty",
        describeRoute({
          summary: "创建PTY会话", // Create PTY session
          description: "创建新的伪终端(PTY)会话，用于运行shell命令和进程。", // Create a new pseudo-terminal (PTY) session for running shell commands and processes.
          operationId: "pty.create", // 操作ID
          responses: {
            200: {
              description: "已创建的会话", // Created session
              content: {
                "application/json": {
                  schema: resolver(Pty.Info),
                },
              },
            },
            ...errors(400),
          },
        }),
        validator("json", Pty.CreateInput), // 验证JSON请求体
        async (c) => {
          const info = await Pty.create(c.req.valid("json"))
          return c.json(info)
        },
      )
      .get(
        "/pty/:ptyID",
        describeRoute({
          summary: "获取PTY会话", // Get PTY session
          description: "检索特定伪终端(PTY)会话的详细信息。", // Retrieve detailed information about a specific pseudo-terminal (PTY) session.
          operationId: "pty.get", // 操作ID
          responses: {
            200: {
              description: "会话信息", // Session info
              content: {
                "application/json": {
                  schema: resolver(Pty.Info),
                },
              },
            },
            ...errors(404),
          },
        }),
        validator("param", z.object({ ptyID: z.string() })), // 验证路径参数
        async (c) => {
          const info = Pty.get(c.req.valid("param").ptyID)
          if (!info) {
            throw new Storage.NotFoundError({ message: "未找到会话" })
          }
          return c.json(info)
        },
      )
      .put(
        "/pty/:ptyID",
        describeRoute({
          summary: "更新PTY会话", // Update PTY session
          description: "更新现有伪终端(PTY)会话的属性。", // Update properties of an existing pseudo-terminal (PTY) session.
          operationId: "pty.update", // 操作ID
          responses: {
            200: {
              description: "已更新的会话", // Updated session
              content: {
                "application/json": {
                  schema: resolver(Pty.Info),
                },
              },
            },
            ...errors(400),
          },
        }),
        validator("param", z.object({ ptyID: z.string() })), // 验证路径参数
        validator("json", Pty.UpdateInput), // 验证JSON请求体
        async (c) => {
          const info = await Pty.update(c.req.valid("param").ptyID, c.req.valid("json"))
          return c.json(info)
        },
      )
      .delete(
        "/pty/:ptyID",
        describeRoute({
          summary: "移除PTY会话", // Remove PTY session
          description: "移除并终止特定的伪终端(PTY)会话。", // Remove and terminate a specific pseudo-terminal (PTY) session.
          operationId: "pty.remove", // 操作ID
          responses: {
            200: {
              description: "会话已移除", // Session removed
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(404),
          },
        }),
        validator("param", z.object({ ptyID: z.string() })), // 验证路径参数
        async (c) => {
          await Pty.remove(c.req.valid("param").ptyID)
          return c.json(true)
        },
      )
      .get(
        "/pty/:ptyID/connect",
        describeRoute({
          summary: "连接到PTY会话", // Connect to PTY session
          description: "建立WebSocket连接以实时与伪终端(PTY)会话交互。", // Establish a WebSocket connection to interact with a pseudo-terminal (PTY) session in real-time.
          operationId: "pty.connect", // 操作ID
          responses: {
            200: {
              description: "已连接的会话", // Connected session
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(404),
          },
        }),
        validator("param", z.object({ ptyID: z.string() })), // 验证路径参数
        upgradeWebSocket((c) => {
          // 升级为WebSocket连接
          const id = c.req.param("ptyID")
          let handler: ReturnType<typeof Pty.connect>
          if (!Pty.get(id)) throw new Error("未找到会话")
          return {
            onOpen(_event, ws) {
              // WebSocket连接打开时的处理
              handler = Pty.connect(id, ws)
            },
            onMessage(event) {
              // 接收到消息时的处理
              handler?.onMessage(String(event.data))
            },
            onClose() {
              // 连接关闭时的处理
              handler?.onClose()
            },
          }
        }),
      )

      .get(
        "/config",
        describeRoute({
          summary: "获取配置", // Get configuration
          description: "检索当前的OpenCode配置设置和首选项。", // Retrieve the current OpenCode configuration settings and preferences.
          operationId: "config.get", // 操作ID
          responses: {
            200: {
              description: "配置信息", // Get config info
              content: {
                "application/json": {
                  schema: resolver(Config.Info),
                },
              },
            },
          },
        }),
        async (c) => {
          return c.json(await Config.get())
        },
      )

      .patch(
        "/config",
        describeRoute({
          summary: "更新配置", // Update configuration
          description: "更新OpenCode配置设置和首选项。", // Update OpenCode configuration settings and preferences.
          operationId: "config.update", // 操作ID
          responses: {
            200: {
              description: "配置更新成功", // Successfully updated config
              content: {
                "application/json": {
                  schema: resolver(Config.Info),
                },
              },
            },
            ...errors(400),
          },
        }),
        validator("json", Config.Info), // 验证JSON请求体
        async (c) => {
          const config = c.req.valid("json")
          await Config.update(config)
          return c.json(config)
        },
      )
      .get(
        "/experimental/tool/ids",
        describeRoute({
          summary: "列出工具ID", // List tool IDs
          description: "获取所有可用工具ID的列表，包括内置工具和动态注册的工具。", // Get a list of all available tool IDs, including both built-in tools and dynamically registered tools.
          operationId: "tool.ids", // 操作ID
          responses: {
            200: {
              description: "工具ID列表", // Tool IDs
              content: {
                "application/json": {
                  schema: resolver(z.array(z.string()).meta({ ref: "ToolIDs" })),
                },
              },
            },
            ...errors(400),
          },
        }),
        async (c) => {
          return c.json(await ToolRegistry.ids())
        },
      )
      .get(
        "/experimental/tool",
        describeRoute({
          summary: "列出工具", // List tools
          description: "获取可用工具列表及其JSON Schema参数，用于特定的提供者和模型组合。", // Get a list of available tools with their JSON schema parameters for a specific provider and model combination.
          operationId: "tool.list", // 操作ID
          responses: {
            200: {
              description: "工具列表", // Tools
              content: {
                "application/json": {
                  schema: resolver(
                    z
                      .array(
                        z
                          .object({
                            id: z.string(),
                            description: z.string(),
                            parameters: z.any(),
                          })
                          .meta({ ref: "ToolListItem" }),
                      )
                      .meta({ ref: "ToolList" }),
                  ),
                },
              },
            },
            ...errors(400),
          },
        }),
        validator(
          "query",
          z.object({
            provider: z.string(),
            model: z.string(),
          }),
        ), // 验证查询参数
        async (c) => {
          const { provider } = c.req.valid("query")
          const tools = await ToolRegistry.tools(provider)
          return c.json(
            tools.map((t) => ({
              id: t.id,
              description: t.description,
              // 处理Zod模式和纯JSON Schema
              parameters: (t.parameters as any)?._def ? zodToJsonSchema(t.parameters as any) : t.parameters,
            })),
          )
        },
      )
      .post(
        "/instance/dispose",
        describeRoute({
          summary: "释放实例", // Dispose instance
          description: "清理并释放当前的OpenCode实例，释放所有资源。", // Clean up and dispose the current OpenCode instance, releasing all resources.
          operationId: "instance.dispose", // 操作ID
          responses: {
            200: {
              description: "实例已释放", // Instance disposed
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        async (c) => {
          await Instance.dispose()
          return c.json(true)
        },
      )
      .get(
        "/path",
        describeRoute({
          summary: "获取路径", // Get paths
          description: "检索OpenCode实例的当前工作目录和相关路径信息。", // Retrieve the current working directory and related path information for the OpenCode instance.
          operationId: "path.get", // 操作ID
          responses: {
            200: {
              description: "路径信息", // Path
              content: {
                "application/json": {
                  schema: resolver(
                    z
                      .object({
                        home: z.string(), // 主目录路径
                        state: z.string(), // 状态目录路径
                        config: z.string(), // 配置目录路径
                        worktree: z.string(), // 工作树路径
                        directory: z.string(), // 当前目录路径
                      })
                      .meta({
                        ref: "Path",
                      }),
                  ),
                },
              },
            },
          },
        }),
        async (c) => {
          return c.json({
            home: Global.Path.home,
            state: Global.Path.state,
            config: Global.Path.config,
            worktree: Instance.worktree,
            directory: Instance.directory,
          })
        },
      )
      .get(
        "/vcs",
        describeRoute({
          summary: "获取VCS信息", // Get VCS info
          description: "检索当前项目的版本控制系统(VCS)信息，如git分支。", // Retrieve version control system (VCS) information for the current project, such as git branch.
          operationId: "vcs.get", // 操作ID
          responses: {
            200: {
              description: "VCS信息", // VCS info
              content: {
                "application/json": {
                  schema: resolver(Vcs.Info),
                },
              },
            },
          },
        }),
        async (c) => {
          const branch = await Vcs.branch()
          return c.json({
            branch,
          })
        },
      )
      .get(
        "/session",
        describeRoute({
          summary: "列出会话", // List sessions
          description: "获取所有OpenCode会话的列表，按最近更新时间排序。", // Get a list of all OpenCode sessions, sorted by most recently updated.
          operationId: "session.list", // 操作ID
          responses: {
            200: {
              description: "会话列表", // List of sessions
              content: {
                "application/json": {
                  schema: resolver(Session.Info.array()),
                },
              },
            },
          },
        }),
        async (c) => {
          const sessions = await Array.fromAsync(Session.list())
          pipe(
            await Array.fromAsync(Session.list()),
            filter((s) => !s.time.archived), // 过滤掉已归档的会话
            sortBy((s) => s.time.updated), // 按更新时间排序
          )
          return c.json(sessions)
        },
      )
      .get(
        "/session/status",
        describeRoute({
          summary: "获取会话状态", // Get session status
          description: "检索所有会话的当前状态，包括活动、空闲和完成状态。", // Retrieve the current status of all sessions, including active, idle, and completed states.
          operationId: "session.status", // 操作ID
          responses: {
            200: {
              description: "会话状态", // Get session status
              content: {
                "application/json": {
                  schema: resolver(z.record(z.string(), SessionStatus.Info)),
                },
              },
            },
            ...errors(400),
          },
        }),
        async (c) => {
          const result = SessionStatus.list()
          return c.json(result)
        },
      )
      .get(
        "/session/:sessionID",
        describeRoute({
          summary: "获取会话", // Get session
          description: "检索特定OpenCode会话的详细信息。", // Retrieve detailed information about a specific OpenCode session.
          tags: ["Session"], // 标签
          operationId: "session.get", // 操作ID
          responses: {
            200: {
              description: "会话信息", // Get session
              content: {
                "application/json": {
                  schema: resolver(Session.Info),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: Session.get.schema,
          }),
        ), // 验证路径参数
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          log.info("SEARCH", { url: c.req.url })
          const session = await Session.get(sessionID)
          return c.json(session)
        },
      )
      .get(
        "/session/:sessionID/children",
        describeRoute({
          summary: "获取会话子项", // Get session children
          tags: ["Session"], // 标签
          description: "检索从指定父会话派生的所有子会话。", // Retrieve all child sessions that were forked from the specified parent session.
          operationId: "session.children", // 操作ID
          responses: {
            200: {
              description: "子项列表", // List of children
              content: {
                "application/json": {
                  schema: resolver(Session.Info.array()),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: Session.children.schema,
          }),
        ), // 验证路径参数
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          const session = await Session.children(sessionID)
          return c.json(session)
        },
      )
      .get(
        "/session/:sessionID/todo",
        describeRoute({
          summary: "获取会话待办事项", // Get session todos
          description: "检索与特定会话关联的待办事项列表，显示任务和行动项。", // Retrieve the todo list associated with a specific session, showing tasks and action items.
          operationId: "session.todo", // 操作ID
          responses: {
            200: {
              description: "待办事项列表", // Todo list
              content: {
                "application/json": {
                  schema: resolver(Todo.Info.array()),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string().meta({ description: "会话ID" }), // Session ID
          }),
        ), // 验证路径参数
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          const todos = await Todo.get(sessionID)
          return c.json(todos)
        },
      )
      .post(
        "/session",
        describeRoute({
          summary: "创建会话", // Create session
          description: "创建新的OpenCode会话，用于与AI助手交互和管理对话。", // Create a new OpenCode session for interacting with AI assistants and managing conversations.
          operationId: "session.create", // 操作ID
          responses: {
            ...errors(400),
            200: {
              description: "会话创建成功", // Successfully created session
              content: {
                "application/json": {
                  schema: resolver(Session.Info),
                },
              },
            },
          },
        }),
        validator("json", Session.create.schema.optional()), // 验证JSON请求体（可选）
        async (c) => {
          const body = c.req.valid("json") ?? {}
          const session = await Session.create(body)
          return c.json(session)
        },
      )
      .delete(
        "/session/:sessionID",
        describeRoute({
          summary: "删除会话", // Delete session
          description: "删除会话并永久移除所有相关数据，包括消息和历史记录。", // Delete a session and permanently remove all associated data, including messages and history.
          operationId: "session.delete", // 操作ID
          responses: {
            200: {
              description: "会话删除成功", // Successfully deleted session
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: Session.remove.schema,
          }),
        ), // 验证路径参数
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          await Session.remove(sessionID)
          return c.json(true)
        },
      )
      .patch(
        "/session/:sessionID",
        describeRoute({
          summary: "更新会话", // Update session
          description: "更新现有会话的属性，如标题或其他元数据。", // Update properties of an existing session, such as title or other metadata.
          operationId: "session.update", // 操作ID
          responses: {
            200: {
              description: "会话更新成功", // Successfully updated session
              content: {
                "application/json": {
                  schema: resolver(Session.Info),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string(),
          }),
        ),
        validator(
          "json",
          z.object({
            title: z.string().optional(),
            time: z
              .object({
                archived: z.number().optional(),
              })
              .optional(),
          }),
        ),
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          const updates = c.req.valid("json")

          const updatedSession = await Session.update(sessionID, (session) => {
            if (updates.title !== undefined) {
              session.title = updates.title
            }
            if (updates.time?.archived !== undefined) session.time.archived = updates.time.archived
          })

          return c.json(updatedSession)
        },
      )
      .post(
        "/session/:sessionID/init",
        describeRoute({
          summary: "初始化会话", // Initialize session
          description: "分析当前应用程序并创建包含项目特定代理配置的AGENTS.md文件。", // Analyze the current application and create an AGENTS.md file with project-specific agent configurations.
          operationId: "session.init", // 操作ID
          responses: {
            200: {
              description: "200",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string().meta({ description: "会话ID" }), // Session ID
          }),
        ),
        validator("json", Session.initialize.schema.omit({ sessionID: true })),
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          const body = c.req.valid("json")
          await Session.initialize({ ...body, sessionID })
          return c.json(true)
        },
      )
      .post(
        "/session/:sessionID/fork",
        describeRoute({
          summary: "派生会话", // Fork session
          description: "在特定消息点通过派生现有会话来创建新会话。", // Create a new session by forking an existing session at a specific message point.
          operationId: "session.fork", // 操作ID
          responses: {
            200: {
              description: "200",
              content: {
                "application/json": {
                  schema: resolver(Session.Info),
                },
              },
            },
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: Session.fork.schema.shape.sessionID,
          }),
        ),
        validator("json", Session.fork.schema.omit({ sessionID: true })),
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          const body = c.req.valid("json")
          const result = await Session.fork({ ...body, sessionID })
          return c.json(result)
        },
      )
      .post(
        "/session/:sessionID/abort",
        describeRoute({
          summary: "中止会话", // Abort session
          description: "中止活动会话并停止任何正在进行的AI处理或命令执行。", // Abort an active session and stop any ongoing AI processing or command execution.
          operationId: "session.abort", // 操作ID
          responses: {
            200: {
              description: "会话已中止", // Aborted session
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string(),
          }),
        ),
        async (c) => {
          SessionPrompt.cancel(c.req.valid("param").sessionID)
          return c.json(true)
        },
      )
      .post(
        "/session/:sessionID/share",
        describeRoute({
          summary: "分享会话", // Share session
          description: "为会话创建可分享的链接，允许其他人查看对话。", // Create a shareable link for a session, allowing others to view the conversation.
          operationId: "session.share", // 操作ID
          responses: {
            200: {
              description: "会话分享成功", // Successfully shared session
              content: {
                "application/json": {
                  schema: resolver(Session.Info),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string(),
          }),
        ),
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          await Session.share(sessionID)
          const session = await Session.get(sessionID)
          return c.json(session)
        },
      )
      .get(
        "/session/:sessionID/diff",
        describeRoute({
          summary: "获取消息差异", // Get message diff
          description: "获取会话中特定用户消息导致的文件变更(diff)。", // Get the file changes (diff) that resulted from a specific user message in the session.
          operationId: "session.diff", // 操作ID
          responses: {
            200: {
              description: "差异获取成功", // Successfully retrieved diff
              content: {
                "application/json": {
                  schema: resolver(Snapshot.FileDiff.array()),
                },
              },
            },
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: SessionSummary.diff.schema.shape.sessionID,
          }),
        ),
        validator(
          "query",
          z.object({
            messageID: SessionSummary.diff.schema.shape.messageID,
          }),
        ),
        async (c) => {
          const query = c.req.valid("query")
          const params = c.req.valid("param")
          const result = await SessionSummary.diff({
            sessionID: params.sessionID,
            messageID: query.messageID,
          })
          return c.json(result)
        },
      )
      .delete(
        "/session/:sessionID/share",
        describeRoute({
          summary: "取消分享会话", // Unshare session
          description: "移除会话的可分享链接，使其重新变为私有。", // Remove shareable link for a session, making it private again.
          operationId: "session.unshare", // 操作ID
          responses: {
            200: {
              description: "会话取消分享成功", // Successfully unshared session
              content: {
                "application/json": {
                  schema: resolver(Session.Info),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: Session.unshare.schema,
          }),
        ), // 验证路径参数
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          await Session.unshare(sessionID)
          const session = await Session.get(sessionID)
          return c.json(session)
        },
      )
      .post(
        "/session/:sessionID/summarize",
        describeRoute({
          summary: "总结会话", // Summarize session
          description: "使用AI压缩生成会话的简洁摘要，以保留关键信息。", // Generate a concise summary of the session using AI compaction to preserve key information.
          operationId: "session.summarize", // 操作ID
          responses: {
            200: {
              description: "会话已总结", // Summarized session
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string().meta({ description: "会话ID" }), // Session ID
          }),
        ),
        validator(
          "json",
          z.object({
            providerID: z.string(),
            modelID: z.string(),
            auto: z.boolean().optional().default(false),
          }),
        ),
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          const body = c.req.valid("json")
          const session = await Session.get(sessionID)
          await SessionRevert.cleanup(session)
          const msgs = await Session.messages({ sessionID })
          let currentAgent = await Agent.defaultAgent()
          for (let i = msgs.length - 1; i >= 0; i--) {
            const info = msgs[i].info
            if (info.role === "user") {
              currentAgent = info.agent || (await Agent.defaultAgent())
              break
            }
          }
          await SessionCompaction.create({
            sessionID,
            agent: currentAgent,
            model: {
              providerID: body.providerID,
              modelID: body.modelID,
            },
            auto: body.auto,
          })
          await SessionPrompt.loop(sessionID)
          return c.json(true)
        },
      )
      .get(
        "/session/:sessionID/message",
        describeRoute({
          summary: "获取会话消息", // Get session messages
          description: "检索会话中的所有消息，包括用户提示和AI响应。", // Retrieve all messages in a session, including user prompts and AI responses.
          operationId: "session.messages", // 操作ID
          responses: {
            200: {
              description: "消息列表", // List of messages
              content: {
                "application/json": {
                  schema: resolver(MessageV2.WithParts.array()),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string().meta({ description: "会话ID" }), // Session ID
          }),
        ),
        validator(
          "query",
          z.object({
            limit: z.coerce.number().optional(),
          }),
        ),
        async (c) => {
          const query = c.req.valid("query")
          const messages = await Session.messages({
            sessionID: c.req.valid("param").sessionID,
            limit: query.limit,
          })
          return c.json(messages)
        },
      )
      .get(
        "/session/:sessionID/diff",
        describeRoute({
          summary: "获取会话差异", // Get session diff
          description: "获取在此会话期间进行的所有文件变更(diff)。", // Get all file changes (diffs) made during this session.
          operationId: "session.diff", // 操作ID
          responses: {
            200: {
              description: "差异列表", // List of diffs
              content: {
                "application/json": {
                  schema: resolver(Snapshot.FileDiff.array()),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string().meta({ description: "会话ID" }), // Session ID
          }),
        ),
        async (c) => {
          const diff = await Session.diff(c.req.valid("param").sessionID)
          return c.json(diff)
        },
      )
      .get(
        "/session/:sessionID/message/:messageID",
        describeRoute({
          summary: "获取消息", // Get message
          description: "通过消息ID从会话中检索特定消息。", // Retrieve a specific message from a session by its message ID.
          operationId: "session.message", // 操作ID
          responses: {
            200: {
              description: "消息", // Message
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      info: MessageV2.Info,
                      parts: MessageV2.Part.array(),
                    }),
                  ),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string().meta({ description: "会话ID" }), // Session ID
            messageID: z.string().meta({ description: "消息ID" }), // Message ID
          }),
        ),
        async (c) => {
          const params = c.req.valid("param")
          const message = await MessageV2.get({
            sessionID: params.sessionID,
            messageID: params.messageID,
          })
          return c.json(message)
        },
      )
      .delete(
        "/session/:sessionID/message/:messageID/part/:partID",
        describeRoute({
          description: "从消息中删除一个部分",  // Delete a part from a message
          operationId: "part.delete",  // 操作ID
          responses: {
            200: {
              description: "部分删除成功",  // Successfully deleted part
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string().meta({ description: "会话ID" }), // Session ID
            messageID: z.string().meta({ description: "消息ID" }), // Message ID
            partID: z.string().meta({ description: "部分ID" }), // Part ID
          }),
        ),
        async (c) => {
          const params = c.req.valid("param")
          await Session.removePart({
            sessionID: params.sessionID,
            messageID: params.messageID,
            partID: params.partID,
          })
          return c.json(true)
        },
      )
      .patch(
        "/session/:sessionID/message/:messageID/part/:partID",
        describeRoute({
          description: "更新消息中的一个部分",  // Update a part in a message
          operationId: "part.update",  // 操作ID
          responses: {
            200: {
              description: "部分更新成功",  // Successfully updated part
              content: {
                "application/json": {
                  schema: resolver(MessageV2.Part),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string().meta({ description: "会话ID" }), // Session ID
            messageID: z.string().meta({ description: "消息ID" }), // Message ID
            partID: z.string().meta({ description: "部分ID" }), // Part ID
          }),
        ),
        validator("json", MessageV2.Part),
        async (c) => {
          const params = c.req.valid("param")
          const body = c.req.valid("json")
          if (body.id !== params.partID || body.messageID !== params.messageID || body.sessionID !== params.sessionID) {
            throw new Error(
              `Part mismatch: body.id='${body.id}' vs partID='${params.partID}', body.messageID='${body.messageID}' vs messageID='${params.messageID}', body.sessionID='${body.sessionID}' vs sessionID='${params.sessionID}'`,
            )
          }
          const part = await Session.updatePart(body)
          return c.json(part)
        },
      )
      .post(
        "/session/:sessionID/message",
        describeRoute({
          summary: "发送消息", // Send message
          description: "创建并向会话发送新消息，流式传输AI响应。", // Create and send a new message to a session, streaming to AI response.
          operationId: "session.prompt", // 操作ID
          responses: {
            200: {
              description: "已创建消息", // Created message
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      info: MessageV2.Assistant,
                      parts: MessageV2.Part.array(),
                    }),
                  ),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string().meta({ description: "会话ID" }), // Session ID
          }),
        ),
        validator("json", SessionPrompt.PromptInput.omit({ sessionID: true })),
        async (c) => {
          c.status(200)
          c.header("Content-Type", "application/json")
          return stream(c, async (stream) => {
            const sessionID = c.req.valid("param").sessionID
            const body = c.req.valid("json")
            const msg = await SessionPrompt.prompt({ ...body, sessionID })
            stream.write(JSON.stringify(msg))
          })
        },
      )
      .post(
        "/session/:sessionID/prompt_async",
        describeRoute({
          summary: "发送异步消息", // Send async message
          description: "异步创建并向会话发送新消息，如需要则启动会话并立即返回。", // Create and send a new message to a session asynchronously, starting the session if needed and returning immediately.
          operationId: "session.prompt_async", // 操作ID
          responses: {
            204: {
              description: "提示已接受", // Prompt accepted
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string().meta({ description: "会话ID" }), // Session ID
          }),
        ),
        validator("json", SessionPrompt.PromptInput.omit({ sessionID: true })),
        async (c) => {
          c.status(204)
          c.header("Content-Type", "application/json")
          return stream(c, async () => {
            const sessionID = c.req.valid("param").sessionID
            const body = c.req.valid("json")
            SessionPrompt.prompt({ ...body, sessionID })
          })
        },
      )
      .post(
        "/session/:sessionID/command",
        describeRoute({
          summary: "发送命令", // Send command
          description: "向会话发送新命令，由AI助手执行。", // Send a new command to a session for execution by the AI assistant.
          operationId: "session.command", // 操作ID
          responses: {
            200: {
              description: "已创建消息", // Created message
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      info: MessageV2.Assistant,
                      parts: MessageV2.Part.array(),
                    }),
                  ),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string().meta({ description: "会话ID" }), // Session ID
          }),
        ),
        validator("json", SessionPrompt.CommandInput.omit({ sessionID: true })),
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          const body = c.req.valid("json")
          const msg = await SessionPrompt.command({ ...body, sessionID })
          return c.json(msg)
        },
      )
      .post(
        "/session/:sessionID/shell",
        describeRoute({
          summary: "运行shell命令", // Run shell command
          description: "在会话上下文中执行shell命令并返回AI的响应。", // Execute a shell command within the session context and return the AI's response.
          operationId: "session.shell", // 操作ID
          responses: {
            200: {
              description: "已创建消息", // Created message
              content: {
                "application/json": {
                  schema: resolver(MessageV2.Assistant),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string().meta({ description: "会话ID" }), // Session ID
          }),
        ),
        validator("json", SessionPrompt.ShellInput.omit({ sessionID: true })),
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          const body = c.req.valid("json")
          const msg = await SessionPrompt.shell({ ...body, sessionID })
          return c.json(msg)
        },
      )
      .post(
        "/session/:sessionID/revert",
        describeRoute({
          summary: "回滚消息", // Revert message
          description: "回滚会话中的特定消息，撤销其影响并恢复到之前的状态。", // Revert a specific message in a session, undoing its effects and restoring the previous state.
          operationId: "session.revert", // 操作ID
          responses: {
            200: {
              description: "会话已更新", // Updated session
              content: {
                "application/json": {
                  schema: resolver(Session.Info),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string(),
          }),
        ),
        validator("json", SessionRevert.RevertInput.omit({ sessionID: true })),
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          log.info("revert", c.req.valid("json"))
          const session = await SessionRevert.revert({
            sessionID,
            ...c.req.valid("json"),
          })
          return c.json(session)
        },
      )
      .post(
        "/session/:sessionID/unrevert",
        describeRoute({
          summary: "恢复已回滚的消息", // Restore reverted messages
          description: "恢复会话中所有之前已回滚的消息。", // Restore all previously reverted messages in a session.
          operationId: "session.unrevert", // 操作ID
          responses: {
            200: {
              description: "会话已更新", // Updated session
              content: {
                "application/json": {
                  schema: resolver(Session.Info),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string(),
          }),
        ),
        async (c) => {
          const sessionID = c.req.valid("param").sessionID
          const session = await SessionRevert.unrevert({ sessionID })
          return c.json(session)
        },
      )
      .post(
        "/session/:sessionID/permissions/:permissionID",
        describeRoute({
          summary: "响应权限", // Respond to permission
          deprecated: true,
          description: "批准或拒绝来自AI助手的权限请求。", // Approve or deny a permission request from the AI assistant.
          operationId: "permission.respond", // 操作ID
          responses: {
            200: {
              description: "权限处理成功", // Permission processed successfully
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            sessionID: z.string(),
            permissionID: z.string(),
          }),
        ),
        validator("json", z.object({ response: PermissionNext.Reply })),
        async (c) => {
          const params = c.req.valid("param")
          PermissionNext.reply({
            requestID: params.permissionID,
            reply: c.req.valid("json").response,
          })
          return c.json(true)
        },
      )
      .post(
        "/permission/:requestID/reply",
        describeRoute({
          summary: "响应权限请求", // Respond to permission request
          description: "批准或拒绝来自AI助手的权限请求。", // Approve or deny a permission request from the AI assistant.
          operationId: "permission.reply", // 操作ID
          responses: {
            200: {
              description: "权限处理成功", // Permission processed successfully
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "param",
          z.object({
            requestID: z.string(),
          }),
        ),
        validator("json", z.object({ reply: PermissionNext.Reply })),
        async (c) => {
          const params = c.req.valid("param")
          const json = c.req.valid("json")
          await PermissionNext.reply({
            requestID: params.requestID,
            reply: json.reply,
          })
          return c.json(true)
        },
      )
      .get(
        "/permission",
        describeRoute({
          summary: "列出待处理权限", // List pending permissions
          description: "获取所有会话中所有待处理的权限请求。", // Get all pending permission requests across all sessions.
          operationId: "permission.list", // 操作ID
          responses: {
            200: {
              description: "待处理权限列表", // List of pending permissions
              content: {
                "application/json": {
                  schema: resolver(PermissionNext.Request.array()),
                },
              },
            },
          },
        }),
        async (c) => {
          const permissions = await PermissionNext.list()
          return c.json(permissions)
        },
      )
      .get(
        "/command",
        describeRoute({
          summary: "列出命令", // List commands
          description: "获取OpenCode系统中所有可用命令的列表。", // Get a list of all available commands in the OpenCode system.
          operationId: "command.list", // 操作ID
          responses: {
            200: {
              description: "命令列表", // List of commands
              content: {
                "application/json": {
                  schema: resolver(Command.Info.array()),
                },
              },
            },
          },
        }),
        async (c) => {
          const commands = await Command.list()
          return c.json(commands)
        },
      )
      .get(
        "/config/providers",
        describeRoute({
          summary: "列出配置提供者", // List config providers
          description: "获取所有已配置的AI提供者及其默认模型的列表。", // Get a list of all configured AI providers and their default models.
          operationId: "config.providers", // 操作ID
          responses: {
            200: {
              description: "提供者列表", // List of providers
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      providers: Provider.Info.array(),
                      default: z.record(z.string(), z.string()),
                    }),
                  ),
                },
              },
            },
          },
        }),
        async (c) => {
          using _ = log.time("providers")
          const providers = await Provider.list().then((x) => mapValues(x, (item) => item))
          return c.json({
            providers: Object.values(providers),
            default: mapValues(providers, (item) => Provider.sort(Object.values(item.models))[0].id),
          })
        },
      )
      .get(
        "/provider",
        describeRoute({
          summary: "列出提供者", // List providers
          description: "获取所有可用AI提供者的列表，包括可用和已连接的提供者。", // Get a list of all available AI providers, including both available and connected ones.
          operationId: "provider.list", // 操作ID
          responses: {
            200: {
              description: "提供者列表", // List of providers
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      all: ModelsDev.Provider.array(),
                      default: z.record(z.string(), z.string()),
                      connected: z.array(z.string()),
                    }),
                  ),
                },
              },
            },
          },
        }),
        async (c) => {
          const config = await Config.get()
          const disabled = new Set(config.disabled_providers ?? [])
          const enabled = config.enabled_providers ? new Set(config.enabled_providers) : undefined

          const allProviders = await ModelsDev.get()
          const filteredProviders: Record<string, (typeof allProviders)[string]> = {}
          for (const [key, value] of Object.entries(allProviders)) {
            if ((enabled ? enabled.has(key) : true) && !disabled.has(key)) {
              filteredProviders[key] = value
            }
          }

          const connected = await Provider.list()
          const providers = Object.assign(
            mapValues(filteredProviders, (x) => Provider.fromModelsDevProvider(x)),
            connected,
          )
          return c.json({
            all: Object.values(providers),
            default: mapValues(providers, (item) => Provider.sort(Object.values(item.models))[0].id),
            connected: Object.keys(connected),
          })
        },
      )
      .get(
        "/provider/auth",
        describeRoute({
          summary: "获取提供者认证方法", // Get provider auth methods
          description: "检索所有AI提供者的可用认证方法。", // Retrieve available authentication methods for all AI providers.
          operationId: "provider.auth", // 操作ID
          responses: {
            200: {
              description: "提供者认证方法", // Provider auth methods
              content: {
                "application/json": {
                  schema: resolver(z.record(z.string(), z.array(ProviderAuth.Method))),
                },
              },
            },
          },
        }),
        async (c) => {
          return c.json(await ProviderAuth.methods())
        },
      )
      .post(
        "/provider/:providerID/oauth/authorize",
        describeRoute({
          summary: "OAuth授权",  // OAuth authorize
          description: "为特定AI提供商启动OAuth授权以获取授权URL。",  // Initiate OAuth authorization for a specific AI provider to get an authorization URL.
          operationId: "provider.oauth.authorize",  // 操作ID
          responses: {
            200: {
              description: "授权URL和方法",  // Authorization URL and method
              content: {
                "application/json": {
                  schema: resolver(ProviderAuth.Authorization.optional()),
                },
              },
            },
            ...errors(400),
          },
        }),
        validator(
          "param",
          z.object({
            providerID: z.string().meta({ description: "提供商ID" }), // Provider ID
          }),
        ),
        validator(
          "json",
          z.object({
            method: z.number().meta({ description: "认证方法索引" }), // Auth method index
          }),
        ),
        async (c) => {
          const providerID = c.req.valid("param").providerID
          const { method } = c.req.valid("json")
          const result = await ProviderAuth.authorize({
            providerID,
            method,
          })
          return c.json(result)
        },
      )
      .post(
        "/provider/:providerID/oauth/callback",
        describeRoute({
          summary: "OAuth回调", // OAuth callback
          description: "在用户授权后处理来自提供者的OAuth回调。", // Handle the OAuth callback from a provider after user authorization.
          operationId: "provider.oauth.callback", // 操作ID
          responses: {
            200: {
              description: "OAuth回调处理成功", // OAuth callback processed successfully
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400),
          },
        }),
        validator(
          "param",
          z.object({
            providerID: z.string().meta({ description: "提供商ID" }), // Provider ID
          }),
        ),
        validator(
          "json",
          z.object({
            method: z.number().meta({ description: "认证方法索引" }), // Auth method index
            code: z.string().optional().meta({ description: "OAuth授权码" }), // OAuth authorization code
          }),
        ),
        async (c) => {
          const providerID = c.req.valid("param").providerID
          const { method, code } = c.req.valid("json")
          await ProviderAuth.callback({
            providerID,
            method,
            code,
          })
          return c.json(true)
        },
      )
      .get(
        "/find",
        describeRoute({
          summary: "查找文本", // Find text
          description: "使用ripgrep在项目中的文件中搜索文本模式。", // Search for text patterns across files in the project using ripgrep.
          operationId: "find.text", // 操作ID
          responses: {
            200: {
              description: "匹配结果", // Matches
              content: {
                "application/json": {
                  schema: resolver(Ripgrep.Match.shape.data.array()),
                },
              },
            },
          },
        }),
        validator(
          "query",
          z.object({
            pattern: z.string(),
          }),
        ),
        async (c) => {
          const pattern = c.req.valid("query").pattern
          const result = await Ripgrep.search({
            cwd: Instance.directory,
            pattern,
            limit: 10,
          })
          return c.json(result)
        },
      )
      .get(
        "/find/file",
        describeRoute({
          summary: "查找文件", // Find files
          description: "在项目目录中按名称或模式搜索文件或目录。", // Search for files or directories by name or pattern in the project directory.
          operationId: "find.files", // 操作ID
          responses: {
            200: {
              description: "文件路径", // File paths
              content: {
                "application/json": {
                  schema: resolver(z.string().array()),
                },
              },
            },
          },
        }),
        validator(
          "query",
          z.object({
            query: z.string(),
            dirs: z.enum(["true", "false"]).optional(),
            type: z.enum(["file", "directory"]).optional(),
            limit: z.coerce.number().int().min(1).max(200).optional(),
          }),
        ),
        async (c) => {
          const query = c.req.valid("query").query
          const dirs = c.req.valid("query").dirs
          const type = c.req.valid("query").type
          const limit = c.req.valid("query").limit
          const results = await File.search({
            query,
            limit: limit ?? 10,
            dirs: dirs !== "false",
            type,
          })
          return c.json(results)
        },
      )
      .get(
        "/find/symbol",
        describeRoute({
          summary: "查找符号", // Find symbols
          description: "使用LSP搜索工作区符号，如函数、类和变量。", // Search for workspace symbols like functions, classes, and variables using LSP.
          operationId: "find.symbols", // 操作ID
          responses: {
            200: {
              description: "符号", // Symbols
              content: {
                "application/json": {
                  schema: resolver(LSP.Symbol.array()),
                },
              },
            },
          },
        }),
        validator(
          "query",
          z.object({
            query: z.string(),
          }),
        ),
        async (c) => {
          /*
          const query = c.req.valid("query").query
          const result = await LSP.workspaceSymbol(query)
          return c.json(result)
          */
          return c.json([])
        },
      )
      .get(
        "/file",
        describeRoute({
          summary: "列出文件", // List files
          description: "列出指定路径中的文件和目录。", // List files and directories in a specified path.
          operationId: "file.list", // 操作ID
          responses: {
            200: {
              description: "文件和目录", // Files and directories
              content: {
                "application/json": {
                  schema: resolver(File.Node.array()),
                },
              },
            },
          },
        }),
        validator(
          "query",
          z.object({
            path: z.string(),
          }),
        ),
        async (c) => {
          const path = c.req.valid("query").path
          const content = await File.list(path)
          return c.json(content)
        },
      )
      .get(
        "/file/content",
        describeRoute({
          summary: "读取文件", // Read file
          description: "读取指定文件的内容。", // Read the content of a specified file.
          operationId: "file.read", // 操作ID
          responses: {
            200: {
              description: "文件内容", // File content
              content: {
                "application/json": {
                  schema: resolver(File.Content),
                },
              },
            },
          },
        }),
        validator(
          "query",
          z.object({
            path: z.string(),
          }),
        ),
        async (c) => {
          const path = c.req.valid("query").path
          const content = await File.read(path)
          return c.json(content)
        },
      )
      .get(
        "/file/status",
        describeRoute({
          summary: "获取文件状态", // Get file status
          description: "获取项目中所有文件的git状态。", // Get the git status of all files in the project.
          operationId: "file.status", // 操作ID
          responses: {
            200: {
              description: "文件状态", // File status
              content: {
                "application/json": {
                  schema: resolver(File.Info.array()),
                },
              },
            },
          },
        }),
        async (c) => {
          const content = await File.status()
          return c.json(content)
        },
      )
      .post(
        "/log",
        describeRoute({
          summary: "写入日志", // Write log
          description: "使用指定级别和元数据向服务器日志写入日志条目。", // Write a log entry to the server logs with specified level and metadata.
          operationId: "app.log", // 操作ID
          responses: {
            200: {
              description: "日志条目写入成功", // Log entry written successfully
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400),
          },
        }),
        validator(
          "json",
          z.object({
            service: z.string().meta({ description: "日志条目的服务名称" }), // Service name for the log entry
            level: z.enum(["debug", "info", "error", "warn"]).meta({ description: "日志级别" }), // Log level
            message: z.string().meta({ description: "日志消息" }), // Log message
            extra: z
              .record(z.string(), z.any())
              .optional()
              .meta({ description: "日志条目的额外元数据" }), // Additional metadata for the log entry
          }),
        ),
        async (c) => {
          const { service, level, message, extra } = c.req.valid("json")
          const logger = Log.create({ service })

          switch (level) {
            case "debug":
              logger.debug(message, extra)
              break
            case "info":
              logger.info(message, extra)
              break
            case "error":
              logger.error(message, extra)
              break
            case "warn":
              logger.warn(message, extra)
              break
          }

          return c.json(true)
        },
      )
      .get(
        "/agent",
        describeRoute({
          summary: "列出代理", // List agents
          description: "获取OpenCode系统中所有可用AI代理的列表。", // Get a list of all available AI agents in the OpenCode system.
          operationId: "app.agents", // 操作ID
          responses: {
            200: {
              description: "代理列表", // List of agents
              content: {
                "application/json": {
                  schema: resolver(Agent.Info.array()),
                },
              },
            },
          },
        }),
        async (c) => {
          const modes = await Agent.list()
          return c.json(modes)
        },
      )
      .get(
        "/mcp",
        describeRoute({
          summary: "获取MCP状态", // Get MCP status
          description: "获取所有模型上下文协议(MCP)服务器的状态。", // Get the status of all Model Context Protocol (MCP) servers.
          operationId: "mcp.status", // 操作ID
          responses: {
            200: {
              description: "MCP服务器状态", // MCP server status
              content: {
                "application/json": {
                  schema: resolver(z.record(z.string(), MCP.Status)),
                },
              },
            },
          },
        }),
        async (c) => {
          return c.json(await MCP.status())
        },
      )
      .post(
        "/mcp",
        describeRoute({
          summary: "添加MCP服务器", // Add MCP server
          description: "动态地向系统添加一个新的模型上下文协议(MCP)服务器。", // Dynamically add a new Model Context Protocol (MCP) server to the system.
          operationId: "mcp.add", // 操作ID
          responses: {
            200: {
              description: "MCP服务器添加成功", // MCP server added successfully
              content: {
                "application/json": {
                  schema: resolver(z.record(z.string(), MCP.Status)),
                },
              },
            },
            ...errors(400),
          },
        }),
        validator(
          "json",
          z.object({
            name: z.string(),
            config: Config.Mcp,
          }),
        ),
        async (c) => {
          const { name, config } = c.req.valid("json")
          const result = await MCP.add(name, config)
          return c.json(result.status)
        },
      )
      .post(
        "/mcp/:name/auth",
        describeRoute({
          summary: "启动MCP OAuth", // Start MCP OAuth
          description: "为模型上下文协议(MCP)服务器启动OAuth认证流程。", // Start OAuth authentication flow for a Model Context Protocol (MCP) server.
          operationId: "mcp.auth.start", // 操作ID
          responses: {
            200: {
              description: "OAuth流程已启动", // OAuth flow started
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      authorizationUrl: z.string().describe("在浏览器中打开以进行授权的URL"), // URL to open in browser for authorization
                    }),
                  ),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        async (c) => {
          const name = c.req.param("name")
          const supportsOAuth = await MCP.supportsOAuth(name)
          if (!supportsOAuth) {
            return c.json({ error: `MCP server ${name} does not support OAuth` }, 400)
          }
          const result = await MCP.startAuth(name)
          return c.json(result)
        },
      )
      .post(
        "/mcp/:name/auth/callback",
        describeRoute({
          summary: "完成MCP OAuth", // Complete MCP OAuth
          description: "使用授权码完成模型上下文协议(MCP)服务器的OAuth认证。", // Complete OAuth authentication for a Model Context Protocol (MCP) server using the authorization code.
          operationId: "mcp.auth.callback", // 操作ID
          responses: {
            200: {
              description: "OAuth认证已完成", // OAuth authentication completed
              content: {
                "application/json": {
                  schema: resolver(MCP.Status),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        validator(
          "json",
          z.object({
            code: z.string().describe("来自OAuth回调的授权码"), // Authorization code from OAuth callback
          }),
        ),
        async (c) => {
          const name = c.req.param("name")
          const { code } = c.req.valid("json")
          const status = await MCP.finishAuth(name, code)
          return c.json(status)
        },
      )
      .post(
        "/mcp/:name/auth/authenticate",
        describeRoute({
          summary: "认证MCP OAuth", // Authenticate MCP OAuth
          description: "启动OAuth流程并等待回调(打开浏览器)", // Start OAuth flow and wait for callback (opens browser)
          operationId: "mcp.auth.authenticate", // 操作ID
          responses: {
            200: {
              description: "OAuth认证已完成", // OAuth authentication completed
              content: {
                "application/json": {
                  schema: resolver(MCP.Status),
                },
              },
            },
            ...errors(400, 404),
          },
        }),
        async (c) => {
          const name = c.req.param("name")
          const supportsOAuth = await MCP.supportsOAuth(name)
          if (!supportsOAuth) {
            return c.json({ error: `MCP server ${name} does not support OAuth` }, 400)
          }
          const status = await MCP.authenticate(name)
          return c.json(status)
        },
      )
      .delete(
        "/mcp/:name/auth",
        describeRoute({
          summary: "移除MCP OAuth", // Remove MCP OAuth
          description: "移除MCP服务器的OAuth凭据", // Remove OAuth credentials for an MCP server
          operationId: "mcp.auth.remove", // 操作ID
          responses: {
            200: {
              description: "OAuth凭据已移除", // OAuth credentials removed
              content: {
                "application/json": {
                  schema: resolver(z.object({ success: z.literal(true) })),
                },
              },
            },
            ...errors(404),
          },
        }),
        async (c) => {
          const name = c.req.param("name")
          await MCP.removeAuth(name)
          return c.json({ success: true as const })
        },
      )
      .post(
        "/mcp/:name/connect",
        describeRoute({
          description: "连接MCP服务器",  // Connect an MCP server
          operationId: "mcp.connect",  // 操作ID
          responses: {
            200: {
              description: "MCP服务器连接成功",  // MCP server connected successfully
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        validator("param", z.object({ name: z.string() })),
        async (c) => {
          const { name } = c.req.valid("param")
          await MCP.connect(name)
          return c.json(true)
        },
      )
      .post(
        "/mcp/:name/disconnect",
        describeRoute({
          description: "断开MCP服务器连接",  // Disconnect an MCP server
          operationId: "mcp.disconnect",  // 操作ID
          responses: {
            200: {
              description: "MCP服务器断开连接成功",  // MCP server disconnected successfully
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        validator("param", z.object({ name: z.string() })),
        async (c) => {
          const { name } = c.req.valid("param")
          await MCP.disconnect(name)
          return c.json(true)
        },
      )
      .get(
        "/lsp",
        describeRoute({
          summary: "获取LSP状态",  // Get LSP status
          description: "获取LSP服务器状态",  // Get LSP server status
          operationId: "lsp.status",  // 操作ID
          responses: {
            200: {
              description: "LSP服务器状态",  // LSP server status
              content: {
                "application/json": {
                  schema: resolver(LSP.Status.array()),
                },
              },
            },
          },
        }),
        async (c) => {
          return c.json(await LSP.status())
        },
      )
      .get(
        "/formatter",
        describeRoute({
          summary: "获取格式化器状态",  // Get formatter status
          description: "获取格式化器状态",  // Get formatter status
          operationId: "formatter.status",  // 操作ID
          responses: {
            200: {
              description: "格式化器状态",  // Formatter status
              content: {
                "application/json": {
                  schema: resolver(Format.Status.array()),
                },
              },
            },
          },
        }),
        async (c) => {
          return c.json(await Format.status())
        },
      )
      .post(
        "/tui/append-prompt",
        describeRoute({
          summary: "追加TUI提示",  // Append TUI prompt
          description: "向TUI追加提示",  // Append prompt to the TUI
          operationId: "tui.appendPrompt",  // 操作ID
          responses: {
            200: {
              description: "提示处理成功",  // Prompt processed successfully
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400),
          },
        }),
        validator("json", TuiEvent.PromptAppend.properties),
        async (c) => {
          await Bus.publish(TuiEvent.PromptAppend, c.req.valid("json"))
          return c.json(true)
        },
      )
      .post(
        "/tui/open-help",
        describeRoute({
          summary: "打开帮助对话框",  // Open help dialog
          description: "在TUI中打开帮助对话框以显示用户帮助信息。",  // Open the help dialog in the TUI to display user assistance information.
          operationId: "tui.openHelp",  // 操作ID
          responses: {
            200: {
              description: "帮助对话框打开成功",  // Help dialog opened successfully
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        async (c) => {
          // TODO: open dialog
          return c.json(true)
        },
      )
      .post(
        "/tui/open-sessions",
        describeRoute({
          summary: "打开会话对话框",  // Open sessions dialog
          description: "打开会话对话框",  // Open the session dialog
          operationId: "tui.openSessions",  // 操作ID
          responses: {
            200: {
              description: "会话对话框打开成功",  // Session dialog opened successfully
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        async (c) => {
          await Bus.publish(TuiEvent.CommandExecute, {
            command: "session.list",
          })
          return c.json(true)
        },
      )
      .post(
        "/tui/open-themes",
        describeRoute({
          summary: "打开主题对话框",  // Open themes dialog
          description: "打开主题对话框",  // Open the theme dialog
          operationId: "tui.openThemes",  // 操作ID
          responses: {
            200: {
              description: "主题对话框打开成功",  // Theme dialog opened successfully
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        async (c) => {
          await Bus.publish(TuiEvent.CommandExecute, {
            command: "session.list",
          })
          return c.json(true)
        },
      )
      .post(
        "/tui/open-models",
        describeRoute({
          summary: "打开模型对话框",  // Open models dialog
          description: "打开模型对话框",  // Open the model dialog
          operationId: "tui.openModels",  // 操作ID
          responses: {
            200: {
              description: "模型对话框打开成功",  // Model dialog opened successfully
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        async (c) => {
          await Bus.publish(TuiEvent.CommandExecute, {
            command: "model.list",
          })
          return c.json(true)
        },
      )
      .post(
        "/tui/submit-prompt",
        describeRoute({
          summary: "提交TUI提示",  // Submit TUI prompt
          description: "提交提示",  // Submit the prompt
          operationId: "tui.submitPrompt",  // 操作ID
          responses: {
            200: {
              description: "提示提交成功",  // Prompt submitted successfully
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        async (c) => {
          await Bus.publish(TuiEvent.CommandExecute, {
            command: "prompt.submit",
          })
          return c.json(true)
        },
      )
      .post(
        "/tui/clear-prompt",
        describeRoute({
          summary: "清除TUI提示",  // Clear TUI prompt
          description: "清除提示",  // Clear the prompt
          operationId: "tui.clearPrompt",  // 操作ID
          responses: {
            200: {
              description: "提示清除成功",  // Prompt cleared successfully
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        async (c) => {
          await Bus.publish(TuiEvent.CommandExecute, {
            command: "prompt.clear",
          })
          return c.json(true)
        },
      )
      .post(
        "/tui/execute-command",
        describeRoute({
          summary: "执行TUI命令",  // Execute TUI command
          description: "执行TUI命令(例如agent_cycle)",  // Execute a TUI command (e.g. agent_cycle)
          operationId: "tui.executeCommand",  // 操作ID
          responses: {
            200: {
              description: "命令执行成功",  // Command executed successfully
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400),
          },
        }),
        validator("json", z.object({ command: z.string() })),
        async (c) => {
          const command = c.req.valid("json").command
          await Bus.publish(TuiEvent.CommandExecute, {
            // @ts-expect-error
            command: {
              session_new: "session.new",
              session_share: "session.share",
              session_interrupt: "session.interrupt",
              session_compact: "session.compact",
              messages_page_up: "session.page.up",
              messages_page_down: "session.page.down",
              messages_half_page_up: "session.half.page.up",
              messages_half_page_down: "session.half.page.down",
              messages_first: "session.first",
              messages_last: "session.last",
              agent_cycle: "agent.cycle",
            }[command],
          })
          return c.json(true)
        },
      )
      .post(
        "/tui/show-toast",
        describeRoute({
          summary: "显示TUI提示",  // Show TUI toast
          description: "在TUI中显示提示通知",  // Show a toast notification in the TUI
          operationId: "tui.showToast",  // 操作ID
          responses: {
            200: {
              description: "提示通知显示成功",  // Toast notification shown successfully
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        validator("json", TuiEvent.ToastShow.properties),
        async (c) => {
          await Bus.publish(TuiEvent.ToastShow, c.req.valid("json"))
          return c.json(true)
        },
      )
      .post(
        "/tui/publish",
        describeRoute({
          summary: "发布TUI事件",  // Publish TUI event
          description: "发布TUI事件",  // Publish a TUI event
          operationId: "tui.publish",  // 操作ID
          responses: {
            200: {
              description: "事件发布成功",  // Event published successfully
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400),
          },
        }),
        validator(
          "json",
          z.union(
            Object.values(TuiEvent).map((def) => {
              return z
                .object({
                  type: z.literal(def.type),
                  properties: def.properties,
                })
                .meta({
                  ref: "Event" + "." + def.type,
                })
            }),
          ),
        ),
        async (c) => {
          const evt = c.req.valid("json")
          await Bus.publish(Object.values(TuiEvent).find((def) => def.type === evt.type)!, evt.properties)
          return c.json(true)
        },
      )
      .route("/tui/control", TuiRoute)
      .put(
        "/auth/:providerID",
        describeRoute({
          summary: "设置认证凭据",  // Set auth credentials
          description: "设置认证凭据",  // Set authentication credentials
          operationId: "auth.set",  // 操作ID
          responses: {
            200: {
              description: "成功设置认证凭据",  // Successfully set authentication credentials
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(400),
          },
        }),
        validator(
          "param",
          z.object({
            providerID: z.string(),
          }),
        ),
        validator("json", Auth.Info),
        async (c) => {
          const providerID = c.req.valid("param").providerID
          const info = c.req.valid("json")
          await Auth.set(providerID, info)
          return c.json(true)
        },
      )
      .get(
        "/event",
        describeRoute({
          summary: "订阅事件", // Subscribe to events
          description: "获取事件", // Get events
          operationId: "event.subscribe", // 操作ID
          responses: {
            200: {
              description: "事件流", // Event stream
              content: {
                "text/event-stream": {
                  schema: resolver(BusEvent.payloads()),
                },
              },
            },
          },
        }),
        async (c) => {
          log.info("事件已连接")  // 记录事件连接成功的日志
          return streamSSE(c, async (stream) => {
            stream.writeSSE({
              data: JSON.stringify({
                type: "server.connected",
                properties: {},
              }),
            })
            const unsub = Bus.subscribeAll(async (event) => {
              await stream.writeSSE({
                data: JSON.stringify(event),
              })
              if (event.type === Bus.InstanceDisposed.type) {
                stream.close()
              }
            })

            // Send heartbeat every 30s to prevent WKWebView timeout (60s default)
            const heartbeat = setInterval(() => {
              stream.writeSSE({
                data: JSON.stringify({
                  type: "server.heartbeat",
                  properties: {},
                }),
              })
            }, 30000)

            await new Promise<void>((resolve) => {
              stream.onAbort(() => {
                clearInterval(heartbeat)
                unsub()
                resolve()
                log.info("事件断开连接")  // 记录事件断开连接的日志
              })
            })
          })
        },
      )
      .all("/*", async (c) => {
        const path = c.req.path
        const response = await proxy(`https://app.opencode.ai${path}`, {
          ...c.req,
          headers: {
            host: "app.opencode.ai",
          },
        })
        // Cloudflare doesn't return Content-Type for static assets, so we need to add it
        const mimeTypes: Record<string, string> = {
          ".js": "application/javascript",
          ".mjs": "application/javascript",
          ".css": "text/css",
          ".json": "application/json",
          ".wasm": "application/wasm",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".gif": "image/gif",
          ".ico": "image/x-icon",
          ".webp": "image/webp",
          ".woff": "font/woff",
          ".woff2": "font/woff2",
          ".ttf": "font/ttf",
          ".eot": "application/vnd.ms-fontobject",
        }
        for (const [ext, mime] of Object.entries(mimeTypes)) {
          if (path.endsWith(ext)) {
            const headers = new Headers(response.headers)
            headers.set("Content-Type", mime)
            return new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers,
            })
          }
        }
        return response
      }),
  )

  export async function openapi() {
    // 生成OpenAPI文档
    const result = await generateSpecs(App(), {
      documentation: {
        info: {
          title: "opencode",
          version: "1.0.0",
          description: "opencode api",
        },
        openapi: "3.1.1",
      },
    })
    return result
  }

  export function listen(opts: { port: number; hostname: string; mdns?: boolean; cors?: string[] }) {
    // 启动服务器监听
    _corsWhitelist = opts.cors ?? []

    const args = {
      hostname: opts.hostname,
      idleTimeout: 0,
      fetch: App().fetch,
      websocket: websocket,
    } as const
    const tryServe = (port: number) => {
      // 尝试在指定端口启动服务器
      try {
        return Bun.serve({ ...args, port })
      } catch {
        return undefined
      }
    }
    const server = opts.port === 0 ? (tryServe(4096) ?? tryServe(0)) : tryServe(opts.port)
    if (!server) throw new Error(`无法在端口 ${opts.port} 上启动服务器`)  // 如果服务器启动失败，抛出错误

    _url = server.url

    const shouldPublishMDNS = // 判断是否应该发布mDNS服务
      opts.mdns &&
      server.port &&
      opts.hostname !== "127.0.0.1" &&
      opts.hostname !== "localhost" &&
      opts.hostname !== "::1"
    if (shouldPublishMDNS) {
      MDNS.publish(server.port!, `opencode-${server.port!}`) // 发布mDNS服务
    } else if (opts.mdns) {
      log.warn("mDNS已启用但主机名是回环地址，跳过mDNS发布")  // mDNS已启用但主机名是回环地址，跳过mDNS发布
    }

    const originalStop = server.stop.bind(server)
    server.stop = async (closeActiveConnections?: boolean) => {
      // 停止服务器
      if (shouldPublishMDNS) MDNS.unpublish() // 取消mDNS发布
      return originalStop(closeActiveConnections)
    }

    return server
  }
}
