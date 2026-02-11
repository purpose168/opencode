import type { NamedError } from "@opencode-ai/util/error" // 导入命名错误类型
import { MessageV2 } from "./message-v2" // 导入消息 V2 模块

export namespace SessionRetry {
  export const RETRY_INITIAL_DELAY = 2000 // 重试初始延迟时间（毫秒）
  export const RETRY_BACKOFF_FACTOR = 2 // 重试退避因子（每次重试延迟时间乘以该因子）
  export const RETRY_MAX_DELAY_NO_HEADERS = 30_000 // 无响应头时的最大重试延迟时间（30秒）
  export const RETRY_MAX_DELAY = 2_147_483_647 // setTimeout 的最大 32 位有符号整数（约24.85天）

  /**
   * 异步睡眠函数，用于等待指定时间
   * @param ms - 等待的毫秒数
   * @param signal - 中止信号，可用于提前取消等待
   * @returns Promise<void> - 等待完成后解析的 Promise
   */
  export async function sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, Math.min(ms, RETRY_MAX_DELAY)) // 设置定时器，确保不超过最大延迟
      signal.addEventListener(
        // 监听中止信号
        "abort",
        () => {
          clearTimeout(timeout) // 清除定时器
          reject(new DOMException("Aborted", "AbortError")) // 拒绝 Promise，抛出中止错误
        },
        { once: true }, // 只监听一次
      )
    })
  }

  /**
   * 计算重试延迟时间
   * @param attempt - 当前重试次数
   * @param error - 可选的 API 错误对象，用于从响应头中获取重试延迟时间
   * @returns number - 延迟时间（毫秒）
   */
  export function delay(attempt: number, error?: MessageV2.APIError) {
    if (error) {
      // 如果提供了错误对象
      const headers = error.data.responseHeaders // 获取响应头
      if (headers) {
        // 如果存在响应头
        const retryAfterMs = headers["retry-after-ms"] // 尝试获取 retry-after-ms 响应头（毫秒）
        if (retryAfterMs) {
          // 如果存在该响应头
          const parsedMs = Number.parseFloat(retryAfterMs) // 解析毫秒数
          if (!Number.isNaN(parsedMs)) {
            // 如果解析成功
            return parsedMs // 返回解析后的毫秒数
          }
        }

        const retryAfter = headers["retry-after"] // 尝试获取 retry-after 响应头（标准 HTTP 响应头）
        if (retryAfter) {
          // 如果存在该响应头
          const parsedSeconds = Number.parseFloat(retryAfter) // 尝试解析为秒数
          if (!Number.isNaN(parsedSeconds)) {
            // 如果解析成功
            return Math.ceil(parsedSeconds * 1000) // 将秒转换为毫秒并向上取整
          }
          // 尝试解析为 HTTP 日期格式
          const parsed = Date.parse(retryAfter) - Date.now() // 计算日期差值
          if (!Number.isNaN(parsed) && parsed > 0) {
            // 如果解析成功且结果为正数
            return Math.ceil(parsed) // 返回向上取整的毫秒数
          }
        }

        return RETRY_INITIAL_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt - 1) // 使用指数退避算法计算延迟时间
      }
    }

    return Math.min(RETRY_INITIAL_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt - 1), RETRY_MAX_DELAY_NO_HEADERS) // 使用指数退避算法，但不超过最大延迟时间
  }

  /**
   * 判断错误是否可重试，并返回重试原因
   * @param error - 命名错误对象
   * @returns string | undefined - 如果可重试，返回重试原因；否则返回 undefined
   */
  export function retryable(error: ReturnType<NamedError["toObject"]>) {
    if (MessageV2.APIError.isInstance(error)) {
      // 如果是 API 错误
      if (!error.data.isRetryable) return undefined // 如果不可重试，返回 undefined
      return error.data.message.includes("Overloaded") ? "Provider is overloaded" : error.data.message // 根据错误消息返回重试原因
    }

    if (typeof error.data?.message === "string") {
      // 如果错误消息是字符串
      try {
        const json = JSON.parse(error.data.message) // 尝试解析 JSON 格式的错误消息
        if (json.type === "error" && json.error?.type === "too_many_requests") {
          // 如果是请求过多错误
          return "Too Many Requests" // 返回请求过多错误
        }
        if (json.code.includes("exhausted") || json.code.includes("unavailable")) {
          // 如果是资源耗尽或服务不可用错误
          return "Provider is overloaded" // 返回提供商过载错误
        }
        if (json.type === "error" && json.error?.code?.includes("rate_limit")) {
          // 如果是速率限制错误
          return "Rate Limited" // 返回速率限制错误
        }
        if (
          json.error?.message?.includes("no_kv_space") || // 如果是键值空间不足错误
          (json.type === "error" && json.error?.type === "server_error") || // 或者是服务器错误
          !!json.error // 或者存在其他错误
        ) {
          return "Provider Server Error" // 返回提供商服务器错误
        }
      } catch {} // 解析失败时忽略
    }

    return undefined // 不可重试，返回 undefined
  }
}
