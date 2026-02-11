import { Context } from "./context"
import { UserRole } from "./schema/user.sql"
import { Log } from "./util/log"

/**
 * Actor（操作者）命名空间
 * 用于管理不同类型的操作者上下文，包括账户、公共、用户和系统
 */
export namespace Actor {
  /**
   * 账户类型 Actor
   * 表示通过账户认证的操作者
   */
  interface Account {
    type: "account"
    properties: {
      accountID: string // 账户 ID
      email: string // 邮箱地址
    }
  }

  /**
   * 公共类型 Actor
   * 表示未认证的公共访问者
   */
  interface Public {
    type: "public"
    properties: {} // 无属性
  }

  /**
   * 用户类型 Actor
   * 表示工作区中的用户操作者
   */
  interface User {
    type: "user"
    properties: {
      userID: string // 用户 ID
      workspaceID: string // 工作区 ID
      accountID: string // 账户 ID
      role: (typeof UserRole)[number] // 用户角色
    }
  }

  /**
   * 系统类型 Actor
   * 表示系统内部操作者
   */
  interface System {
    type: "system"
    properties: {
      workspaceID: string // 工作区 ID
    }
  }

  /**
   * Actor 信息类型
   * 可以是账户、公共、用户或系统类型之一
   */
  export type Info = Account | Public | User | System

  // Actor 上下文
  const ctx = Context.create<Info>()
  export const use = ctx.use

  // Actor 日志记录器
  const log = Log.create().tag("namespace", "actor")

  /**
   * 提供 Actor 上下文
   * 在指定的 Actor 类型上下文中执行回调函数
   * @param type Actor 类型
   * @param properties Actor 属性
   * @param cb 要执行的回调函数
   * @returns 回调函数的返回值
   */
  export function provide<R, T extends Info["type"]>(
    type: T,
    properties: Extract<Info, { type: T }>["properties"],
    cb: () => R,
  ) {
    return ctx.provide(
      {
        type,
        properties,
      } as any,
      () => {
        return Log.provide({ ...properties }, () => {
          log.info("已提供 Actor 上下文")
          return cb()
        })
      },
    )
  }

  /**
   * 断言 Actor 类型
   * 检查当前 Actor 是否为指定类型，如果不是则抛出错误
   * @param type 期望的 Actor 类型
   * @returns 当前 Actor 信息
   * @throws 如果类型不匹配则抛出错误
   */
  export function assert<T extends Info["type"]>(type: T) {
    const actor = use()
    if (actor.type !== type) {
      throw new Error(`期望 Actor 类型为 ${type}，实际为 ${actor.type}`)
    }
    return actor as Extract<Info, { type: T }>
  }

  /**
   * 断言管理员权限
   * 检查当前用户是否为管理员，如果不是则抛出错误
   * @throws 如果当前用户不是管理员则抛出错误
   */
  export const assertAdmin = () => {
    if (userRole() === "admin") return
    throw new Error(`操作不被允许。请联系您的工作区管理员执行此操作。`)
  }

  /**
   * 获取工作区 ID
   * @returns 当前 Actor 关联的工作区 ID
   * @throws 如果 Actor 未关联工作区则抛出错误
   */
  export function workspace() {
    const actor = use()
    if ("workspaceID" in actor.properties) {
      return actor.properties.workspaceID
    }
    throw new Error(`类型为 "${actor.type}" 的 Actor 未关联工作区`)
  }

  /**
   * 获取账户 ID
   * @returns 当前 Actor 关联的账户 ID
   * @throws 如果 Actor 未关联账户则抛出错误
   */
  export function account() {
    const actor = use()
    if ("accountID" in actor.properties) {
      return actor.properties.accountID
    }
    throw new Error(`类型为 "${actor.type}" 的 Actor 未关联账户`)
  }

  /**
   * 获取用户 ID
   * @returns 当前用户的 ID
   */
  export function userID() {
    return Actor.assert("user").properties.userID
  }

  /**
   * 获取用户角色
   * @returns 当前用户的角色
   */
  export function userRole() {
    return Actor.assert("user").properties.role
  }
}
