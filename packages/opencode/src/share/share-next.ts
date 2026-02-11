import { Bus } from "@/bus" // 导入事件总线
import { Config } from "@/config/config" // 导入配置模块
import { Provider } from "@/provider/provider" // 导入提供商模块
import { Session } from "@/session" // 导入会话模块
import { MessageV2 } from "@/session/message-v2" // 导入消息 V2 模块
import { Storage } from "@/storage/storage" // 导入存储模块
import { Log } from "@/util/log" // 导入日志工具
import type * as SDK from "@opencode-ai/sdk/v2" // 导入 SDK 类型定义
import { ulid } from "ulid" // 导入 ULID 生成工具

export namespace ShareNext {
  const log = Log.create({ service: "share-next" }) // 创建日志实例

  /**
   * 获取分享服务器 URL
   * @returns Promise<string> - 分享服务器 URL
   */
  async function url() {
    return Config.get().then((x) => x.enterprise?.url ?? "https://opncd.ai") // 返回企业 URL 或默认 URL
  }

  /**
   * 初始化分享功能，订阅相关事件
   */
  export async function init() {
    Bus.subscribe(Session.Event.Updated, async (evt) => {
      // 订阅会话更新事件
      await sync(evt.properties.info.id, [
        // 同步会话数据
        {
          type: "session", // 数据类型：会话
          data: evt.properties.info, // 会话信息
        },
      ])
    })
    Bus.subscribe(MessageV2.Event.Updated, async (evt) => {
      // 订阅消息更新事件
      await sync(evt.properties.info.sessionID, [
        // 同步消息数据
        {
          type: "message", // 数据类型：消息
          data: evt.properties.info, // 消息信息
        },
      ])
      if (evt.properties.info.role === "user") {
        // 如果是用户消息
        await sync(evt.properties.info.sessionID, [
          // 同步模型数据
          {
            type: "model", // 数据类型：模型
            data: [
              await Provider.getModel(evt.properties.info.model.providerID, evt.properties.info.model.modelID).then(
                // 获取模型信息
                (m) => m,
              ),
            ],
          },
        ])
      }
    })
    Bus.subscribe(MessageV2.Event.PartUpdated, async (evt) => {
      // 订阅消息部分更新事件
      await sync(evt.properties.part.sessionID, [
        // 同步消息部分数据
        {
          type: "part", // 数据类型：消息部分
          data: evt.properties.part, // 消息部分信息
        },
      ])
    })
    Bus.subscribe(Session.Event.Diff, async (evt) => {
      // 订阅会话差异事件
      await sync(evt.properties.sessionID, [
        // 同步差异数据
        {
          type: "session_diff", // 数据类型：会话差异
          data: evt.properties.diff, // 差异信息
        },
      ])
    })
  }

  /**
   * 创建会话分享
   * @param sessionID - 会话 ID
   * @returns Promise<{ id: string; url: string; secret: string }> - 分享信息（包含 ID、URL 和密钥）
   */
  export async function create(sessionID: string) {
    log.info("creating share", { sessionID }) // 记录创建分享日志
    const result = await fetch(`${await url()}/api/share`, {
      // 调用分享 API
      method: "POST", // 请求方法：POST
      headers: {
        "Content-Type": "application/json", // 内容类型：JSON
      },
      body: JSON.stringify({ sessionID: sessionID }), // 请求体：会话 ID
    })
      .then((x) => x.json()) // 解析 JSON 响应
      .then((x) => x as { id: string; url: string; secret: string }) // 类型断言
    await Storage.write(["session_share", sessionID], result) // 保存分享信息到存储
    fullSync(sessionID) // 执行完整同步
    return result // 返回分享信息
  }

  /**
   * 获取会话分享信息
   * @param sessionID - 会话 ID
   * @returns Promise<{ id: string; secret: string; url: string } | undefined> - 分享信息
   */
  function get(sessionID: string) {
    return Storage.read<{
      // 从存储中读取分享信息
      id: string // 分享 ID
      secret: string // 分享密钥
      url: string // 分享 URL
    }>(["session_share", sessionID])
  }

