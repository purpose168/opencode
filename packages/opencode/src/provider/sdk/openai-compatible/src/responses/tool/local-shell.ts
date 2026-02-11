import { createProviderDefinedToolFactoryWithOutputSchema } from "@ai-sdk/provider-utils"
import { z } from "zod/v4"

// 本地Shell输入Schema定义
export const localShellInputSchema = z.object({
  action: z.object({
    type: z.literal("exec"), // 动作类型:执行
    command: z.array(z.string()), // 要执行的命令数组
    timeoutMs: z.number().optional(), // 命令的超时时间(毫秒,可选)
    user: z.string().optional(), // 运行命令的用户(可选)
    workingDirectory: z.string().optional(), // 运行命令的工作目录(可选)
    env: z.record(z.string(), z.string()).optional(), // 为命令设置的环境变量(可选)
  }),
})

// 本地Shell输出Schema定义
export const localShellOutputSchema = z.object({
  output: z.string(), // 本地Shell工具调用的输出
})

// 本地Shell工具工厂
// 创建具有输入和输出Schema的本地Shell工具
export const localShell = createProviderDefinedToolFactoryWithOutputSchema<
  {
    /**
     * 在服务器上执行Shell命令。
     */
    action: {
      type: "exec" // 动作类型:执行

      /**
       * 要运行的命令。
       */
      command: string[]

      /**
       * 命令的可选超时时间(毫秒)。
       */
      timeoutMs?: number

      /**
       * 运行命令的可选用户。
       */
      user?: string

      /**
       * 运行命令的可选工作目录。
       */
      workingDirectory?: string

      /**
       * 为命令设置的环境变量。
       */
      env?: Record<string, string>
    }
  },
  {
    /**
     * 本地Shell工具调用的输出。
     */
    output: string
  },
  {} // 空参数类型
>({
  id: "openai.local_shell", // 工具ID
  name: "local_shell", // 工具名称
  inputSchema: localShellInputSchema, // 输入Schema
  outputSchema: localShellOutputSchema, // 输出Schema
})
