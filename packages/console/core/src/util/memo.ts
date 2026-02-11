/**
 * 创建一个记忆化（memoized）函数
 * 该函数会缓存首次执行的结果，后续调用直接返回缓存值
 * @param fn 要记忆化的函数
 * @param cleanup 清理函数，用于在重置时清理缓存值（可选）
 * @returns 记忆化后的函数，包含 reset 方法
 */
export function memo<T>(fn: () => T, cleanup?: (input: T) => Promise<void>) {
  let value: T | undefined // 缓存的值
  let loaded = false // 是否已加载

  // 记忆化函数：首次调用时执行并缓存，后续直接返回缓存
  const result = (): T => {
    if (loaded) return value as T
    loaded = true
    value = fn()
    return value as T
  }
  
  /**
   * 重置缓存
   * 清除缓存的值，并执行清理函数（如果提供）
   */
  result.reset = async () => {
    if (cleanup && value) await cleanup(value)
    loaded = false
    value = undefined
  }

  return result
}
