import type { APIEvent } from "@solidjs/start/server"
import { Hono } from "hono"
import { describeRoute, openAPIRouteHandler, resolver } from "hono-openapi"
import { validator } from "hono-openapi"
import z from "zod"
import { cors } from "hono/cors"
import { Share } from "~/core/share"

/**
 * API路由应用实例
 */
const app = new Hono()

/**
 * 配置API路由
 */
app
  .basePath("/api") // 设置API基础路径
  .use(cors()) // 使用CORS中间件
  .get(
    "/doc",
    openAPIRouteHandler(app, {
      documentation: {
        info: {
          title: "Opencode Enterprise API",
          version: "1.0.0",
          description: "Opencode Enterprise API端点",
        },
        openapi: "3.1.1",
      },
    }),
  )
  .post(
    "/share",
    describeRoute({
      description: "创建分享",
      operationId: "share.create",
      responses: {
        200: {
          description: "成功",
          content: {
            "application/json": {
              schema: resolver(
                z
                  .object({
                    id: z.string(),
                    url: z.string(),
                    secret: z.string(),
                  })
                  .meta({ ref: "Share" }),
              ),
            },
          },
        },
      },
    }),
    validator("json", z.object({ sessionID: z.string() })),
    async (c) => {
      const body = c.req.valid("json")
      const share = await Share.create({ sessionID: body.sessionID })
      const protocol = c.req.header("x-forwarded-proto") ?? c.req.header("x-forwarded-protocol") ?? "https"
      const host = c.req.header("x-forwarded-host") ?? c.req.header("host")
      return c.json({
        id: share.id,
        secret: share.secret,
        url: `${protocol}://${host}/share/${share.id}`,
      })
    },
  )
  .post(
    "/share/:shareID/sync",
    describeRoute({
      description: "同步分享数据",
      operationId: "share.sync",
      responses: {
        200: {
          description: "成功",
          content: {
            "application/json": {
              schema: resolver(z.object({})),
            },
          },
        },
      },
    }),
    validator("param", z.object({ shareID: z.string() })),
    validator("json", z.object({ secret: z.string(), data: Share.Data.array() })),
    async (c) => {
      const { shareID } = c.req.valid("param")
      const body = c.req.valid("json")
      await Share.sync({
        share: { id: shareID, secret: body.secret },
        data: body.data,
      })
      return c.json({})
    },
  )
  .get(
    "/share/:shareID/data",
    describeRoute({
      description: "获取分享数据",
      operationId: "share.data",
      responses: {
        200: {
          description: "成功",
          content: {
            "application/json": {
              schema: resolver(z.array(Share.Data)),
            },
          },
        },
      },
    }),
    validator("param", z.object({ shareID: z.string() })),
    async (c) => {
      const { shareID } = c.req.valid("param")
      return c.json(await Share.data(shareID))
    },
  )
  .delete(
    "/share/:shareID",
    describeRoute({
      description: "删除分享",
      operationId: "share.remove",
      responses: {
        200: {
          description: "成功",
          content: {
            "application/json": {
              schema: resolver(z.object({})),
            },
          },
        },
      },
    }),
    validator("param", z.object({ shareID: z.string() })),
    validator("json", z.object({ secret: z.string() })),
    async (c) => {
      const { shareID } = c.req.valid("param")
      const body = c.req.valid("json")
      await Share.remove({ id: shareID, secret: body.secret })
      return c.json({})
    },
  )

/**
 * 处理GET请求
 * @param event API事件对象
 * @returns 响应对象
 */
export function GET(event: APIEvent) {
  return app.fetch(event.request)
}

/**
 * 处理POST请求
 * @param event API事件对象
 * @returns 响应对象
 */
export function POST(event: APIEvent) {
  return app.fetch(event.request)
}

/**
 * 处理PUT请求
 * @param event API事件对象
 * @returns 响应对象
 */
export function PUT(event: APIEvent) {
  return app.fetch(event.request)
}

/**
 * 处理DELETE请求
 * @param event API事件对象
 * @returns 响应对象
 */
export async function DELETE(event: APIEvent) {
  return app.fetch(event.request)
}
