import { Bus } from "@/bus" // 导入事件总线
import { BusEvent } from "@/bus/bus-event" // 导入总线事件定义工具
import z from "zod" // 导入 Zod 验证库
import { Storage } from "../storage/storage" // 导入存储模块

export namespace Todo {
  /**
   * 待办事项信息的 Zod schema 定义
   */
  export const Info = z
    .object({
      content: z.string().describe("Brief description of the task"), // 任务简短描述
      status: z.string().describe("Current status of the task: pending, in_progress, completed, cancelled"), // 任务当前状态：待处理、进行中、已完成、已取消
      priority: z.string().describe("Priority level of the task: high, medium, low"), // 任务优先级：高、中、低
      id: z.string().describe("Unique identifier for the todo item"), // 待办事项的唯一标识符
    })
    .meta({ ref: "Todo" }) // 引用名称
  export type Info = z.infer<typeof Info> // 待办事项信息类型

  /**
   * 待办事项事件定义
   */
  export const Event = {
    Updated: BusEvent.define(
      // 定义更新事件
      "todo.updated", // 事件名称
      z.object({
        sessionID: z.string(), // 会话 ID
        todos: z.array(Info), // 待办事项列表
      }),
    ),
  }

  /**
   * 更新待办事项列表
   * @param input - 包含会话 ID 和待办事项列表的输入参数
   */
  export async function update(input: { sessionID: string; todos: Info[] }) {
    await Storage.write(["todo", input.sessionID], input.todos) // 保存待办事项列表到存储
    Bus.publish(Event.Updated, input) // 发布更新事件
  }

  /**
   * 获取指定会话的待办事项列表
   * @param sessionID - 会话 ID
   * @returns Promise<Info[]> - 待办事项列表
   */
  export async function get(sessionID: string) {
    return Storage.read<Info[]>(["todo", sessionID]) // 从存储中读取待办事项列表
      .then((x) => x || []) // 如果不存在则返回空数组
      .catch(() => []) // 读取失败时返回空数组
  }
}
