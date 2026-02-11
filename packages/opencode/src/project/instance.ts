import { GlobalBus } from "@/bus/global"
import { iife } from "@/util/iife"
import { Log } from "@/util/log"
import { Context } from "../util/context"
import { Project } from "./project"
import { State } from "./state"

// 实例上下文接口定义
// 包含实例运行所需的核心信息
interface Context {
  directory: string // 实例目录路径
  worktree: string // 工作树路径
  project: Project.Info // 项目信息对象
}

// 创建实例上下文管理器
// 使用Context.create()创建一个名为"instance"的上下文
const context = Context.create<Context>("instance")

// 实例缓存映射表
// 使用目录路径作为键,存储实例创建的Promise
// 避免为同一目录重复创建实例
const cache = new Map<string, Promise<Context>>()

// 实例管理对象
// 提供实例的创建、访问、状态管理和销毁功能
export const Instance = {
  // 提供实例上下文并执行函数
  // 如果目录对应的实例不存在,则创建新实例
  // 在实例上下文中执行用户提供的函数
  async provide<R>(input: { directory: string; init?: () => Promise<any>; fn: () => R }): Promise<R> {
    // 检查缓存中是否已存在该目录的实例
    let existing = cache.get(input.directory)
    if (!existing) {
      // 记录实例创建日志
      Log.Default.info("正在创建实例", { directory: input.directory })
      // 创建新实例
      existing = iife(async () => {
        // 从目录加载项目信息
        const project = await Project.fromDirectory(input.directory)
        // 构建实例上下文
        const ctx = {
          directory: input.directory,
          worktree: project.worktree,
          project,
        }
        // 在上下文中执行初始化函数
        await context.provide(ctx, async () => {
          await input.init?.()
        })
        return ctx
      })
      // 将实例Promise缓存起来
      cache.set(input.directory, existing)
    }
    // 等待实例创建完成
    const ctx = await existing
    // 在实例上下文中执行用户函数
    return context.provide(ctx, async () => {
      return input.fn()
    })
  },

  // 获取当前实例目录
  // 从上下文中获取目录信息
  get directory() {
    return context.use().directory
  },

  // 获取当前实例工作树
  // 从上下文中获取工作树路径
  get worktree() {
    return context.use().worktree
  },

  // 获取当前实例项目信息
  // 从上下文中获取项目信息对象
  get project() {
    return context.use().project
  },

  // 创建实例状态
  // 为当前实例创建可管理的状态
  // 状态与实例目录绑定,实例销毁时自动清理
  state<S>(init: () => S, dispose?: (state: Awaited<S>) => Promise<void>): () => S {
    return State.create(() => Instance.directory, init, dispose)
  },

  // 销毁当前实例
  // 清理实例相关的所有状态和资源
  async dispose() {
    // 记录实例销毁日志
    Log.Default.info("正在销毁实例", { directory: Instance.directory })
    // 销毁实例的所有状态
    await State.dispose(Instance.directory)
    // 从缓存中移除实例
    cache.delete(Instance.directory)
    // 发送实例销毁事件
    GlobalBus.emit("event", {
      directory: Instance.directory,
      payload: {
        type: "server.instance.disposed",
        properties: {
          directory: Instance.directory,
        },
      },
    })
  },

  // 销毁所有实例
  // 清理所有缓存中的实例及其状态
  async disposeAll() {
    // 记录销毁所有实例的日志
    Log.Default.info("正在销毁所有实例")
    // 遍历所有缓存的实例
    for (const [_key, value] of cache) {
      // 等待实例创建完成(如果还在创建中)
      const awaited = await value.catch(() => {})
      if (awaited) {
        // 在实例上下文中销毁实例
        await context.provide(await value, async () => {
          await Instance.dispose()
        })
      }
    }
    // 清空缓存
    cache.clear()
  },
}
