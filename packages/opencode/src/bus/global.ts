import { EventEmitter } from "events"

/**
 * 全局事件总线
 * 用于在应用程序的不同部分之间传递事件
 */
/**
 * 全局事件总线实例
 * 支持的事件类型：
 * - event: 通用事件，包含可选的目录路径和事件负载
 */
export const GlobalBus = new EventEmitter<{
  /**
   * 通用事件
   * @param directory 可选的目录路径
   * @param payload 事件负载，可以是任何类型
   */
  event: [
    {
      directory?: string // 可选的目录路径
      payload: any // 事件负载
    },
  ]
}>()
