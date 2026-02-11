import { AsyncLocalStorage } from "node:async_hooks"

/**
 * 上下文管理命名空间
 * 提供基于异步本地存储的上下文传递功能
 */
export namespace Context {
  /**
   * 未找到错误
   * 当尝试使用不存在的上下文时抛出
   */
  export class NotFound extends Error {}

  /**
   * 创建上下文管理器
   * @returns 上下文管理器对象，包含 use 和 provide 方法
   */
  export function create<T>() {
    const storage = new AsyncLocalStorage<T>()
    return {
      /**
       * 使用上下文
       * 获取当前上下文，如果不存在则抛出 NotFound 错误
       * @returns 当前上下文值
       * @throws 如果上下文不存在则抛出 NotFound 错误
       */
      use() {
        const result = storage.getStore()
        if (!result) {
          throw new NotFound()
        }
        return result
      },
      /**
       * 提供上下文
       * 在指定的上下文值中执行回调函数
       * @param value 上下文值
       * @param fn 要执行的回调函数
       * @returns 回调函数的返回值
       */
      provide<R>(value: T, fn: () => R) {
        return storage.run(value, fn)
      },
    }
  }
}
