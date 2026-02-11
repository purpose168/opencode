import { Bus } from "@/bus" // 导入总线
import { BusEvent } from "@/bus/bus-event" // 导入总线事件
import { NamedError } from "@opencode-ai/util/error" // 导入命名错误工具
import path from "path" // 导入路径处理模块
import { fileURLToPath, pathToFileURL } from "url" // 导入URL路径转换工具
import { createMessageConnection, StreamMessageReader, StreamMessageWriter } from "vscode-jsonrpc/node" // 导入JSON-RPC消息连接工具
import type { Diagnostic as VSCodeDiagnostic } from "vscode-languageserver-types" // 导入VS Code语言服务器诊断类型
import z from "zod" // 导入zod库用于数据验证
import { Instance } from "../project/instance" // 导入实例管理模块
import { Filesystem } from "../util/filesystem" // 导入文件系统工具
import { Log } from "../util/log" // 导入日志工具
import { withTimeout } from "../util/timeout" // 导入超时工具
import { LANGUAGE_EXTENSIONS } from "./language" // 导入语言扩展映射
import type { LSPServer } from "./server" // 导入LSP服务器类型

const DIAGNOSTICS_DEBOUNCE_MS = 150 // 诊断信息防抖延迟(毫秒)

export namespace LSPClient {
  const log = Log.create({ service: "lsp.client" }) // 创建LSP客户端服务日志记录器

  export type Info = NonNullable<Awaited<ReturnType<typeof create>>> // LSP客户端信息类型

  export type Diagnostic = VSCodeDiagnostic // 诊断信息类型

  // LSP初始化错误
  export const InitializeError = NamedError.create(
    "LSPInitializeError",
    z.object({
      serverID: z.string(), // 服务器ID
    }),
  )

  export const Event = {
    // 诊断信息发布事件
    Diagnostics: BusEvent.define(
      "lsp.client.diagnostics",
      z.object({
        serverID: z.string(), // 服务器ID
        path: z.string(), // 文件路径
      }),
    ),
  }

