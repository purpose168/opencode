// 导入 zod 库用于模式验证
import { z } from "zod"

// 定义工具上下文类型
export type ToolContext = {
  sessionID: string
  messageID: string
  agent: string
  abort: AbortSignal
}

// 定义工具函数，用于创建工具定义
export function tool<Args extends z.ZodRawShape>(input: {
  description: string
  args: Args
  execute(args: z.infer<z.ZodObject<Args>>, context: ToolContext): Promise<string>
}) {
  return input
}
// 将 zod 模式附加到工具函数上
tool.schema = z

// 定义工具定义类型
export type ToolDefinition = ReturnType<typeof tool>
