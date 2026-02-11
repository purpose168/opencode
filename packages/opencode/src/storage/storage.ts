import { NamedError } from "@opencode-ai/util/error" // 导入命名错误工具
import { $ } from "bun" // 导入 Bun shell 命令执行工具
import fs from "fs/promises" // 导入文件系统 Promise API
import path from "path" // 导入路径处理模块
import z from "zod" // 导入 Zod schema 验证库
import { Global } from "../global" // 导入全局配置
import { lazy } from "../util/lazy" // 导入懒加载工具
import { Lock } from "../util/lock" // 导入文件锁工具
import { Log } from "../util/log" // 导入日志工具

export namespace Storage {
  const log = Log.create({ service: "storage" }) // 创建日志实例

  type Migration = (dir: string) => Promise<void> // 迁移函数类型定义

  export const NotFoundError = NamedError.create(
    // 创建未找到错误
    "NotFoundError", // 错误名称
    z.object({
      // Zod schema 定义
      message: z.string(), // 错误消息
    }),
  )

  const MIGRATIONS: Migration[] = [
    // 迁移函数列表
    async (dir) => {
      // 第一个迁移函数：从旧的项目目录迁移数据
      const project = path.resolve(dir, "../project") // 解析旧项目目录路径
      if (!fs.exists(project)) return // 如果项目目录不存在，直接返回
      for await (const projectDir of new Bun.Glob("*").scan({
        // 遍历项目目录
        cwd: project, // 工作目录
        onlyFiles: false, // 包含文件和目录
      })) {
        log.info(`migrating project ${projectDir}`) // 记录迁移日志
        let projectID = projectDir // 项目 ID
        const fullProjectDir = path.join(project, projectDir) // 完整项目目录路径
        let worktree = "/" // 工作树路径

        if (projectID !== "global") {
          // 如果不是全局项目
          for await (const msgFile of new Bun.Glob("storage/session/message/*/*.json").scan({
            // 扫描消息文件
            cwd: path.join(project, projectDir), // 工作目录
            absolute: true, // 返回绝对路径
          })) {
            const json = await Bun.file(msgFile).json() // 读取 JSON 文件
            worktree = json.path?.root // 获取工作树路径
            if (worktree) break // 如果找到工作树路径，跳出循环
          }
          if (!worktree) continue // 如果没有工作树路径，跳过当前项目
          if (!(await fs.exists(worktree))) continue // 如果工作树路径不存在，跳过当前项目
          const [id] = await $`git rev-list --max-parents=0 --all` // 获取 git 仓库的初始提交哈希
            .quiet() // 静默模式
            .nothrow() // 不抛出错误
            .cwd(worktree) // 工作目录
            .text() // 获取文本输出
            .then(
              (x) =>
                x
                  .split("\n") // 按换行符分割
                  .filter(Boolean) // 过滤空行
                  .map((x) => x.trim()) // 去除空白字符
                  .toSorted(), // 排序
            )
          if (!id) continue // 如果没有找到初始提交，跳过当前项目
          projectID = id // 使用 git 哈希作为项目 ID

          await Bun.write(
            // 写入项目配置文件
            path.join(dir, "project", projectID + ".json"), // 目标文件路径
            JSON.stringify({
              // JSON 序列化
              id, // 项目 ID
              vcs: "git", // 版本控制系统
              worktree, // 工作树路径
              time: {
                // 时间信息
                created: Date.now(), // 创建时间
                initialized: Date.now(), // 初始化时间
              },
            }),
          )

          log.info(`migrating sessions for project ${projectID}`) // 记录会话迁移日志
          for await (const sessionFile of new Bun.Glob("storage/session/info/*.json").scan({
            // 扫描会话文件
            cwd: fullProjectDir, // 工作目录
            absolute: true, // 返回绝对路径
          })) {
            const dest = path.join(dir, "session", projectID, path.basename(sessionFile)) // 目标文件路径
            log.info("copying", {
              // 记录复制日志
              sessionFile, // 源文件
              dest, // 目标文件
            })
            const session = await Bun.file(sessionFile).json() // 读取会话 JSON
            await Bun.write(dest, JSON.stringify(session)) // 写入会话文件
            log.info(`migrating messages for session ${session.id}`) // 记录消息迁移日志
            for await (const msgFile of new Bun.Glob(`storage/session/message/${session.id}/*.json`).scan({
              // 扫描消息文件
              cwd: fullProjectDir, // 工作目录
              absolute: true, // 返回绝对路径
            })) {
              const dest = path.join(dir, "message", session.id, path.basename(msgFile)) // 目标文件路径
              log.info("copying", {
                // 记录复制日志
                msgFile, // 源文件
                dest, // 目标文件
              })
              const message = await Bun.file(msgFile).json() // 读取消息 JSON
              await Bun.write(dest, JSON.stringify(message)) // 写入消息文件

              log.info(`migrating parts for message ${message.id}`) // 记录部分迁移日志
              for await (const partFile of new Bun.Glob(`storage/session/part/${session.id}/${message.id}/*.json`).scan(
                // 扫描部分文件
                {
                  cwd: fullProjectDir, // 工作目录
                  absolute: true, // 返回绝对路径
                },
              )) {
                const dest = path.join(dir, "part", message.id, path.basename(partFile)) // 目标文件路径
                const part = await Bun.file(partFile).json() // 读取部分 JSON
                log.info("copying", {
                  // 记录复制日志
                  partFile, // 源文件
                  dest, // 目标文件
                })
                await Bun.write(dest, JSON.stringify(part)) // 写入部分文件
              }
            }
          }
        }
      }
    },
    async (dir) => {
      // 第二个迁移函数：分离会话差异数据
      for await (const item of new Bun.Glob("session/*/*.json").scan({
        // 扫描会话文件
        cwd: dir, // 工作目录
        absolute: true, // 返回绝对路径
      })) {
        const session = await Bun.file(item).json() // 读取会话 JSON
        if (!session.projectID) continue // 如果没有项目 ID，跳过
        if (!session.summary?.diffs) continue // 如果没有差异数据，跳过
        const { diffs } = session.summary // 提取差异数据
        await Bun.file(path.join(dir, "session_diff", session.id + ".json")).write(JSON.stringify(diffs)) // 写入差异文件
        await Bun.file(path.join(dir, "session", session.projectID, session.id + ".json")).write(
          // 更新会话文件
          JSON.stringify({
            ...session, // 保留原有会话数据
            summary: {
              // 更新摘要
              additions: diffs.reduce((sum: any, x: any) => sum + x.additions, 0), // 计算总新增行数
              deletions: diffs.reduce((sum: any, x: any) => sum + x.deletions, 0), // 计算总删除行数
            },
          }),
        )
      }
    },
  ]

