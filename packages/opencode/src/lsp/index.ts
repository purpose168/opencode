import { Bus } from "@/bus" // 导入总线
import { BusEvent } from "@/bus/bus-event" // 导入总线事件
import { Flag } from "@/flag/flag" // 导入标志配置
import { spawn } from "child_process" // 导入子进程生成器
import path from "path" // 导入路径处理模块
import { pathToFileURL } from "url" // 导入URL路径转换工具
import z from "zod" // 导入zod库用于数据验证
import { Config } from "../config/config" // 导入配置
import { Instance } from "../project/instance" // 导入实例管理模块
import { Log } from "../util/log" // 导入日志工具
import { LSPClient } from "./client" // 导入LSP客户端
import { LSPServer } from "./server" // 导入LSP服务器

export namespace LSP {
  const log = Log.create({ service: "lsp" }) // 创建LSP服务日志记录器

  export const Event = {
    // LSP更新事件
    Updated: BusEvent.define("lsp.updated", z.object({})),
  }

  // 范围schema
  export const Range = z
    .object({
      start: z.object({
        line: z.number(), // 起始行号
        character: z.number(), // 起始字符位置
      }),
      end: z.object({
        line: z.number(), // 结束行号
        character: z.number(), // 结束字符位置
      }),
    })
    .meta({
      ref: "Range",
    })
  export type Range = z.infer<typeof Range>

  // 符号schema
  export const Symbol = z
    .object({
      name: z.string(), // 符号名称
      kind: z.number(), // 符号类型
      location: z.object({
        uri: z.string(), // 文件URI
        range: Range, // 位置范围
      }),
    })
    .meta({
      ref: "Symbol",
    })
  export type Symbol = z.infer<typeof Symbol>

  // 文档符号schema
  export const DocumentSymbol = z
    .object({
      name: z.string(), // 符号名称
      detail: z.string().optional(), // 详细信息
      kind: z.number(), // 符号类型
      range: Range, // 范围
      selectionRange: Range, // 选择范围
    })
    .meta({
      ref: "DocumentSymbol",
    })
  export type DocumentSymbol = z.infer<typeof DocumentSymbol>

  // 过滤实验性服务器
  const filterExperimentalServers = (servers: Record<string, LSPServer.Info>) => {
    if (Flag.OPENCODE_EXPERIMENTAL_LSP_TY) {
      // 如果启用了实验性标志,禁用pyright
      if (servers["pyright"]) {
        log.info("LSP服务器 pyright已禁用,因为OPENCODE_EXPERIMENTAL_LSP_TY已启用")
        delete servers["pyright"]
      }
    } else {
      // 如果禁用了实验性标志,禁用ty
      if (servers["ty"]) {
        delete servers["ty"]
      }
    }
  }

  // LSP状态管理
  const state = Instance.state(
    async () => {
      const clients: LSPClient.Info[] = [] // 客户端列表
      const servers: Record<string, LSPServer.Info> = {} // 服务器映射
      const cfg = await Config.get() // 获取配置

      // 如果LSP被禁用
      if (cfg.lsp === false) {
        log.info("所有LSP服务器已禁用")
        return {
          broken: new Set<string>(), // 损坏的服务器集合
          servers,
          clients,
          spawning: new Map<string, Promise<LSPClient.Info | undefined>>(), // 正在生成的服务器映射
        }
      }

      // 初始化所有服务器
      for (const server of Object.values(LSPServer)) {
        servers[server.id] = server
      }

      filterExperimentalServers(servers) // 过滤实验性服务器

      // 应用用户配置
      for (const [name, item] of Object.entries(cfg.lsp ?? {})) {
        const existing = servers[name]
        if (item.disabled) {
          log.info(`LSP服务器 ${name} 已禁用`)
          delete servers[name]
          continue
        }
        servers[name] = {
          ...existing,
          id: name,
          root: existing?.root ?? (async () => Instance.directory), // 根目录
          extensions: item.extensions ?? existing?.extensions ?? [], // 支持的文件扩展名
          spawn: async (root) => {
            return {
              process: spawn(item.command[0], item.command.slice(1), {
                // 生成服务器进程
                cwd: root,
                env: {
                  ...process.env,
                  ...item.env, // 环境变量
                },
              }),
              initialization: item.initialization, // 初始化选项
            }
          },
        }
      }

      log.info("已启用的LSP服务器", {
        serverIds: Object.values(servers)
          .map((server) => server.id)
          .join(", "),
      })

      return {
        broken: new Set<string>(),
        servers,
        clients,
        spawning: new Map<string, Promise<LSPClient.Info | undefined>>(),
      }
    },
    async (state) => {
      await Promise.all(state.clients.map((client) => client.shutdown())) // 关闭所有客户端
    },
  )

