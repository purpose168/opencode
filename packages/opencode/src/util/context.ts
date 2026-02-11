import { AsyncLocalStorage } from "async_hooks"

export namespace Context {
  export class NotFound extends Error {
    constructor(public override readonly name: string) {
      super(`未找到${name}的上下文`)
    }
  }

  export function create<T>(name: string) {
    const storage = new AsyncLocalStorage<T>()
    return {
      use() {
        const result = storage.getStore()
        if (!result) {
          throw new NotFound(name)
        }
        return result
      },
      provide<R>(value: T, fn: () => R) {
        return storage.run(value, fn)
      },
    }
  }
}

// Context命名空间提供异步本地存储上下文管理功能
// NotFound类：上下文未找到错误
// 参数：
//   name: 上下文名称
// 功能：
//   - 继承自Error类
//   - 当尝试访问不存在的上下文时抛出此错误
//   - 错误消息格式：未找到{name}的上下文
//
// create函数：创建一个新的上下文存储
// 泛型参数：
//   T: 上下文存储的数据类型
// 参数：
//   name: 上下文名称，用于错误消息
// 返回值：
//   包含use和provide方法的对象
// 功能：
//   - 使用AsyncLocalStorage创建异步本地存储实例
//   - 返回的对象包含两个方法：
//     1. use(): 获取当前上下文中的值
//        - 调用storage.getStore()获取存储的值
//        - 如果值不存在，抛出NotFound错误
//        - 返回存储的值
//     2. provide<R>(value: T, fn: () => R): 在指定上下文中执行函数
//        - 泛型参数R: 函数返回值类型
//        - 参数value: 要存储在上下文中的值
//        - 参数fn: 要在上下文中执行的函数
//        - 调用storage.run(value, fn)在指定上下文中执行函数
//        - 返回函数的执行结果
// 使用场景：
//   - 在异步调用链中传递上下文信息（如用户ID、请求ID等）
//   - 避免通过函数参数层层传递共享数据
//   - 确保异步操作中上下文的一致性
