import z from "zod"
import { Tool } from "./tool"

// 定义无效工具，用于处理工具参数无效的情况
export const InvalidTool = Tool.define("invalid", {
  description: "请勿使用",
  parameters: z.object({
    tool: z.string(),
    error: z.string(),
  }),
  async execute(params) {
    return {
      title: "无效工具",
      output: `提供给工具的参数无效：${params.error}`,
      metadata: {},
    }
  },
})