  // 初始化LSP服务
  export async function init() {
    return state()
  }

  // LSP状态schema
  export const Status = z
    .object({
      id: z.string(), // 服务器ID
      name: z.string(), // 服务器名称
      root: z.string(), // 根目录
      status: z.union([z.literal("connected"), z.literal("error")]), // 状态
    })
    .meta({
      ref: "LSPStatus",
    })
  export type Status = z.infer<typeof Status>

  // 获取LSP状态
  export async function status() {
    return state().then((x) => {
      const result: Status[] = []
      for (const client of x.clients) {
        result.push({
          id: client.serverID,
          name: x.servers[client.serverID].id,
          root: path.relative(Instance.directory, client.root), // 相对路径
          status: "connected",
        })
      }
      return result
    })
  }

  // 获取文件对应的客户端
  async function getClients(file: string) {
    const s = await state()
    const extension = path.parse(file).ext || file // 文件扩展名
    const result: LSPClient.Info[] = []

    // 调度服务器启动
    async function schedule(server: LSPServer.Info, root: string, key: string) {
      const handle = await server
        .spawn(root)
        .then((value) => {
          if (!value) s.broken.add(key)
          return value
        })
        .catch((err) => {
          s.broken.add(key)
          log.error(`生成LSP服务器失败 ${server.id}`, { error: err })
          return undefined
        })

      if (!handle) return undefined
      log.info("已生成LSP服务器", { serverID: server.id })

      // 创建客户端
      const client = await LSPClient.create({
        serverID: server.id,
        server: handle,
        root,
      }).catch((err) => {
        s.broken.add(key)
        handle.process.kill()
        log.error(`初始化LSP客户端失败 ${server.id}`, { error: err })
        return undefined
      })

      if (!client) {
        handle.process.kill()
        return undefined
      }

      // 检查是否已存在相同客户端
      const existing = s.clients.find((x) => x.root === root && x.serverID === server.id)
      if (existing) {
        handle.process.kill()
        return existing
      }

      s.clients.push(client)
      return client
    }

    // 遍历所有服务器
    for (const server of Object.values(s.servers)) {
      if (server.extensions.length && !server.extensions.includes(extension)) continue // 检查扩展名是否匹配

      const root = await server.root(file)
      if (!root) continue
      if (s.broken.has(root + server.id)) continue // 跳过损坏的服务器

      // 检查是否已存在客户端
      const match = s.clients.find((x) => x.root === root && x.serverID === server.id)
      if (match) {
        result.push(match)
        continue
      }

      // 检查是否正在生成
      const inflight = s.spawning.get(root + server.id)
      if (inflight) {
        const client = await inflight
        if (!client) continue
        result.push(client)
        continue
      }

      // 调度服务器启动
      const task = schedule(server, root, root + server.id)
      s.spawning.set(root + server.id, task)

      task.finally(() => {
        if (s.spawning.get(root + server.id) === task) {
          s.spawning.delete(root + server.id)
        }
      })

      const client = await task
      if (!client) continue

      result.push(client)
      Bus.publish(Event.Updated, {}) // 发布更新事件
    }

    return result
  }

