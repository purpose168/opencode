import z from "zod"
import DESCRIPTION from "./codesearch.txt"
import { Tool } from "./tool"

// API配置常量
const API_CONFIG = {
  BASE_URL: "https://mcp.exa.ai",
  ENDPOINTS: {
    CONTEXT: "/mcp",
  },
} as const

// MCP代码请求接口定义
interface McpCodeRequest {
  jsonrpc: string
  id: number
  method: string
  params: {
    name: string
    arguments: {
      query: string
      tokensNum: number
    }
  }
}

// MCP代码响应接口定义
interface McpCodeResponse {
  jsonrpc: string
  result: {
    content: Array<{
      type: string
      text: string
    }>
  }
}

// 定义代码搜索工具，用于搜索API、库和SDK的相关上下文
export const CodeSearchTool = Tool.define("codesearch", {
  description: DESCRIPTION,
  parameters: z.object({
    query: z
      .string()
      .describe(
        "搜索查询，用于查找API、库和SDK的相关上下文。例如，'React useState hook示例'、'Python pandas数据框过滤'、'Express.js中间件'、'Next.js部分预渲染配置'",
      ),
    tokensNum: z
      .number()
      .min(1000)
      .max(50000)
      .default(5000)
      .describe(
        "要返回的token数量（1000-50000）。默认为5000个token。根据您需要的上下文量调整此值 - 对于针对性查询使用较低的值，对于综合文档使用较高的值。",
      ),
  }),
  async execute(params, ctx) {
    // 请求代码搜索权限
    await ctx.ask({
      permission: "codesearch",
      patterns: [params.query],
      always: ["*"],
      metadata: {
        query: params.query,
        tokensNum: params.tokensNum,
      },
    })

    // 构建代码搜索请求
    const codeRequest: McpCodeRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "get_code_context_exa",
        arguments: {
          query: params.query,
          tokensNum: params.tokensNum || 5000,
        },
      },
    }

    // 设置超时控制器，30秒后中止请求
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      // 设置请求头
      const headers: Record<string, string> = {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      }

      // 发送HTTP请求到代码搜索API
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CONTEXT}`, {
        method: "POST",
        headers,
        body: JSON.stringify(codeRequest),
        signal: AbortSignal.any([controller.signal, ctx.abort]),
      })

      clearTimeout(timeoutId)

      // 检查响应状态
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`代码搜索错误（${response.status}）：${errorText}`)
      }

      const responseText = await response.text()

      // 解析服务器发送事件（SSE）响应
      const lines = responseText.split("\n")
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data: McpCodeResponse = JSON.parse(line.substring(6))
          if (data.result && data.result.content && data.result.content.length > 0) {
            return {
              output: data.result.content[0].text,
              title: `代码搜索：${params.query}`,
              metadata: {},
            }
          }
        }
      }

      // 未找到代码片段或文档
      return {
        output: "未找到代码片段或文档。请尝试不同的查询，更具体地说明库或编程概念，或检查框架名称的拼写。",
        title: `代码搜索：${params.query}`,
        metadata: {},
      }
    } catch (error) {
      clearTimeout(timeoutId)

      // 处理中止错误（超时或用户取消）
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("代码搜索请求超时")
      }

      throw error
    }
  },
})
