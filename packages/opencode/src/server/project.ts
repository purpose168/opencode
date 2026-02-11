import { Hono } from "hono" // 导入Hono框架，用于构建Web API
import { describeRoute, resolver, validator } from "hono-openapi" // 导入OpenAPI路由描述和验证器
import z from "zod" // 导入Zod库，用于数据验证和模式定义
import { Instance } from "../project/instance" // 导入项目实例模块
import { Project } from "../project/project" // 导入项目模块
import { errors } from "./error" // 导入错误处理模块

export const ProjectRoute = new Hono() // 创建项目路由实例
  .get(
    "/",
    describeRoute({
      summary: "列出所有项目", // List all projects
      description: "获取已使用OpenCode打开的项目列表。", // Get a list of projects that have been opened with OpenCode.
      operationId: "project.list", // 操作ID，用于API文档标识
      responses: {
        200: {
          description: "项目列表", // List of projects
          content: {
            "application/json": {
              schema: resolver(Project.Info.array()), // 项目信息数组模式
            },
          },
        },
      },
    }),
    async (c) => {
      const projects = await Project.list() // 获取所有项目列表
      return c.json(projects) // 返回JSON格式的项目列表
    },
  )
  .get(
    "/current",
    describeRoute({
      summary: "获取当前项目", // Get current project
      description: "检索OpenCode当前正在使用的活动项目。", // Retrieve the currently active project that OpenCode is working with.
      operationId: "project.current", // 操作ID，用于API文档标识
      responses: {
        200: {
          description: "当前项目信息", // Current project information
          content: {
            "application/json": {
              schema: resolver(Project.Info), // 项目信息模式
            },
          },
        },
      },
    }),
    async (c) => {
      return c.json(Instance.project) // 返回当前项目实例的JSON数据
    },
  )
  .patch(
    "/:projectID",
    describeRoute({
      summary: "更新项目", // Update project
      description: "更新项目属性，如名称、图标和颜色。", // Update project properties such as name, icon and color.
      operationId: "project.update", // 操作ID，用于API文档标识
      responses: {
        200: {
          description: "更新后的项目信息", // Updated project information
          content: {
            "application/json": {
              schema: resolver(Project.Info), // 项目信息模式
            },
          },
        },
        ...errors(400, 404), // 包含400和404错误响应
      },
    }),
    validator("param", z.object({ projectID: z.string() })), // 验证路径参数中的projectID
    validator("json", Project.update.schema.omit({ projectID: true })), // 验证请求体中的项目更新数据（排除projectID字段）
    async (c) => {
      const projectID = c.req.valid("param").projectID // 从路径参数中获取项目ID
      const body = c.req.valid("json") // 从请求体中获取更新数据
      const project = await Project.update({ ...body, projectID }) // 更新项目信息
      return c.json(project) // 返回更新后的项目信息
    },
  )