  // 检查文件是否有对应的客户端
  export async function hasClients(file: string) {
    const s = await state()
    const extension = path.parse(file).ext || file
    for (const server of Object.values(s.servers)) {
      if (server.extensions.length && !server.extensions.includes(extension)) continue
      const root = await server.root(file)
      if (!root) continue
      if (s.broken.has(root + server.id)) continue
      return true
    }
    return false
  }

  // 触摸文件(通知LSP服务器文件已变更)
  export async function touchFile(input: string, waitForDiagnostics?: boolean) {
    log.info("触摸文件", { file: input })
    const clients = await getClients(input)
    await Promise.all(
      clients.map(async (client) => {
        const wait = waitForDiagnostics ? client.waitForDiagnostics({ path: input }) : Promise.resolve()
        await client.notify.open({ path: input })
        return wait
      }),
    ).catch((err) => {
      log.error("触摸文件失败", { err, file: input })
    })
  }

  // 获取所有诊断信息
  export async function diagnostics() {
    const results: Record<string, LSPClient.Diagnostic[]> = {}
    for (const result of await runAll(async (client) => client.diagnostics)) {
      for (const [path, diagnostics] of result.entries()) {
        const arr = results[path] || []
        arr.push(...diagnostics)
        results[path] = arr
      }
    }
    return results
  }

  // 获取悬停信息
  export async function hover(input: { file: string; line: number; character: number }) {
    return run(input.file, (client) => {
      return client.connection
        .sendRequest("textDocument/hover", {
          textDocument: {
            uri: pathToFileURL(input.file).href,
          },
          position: {
            line: input.line,
            character: input.character,
          },
        })
        .catch(() => null)
    })
  }

  // 符号类型枚举
  enum SymbolKind {
    File = 1, // 文件
    Module = 2, // 模块
    Namespace = 3, // 命名空间
    Package = 4, // 包
    Class = 5, // 类
    Method = 6, // 方法
    Property = 7, // 属性
    Field = 8, // 字段
    Constructor = 9, // 构造函数
    Enum = 10, // 枚举
    Interface = 11, // 接口
    Function = 12, // 函数
    Variable = 13, // 变量
    Constant = 14, // 常量
    String = 15, // 字符串
    Number = 16, // 数字
    Boolean = 17, // 布尔值
    Array = 18, // 数组
    Object = 19, // 对象
    Key = 20, // 键
    Null = 21, // 空值
    EnumMember = 22, // 枚举成员
    Struct = 23, // 结构体
    Event = 24, // 事件
    Operator = 25, // 操作符
    TypeParameter = 26, // 类型参数
  }

  // 常用符号类型
  const kinds = [
    SymbolKind.Class,
    SymbolKind.Function,
    SymbolKind.Method,
    SymbolKind.Interface,
    SymbolKind.Variable,
    SymbolKind.Constant,
    SymbolKind.Struct,
    SymbolKind.Enum,
  ]

  // 搜索工作区符号
  export async function workspaceSymbol(query: string) {
    return runAll((client) =>
      client.connection
        .sendRequest("workspace/symbol", {
          query,
        })
        .then((result: any) => result.filter((x: LSP.Symbol) => kinds.includes(x.kind))) // 过滤常用符号类型
        .then((result: any) => result.slice(0, 10)) // 限制结果数量
        .catch(() => []),
    ).then((result) => result.flat() as LSP.Symbol[])
  }

  // 获取文档符号
  export async function documentSymbol(uri: string) {
    const file = new URL(uri).pathname
    return run(file, (client) =>
      client.connection
        .sendRequest("textDocument/documentSymbol", {
          textDocument: {
            uri,
          },
        })
        .catch(() => []),
    )
      .then((result) => result.flat() as (LSP.DocumentSymbol | LSP.Symbol)[])
      .then((result) => result.filter(Boolean))
  }