  const state = lazy(async () => {
    // 懒加载状态
    const dir = path.join(Global.Path.data, "storage") // 存储目录路径
    const migration = await Bun.file(path.join(dir, "migration")) // 读取迁移状态文件
      .json() // 解析 JSON
      .then((x) => parseInt(x)) // 转换为整数
      .catch(() => 0) // 如果失败，返回 0
    for (let index = migration; index < MIGRATIONS.length; index++) {
      // 遍历待执行的迁移
      log.info("running migration", { index }) // 记录迁移日志
      const migration = MIGRATIONS[index] // 获取迁移函数
      await migration(dir).catch(() => log.error("failed to run migration", { index })) // 执行迁移，失败时记录错误
      await Bun.write(path.join(dir, "migration"), (index + 1).toString()) // 更新迁移状态
    }
    return {
      dir, // 返回存储目录
    }
  })

  /**
   * 删除指定键对应的文件
   * @param key - 文件键路径数组（例如：["session", "projectID", "sessionID"]）
   */
  export async function remove(key: string[]) {
    const dir = await state().then((x) => x.dir) // 获取存储目录
    const target = path.join(dir, ...key) + ".json" // 构造目标文件路径
    return withErrorHandling(async () => {
      // 错误处理
      await fs.unlink(target).catch(() => {}) // 删除文件，失败时忽略错误
    })
  }

