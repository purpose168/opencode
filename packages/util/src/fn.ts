/**
 * 函数工具
 * 
 * 提供创建带模式验证的函数的工具
 */
import { z } from "zod"

/**
 * 创建带模式验证的函数
 * 
 * @template T - Zod 模式类型
 * @template Result - 函数返回类型
 * @param schema - Zod 模式对象，用于验证输入
 * @param cb - 回调函数，接收验证后的输入并返回结果
 * @returns 带模式验证的函数，包含 force 方法和 schema 属性
 */
export function fn<T extends z.ZodType, Result>(schema: T, cb: (input: z.infer<T>) => Result) {
  // 创建带验证的函数
  const result = (input: z.infer<T>) => {
    const parsed = schema.parse(input) // 验证并解析输入
    return cb(parsed) // 调用回调函数
  }
  
  // 添加 force 方法，跳过验证直接调用回调
  result.force = (input: z.infer<T>) => cb(input)
  
  // 添加 schema 属性，存储原始模式
  result.schema = schema
  
  return result
}
