import { Log } from "@/util/log"

export namespace State {
  // 状态条目接口定义
  // 包含状态对象和可选的销毁函数
  interface Entry {
    state: any // 状态对象
    dispose?: (state: any) => Promise<void> // 状态销毁函数(可选)
  }

  const log = Log.create({ service: "state" })
  // 状态记录映射表
  // 使用根键作为外层键,初始化函数作为内层键
  // 避免为同一初始化函数重复创建状态
  const recordsByKey = new Map<string, Map<any, Entry>>()

  // 创建状态函数
  // 为指定的根键创建可管理的状态
  // 支持泛型类型S,确保状态类型安全
  export function create<S>(root: () => string, init: () => S, dispose?: (state: Awaited<S>) => Promise<void>) {
    return () => {
      // 获取根键(通常是项目ID或实例ID)
      const key = root()
      // 获取该根键对应的状态条目映射表
      let entries = recordsByKey.get(key)
      if (!entries) {
        // 如果不存在,创建新的映射表
        entries = new Map<string, Entry>()
        recordsByKey.set(key, entries)
      }
      // 检查是否已存在相同初始化函数的状态
      const exists = entries.get(init)
      if (exists) return exists.state as S
      // 创建新的状态
      const state = init()
      // 将状态和销毁函数存储到条目中
      entries.set(init, {
        state,
        dispose,
      })
      return state
    }
  }

  // 销毁状态函数
  // 销毁指定根键的所有状态
  // 调用每个状态的销毁函数进行清理
  export async function dispose(key: string) {
    // 获取该根键对应的状态条目映射表
    const entries = recordsByKey.get(key)
    if (!entries) return

    // 记录状态销毁开始日志
    log.info("等待状态销毁完成", { key })

    // 标记销毁是否完成
    let disposalFinished = false

    // 设置超时警告:如果销毁时间超过10秒,记录警告
    setTimeout(() => {
      if (!disposalFinished) {
        log.warn("状态销毁耗时异常长 - 如果在合理时间内未完成,请将其报告为错误", { key })
      }
    }, 10000).unref()

    // 收集所有销毁任务
    const tasks: Promise<void>[] = []
    // 遍历所有状态条目
    for (const entry of entries.values()) {
      // 跳过没有销毁函数的条目
      if (!entry.dispose) continue

      // 创建销毁任务
      const task = Promise.resolve(entry.state)
        .then((state) => entry.dispose!(state))
        .catch((error) => {
          // 记录销毁过程中的错误
          log.error("销毁状态时出错:", { error, key })
        })

      tasks.push(task)
    }
    // 清空状态条目映射表
    entries.clear()
    // 等待所有销毁任务完成
    await Promise.all(tasks)
    // 标记销毁完成
    disposalFinished = true
    // 记录状态销毁完成日志
    log.info("状态销毁完成", { key })
  }
}
