import z from "zod" // 数据验证库
import { Todo } from "../session/todo" // 待办事项管理
import DESCRIPTION_WRITE from "./todowrite.txt" // 待办事项写入描述文件
import { Tool } from "./tool" // 工具基类

export const TodoWriteTool = Tool.define("todowrite", {
  description: DESCRIPTION_WRITE,
  parameters: z.object({
    todos: z.array(z.object(Todo.Info.shape)).describe("更新后的待办事项列表"),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: "todowrite",
      patterns: ["*"],
      always: ["*"],
      metadata: {},
    })

    await Todo.update({
      // 更新待办事项
      sessionID: ctx.sessionID,
      todos: params.todos,
    })
    return {
      title: `${params.todos.filter((x) => x.status !== "completed").length} 个待办事项`,
      output: JSON.stringify(params.todos, null, 2),
      metadata: {
        todos: params.todos,
      },
    }
  },
})

export const TodoReadTool = Tool.define("todoread", {
  description: "使用此工具读取您的待办事项列表",
  parameters: z.object({}),
  async execute(_params, ctx) {
    await ctx.ask({
      permission: "todoread",
      patterns: ["*"],
      always: ["*"],
      metadata: {},
    })

    const todos = await Todo.get(ctx.sessionID) // 获取待办事项
    return {
      title: `${todos.filter((x) => x.status !== "completed").length} 个待办事项`,
      metadata: {
        todos,
      },
      output: JSON.stringify(todos, null, 2),
    }
  },
})
