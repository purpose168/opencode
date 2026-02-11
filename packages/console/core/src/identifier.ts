import { ulid } from "ulid"
import { z } from "zod"

/**
 * 标识符管理命名空间
 * 提供标识符生成和验证功能
 */
export namespace Identifier {
  /**
   * 标识符前缀映射
   * 定义不同类型实体的标识符前缀
   */
  const prefixes = {
    account: "acc", // 账户
    auth: "aut", // 认证
    benchmark: "ben", // 基准测试
    billing: "bil", // 账单
    key: "key", // 密钥
    model: "mod", // 模型
    payment: "pay", // 支付
    provider: "prv", // 提供商
    usage: "usg", // 使用量
    user: "usr", // 用户
    workspace: "wrk", // 工作区
  } as const

  /**
   * 创建标识符
   * 生成指定类型的唯一标识符
   * @param prefix 标识符类型
   * @param given 可选的给定标识符（如果提供，则验证其前缀）
   * @returns 生成的标识符
   * @throws 如果给定标识符的前缀不匹配则抛出错误
   */
  export function create(prefix: keyof typeof prefixes, given?: string): string {
    if (given) {
      if (given.startsWith(prefixes[prefix])) return given
      throw new Error(`标识符 ${given} 不以 ${prefixes[prefix]} 开头`)
    }
    return [prefixes[prefix], ulid()].join("_")
  }

  /**
   * 创建标识符 schema
   * 用于验证标识符格式
   * @param prefix 标识符类型
   * @returns Zod schema，用于验证标识符是否以指定前缀开头
   */
  export function schema(prefix: keyof typeof prefixes) {
    return z.string().startsWith(prefixes[prefix])
  }
}
