/**
 * 标识符生成工具
 * 
 * 提供生成单调递增或递减的唯一标识符的功能
 */
import { randomBytes } from "crypto"

/**
 * 标识符命名空间
 * 
 * 包含生成唯一标识符的方法
 */
export namespace Identifier {
  /**
   * 标识符长度
   */
  const LENGTH = 26

  // 单调 ID 生成的状态
  let lastTimestamp = 0 // 上次生成 ID 的时间戳
  let counter = 0 // 计数器，用于同一时间戳内的 ID 生成

  /**
   * 生成升序标识符
   * 
   * @returns 升序唯一标识符
   */
  export function ascending() {
    return create(false)
  }

  /**
   * 生成降序标识符
   * 
   * @returns 降序唯一标识符
   */
  export function descending() {
    return create(true)
  }

  /**
   * 生成指定长度的随机 Base62 字符串
   * 
   * @param length - 字符串长度
   * @returns Base62 编码的随机字符串
   */
  function randomBase62(length: number): string {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    let result = ""
    const bytes = randomBytes(length)
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % 62]
    }
    return result
  }

  /**
   * 创建标识符
   * 
   * @param descending - 是否生成降序标识符
   * @param timestamp - 可选的时间戳，默认为当前时间
   * @returns 唯一标识符
   */
  export function create(descending: boolean, timestamp?: number): string {
    const currentTimestamp = timestamp ?? Date.now()

    // 如果时间戳变化，重置计数器
    if (currentTimestamp !== lastTimestamp) {
      lastTimestamp = currentTimestamp
      counter = 0
    }
    counter++

    // 计算时间戳和计数器的组合值
    let now = BigInt(currentTimestamp) * BigInt(0x1000) + BigInt(counter)

    // 如果是降序，取反
    now = descending ? ~now : now

    // 将时间戳和计数器组合值转换为字节
    const timeBytes = Buffer.alloc(6)
    for (let i = 0; i < 6; i++) {
      timeBytes[i] = Number((now >> BigInt(40 - 8 * i)) & BigInt(0xff))
    }

    // 生成最终标识符：时间戳字节的十六进制表示 + 随机 Base62 字符串
    return timeBytes.toString("hex") + randomBase62(LENGTH - 12)
  }
}