  // 创建LSP客户端
  export async function create(input: { serverID: string; server: LSPServer.Handle; root: string }) {
    const l = log.clone().tag("serverID", input.serverID) // 创建带服务器ID标签的日志记录器
    l.info("启动客户端") // 记录客户端启动日志

    // 创建消息连接
    const connection = createMessageConnection(
      new StreamMessageReader(input.server.process.stdout as any), // 从服务器进程读取消息
      new StreamMessageWriter(input.server.process.stdin as any), // 向服务器进程写入消息
    )

    const diagnostics = new Map<string, Diagnostic[]>() // 存储文件诊断信息的映射
    // 监听诊断信息发布通知
    connection.onNotification("textDocument/publishDiagnostics", (params) => {
      const filePath = Filesystem.normalizePath(fileURLToPath(params.uri)) // 规范化文件路径
      l.info("文档/发布诊断信息", {
        path: filePath,
        count: params.diagnostics.length,
      })
      const exists = diagnostics.has(filePath)
      diagnostics.set(filePath, params.diagnostics) // 存储诊断信息
      // 对于TypeScript服务器,首次诊断不发布事件
      if (!exists && input.serverID === "typescript") return
      Bus.publish(Event.Diagnostics, { path: filePath, serverID: input.serverID }) // 发布诊断事件
    })
    // 监听工作进度创建请求
    connection.onRequest("window/workDoneProgress/create", (params) => {
      l.info("窗口/创建工作进度", params)
      return null
    })
    // 监听工作区配置请求
    connection.onRequest("workspace/configuration", async () => {
      // 返回服务器初始化选项
      return [input.server.initialization ?? {}]
    })
    // 监听客户端能力注册请求
    connection.onRequest("client/registerCapability", async () => {})
    // 监听客户端能力注销请求
    connection.onRequest("client/unregisterCapability", async () => {})
    // 监听工作区文件夹请求
    connection.onRequest("workspace/workspaceFolders", async () => [
      {
        name: "workspace", // 工作区名称
        uri: pathToFileURL(input.root).href, // 工作区URI
      },
    ])
    connection.listen() // 开始监听消息

    l.info("发送初始化请求") // 记录发送初始化请求日志
    // 发送初始化请求
    await withTimeout(
      connection.sendRequest("initialize", {
        rootUri: pathToFileURL(input.root).href, // 根目录URI
        processId: input.server.process.pid, // 进程ID
        workspaceFolders: [
          {
            name: "workspace", // 工作区名称
            uri: pathToFileURL(input.root).href, // 工作区URI
          },
        ],
        initializationOptions: {
          ...input.server.initialization, // 初始化选项
        },
        capabilities: {
          window: {
            workDoneProgress: true, // 支持工作进度
          },
          workspace: {
            configuration: true, // 支持配置
            didChangeWatchedFiles: {
              dynamicRegistration: true, // 支持动态注册文件监视
            },
          },
          textDocument: {
            synchronization: {
              didOpen: true, // 支持打开文档
              didChange: true, // 支持文档变更
            },
            publishDiagnostics: {
              versionSupport: true, // 支持诊断版本
            },
          },
        },
      }),
      45_000, // 45秒超时
    ).catch((err) => {
      l.error("初始化错误", { error: err }) // 记录初始化错误
      throw new InitializeError(
        { serverID: input.serverID },
        {
          cause: err,
        },
      )
    })

    await connection.sendNotification("initialized", {}) // 发送初始化完成通知

    // 如果有初始化选项,发送配置变更通知
    if (input.server.initialization) {
      await connection.sendNotification("workspace/didChangeConfiguration", {
        settings: input.server.initialization,
      })
    }

    const files: {
      [path: string]: number // 文件版本映射
    } = {}

    // 返回LSP客户端对象
    const result = {
      root: input.root, // 根目录
      get serverID() {
        return input.serverID // 服务器ID
      },
      get connection() {
        return connection // 消息连接
      },
      notify: {
        // 通知服务器文件已打开或变更
        async open(input: { path: string }) {
          input.path = path.isAbsolute(input.path) ? input.path : path.resolve(Instance.directory, input.path) // 解析绝对路径
          const file = Bun.file(input.path)
          const text = await file.text() // 读取文件内容
          const extension = path.extname(input.path) // 获取文件扩展名
          const languageId = LANGUAGE_EXTENSIONS[extension] ?? "plaintext" // 获取语言ID

          const version = files[input.path]
          // 如果文件已打开,发送变更通知
          if (version !== undefined) {
            log.info("工作区/文件已变更", input)
            await connection.sendNotification("workspace/didChangeWatchedFiles", {
              changes: [
                {
                  uri: pathToFileURL(input.path).href,
                  type: 2, // 已变更
                },
              ],
            })

            const next = version + 1
            files[input.path] = next
            log.info("文档/已变更", {
              path: input.path,
              version: next,
            })
            await connection.sendNotification("textDocument/didChange", {
              textDocument: {
                uri: pathToFileURL(input.path).href,
                version: next,
              },
              contentChanges: [{ text }], // 文件内容变更
            })
            return
          }

          // 文件首次打开,发送打开通知
          log.info("工作区/文件已变更", input)
          await connection.sendNotification("workspace/didChangeWatchedFiles", {
            changes: [
              {
                uri: pathToFileURL(input.path).href,
                type: 1, // 已创建
              },
            ],
          })

          log.info("文档/已打开", input)
          diagnostics.delete(input.path) // 清除旧的诊断信息
          await connection.sendNotification("textDocument/didOpen", {
            textDocument: {
              uri: pathToFileURL(input.path).href,
              languageId,
              version: 0,
              text,
            },
          })
          files[input.path] = 0
          return
        },
      },
      get diagnostics() {
        return diagnostics // 获取所有诊断信息
      },
      // 等待指定文件的诊断信息
      async waitForDiagnostics(input: { path: string }) {
        const normalizedPath = Filesystem.normalizePath(
          path.isAbsolute(input.path) ? input.path : path.resolve(Instance.directory, input.path), // 规范化路径
        )
        log.info("等待诊断信息", { path: normalizedPath })
        let unsub: () => void
        let debounceTimer: ReturnType<typeof setTimeout> | undefined
        return await withTimeout(
          new Promise<void>((resolve) => {
            unsub = Bus.subscribe(Event.Diagnostics, (event) => {
              // 检查是否为指定文件的诊断信息
              if (event.properties.path === normalizedPath && event.properties.serverID === result.serverID) {
                // 防抖以允许LSP发送后续诊断(例如,语法分析后的语义分析)
                if (debounceTimer) clearTimeout(debounceTimer)
                debounceTimer = setTimeout(() => {
                  log.info("收到诊断信息", { path: normalizedPath })
                  unsub?.()
                  resolve()
                }, DIAGNOSTICS_DEBOUNCE_MS)
              }
            })
          }),
          3000, // 3秒超时
        )
          .catch(() => {})
          .finally(() => {
            if (debounceTimer) clearTimeout(debounceTimer)
            unsub?.()
          })
      },
      // 关闭客户端
      async shutdown() {
        l.info("关闭中")
        connection.end() // 结束连接
        connection.dispose() // 释放资源
        input.server.process.kill() // 终止服务器进程
        l.info("已关闭")
      },
    }

    l.info("初始化完成") // 记录初始化完成日志

    return result
  }
}
