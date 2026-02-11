/**
 * 懒加载工具
 * 
 * 提供创建懒加载函数的工具
 */

/**
 * 创建懒加载函数
 * 
 * @template T - 函数返回类型
 * @param fn - 要懒加载的函数，只会执行一次
 * @returns 懒加载函数，首次调用时执行原始函数并缓存结果
 */
export function lazy<T>(fn: () => T) {
  let value: T | undefined // 缓存的值
  let loaded = false // 是否已加载

  return (): T => {
    if (loaded) return value as T // 如果已加载，直接返回缓存的值
    loaded = true // 标记为已加载
    value = fn() // 执行原始函数
    return value as T // 返回执行结果
  }
}