  // 获取定义
  export async function definition(input: { file: string; line: number; character: number }) {
    return run(input.file, (client) =>
      client.connection
        .sendRequest("textDocument/definition", {
          textDocument: { uri: pathToFileURL(input.file).href },
          position: { line: input.line, character: input.character },
        })
        .catch(() => null),
    ).then((result) => result.flat().filter(Boolean))
  }

  // 获取引用
  export async function references(input: { file: string; line: number; character: number }) {
    return run(input.file, (client) =>
      client.connection
        .sendRequest("textDocument/references", {
          textDocument: { uri: pathToFileURL(input.file).href },
          position: { line: input.line, character: input.character },
          context: { includeDeclaration: true },
        })
        .catch(() => []),
    ).then((result) => result.flat().filter(Boolean))
  }

  // 获取实现
  export async function implementation(input: { file: string; line: number; character: number }) {
    return run(input.file, (client) =>
      client.connection
        .sendRequest("textDocument/implementation", {
          textDocument: { uri: pathToFileURL(input.file).href },
          position: { line: input.line, character: input.character },
        })
        .catch(() => null),
    ).then((result) => result.flat().filter(Boolean))
  }

  // 准备调用层次结构
  export async function prepareCallHierarchy(input: { file: string; line: number; character: number }) {
    return run(input.file, (client) =>
      client.connection
        .sendRequest("textDocument/prepareCallHierarchy", {
          textDocument: { uri: pathToFileURL(input.file).href },
          position: { line: input.line, character: input.character },
        })
        .catch(() => []),
    ).then((result) => result.flat().filter(Boolean))
  }

  // 获取传入调用
  export async function incomingCalls(input: { file: string; line: number; character: number }) {
    return run(input.file, async (client) => {
      const items = (await client.connection
        .sendRequest("textDocument/prepareCallHierarchy", {
          textDocument: { uri: pathToFileURL(input.file).href },
          position: { line: input.line, character: input.character },
        })
        .catch(() => [])) as any[]
      if (!items?.length) return []
      return client.connection.sendRequest("callHierarchy/incomingCalls", { item: items[0] }).catch(() => [])
    }).then((result) => result.flat().filter(Boolean))
  }

  // 获取传出调用
  export async function outgoingCalls(input: { file: string; line: number; character: number }) {
    return run(input.file, async (client) => {
      const items = (await client.connection
        .sendRequest("textDocument/prepareCallHierarchy", {
          textDocument: { uri: pathToFileURL(input.file).href },
          position: { line: input.line, character: input.character },
        })
        .catch(() => [])) as any[]
      if (!items?.length) return []
      return client.connection.sendRequest("callHierarchy/outgoingCalls", { item: items[0] }).catch(() => [])
    }).then((result) => result.flat().filter(Boolean))
  }

  // 在所有客户端上运行操作
  async function runAll<T>(input: (client: LSPClient.Info) => Promise<T>): Promise<T[]> {
    const clients = await state().then((x) => x.clients)
    const tasks = clients.map((x) => input(x))
    return Promise.all(tasks)
  }

  // 在文件对应的客户端上运行操作
  async function run<T>(file: string, input: (client: LSPClient.Info) => Promise<T>): Promise<T[]> {
    const clients = await getClients(file)
    const tasks = clients.map((x) => input(x))
    return Promise.all(tasks)
  }

  // 诊断信息工具
  export namespace Diagnostic {
    // 格式化诊断信息
    export function pretty(diagnostic: LSPClient.Diagnostic) {
      const severityMap = {
        1: "ERROR", // 错误
        2: "WARN", // 警告
        3: "INFO", // 信息
        4: "HINT", // 提示
      }

      const severity = severityMap[diagnostic.severity || 1]
      const line = diagnostic.range.start.line + 1
      const col = diagnostic.range.start.character + 1

      return `${severity} [${line}:${col}] ${diagnostic.message}`
    }
  }
}
