import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { Config } from "@/config/config"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Storage } from "@/storage/storage"
import { fn } from "@/util/fn"
import { Log } from "@/util/log"
import { Wildcard } from "@/util/wildcard"
import z from "zod"

export namespace PermissionNext {
  const log = Log.create({ service: "permission" })

  // 权限动作枚举定义,包含允许、拒绝和询问三种动作
  export const Action = z.enum(["allow", "deny", "ask"]).meta({
    ref: "PermissionAction",
  })
  export type Action = z.infer<typeof Action>

  // 权限规则Schema定义,包含权限名称、匹配模式和动作
  export const Rule = z
    .object({
      permission: z.string(), // 权限名称
      pattern: z.string(), // 匹配模式,支持通配符
      action: Action, // 权限动作
    })
    .meta({
      ref: "PermissionRule",
    })
  export type Rule = z.infer<typeof Rule>

  // 权限规则集Schema定义,是规则的数组
  export const Ruleset = Rule.array().meta({
    ref: "PermissionRuleset",
  })
  export type Ruleset = z.infer<typeof Ruleset>

  // 从配置对象构建权限规则集
  // 将配置中的权限设置转换为规则集格式
  // 支持两种配置格式:字符串格式(默认模式为*)和对象格式(指定不同模式的动作)
  export function fromConfig(permission: Config.Permission) {
    const ruleset: Ruleset = []
    for (const [key, value] of Object.entries(permission)) {
      if (typeof value === "string") {
        // 字符串格式:使用默认通配符模式
        ruleset.push({
          permission: key,
          action: value,
          pattern: "*",
        })
        continue
      }
      // 对象格式:为每个模式指定动作
      ruleset.push(...Object.entries(value).map(([pattern, action]) => ({ permission: key, pattern, action })))
    }
    return ruleset
  }

  // 合并多个规则集为一个规则集
  export function merge(...rulesets: Ruleset[]): Ruleset {
    return rulesets.flat()
  }

  // 权限请求Schema定义,包含请求的所有相关信息
  export const Request = z
    .object({
      id: Identifier.schema("permission"), // 权限请求唯一标识符
      sessionID: Identifier.schema("session"), // 会话ID
      permission: z.string(), // 请求的权限名称
      patterns: z.string().array(), // 需要匹配的模式列表
      metadata: z.record(z.string(), z.any()), // 元数据
      always: z.string().array(), // 总是批准的模式列表
      tool: z
        .object({
          messageID: z.string(), // 消息ID
          callID: z.string(), // 工具调用ID
        })
        .optional(), // 工具调用信息(可选)
    })
    .meta({
      ref: "PermissionRequest",
    })

  export type Request = z.infer<typeof Request>

  // 权限响应枚举定义,包含一次、总是和拒绝三种响应
  export const Reply = z.enum(["once", "always", "reject"])
  export type Reply = z.infer<typeof Reply>

  // 权限批准Schema定义,包含项目ID和批准的模式列表
  export const Approval = z.object({
    projectID: z.string(), // 项目ID
    patterns: z.string().array(), // 批准的模式列表
  })

  // 权限事件定义
  export const Event = {
    Asked: BusEvent.define("permission.asked", Request), // 权限询问事件
    Replied: BusEvent.define(
      // 权限响应事件
      "permission.replied",
      z.object({
        sessionID: z.string(), // 会话ID
        requestID: z.string(), // 请求ID
        reply: Reply, // 响应类型
      }),
    ),
  }

  // 权限状态管理
  // 使用实例状态管理待处理和已批准的权限
  const state = Instance.state(async () => {
    const projectID = Instance.project.id
    // 从存储中读取已批准的权限规则集
    const stored = await Storage.read<Ruleset>(["permission", projectID]).catch(() => [] as Ruleset)

    // 待处理的权限请求映射表
    const pending: Record<
      string,
      {
        info: Request // 权限请求信息
        resolve: () => void // 解决Promise的函数
        reject: (e: any) => void // 拒绝Promise的函数
      }
    > = {}

    return {
      pending, // 待处理的权限请求
      approved: stored, // 已批准的权限规则集
    }
  })

  // 请求权限函数
  // 评估权限请求并根据规则集决定是否需要询问用户
  // 如果规则明确允许或拒绝,直接返回或抛出错误
  // 如果规则要求询问,则发布事件并等待用户响应
  export const ask = fn(
    Request.partial({ id: true }).extend({
      ruleset: Ruleset,
    }),
    async (input) => {
      const s = await state()
      const { ruleset, ...request } = input
      // 遍历所有需要匹配的模式
      for (const pattern of request.patterns ?? []) {
        // 评估权限:根据权限名称、模式和规则集决定动作
        const action = evaluate(request.permission, pattern, ruleset, s.approved)
        log.info("evaluated", { permission: request.permission, pattern, action })
        if (action === "deny") throw new RejectedError() // 拒绝:抛出错误
        if (action === "ask") {
          // 询问:生成请求ID并等待用户响应
          const id = input.id ?? Identifier.ascending("permission")
          return new Promise<void>((resolve, reject) => {
            const info: Request = {
              id,
              ...request,
            }
            // 将请求添加到待处理列表
            s.pending[id] = {
              info,
              resolve,
              reject,
            }
            // 发布权限询问事件
            Bus.publish(Event.Asked, info)
          })
        }
        if (action === "allow") continue // 允许:继续处理下一个模式
      }
    },
  )

