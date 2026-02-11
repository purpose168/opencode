/**
 * 重试工具
 * 
 * 提供异步操作重试功能，支持指数退避策略
 */

/**
 * 重试选项接口
 */
export interface RetryOptions {
  /**
   * 尝试次数，默认为 3
   */
  attempts?: number
  /**
   * 初始延迟（毫秒），默认为 500
   */
  delay?: number
  /**
   * 延迟增长因子，默认为 2
   */
  factor?: number
  /**
   * 最大延迟（毫秒），默认为 10000
   */
  maxDelay?: number
  /**
   * 判断是否需要重试的函数，默认为 isTransientError
   */
  retryIf?: (error: unknown) => boolean
}

/**
 * 临时错误消息列表
 * 
 * 包含常见的网络临时错误消息
 */
const TRANSIENT_MESSAGES = [
  "load failed",
  "network connection was lost",
  "network request failed",
  "failed to fetch",
  "econnreset",
  "econnrefused",
  "etimedout",
  "socket hang up",
]

/**
 * 判断是否为临时错误
 * 
 * @param error - 错误对象
 * @returns 是否为临时错误
 */
function isTransientError(error: unknown): boolean {
  if (!error) return false
  const message = String(error instanceof Error ? error.message : error).toLowerCase()
  return TRANSIENT_MESSAGES.some((m) => message.includes(m))
}

/**
 * 重试异步操作
 * 
 * @template T - 函数返回类型
 * @param fn - 要重试的异步函数
 * @param options - 重试选项
 * @returns 函数执行的结果
 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { attempts = 3, delay = 500, factor = 2, maxDelay = 10000, retryIf = isTransientError } = options

  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn() // 执行函数
    } catch (error) {
      lastError = error
      if (attempt === attempts - 1 || !retryIf(error)) throw error // 达到最大尝试次数或不需要重试时抛出错误
      const wait = Math.min(delay * Math.pow(factor, attempt), maxDelay) // 计算延迟时间
      await new Promise((resolve) => setTimeout(resolve, wait)) // 等待
    }
  }
  throw lastError // 所有尝试都失败时抛出最后一个错误
}
