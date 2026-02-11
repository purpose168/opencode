import { Resource } from "@opencode-ai/console-resource"
import type { TraceItem } from "@cloudflare/workers-types"

/**
 * 日志处理器
 * 用于处理和分析 Zen API 的请求日志，提取指标并发送到 Honeycomb.io
 */
export default {
  /**
   * 处理跟踪事件
   * @param events 跟踪事件数组
   */
  async tail(events: TraceItem[]) {
    for (const event of events) {
      // 跳过没有事件数据的项
      if (!event.event) continue
      if (!("request" in event.event)) continue
      if (event.event.request.method !== "POST") continue

      const url = new URL(event.event.request.url)
      // 只处理 Zen API 的特定路径
      if (
        url.pathname !== "/zen/v1/chat/completions" &&
        url.pathname !== "/zen/v1/messages" &&
        url.pathname !== "/zen/v1/responses" &&
        !url.pathname.startsWith("/zen/v1/models/")
      )
        return

      /**
       * 构建基础指标对象
       * 包含事件类型、地理位置信息、请求时长、请求长度、响应状态等
       */
      let metrics = {
        event_type: "completions",
        "cf.continent": event.event.request.cf?.continent, // 大洲
        "cf.country": event.event.request.cf?.country, // 国家
        "cf.city": event.event.request.cf?.city, // 城市
        "cf.region": event.event.request.cf?.region, // 地区
        "cf.latitude": event.event.request.cf?.latitude, // 纬度
        "cf.longitude": event.event.request.cf?.longitude, // 经度
        "cf.timezone": event.event.request.cf?.timezone, // 时区
        duration: event.wallTime, // 请求处理时长
        request_length: parseInt(event.event.request.headers["content-length"] ?? "0"), // 请求长度
        status: event.event.response?.status ?? 0, // 响应状态码
        ip: event.event.request.headers["x-real-ip"], // 客户端 IP
      }

      /**
       * 从日志消息中提取额外的指标信息
       * 查找以 "_metric:" 开头的消息，并解析其中的 JSON 数据
       */
      for (const log of event.logs) {
        for (const message of log.message) {
          if (!message.startsWith("_metric:")) continue
          metrics = { ...metrics, ...JSON.parse(message.slice(8)) }
        }
      }

      // 打印指标信息到控制台
      console.log(JSON.stringify(metrics, null, 2))

      /**
       * 将指标发送到 Honeycomb.io
       * 使用 POST 请求将指标数据发送到 Honeycomb API
       */
      const ret = await fetch("https://api.honeycomb.io/1/events/zen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Honeycomb-Event-Time": (event.eventTimestamp ?? Date.now()).toString(),
          "X-Honeycomb-Team": Resource.HONEYCOMB_API_KEY.value,
        },
        body: JSON.stringify(metrics),
      })

      // 打印发送结果
      console.log(ret.status)
      console.log(await ret.text())
    }
  },
}
