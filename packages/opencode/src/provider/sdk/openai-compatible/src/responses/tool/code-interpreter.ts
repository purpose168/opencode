import { createProviderDefinedToolFactoryWithOutputSchema } from "@ai-sdk/provider-utils"
import { z } from "zod/v4"

// 代码解释器输入Schema定义
export const codeInterpreterInputSchema = z.object({
  code: z.string().nullish(), // 要运行的代码,如果不可用则为null
  containerId: z.string(), // 用于运行代码的容器ID
})

// 代码解释器输出Schema定义
export const codeInterpreterOutputSchema = z.object({
  outputs: z
    .array(
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("logs"), logs: z.string() }), // 日志输出类型
        z.object({ type: z.literal("image"), url: z.string() }), // 图像输出类型
      ]),
    )
    .nullish(), // 可以为null
})

// 代码解释器参数Schema定义
export const codeInterpreterArgsSchema = z.object({
  container: z
    .union([
      z.string(), // 容器ID字符串
      z.object({
        fileIds: z.array(z.string()).optional(), // 上传的文件ID数组(可选)
      }),
    ])
    .optional(), // 可选参数
})

// 代码解释器参数类型定义
type CodeInterpreterArgs = {
  /**
   * 代码解释器容器。
   * 可以是容器ID
   * 或指定上传文件ID以使代码可用的对象。
   */
  container?: string | { fileIds?: string[] }
}

// 代码解释器工具工厂
// 创建具有输入和输出Schema的代码解释器工具
export const codeInterpreterToolFactory = createProviderDefinedToolFactoryWithOutputSchema<
  {
    /**
     * 要运行的代码,如果不可用则为null。
     */
    code?: string | null

    /**
     * 用于运行代码的容器的ID。
     */
    containerId: string
  },
  {
    /**
     * 代码解释器生成的输出,例如日志或图像。
     * 如果没有可用输出,可以为null。
     */
    outputs?: Array<
      | {
          type: "logs"

          /**
           * 代码解释器输出的日志。
           */
          logs: string
        }
      | {
          type: "image"

          /**
           * 代码解释器输出的图像的URL。
           */
          url: string
        }
    > | null
  },
  CodeInterpreterArgs
>({
  id: "openai.code_interpreter", // 工具ID
  name: "code_interpreter", // 工具名称
  inputSchema: codeInterpreterInputSchema, // 输入Schema
  outputSchema: codeInterpreterOutputSchema, // 输出Schema
})

// 代码解释器函数
// 创建并返回代码解释器工具实例
export const codeInterpreter = (
  args: CodeInterpreterArgs = {}, // 默认参数为空对象
) => {
  return codeInterpreterToolFactory(args)
}