  // 响应权限请求函数
  // 处理用户对权限请求的响应
  // 支持三种响应类型:拒绝、一次、总是
  export const reply = fn(
    z.object({
      requestID: Identifier.schema("permission"), // 请求ID
      reply: Reply, // 响应类型
    }),
    async (input) => {
      const s = await state()
      const existing = s.pending[input.requestID]
      if (!existing) return // 请求不存在,直接返回
      delete s.pending[input.requestID] // 从待处理列表中移除
      // 发布权限响应事件
      Bus.publish(Event.Replied, {
        sessionID: existing.info.sessionID,
        requestID: existing.info.id,
        reply: input.reply,
      })
      if (input.reply === "reject") {
        // 拒绝:拒绝当前请求并拒绝同一会话的所有其他待处理请求
        existing.reject(new RejectedError())
        const sessionID = existing.info.sessionID
        for (const [id, pending] of Object.entries(s.pending)) {
          if (pending.info.sessionID === sessionID) {
            delete s.pending[id]
            Bus.publish(Event.Replied, {
              sessionID: pending.info.sessionID,
              requestID: pending.info.id,
              reply: "reject",
            })
            pending.reject(new RejectedError())
          }
        }
        return
      }
      if (input.reply === "once") {
        // 一次:仅批准当前请求
        existing.resolve()
        return
      }
      if (input.reply === "always") {
        // 总是:将批准的规则添加到已批准列表,并自动批准同一会话中符合规则的待处理请求
        for (const pattern of existing.info.always) {
          s.approved.push({
            permission: existing.info.permission,
            pattern,
            action: "allow",
          })
        }

        existing.resolve()

        // 检查同一会话中的其他待处理请求
        const sessionID = existing.info.sessionID
        for (const [id, pending] of Object.entries(s.pending)) {
          if (pending.info.sessionID !== sessionID) continue
          // 检查待处理请求的所有模式是否都被允许
          const ok = pending.info.patterns.every(
            (pattern) => evaluate(pending.info.permission, pattern, s.approved) === "allow",
          )
          if (!ok) continue
          delete s.pending[id]
          Bus.publish(Event.Replied, {
            sessionID: pending.info.sessionID,
            requestID: pending.info.id,
            reply: "always",
          })
          pending.resolve()
        }

        // TODO: 尚未将权限规则集保存到磁盘,直到有UI来管理它
        // await Storage.write(["permission", Instance.project.id], s.approved)
        return
      }
    },
  )

  // 评估权限函数
  // 根据权限名称、模式和规则集评估权限动作
  // 使用通配符匹配来查找最匹配的规则
  // 如果没有匹配的规则,默认返回"ask"
  export function evaluate(permission: string, pattern: string, ...rulesets: Ruleset[]): Action {
    const merged = merge(...rulesets)
    log.info("evaluate", { permission, pattern, ruleset: merged })
    // 查找最后一个匹配的规则(后面的规则优先级更高)
    const match = merged.findLast(
      (rule) => Wildcard.match(permission, rule.permission) && Wildcard.match(pattern, rule.pattern),
    )
    return match?.action ?? "ask"
  }

  // 编辑工具列表,这些工具需要"edit"权限
  const EDIT_TOOLS = ["edit", "write", "patch", "multiedit"]

  // 获取被禁用的工具集合
  // 根据规则集评估每个工具是否被禁用
  // 编辑工具需要"edit"权限,其他工具使用其名称作为权限
  export function disabled(tools: string[], ruleset: Ruleset): Set<string> {
    const result = new Set<string>()
    for (const tool of tools) {
      const permission = EDIT_TOOLS.includes(tool) ? "edit" : tool
      if (evaluate(permission, "*", ruleset) === "deny") {
        result.add(tool)
      }
    }
    return result
  }

  // 权限被拒绝错误类
  // 当用户拒绝权限请求时抛出此错误
  export class RejectedError extends Error {
    constructor(public readonly reason?: string) {
      super(reason !== undefined ? reason : `用户拒绝了使用此特定工具调用的权限。您可以尝试使用不同的参数重试。`)
    }
  }

  // 列出所有待处理的权限请求
  export async function list() {
    return state().then((x) => Object.values(x.pending).map((x) => x.info))
  }
}