  /**
   * 读取指定键对应的文件内容
   * @param key - 文件键路径数组（例如：["session", "projectID", "sessionID"]）
   * @returns 文件内容（泛型 T）
   */
  export async function read<T>(key: string[]) {
    const dir = await state().then((x) => x.dir) // 获取存储目录
    const target = path.join(dir, ...key) + ".json" // 构造目标文件路径
    return withErrorHandling(async () => {
      // 错误处理
      using _ = await Lock.read(target) // 获取读锁
      const result = await Bun.file(target).json() // 读取 JSON 文件
      return result as T // 返回类型 T 的结果
    })
  }

  /**
   * 更新指定键对应的文件内容
   * @param key - 文件键路径数组（例如：["session", "projectID", "sessionID"]）
   * @param fn - 更新函数，接收当前内容并修改
   * @returns 更新后的内容（泛型 T）
   */
  export async function update<T>(key: string[], fn: (draft: T) => void) {
    const dir = await state().then((x) => x.dir) // 获取存储目录
    const target = path.join(dir, ...key) + ".json" // 构造目标文件路径
    return withErrorHandling(async () => {
      // 错误处理
      using _ = await Lock.write(target) // 获取写锁
      const content = await Bun.file(target).json() // 读取 JSON 文件
      fn(content) // 调用更新函数修改内容
      await Bun.write(target, JSON.stringify(content, null, 2)) // 写入 JSON 文件（格式化缩进）
      return content as T // 返回更新后的内容
    })
  }

  /**
   * 写入指定键对应的文件内容
   * @param key - 文件键路径数组（例如：["session", "projectID", "sessionID"]）
   * @param content - 要写入的内容（泛型 T）
   */
  export async function write<T>(key: string[], content: T) {
    const dir = await state().then((x) => x.dir) // 获取存储目录
    const target = path.join(dir, ...key) + ".json" // 构造目标文件路径
    return withErrorHandling(async () => {
      // 错误处理
      using _ = await Lock.write(target) // 获取写锁
      await Bun.write(target, JSON.stringify(content, null, 2)) // 写入 JSON 文件（格式化缩进）
    })
  }

  /**
   * 错误处理函数
   * @param body - 要执行的异步函数
   * @returns 函数执行结果（泛型 T）
   * @throws NotFoundError - 当文件不存在时抛出
   */
  async function withErrorHandling<T>(body: () => Promise<T>) {
    return body().catch((e) => {
      // 捕获错误
      if (!(e instanceof Error)) throw e // 如果不是 Error 类型，直接抛出
      const errnoException = e as NodeJS.ErrnoException // 转换为 Node.js 错误类型
      if (errnoException.code === "ENOENT") {
        // 如果是文件不存在错误
        throw new NotFoundError({ message: `Resource not found: ${errnoException.path}` }) // 抛出未找到错误
      }
      throw e // 抛出其他错误
    })
  }

  const glob = new Bun.Glob("**/*") // 创建 Glob 模式（匹配所有文件）
  /**
   * 列出指定前缀下的所有文件
   * @param prefix - 文件前缀路径数组（例如：["session", "projectID"]）
   * @returns 文件键路径列表
   */
  export async function list(prefix: string[]) {
    const dir = await state().then((x) => x.dir) // 获取存储目录
    try {
      const result = await Array.fromAsync(
        // 异步遍历 Glob 结果
        glob.scan({
          // 扫描文件
          cwd: path.join(dir, ...prefix), // 工作目录
          onlyFiles: true, // 只包含文件
        }),
      ).then((results) => results.map((x) => [...prefix, ...x.slice(0, -5).split(path.sep)])) // 转换为键路径列表（移除 .json 后缀）
      result.sort() // 排序结果
      return result // 返回结果
    } catch {
      return [] // 如果失败，返回空数组
    }
  }
}
