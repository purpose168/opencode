// 从 OpenCode AI SDK v2 导入各种类型定义
// 这些类型定义描述了应用中使用的核心数据结构和实体
import type {
  Agent, // 待办事项类型，表示任务列表中的单个任务
  Command, // 部分类型，表示消息的组成部分（如文本、代码块等）
  Config, // MCP 状态类型，表示模型上下文协议的状态信息
  FormatterStatus, // 权限请求类型，表示智能体请求用户授权的请求
  LspStatus, // LSP 状态类型，表示语言服务器协议的状态信息
  McpStatus,
  Message, // 会话类型，表示一次完整的对话会话
  Part, // 命令类型，表示可执行的命令定义
  PermissionRequest, // 智能体类型，定义 AI 智能体的配置和行为
  Provider, // 提供者列表响应类型，列出所有可用的提供者
  ProviderAuthMethod, // 会话状态类型，表示会话的当前状态
  ProviderListResponse, // 提供者类型，表示 LLM 服务提供商
  Session, // 格式化器状态类型，表示代码格式化器的状态
  SessionStatus, // 配置类型，应用的整体配置信息
  Todo, // 提供者认证方法类型，表示提供者的认证方式
  VcsInfo, // 版本控制信息类型，表示 Git 等版本控制系统的信息
} from "@opencode-ai/sdk/v2"

import { createStore, produce, reconcile } from "solid-js/store" // Solid.js 状态管理库
// - createStore: 创建响应式状态存储，用于管理复杂的数据结构
// - produce: 基于 Immer 的状态更新工具，允许以不可变的方式更新嵌套数据
// - reconcile: 智能对账工具，用于高效合并和更新数组或对象

import { useSDK } from "@tui/context/sdk" // SDK 上下文钩子，用于访问 OpenCode SDK 客户端实例

import { Binary } from "@opencode-ai/util/binary" // 二分搜索工具库，用于在有序数组中高效查找元素
// Binary.search 提供了 O(log n) 时间复杂度的搜索算法

import { createSimpleContext } from "./helper" // 上下文创建工具，封装了常见的上下文创建模式

import type { Snapshot } from "@/snapshot" // 快照类型定义，用于表示文件的差异和变更

import { useExit } from "./exit" // 退出上下文钩子，用于处理应用退出流程

import { useArgs } from "./args" // 命令行参数上下文钩子，用于访问启动参数

import { batch, onMount } from "solid-js" // Solid.js 生命周期和工具函数
// - batch: 批量更新函数，将多个状态更新合并为一次渲染
// - onMount: 挂载函数，在组件首次渲染后执行初始化逻辑

import { Log } from "@/util/log" // 日志工具，用于记录应用运行时的日志信息

import type { Path } from "@opencode-ai/sdk" // 路径类型，定义各种项目路径信息

