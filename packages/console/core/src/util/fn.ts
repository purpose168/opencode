import { z } from "zod"

/**
 * 创建一个带 schema 验证的函数
 * 该函数会先使用 Zod schema 验证输入，然后调用回调函数
 * @param schema Zod 验证 schema
 * @param cb 验证通过后的回调函数
 * @returns 带有验证功能的函数，包含 force 和 schema 属性
 */
export function fn<T extends z.ZodType, Result>(schema: T, cb: (input: z.infer<T>) => Result) {
  // 创建验证函数：先解析输入，再调用回调
  const result = (input: z.infer<T>) => {
    const parsed = schema.parse(input)
    return cb(parsed)
  }
  // 强制执行：跳过验证直接调用回调
  result.force = (input: z.infer<T>) => cb(input)
  // 附加 schema 到结果函数上
  result.schema = schema
  return result
}
