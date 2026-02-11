import z from "zod"
import { Log } from "../util/log"
import { Instance } from "../project/instance"
import { BusEvent } from "./bus-event"
import { GlobalBus } from "./global"

/**
 * 事件总线模块
 * 用于发布和订阅应用程序内的事件
 */
export namespace Bus {
  const log = Log.create({ service: "bus" })
  type Subscription = (event: any) => void

  /**
   * 实例销毁事件定义
   * 当服务器实例被销毁时触发
   */
  export const InstanceDisposed = BusEvent.define(
    "server.instance.disposed",
    z.object({
      directory: z.string(), // 实例目录路径
    }),
  )

  /**
   * 事件总线状态
   * 管理事件订阅和在实例销毁时发布事件
   */
  const state = Instance.state(
    () => {
      const subscriptions = new Map<any, Subscription[]>()

      return {
        subscriptions,
      }
    },
    async (entry) => {
      const wildcard = entry.subscriptions.get("*")
      if (!wildcard) return
      const event = {
        type: InstanceDisposed.type,
        properties: {
          directory: Instance.directory,
        },
      }
      for (const sub of [...wildcard]) {
        sub(event)
      }
    },
  )

  /**
   * 发布事件
   * @param def 事件定义
   * @param properties 事件属性
   * @returns 所有订阅回调的执行结果
   */
  export async function publish<Definition extends BusEvent.Definition>(
    def: Definition,
    properties: z.output<Definition["properties"]>,
  ) {
    const payload = {
      type: def.type,
      properties,
    }
    log.info("正在发布事件", {
      type: def.type,
    })
    const pending = []
    for (const key of [def.type, "*"]) {
      const match = state().subscriptions.get(key)
      for (const sub of match ?? []) {
        pending.push(sub(payload))
      }
    }
    GlobalBus.emit("event", {
      directory: Instance.directory,
      payload,
    })
    return Promise.all(pending)
  }

  /**
   * 订阅事件
   * @param def 事件定义
   * @param callback 事件回调函数
   * @returns 取消订阅函数
   */
  export function subscribe<Definition extends BusEvent.Definition>(
    def: Definition,
    callback: (event: { type: Definition["type"]; properties: z.infer<Definition["properties"]> }) => void,
  ) {
    return raw(def.type, callback)
  }

  /**
   * 订阅事件一次
   * 事件触发后自动取消订阅
   * @param def 事件定义
   * @param callback 事件回调函数，返回 "done" 表示完成订阅
   */
  export function once<Definition extends BusEvent.Definition>(
    def: Definition,
    callback: (event: {
      type: Definition["type"]
      properties: z.infer<Definition["properties"]>
    }) => "done" | undefined,
  ) {
    const unsub = subscribe(def, (event) => {
      if (callback(event)) unsub()
    })
  }

  /**
   * 订阅所有事件
   * @param callback 事件回调函数
   * @returns 取消订阅函数
   */
  export function subscribeAll(callback: (event: any) => void) {
    return raw("*", callback)
  }

  /**
   * 原始订阅方法
   * @param type 事件类型
   * @param callback 事件回调函数
   * @returns 取消订阅函数
   */
  function raw(type: string, callback: (event: any) => void) {
    log.info("正在订阅事件", { type })
    const subscriptions = state().subscriptions
    let match = subscriptions.get(type) ?? []
    match.push(callback)
    subscriptions.set(type, match)

    return () => {
      log.info("正在取消订阅事件", { type })
      const match = subscriptions.get(type)
      if (!match) return
      const index = match.indexOf(callback)
      if (index === -1) return
      match.splice(index, 1)
    }
  }
}