// 创建同步上下文提供者
// 使用 createSimpleContext 工具函数快速创建一个同步状态管理上下文
// 这个上下文用于在整个应用组件树中管理同步数据，包括会话、消息、智能体、配置等
// 通过订阅 SDK 事件实现数据的实时同步更新
//
// 返回值包含两个主要部分：
// - use: 用于在子组件中获取同步数据和操作函数的钩子函数
// - provider: 用于在父组件中提供同步上下文的组件
export const { use: useSync, provider: SyncProvider } = createSimpleContext({
  name: "Sync", // 上下文的名称，用于调试和错误提示
  init: () => {
    // 创建同步数据的响应式 store
    // 这个 store 包含了应用运行所需的所有同步状态数据
    // 使用 TypeScript 泛型确保类型安全
    const [store, setStore] = createStore<{
      status: "loading" | "partial" | "complete" // 同步状态：加载中/部分加载/完全加载
      provider: Provider[] // 已配置的 LLM 提供者列表
      provider_default: Record<string, string> // 提供者的默认模型映射
      provider_next: ProviderListResponse // 下一个可用的提供者列表
      provider_auth: Record<string, ProviderAuthMethod[]> // 各提供者的认证方法配置
      agent: Agent[] // 已配置的智能体列表
      command: Command[] // 可用的命令列表
      permission: {
        // 会话权限请求映射，按会话 ID 索引
        [sessionID: string]: PermissionRequest[]
      }
      config: Config // 应用配置信息
      session: Session[] // 会话列表
      session_status: {
        // 会话状态映射，按会话 ID 索引
        [sessionID: string]: SessionStatus
      }
      session_diff: {
        // 会话文件差异映射，按会话 ID 索引
        [sessionID: string]: Snapshot.FileDiff[]
      }
      todo: {
        // 会话待办事项映射，按会话 ID 索引
        [sessionID: string]: Todo[]
      }
      message: {
        // 会话消息映射，按会话 ID 索引
        [sessionID: string]: Message[]
      }
      part: {
        // 消息部分映射，按消息 ID 索引
        [messageID: string]: Part[]
      }
      lsp: LspStatus[] // LSP 服务器状态列表
      mcp: {
        // MCP 服务器状态映射，按服务器名称索引
        [key: string]: McpStatus
      }
      formatter: FormatterStatus[] // 格式化器状态列表
      vcs: VcsInfo | undefined // 版本控制信息
      path: Path // 项目路径信息
    }>({
      // 初始化同步数据的默认值
      // 这些初始值确保在数据加载完成前应用可以正常渲染
      provider_next: {
        all: [], // 所有可用提供者列表
        default: {}, // 默认提供者配置
        connected: [], // 已连接的提供者列表
      },
      provider_auth: {}, // 提供者认证配置初始化为空对象
      config: {}, // 配置初始化为空对象
      status: "loading", // 初始状态为加载中
      agent: [], // 智能体列表初始化为空数组
      permission: {}, // 权限请求初始化为空对象
      command: [], // 命令列表初始化为空数组
      provider: [], // 提供者列表初始化为空数组
      provider_default: {}, // 默认提供者映射初始化为空对象
      session: [], // 会话列表初始化为空数组
      session_status: {}, // 会话状态初始化为空对象
      session_diff: {}, // 会话差异初始化为空对象
      todo: {}, // 待办事项初始化为空对象
      message: {}, // 消息初始化为空对象
      part: {}, // 消息部分初始化为空对象
      lsp: [], // LSP 状态初始化为空数组
      mcp: {}, // MCP 状态初始化为空对象
      formatter: [], // 格式化器状态初始化为空数组
      vcs: undefined, // 版本控制信息初始为未定义
      // 路径信息初始化为包含空字符串的对象
      path: { state: "", config: "", worktree: "", directory: "" },
    })

    // 获取 SDK 上下文，用于访问 SDK 客户端和事件系统
    const sdk = useSDK()

    // 监听 SDK 事件并更新同步 store
    // 根据不同类型的事件执行相应的状态更新逻辑
    sdk.event.listen((e) => {
      // 从事件详情中获取事件数据
      const event = e.details

      // 使用 switch 语句处理各种事件类型
      switch (event.type) {
        // 处理权限请求已回复的事件
        case "permission.replied": {
          // 获取该会话的权限请求列表
          const requests = store.permission[event.properties.sessionID]
          if (!requests) break // 如果没有请求，直接退出

          // 使用二分搜索查找对应的权限请求
          const match = Binary.search(requests, event.properties.requestID, (r) => r.id)
          if (!match.found) break // 如果没找到，直接退出

          // 从请求列表中移除已回复的请求
          setStore(
            "permission",
            event.properties.sessionID,
            produce((draft) => {
              draft.splice(match.index, 1)
            }),
          )
          break
        }

        // 处理新的权限请求事件
        case "permission.asked": {
          // 获取请求详情
          const request = event.properties
          // 获取该会话现有的权限请求列表
          const requests = store.permission[request.sessionID]

          if (!requests) {
            // 如果没有现有请求，直接创建新列表
            setStore("permission", request.sessionID, [request])
            break
          }

          // 使用二分搜索检查请求是否已存在
          const match = Binary.search(requests, request.id, (r) => r.id)
          if (match.found) {
            // 如果请求已存在，更新该请求
            setStore("permission", request.sessionID, match.index, reconcile(request))
            break
          }

          // 如果请求不存在，添加到列表开头
          setStore(
            "permission",
            request.sessionID,
            produce((draft) => {
              draft.splice(match.index, 0, request)
            }),
          )
          break
        }

        // 处理待办事项更新事件
        case "todo.updated":
          setStore("todo", event.properties.sessionID, event.properties.todos)
          break

        // 处理会话差异更新事件
        case "session.diff":
          setStore("session_diff", event.properties.sessionID, event.properties.diff)
          break

        // 处理会话删除事件
        case "session.deleted": {
          // 在会话列表中查找要删除的会话
          const result = Binary.search(store.session, event.properties.info.id, (s) => s.id)
          if (result.found) {
            // 从会话列表中移除该会话
            setStore(
              "session",
              produce((draft) => {
                draft.splice(result.index, 1)
              }),
            )
          }
          break
        }

        // 处理会话更新事件
        case "session.updated": {
          // 在会话列表中查找要更新的会话
          const result = Binary.search(store.session, event.properties.info.id, (s) => s.id)
          if (result.found) {
            // 如果找到，更新该会话的信息
            setStore("session", result.index, reconcile(event.properties.info))
            break
          }

          // 如果没找到，将新会话添加到列表开头
          setStore(
            "session",
            produce((draft) => {
              draft.splice(result.index, 0, event.properties.info)
            }),
          )
          break
        }

        // 处理会话状态更新事件
        case "session.status": {
          setStore("session_status", event.properties.sessionID, event.properties.status)
          break
        }

        // 处理消息更新事件
        case "message.updated": {
          // 获取该会话的消息列表
          const messages = store.message[event.properties.info.sessionID]
          if (!messages) {
            // 如果没有消息列表，创建新列表
            setStore("message", event.properties.info.sessionID, [event.properties.info])
            break
          }

          // 在消息列表中查找要更新的消息
          const result = Binary.search(messages, event.properties.info.id, (m) => m.id)
          if (result.found) {
            // 如果找到，更新该消息
            setStore("message", event.properties.info.sessionID, result.index, reconcile(event.properties.info))
            break
          }

          // 如果没找到，将新消息添加到列表开头
          setStore(
            "message",
            event.properties.info.sessionID,
            produce((draft) => {
              draft.splice(result.index, 0, event.properties.info)
              // 限制消息数量，最多保留 100 条
              if (draft.length > 100) draft.shift()
            }),
          )
          break
        }

        // 处理消息删除事件
        case "message.removed": {
          // 获取该会话的消息列表
          const messages = store.message[event.properties.sessionID]
          // 在消息列表中查找要删除的消息
          const result = Binary.search(messages, event.properties.messageID, (m) => m.id)
          if (result.found) {
            // 从消息列表中移除该消息
            setStore(
              "message",
              event.properties.sessionID,
              produce((draft) => {
                draft.splice(result.index, 1)
              }),
            )
          }
          break
        }

        // 处理消息部分更新事件
        case "message.part.updated": {
          // 获取该消息的部分列表
          const parts = store.part[event.properties.part.messageID]
          if (!parts) {
            // 如果没有部分列表，创建新列表
            setStore("part", event.properties.part.messageID, [event.properties.part])
            break
          }

          // 在部分列表中查找要更新的部分
          const result = Binary.search(parts, event.properties.part.id, (p) => p.id)
          if (result.found) {
            // 如果找到，更新该部分
            setStore("part", event.properties.part.messageID, result.index, reconcile(event.properties.part))
            break
          }

          // 如果没找到，将新部分添加到列表开头
          setStore(
            "part",
            event.properties.part.messageID,
            produce((draft) => {
              draft.splice(result.index, 0, event.properties.part)
            }),
          )
          break
        }

        // 处理消息部分删除事件
        case "message.part.removed": {
          // 获取该消息的部分列表
          const parts = store.part[event.properties.messageID]
          // 在部分列表中查找要删除的部分
          const result = Binary.search(parts, event.properties.partID, (p) => p.id)
          if (result.found)
            // 从部分列表中移除该部分
            setStore(
              "part",
              event.properties.messageID,
              produce((draft) => {
                draft.splice(result.index, 1)
              }),
            )
          break
        }

        // 处理 LSP 状态更新事件
        case "lsp.updated": {
          // 从服务器获取最新的 LSP 状态
          sdk.client.lsp.status().then((x) => setStore("lsp", x.data!))
          break
        }

        // 处理版本控制分支更新事件
        case "vcs.branch.updated": {
          // 更新分支信息
          setStore("vcs", { branch: event.properties.branch })
          break
        }
      }
    })

    // 获取退出和参数上下文
    const exit = useExit()
    const args = useArgs()

    // 引导函数：初始化同步数据
    // 这个函数负责从服务器加载所有必要的同步数据
    async function bootstrap() {
      // 创建获取会话列表的 Promise
      const sessionListPromise = sdk.client.session.list().then((x) =>
        // 获取会话列表并按 ID 排序
        setStore(
          "session",
          (x.data ?? []).toSorted((a, b) => a.id.localeCompare(b.id)),
        ),
      )

      // 阻塞性请求：必须先完成的请求
      // 这些请求是应用运行所必需的，必须全部成功才能继续
      const blockingRequests: Promise<unknown>[] = [
        // 获取提供者配置
        sdk.client.config.providers({}, { throwOnError: true }).then((x) => {
          batch(() => {
            setStore("provider", x.data!.providers)
            setStore("provider_default", x.data!.default)
          })
        }),
        // 获取可用提供者列表
        sdk.client.provider.list({}, { throwOnError: true }).then((x) => {
          batch(() => {
            setStore("provider_next", x.data!)
          })
        }),
        // 获取智能体列表
        sdk.client.app.agents({}, { throwOnError: true }).then((x) => setStore("agent", x.data ?? [])),
        // 获取应用配置
        sdk.client.config.get({}, { throwOnError: true }).then((x) => setStore("config", x.data!)),
        // 如果是继续会话模式，添加会话列表请求
        ...(args.continue ? [sessionListPromise] : []),
      ]

      // 等待所有阻塞性请求完成
      await Promise.all(blockingRequests)
        .then(() => {
          // 阻塞性请求完成后，更新状态为部分加载
          if (store.status !== "complete") setStore("status", "partial")

          // 非阻塞性请求：可以并行执行的请求
          // 这些请求不影响应用的核心功能，可以异步加载
          Promise.all([
            // 如果不是继续会话模式，添加会话列表请求
            ...(args.continue ? [] : [sessionListPromise]),
            // 获取命令列表
            sdk.client.command.list().then((x) => setStore("command", x.data ?? [])),
            // 获取 LSP 状态
            sdk.client.lsp.status().then((x) => setStore("lsp", x.data!)),
            // 获取 MCP 状态
            sdk.client.mcp.status().then((x) => setStore("mcp", x.data!)),
            // 获取格式化器状态
            sdk.client.formatter.status().then((x) => setStore("formatter", x.data!)),
            // 获取会话状态
            sdk.client.session.status().then((x) => setStore("session_status", x.data!)),
            // 获取提供者认证信息
            sdk.client.provider.auth().then((x) => setStore("provider_auth", x.data ?? {})),
            // 获取版本控制信息
            sdk.client.vcs.get().then((x) => setStore("vcs", x.data)),
            // 获取路径信息
            sdk.client.path.get().then((x) => setStore("path", x.data!)),
            // 非阻塞性请求完成后，更新状态为完全加载
          ]).then(() => {
            setStore("status", "complete")
          })
        })
        .catch(async (e) => {
          // 处理引导过程中的错误
          Log.Default.error("tui bootstrap failed", {
            error: e instanceof Error ? e.message : String(e),
            name: e instanceof Error ? e.name : undefined,
            stack: e instanceof Error ? e.stack : undefined,
          })
          // 调用退出函数，传入错误信息
          await exit(e)
        })
    }

    // 在组件挂载时启动引导流程
    onMount(() => {
      bootstrap()
    })

    // 已完全同步的会话集合，用于避免重复同步
    const fullSyncedSessions = new Set<string>()

    // 返回同步管理的操作接口
    const result = {
      data: store, // 同步数据的只读引用
      set: setStore, // 直接更新 store 的方法
      // 获取当前同步状态
      get status() {
        return store.status
      },
      // 检查是否已就绪（不是加载中状态）
      get ready() {
        return store.status !== "loading"
      },
      // 会话管理模块
      session: {
        // 获取指定会话
        get(sessionID: string) {
          // 使用二分搜索在会话列表中查找
          const match = Binary.search(store.session, sessionID, (s) => s.id)
          if (match.found) return store.session[match.index]
          return undefined
        },
        // 获取会话状态
        status(sessionID: string) {
          const session = result.session.get(sessionID)
          if (!session) return "idle" // 如果没有找到会话，返回空闲状态
          if (session.time.compacting) return "compacting" // 如果正在压缩，返回压缩中状态
          const messages = store.message[sessionID] ?? []
          const last = messages.at(-1) // 获取最后一条消息
          if (!last) return "idle" // 如果没有消息，返回空闲状态
          if (last.role === "user") return "working" // 如果最后一条是用户消息，返回工作中状态
          return last.time.completed ? "idle" : "working" // 根据最后消息是否完成返回状态
        },
        // 同步指定会话的数据
        async sync(sessionID: string) {
          // 如果已经同步过，跳过
          if (fullSyncedSessions.has(sessionID)) return

          // 并行获取会话的各种数据
          const [session, messages, todo, diff] = await Promise.all([
            // 获取会话详情
            sdk.client.session.get({ sessionID }, { throwOnError: true }),
            // 获取会话消息（限制 100 条）
            sdk.client.session.messages({ sessionID, limit: 100 }),
            // 获取会话待办事项
            sdk.client.session.todo({ sessionID }),
            // 获取会话文件差异
            sdk.client.session.diff({ sessionID }),
          ])

          // 更新 store 中的会话数据
          setStore(
            produce((draft) => {
              // 查找或添加会话到列表
              const match = Binary.search(draft.session, sessionID, (s) => s.id)
              if (match.found) draft.session[match.index] = session.data! // 更新现有会话
              if (!match.found) draft.session.splice(match.index, 0, session.data!) // 添加新会话

              // 更新待办事项
              draft.todo[sessionID] = todo.data ?? []
              // 更新消息列表
              draft.message[sessionID] = messages.data!.map((x) => x.info)
              // 更新消息部分
              for (const message of messages.data!) {
                draft.part[message.info.id] = message.parts
              }
              // 更新会话差异
              draft.session_diff[sessionID] = diff.data ?? []
            }),
          )

          // 标记该会话已完全同步
          fullSyncedSessions.add(sessionID)
        },
      },
      bootstrap, // 引导函数，用于重新初始化同步数据
    }
    return result
  },
})
