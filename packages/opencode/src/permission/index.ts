import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import z from "zod"
import { Identifier } from "../id/id"
import { Plugin } from "../plugin"
import { Instance } from "../project/instance"
import { Log } from "../util/log"
import { Wildcard } from "../util/wildcard"

export namespace Permission {
  const log = Log.create({ service: "permission" }) // 创建权限服务日志记录器

  // 将模式转换为键数组
  function toKeys(pattern: Info["pattern"], type: string): string[] {
    return pattern === undefined ? [type] : Array.isArray(pattern) ? pattern : [pattern]
  }

  // 检查所有键是否都被批准的规则覆盖
  function covered(keys: string[], approved: Record<string, boolean>): boolean {
    const pats = Object.keys(approved)
    return keys.every((k) => pats.some((p) => Wildcard.match(k, p)))
  }

  // 权限信息Schema定义
  export const Info = z
    .object({
      id: z.string(), // 权限ID
      type: z.string(), // 权限类型
      pattern: z.union([z.string(), z.array(z.string())]).optional(), // 权限模式(可选)
      sessionID: z.string(), // 会话ID
      messageID: z.string(), // 消息ID
      callID: z.string().optional(), // 调用ID(可选)
      message: z.string(), // 权限请求消息
      metadata: z.record(z.string(), z.any()), // 元数据
      time: z.object({
        created: z.number(), // 创建时间戳
      }),
    })
    .meta({
      ref: "Permission",
    })
  export type Info = z.infer<typeof Info>

  // 权限事件定义
  export const Event = {
    Updated: BusEvent.define("permission.updated", Info), // 权限更新事件
    Replied: BusEvent.define(
      "permission.replied",
      z.object({
        sessionID: z.string(), // 会话ID
        permissionID: z.string(), // 权限ID
        response: z.string(), // 响应内容
      }),
    ),
  }

  // 权限状态管理
  const state = Instance.state(
    () => {
      const pending: {
        [sessionID: string]: {
          [permissionID: string]: {
            info: Info // 权限信息
            resolve: () => void // 成功回调
            reject: (e: any) => void // 失败回调
          }
        }
      } = {}

      const approved: {
        [sessionID: string]: {
          [permissionID: string]: boolean // 是否已批准
        }
      } = {}

      return {
        pending, // 待处理的权限请求
        approved, // 已批准的权限规则
      }
    },
    async (state) => {
      // 清理所有待处理的权限请求
      for (const pending of Object.values(state.pending)) {
        for (const item of Object.values(pending)) {
          item.reject(new RejectedError(item.info.sessionID, item.info.id, item.info.callID, item.info.metadata))
        }
      }
    },
  )

  // 获取待处理的权限请求
  export function pending() {
    return state().pending
  }

  // 列出所有待处理的权限请求
  export function list() {
    const { pending } = state()
    const result: Info[] = []
    for (const items of Object.values(pending)) {
      for (const item of Object.values(items)) {
        result.push(item.info)
      }
    }
    return result.sort((a, b) => a.id.localeCompare(b.id))
  }

  // 请求权限
  export async function ask(input: {
    type: Info["type"] // 权限类型
    message: Info["message"] // 权限请求消息
    pattern?: Info["pattern"] // 权限模式(可选)
    callID?: Info["callID"] // 调用ID(可选)
    sessionID: Info["sessionID"] // 会话ID
    messageID: Info["messageID"] // 消息ID
    metadata: Info["metadata"] // 元数据
  }) {
    const { pending, approved } = state()
    log.info("请求权限", {
      sessionID: input.sessionID,
      messageID: input.messageID,
      toolCallID: input.callID,
      pattern: input.pattern,
    })
    const approvedForSession = approved[input.sessionID] || {}
    const keys = toKeys(input.pattern, input.type)
    // 检查是否已被批准
    if (covered(keys, approvedForSession)) return
    const info: Info = {
      id: Identifier.ascending("permission"), // 生成唯一的权限ID
      type: input.type,
      pattern: input.pattern,
      sessionID: input.sessionID,
      messageID: input.messageID,
      callID: input.callID,
      message: input.message,
      metadata: input.metadata,
      time: {
        created: Date.now(),
      },
    }

    // 触发权限请求插件
    switch (
      await Plugin.trigger("permission.ask", info, {
        status: "ask",
      }).then((x) => x.status)
    ) {
      case "deny": // 拒绝
        throw new RejectedError(info.sessionID, info.id, info.callID, info.metadata)
      case "allow": // 允许
        return
    }

    // 添加到待处理列表
    pending[input.sessionID] = pending[input.sessionID] || {}
    return new Promise<void>((resolve, reject) => {
      pending[input.sessionID][info.id] = {
        info,
        resolve,
        reject,
      }
      Bus.publish(Event.Updated, info)
    })
  }

  // 权限响应类型枚举
  export const Response = z.enum(["once", "always", "reject"]) // 一次、总是、拒绝
  export type Response = z.infer<typeof Response>

  // 响应权限请求
  export function respond(input: { sessionID: Info["sessionID"]; permissionID: Info["id"]; response: Response }) {
    log.info("响应权限", input)
    const { pending, approved } = state()
    const match = pending[input.sessionID]?.[input.permissionID]
    if (!match) return
    // 从待处理列表中移除
    delete pending[input.sessionID][input.permissionID]
    Bus.publish(Event.Replied, {
      sessionID: input.sessionID,
      permissionID: input.permissionID,
      response: input.response,
    })
    if (input.response === "reject") {
      match.reject(new RejectedError(input.sessionID, input.permissionID, match.info.callID, match.info.metadata))
      return
    }
    match.resolve()
    if (input.response === "always") {
      // 更新已批准的权限规则
      approved[input.sessionID] = approved[input.sessionID] || {}
      const approveKeys = toKeys(match.info.pattern, match.info.type)
      for (const k of approveKeys) {
        approved[input.sessionID][k] = true
      }
      // 处理其他待处理的权限请求
      const items = pending[input.sessionID]
      if (!items) return
      for (const item of Object.values(items)) {
        const itemKeys = toKeys(item.info.pattern, item.info.type)
        if (covered(itemKeys, approved[input.sessionID])) {
          respond({
            sessionID: item.info.sessionID,
            permissionID: item.info.id,
            response: input.response,
          })
        }
      }
    }
  }

  // 权限被拒绝错误类
  export class RejectedError extends Error {
    constructor(
      public readonly sessionID: string, // 会话ID
      public readonly permissionID: string, // 权限ID
      public readonly toolCallID?: string, // 工具调用ID(可选)
      public readonly metadata?: Record<string, any>, // 元数据(可选)
      public readonly reason?: string, // 拒绝原因(可选)
    ) {
      super(reason !== undefined ? reason : `用户拒绝了使用此特定工具调用的权限。您可以尝试使用不同的参数重试。`)
    }
  }
}
