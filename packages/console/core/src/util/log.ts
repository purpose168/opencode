import { Context } from "../context"

/**
 * 日志工具命名空间
 * 提供带标签的日志记录功能，支持上下文传递
 */
export namespace Log {
  /**
   * 日志上下文
   * 用于在调用链中传递日志标签
   */
  const ctx = Context.create<{
    tags: Record<string, any>
  }>()

  /**
   * 创建日志记录器
   * @param tags 初始标签（可选）
   * @returns 日志记录器对象，包含 info、tag 和 clone 方法
   */
  export function create(tags?: Record<string, any>) {
    tags = tags || {}

    const result = {
      /**
       * 记录信息日志
       * @param message 日志消息
       * @param extra 额外的标签（可选）
       * @returns 日志记录器本身（支持链式调用）
       */
      info(message?: any, extra?: Record<string, any>) {
        // 合并上下文标签、初始标签和额外标签
        const prefix = Object.entries({
          ...use().tags,
          ...tags,
          ...extra,
        })
          .map(([key, value]) => `${key}=${value}`)
          .join(" ")
        console.log(prefix, message)
        return result
      },
      /**
       * 添加标签
       * @param key 标签键
       * @param value 标签值
       * @returns 日志记录器本身（支持链式调用）
       */
      tag(key: string, value: string) {
        if (tags) tags[key] = value
        return result
      },
      /**
       * 克隆日志记录器
       * 创建一个新的日志记录器，继承当前的所有标签
       * @returns 新的日志记录器
       */
      clone() {
        return Log.create({ ...tags })
      },
    }

    return result
  }

  /**
   * 提供日志上下文
   * 在指定的标签上下文中执行回调函数
   * @param tags 要提供的标签
   * @param cb 要执行的回调函数
   * @returns 回调函数的返回值
   */
  export function provide<R>(tags: Record<string, any>, cb: () => R) {
    // 获取现有的上下文标签
    const existing = use()
    return ctx.provide(
      {
        tags: {
          ...existing.tags,
          ...tags,
        },
      },
      cb,
    )
  }

  /**
   * 使用日志上下文
   * 获取当前的日志上下文，如果不存在则返回空标签
   * @returns 当前日志上下文
   */
  function use() {
    try {
      return ctx.use()
    } catch (e) {
      return { tags: {} }
    }
  }
}
