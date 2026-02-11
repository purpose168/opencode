import { createJsonErrorResponseHandler } from "@ai-sdk/provider-utils"
import { z } from "zod/v4"

/**
 * OpenAI错误数据Schema定义
 * 定义了OpenAI API返回的错误数据结构
 *
 * 该Schema设计为宽松模式,以支持OpenAI兼容的提供者返回的略有不同的错误响应格式
 */
export const openaiErrorDataSchema = z.object({
  error: z.object({
    message: z.string(), // 错误消息,描述错误的详细信息

    // 以下附加信息采用宽松处理,以支持OpenAI兼容的提供者返回的略有不同的错误响应:
    type: z.string().nullish(), // 错误类型,可为null或undefined
    param: z.any().nullish(), // 错误参数,可为null或undefined,可以是任意类型
    code: z.union([z.string(), z.number()]).nullish(), // 错误代码,可为null或undefined,可以是字符串或数字
  }),
})

/**
 * OpenAI错误数据类型
 * 从openaiErrorDataSchema推断得出的TypeScript类型
 */
export type OpenAIErrorData = z.infer<typeof openaiErrorDataSchema>

/**
 * OpenAI失败响应处理器
 * 用于处理OpenAI API返回的JSON格式错误响应
 *
 * 该处理器使用createJsonErrorResponseHandler创建,配置了错误Schema和错误消息提取函数
 */
export const openaiFailedResponseHandler: any = createJsonErrorResponseHandler({
  errorSchema: openaiErrorDataSchema, // 错误数据Schema,用于验证和解析错误响应
  errorToMessage: (data) => data.error.message, // 错误消息提取函数,从错误数据中提取message字段
})
