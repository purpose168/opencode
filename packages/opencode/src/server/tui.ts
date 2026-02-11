import { Hono, type Context } from "hono" // 导入 Hono 框架和 Context 类型
import { describeRoute, resolver, validator } from "hono-openapi" // 导入 OpenAPI 路由描述工具
import { z } from "zod" // 导入 Zod 数据验证库
import { AsyncQueue } from "../util/queue" // 导入异步队列工具

const TuiRequest = z.object({
  path: z.string(), // 请求路径
  body: z.any(), // 请求体，可以是任意类型
}) // 定义 TUI 请求的数据结构

type TuiRequest = z.infer<typeof TuiRequest> // 推断 TuiRequest 的类型

const request = new AsyncQueue<TuiRequest>() // 创建 TUI 请求队列
const response = new AsyncQueue<any>() // 创建 TUI 响应队列

export async function callTui(ctx: Context) {
  const body = await ctx.req.json() // 解析请求体为 JSON
  request.push({
    // 将请求推入请求队列
    path: ctx.req.path, // 记录请求路径
    body, // 记录请求体
  })
  return response.next() // 等待并返回下一个响应
}

export const TuiRoute = new Hono()
  .get(
    "/next",
    describeRoute({
      summary: "获取下一个 TUI 请求", // 路由摘要
      description: "从队列中检索下一个 TUI（终端用户界面）请求以进行处理。", // 路由描述
      operationId: "tui.control.next", // 操作 ID
      responses: {
        200: {
          description: "下一个 TUI 请求", // 响应描述
          content: {
            "application/json": {
              schema: resolver(TuiRequest), // 响应数据结构
            },
          },
        },
      },
    }),
    async (c) => {
      const req = await request.next() // 从请求队列中获取下一个请求
      return c.json(req) // 返回 JSON 格式的请求
    },
  )
  .post(
    "/response",
    describeRoute({
      summary: "提交 TUI 响应", // 路由摘要
      description: "向 TUI 请求队列提交响应以完成待处理的请求。", // 路由描述
      operationId: "tui.control.response", // 操作 ID
      responses: {
        200: {
          description: "响应提交成功", // 响应描述
          content: {
            "application/json": {
              schema: resolver(z.boolean()), // 响应数据结构为布尔值
            },
          },
        },
      },
    }),
    validator("json", z.any()), // 验证 JSON 请求体
    async (c) => {
      const body = c.req.valid("json") // 获取验证后的请求体
      response.push(body) // 将响应推入响应队列
      return c.json(true) // 返回成功状态
    },
  )
