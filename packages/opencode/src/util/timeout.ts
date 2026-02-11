export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeout: NodeJS.Timeout
  return Promise.race([
    promise.then((result) => {
      clearTimeout(timeout)
      return result
    }),
    new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        reject(new Error(`操作在${ms}毫秒后超时`))
      }, ms)
    }),
  ])
}

// withTimeout函数：为Promise添加超时功能
// 泛型参数：
//   T: Promise的返回值类型
// 参数：
//   promise: 要添加超时的Promise对象
//   ms: 超时时间（毫秒）
// 返回值：
//   Promise<T>，在原始Promise完成或超时时解析
// 功能：
//   - 使用Promise.race在原始Promise和超时Promise之间竞争
//   - 如果原始Promise先完成，清除超时定时器并返回结果
//   - 如果超时先触发，拒绝Promise并返回超时错误
//   - 超时错误消息格式：操作在{ms}毫秒后超时
// 使用场景：
//   - 防止长时间运行的异步操作无限期挂起
//   - 为网络请求、文件操作等添加超时保护
//   - 控制异步操作的最大执行时间
//   - 提高应用程序的响应性和可靠性
// 示例：
//   const result = await withTimeout(fetchData(), 5000)
//   // 如果fetchData在5秒内完成，返回结果
//   // 如果5秒后仍未完成，抛出超时错误
