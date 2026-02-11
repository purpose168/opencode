import z from "zod"
import type { ZodType } from "zod"
import { Log } from "../util/log"

/**
 * 事件总线事件模块
 * 负责定义和管理事件类型
 */
export namespace BusEvent {
  const log = Log.create({ service: "event" })

  /**
   * 事件定义类型
   * 由 define 函数返回的类型
   */
  export type Definition = ReturnType<typeof define>

  // 事件定义注册表
  const registry = new Map<string, Definition>()

  /**
   * 定义一个新的事件类型
   * @param type 事件类型名称
   * @param properties 事件属性的 Zod 模式
   * @returns 事件定义对象
   */
  export function define<Type extends string, Properties extends ZodType>(type: Type, properties: Properties) {
    const result = {
      type,
      properties,
    }
    registry.set(type, result)
    return result
  }

  /**
   * 生成所有注册事件的负载 Zod 模式
   * @returns 事件负载的 Zod 联合模式
   */
  export function payloads() {
    return z
      .discriminatedUnion(
        "type",
        registry
          .entries()
          .map(([type, def]) => {
            return z
              .object({
                type: z.literal(type),
                properties: def.properties,
              })
              .meta({
                ref: "Event" + "." + def.type,
              })
          })
          .toArray() as any,
      )
      .meta({
        ref: "Event",
      })
  }
}