  /**
   * 数据类型定义
   */
  type Data =
    | {
        type: "session" // 会话数据
        data: SDK.Session // 会话信息
      }
    | {
        type: "message" // 消息数据
        data: SDK.Message // 消息信息
      }
    | {
        type: "part" // 消息部分数据
        data: SDK.Part // 消息部分信息
      }
    | {
        type: "session_diff" // 会话差异数据
        data: SDK.FileDiff[] // 文件差异列表
      }
    | {
        type: "model" // 模型数据
        data: SDK.Model[] // 模型列表
      }

  const queue = new Map<string, { timeout: NodeJS.Timeout; data: Map<string, Data> }>() // 同步队列
  /**
   * 同步数据到服务器（使用队列和防抖）
   * @param sessionID - 会话 ID
   * @param data - 要同步的数据列表
   */
  async function sync(sessionID: string, data: Data[]) {
    const existing = queue.get(sessionID) // 获取现有队列
    if (existing) {
      // 如果队列已存在
      for (const item of data) {
        // 遍历新数据
        existing.data.set("id" in item ? (item.id as string) : ulid(), item) // 添加到现有队列
      }
      return // 直接返回
    }

    const dataMap = new Map<string, Data>() // 创建新的数据映射
    for (const item of data) {
      // 遍历数据
      dataMap.set("id" in item ? (item.id as string) : ulid(), item) // 添加到数据映射
    }

    const timeout = setTimeout(async () => {
      // 设置延迟执行
      const queued = queue.get(sessionID) // 获取队列数据
      if (!queued) return // 如果队列不存在，直接返回
      queue.delete(sessionID) // 从队列中删除
      const share = await get(sessionID) // 获取分享信息
      if (!share) return // 如果分享不存在，直接返回

      await fetch(`${await url()}/api/share/${share.id}/sync`, {
        // 调用同步 API
        method: "POST", // 请求方法：POST
        headers: {
          "Content-Type": "application/json", // 内容类型：JSON
        },
        body: JSON.stringify({
          // 请求体
          secret: share.secret, // 分享密钥
          data: Array.from(queued.data.values()), // 队列中的所有数据
        }),
      })
    }, 1000) // 延迟 1 秒执行
    queue.set(sessionID, { timeout, data: dataMap }) // 添加到队列
  }

  /**
   * 删除会话分享
   * @param sessionID - 会话 ID
   */
  export async function remove(sessionID: string) {
    log.info("removing share", { sessionID }) // 记录删除分享日志
    const share = await get(sessionID) // 获取分享信息
    if (!share) return // 如果分享不存在，直接返回
    await fetch(`${await url()}/api/share/${share.id}`, {
      // 调用删除 API
      method: "DELETE", // 请求方法：DELETE
      headers: {
        "Content-Type": "application/json", // 内容类型：JSON
      },
      body: JSON.stringify({
        secret: share.secret, // 分享密钥
      }),
    })
    await Storage.remove(["session_share", sessionID]) // 从存储中删除分享信息
  }

  /**
   * 执行完整同步，同步会话的所有数据
   * @param sessionID - 会话 ID
   */
  async function fullSync(sessionID: string) {
    log.info("full sync", { sessionID }) // 记录完整同步日志
    const session = await Session.get(sessionID) // 获取会话信息
    const diffs = await Session.diff(sessionID) // 获取会话差异
    const messages = await Array.fromAsync(MessageV2.stream(sessionID)) // 获取所有消息
    const models = await Promise.all(
      // 获取所有模型
      messages
        .filter((m) => m.info.role === "user") // 筛选用户消息
        .map((m) => (m.info as SDK.UserMessage).model) // 提取模型信息
        .map((m) => Provider.getModel(m.providerID, m.modelID).then((m) => m)), // 获取模型详情
    )
    await sync(sessionID, [
      // 同步所有数据
      {
        type: "session", // 会话数据
        data: session,
      },
      ...messages.map((x) => ({
        // 所有消息
        type: "message" as const,
        data: x.info,
      })),
      ...messages.flatMap((x) => x.parts.map((y) => ({ type: "part" as const, data: y }))), // 所有消息部分
      {
        type: "session_diff", // 会话差异数据
        data: diffs,
      },
      {
        type: "model", // 模型数据
        data: models,
      },
    ])
  }
}
