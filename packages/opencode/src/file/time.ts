import { Instance } from "../project/instance" // 导入实例管理模块
import { Log } from "../util/log" // 导入日志工具

export namespace FileTime {
  const log = Log.create({ service: "file.time" }) // 创建文件时间服务日志记录器

  // 每个会话的读取时间加上每个文件的写入锁。
  // 所有覆盖现有文件的工具都应该在withLock(filepath, ...)内部运行它们的
  // 断言/读取/写入/更新序列,以便对同一文件的并发写入进行序列化。
  export const state = Instance.state(() => {
    const read: {
      [sessionID: string]: {
        [path: string]: Date | undefined
      }
    } = {}
    const locks = new Map<string, Promise<void>>()
    return {
      read,
      locks,
    }
  })

  // 记录文件读取时间
  export function read(sessionID: string, file: string) {
    log.info("read", { sessionID, file })
    const { read } = state()
    read[sessionID] = read[sessionID] || {}
    read[sessionID][file] = new Date()
  }

  // 获取文件读取时间
  export function get(sessionID: string, file: string) {
    return state().read[sessionID]?.[file]
  }

  // 使用锁执行函数(确保并发写入的序列化)
  export async function withLock<T>(filepath: string, fn: () => Promise<T>): Promise<T> {
    const current = state()
    const currentLock = current.locks.get(filepath) ?? Promise.resolve()
    let release: () => void = () => {}
    const nextLock = new Promise<void>((resolve) => {
      release = resolve
    })
    const chained = currentLock.then(() => nextLock)
    current.locks.set(filepath, chained)
    await currentLock
    try {
      return await fn()
    } finally {
      release()
      if (current.locks.get(filepath) === chained) {
        current.locks.delete(filepath)
      }
    }
  }

  // 断言文件未被修改(用于防止并发写入冲突)
  export async function assert(sessionID: string, filepath: string) {
    const time = get(sessionID, filepath)
    if (!time) throw new Error(`在覆盖文件${filepath}之前必须先读取它。请先使用Read工具`)
    const stats = await Bun.file(filepath).stat()
    if (stats.mtime.getTime() > time.getTime()) {
      throw new Error(
        `文件${filepath}自上次读取以来已被修改。\n最后修改时间: ${stats.mtime.toISOString()}\n最后读取时间: ${time.toISOString()}\n\n请在修改之前再次读取文件。`,
      )
    }
  }
}
