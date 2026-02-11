import { Bus } from "@/bus" // 导入事件总线
import { BusEvent } from "@/bus/bus-event" // 导入总线事件定义工具
import { Instance } from "@/project/instance" // 导入实例状态管理工具
import z from "zod" // 导入 Zod 验证库

export namespace SessionStatus {
  /**
   * 会话状态信息的 Zod schema 定义
   * 使用联合类型定义三种状态：空闲、重试中、忙碌
   */
  export const Info = z
    .union([
      // 联合类型定义
      z.object({
        type: z.literal("idle"), // 空闲状态
      }),
      z.object({
        type: z.literal("retry"), // 重试中状态
        attempt: z.number(), // 当前重试次数
        message: z.string(), // 重试消息
        next: z.number(), // 下次重试时间戳
      }),
      z.object({
        type: z.literal("busy"), // 忙碌状态
      }),
    ])
    .meta({
      ref: "SessionStatus", // 引用名称
    })
  export type Info = z.infer<typeof Info> // 会话状态信息类型

  /**
   * 会话状态事件定义
   */
  export const Event = {
    Status: BusEvent.define(
      // 定义状态更新事件
      "session.status", // 事件名称
      z.object({
        sessionID: z.string(), // 会话 ID
        status: Info, // 会话状态
      }),
    ),
    // 已废弃
    Idle: BusEvent.define(
      // 定义空闲事件（已废弃）
      "session.idle", // 事件名称
      z.object({
        sessionID: z.string(), // 会话 ID
      }),
    ),
  }

  const state = Instance.state(() => {
    // 创建实例状态
    const data: Record<string, Info> = {} // 状态数据：会话 ID 到状态的映射
    return data
  })

  /**
   * 获取指定会话的状态
   * @param sessionID - 会话 ID
   * @returns Info - 会话状态信息，如果不存在则返回空闲状态
   */
  export function get(sessionID: string) {
    return (
      state()[sessionID] ?? {
        // 获取会话状态，如果不存在则返回空闲状态
        type: "idle",
      }
    )
  }

  /**
   * 获取所有会话的状态
   * @returns Record<string, Info> - 所有会话的状态映射
   */
  export function list() {
    return state() // 返回所有会话状态
  }

  /**
   * 设置指定会话的状态
   * @param sessionID - 会话 ID
   * @param status - 会话状态信息
   */
  export function set(sessionID: string, status: Info) {
    Bus.publish(Event.Status, {
      // 发布状态更新事件
      sessionID,
      status,
    })
    if (status.type === "idle") {
      // 如果状态为空闲
      // 已废弃
      Bus.publish(Event.Idle, {
        // 发布空闲事件（已废弃）
        sessionID,
      })
      delete state()[sessionID] // 从状态中删除该会话
      return
    }
    state()[sessionID] = status // 设置会话状态
  }
}
