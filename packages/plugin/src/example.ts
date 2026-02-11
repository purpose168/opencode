// 导入 Plugin 类型定义
import { Plugin } from "./index"
// 导入 tool 函数用于创建工具定义
import { tool } from "./tool"

// 定义示例插件
export const ExamplePlugin: Plugin = async (ctx) => {
  return {
    tool: {
      // 定义自定义工具 mytool
      mytool: tool({
        description: "这是一个自定义工具",
        args: {
          // 定义 foo 参数为字符串类型
          foo: tool.schema.string().describe("foo"),
        },
        // 执行工具的逻辑
        async execute(args) {
          return `Hello ${args.foo}!`
        },
      }),
    },
  }
}
