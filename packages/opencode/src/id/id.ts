import { randomBytes } from "crypto" // 导入加密随机数生成器
import z from "zod" // 导入zod库用于数据验证

export namespace Identifier {
  const prefixes = {
    session: "ses", // 会话标识符前缀
    message: "msg", // 消息标识符前缀
    permission: "per", // 权限标识符前缀
    user: "usr", // 用户标识符前缀
    part: "prt", // 部分标识符前缀
    pty: "pty", // 伪终端标识符前缀
  } as const

  // 为指定前缀创建ID验证schema
  export function schema(prefix: keyof typeof prefixes) {
    return z.string().startsWith(prefixes[prefix])
  }

  const LENGTH = 26 // ID总长度

  // 单调ID生成的状态变量
  let lastTimestamp = 0 // 上次生成ID的时间戳
  let counter = 0 // 计数器

  // 生成升序ID
  export function ascending(prefix: keyof typeof prefixes, given?: string) {
    return generateID(prefix, false, given)
  }

  // 生成降序ID
  export function descending(prefix: keyof typeof prefixes, given?: string) {
    return generateID(prefix, true, given)
  }

  // 生成ID的内部函数
  function generateID(prefix: keyof typeof prefixes, descending: boolean, given?: string): string {
    if (!given) {
      return create(prefix, descending)
    }

    // 验证给定的ID是否以正确的前缀开头
    if (!given.startsWith(prefixes[prefix])) {
      throw new Error(`ID ${given} does not start with ${prefixes[prefix]}`)
    }
    return given
  }

  // 生成指定长度的随机base62字符串
  function randomBase62(length: number): string {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" // base62字符集
    let result = ""
    const bytes = randomBytes(length) // 生成随机字节
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % 62]
    }
    return result
  }

  // 创建新的ID
  export function create(prefix: keyof typeof prefixes, descending: boolean, timestamp?: number): string {
    const currentTimestamp = timestamp ?? Date.now() // 获取当前时间戳或使用给定时间戳

    // 如果时间戳变化,重置计数器
    if (currentTimestamp !== lastTimestamp) {
      lastTimestamp = currentTimestamp
      counter = 0
    }
    counter++

    // 组合时间戳和计数器
    let now = BigInt(currentTimestamp) * BigInt(0x1000) + BigInt(counter)

    // 根据是否降序决定是否取反
    now = descending ? ~now : now

    // 将时间戳转换为6字节的缓冲区
    const timeBytes = Buffer.alloc(6)
    for (let i = 0; i < 6; i++) {
      timeBytes[i] = Number((now >> BigInt(40 - 8 * i)) & BigInt(0xff))
    }

    // 返回格式为:前缀_时间戳(十六进制)+随机字符串的ID
    return prefixes[prefix] + "_" + timeBytes.toString("hex") + randomBase62(LENGTH - 12)
  }
}
