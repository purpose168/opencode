import { resolver } from "hono-openapi" // 导入OpenAPI解析器，用于生成API文档
import z from "zod" // 导入Zod库，用于数据验证和模式定义
import { Storage } from "../storage/storage" // 导入存储模块

export const ERRORS = {
  400: {
    description: "错误的请求", // Bad request - 客户端发送的请求格式错误
    content: {
      "application/json": {
        schema: resolver(
          z
            .object({
              data: z.any(), // 任意类型的数据
              errors: z.array(z.record(z.string(), z.any())), // 错误信息数组，包含键值对形式的错误详情
              success: z.literal(false), // 字面量false，表示操作失败
            })
            .meta({
              ref: "BadRequestError", // 引用名称，用于API文档中的错误类型标识
            }),
        ),
      },
    },
  },
  404: {
    description: "未找到", // Not found - 请求的资源不存在
    content: {
      "application/json": {
        schema: resolver(Storage.NotFoundError.Schema), // 使用存储模块中定义的未找到错误模式
      },
    },
  },
} as const // 使用const断言，确保类型推断为字面量类型

export function errors(...codes: number[]) {
  return Object.fromEntries(codes.map((code) => [code, ERRORS[code as keyof typeof ERRORS]])) // 根据传入的错误代码数组，从ERRORS对象中提取对应的错误定义并转换为对象
}
