import { Bus } from "../bus" // 导入事件总线
import { Installation } from "../installation" // 导入安装信息模块
import { Session } from "../session" // 导入会话模块
import { MessageV2 } from "../session/message-v2" // 导入消息 V2 模块
import { Log } from "../util/log" // 导入日志工具

export namespace Share {
  const log = Log.create({ service: "share" }) // 创建日志实例

  let queue: Promise<void> = Promise.resolve() // 同步队列
  const pending = new Map<string, any>() // 待同步数据映射

  /**
   * 同步数据到分享服务器
   * @param key - 同步键（格式：session/info/{sessionID}、session/message/{sessionID}/{messageID}、session/part/{sessionID}/{messageID}/{partID}）
   * @param content - 要同步的内容
   */
  export async function sync(key: string, content: any) {
    const [root, ...splits] = key.split("/") // 分割键
    if (root !== "session") return // 如果根键不是 session，直接返回
    const [sub, sessionID] = splits // 提取子键和会话 ID
    if (sub === "share") return // 如果是分享键，直接返回
    const share = await Session.getShare(sessionID).catch(() => {}) // 获取分享信息
    if (!share) return // 如果分享不存在，直接返回
    const { secret } = share // 提取分享密钥
    pending.set(key, content) // 添加到待同步映射
    queue = queue // 添加到队列
      .then(async () => {
        const content = pending.get(key) // 获取待同步内容
        if (content === undefined) return // 如果内容不存在，直接返回
        pending.delete(key) // 从待同步映射中删除

        return fetch(`${URL}/share_sync`, {
          // 调用同步 API
          method: "POST", // 请求方法：POST
          body: JSON.stringify({
            // 请求体
            sessionID: sessionID, // 会话 ID
            secret, // 分享密钥
            key: key, // 同步键
            content, // 同步内容
          }),
        })
      })
      .then((x) => {
        if (x) {
          // 如果响应存在
          log.info("synced", {
            // 记录同步日志
            key: key, // 同步键
            status: x.status, // 响应状态
          })
        }
      })
  }

  /**
   * 初始化分享功能，订阅相关事件
   */
  export function init() {
    Bus.subscribe(Session.Event.Updated, async (evt) => {
      // 订阅会话更新事件
      await sync("session/info/" + evt.properties.info.id, evt.properties.info) // 同步会话信息
    })
    Bus.subscribe(MessageV2.Event.Updated, async (evt) => {
      // 订阅消息更新事件
      await sync("session/message/" + evt.properties.info.sessionID + "/" + evt.properties.info.id, evt.properties.info) // 同步消息信息
    })
    Bus.subscribe(MessageV2.Event.PartUpdated, async (evt) => {
      // 订阅消息部分更新事件
      await sync(
        // 同步消息部分信息
        "session/part/" +
          evt.properties.part.sessionID +
          "/" +
          evt.properties.part.messageID +
          "/" +
          evt.properties.part.id,
        evt.properties.part,
      )
    })
  }

  /**
   * 分享服务器 URL
   * 根据环境变量和安装类型选择不同的 API 地址
   */
  export const URL =
    process.env["OPENCODE_API"] ??
    (Installation.isPreview() || Installation.isLocal() ? "https://api.dev.opencode.ai" : "https://api.opencode.ai") // 预览版或本地版本使用开发 API，否则使用生产 API

  /**
   * 创建会话分享
   * @param sessionID - 会话 ID
   * @returns Promise<{ url: string; secret: string }> - 分享信息（包含 URL 和密钥）
   */
  export async function create(sessionID: string) {
    return fetch(`${URL}/share_create`, {
      // 调用创建分享 API
      method: "POST", // 请求方法：POST
      body: JSON.stringify({ sessionID: sessionID }), // 请求体：会话 ID
    })
      .then((x) => x.json()) // 解析 JSON 响应
      .then((x) => x as { url: string; secret: string }) // 类型断言
  }

  /**
   * 删除会话分享
   * @param sessionID - 会话 ID
   * @param secret - 分享密钥
   * @returns Promise<any> - 删除结果
   */
  export async function remove(sessionID: string, secret: string) {
    return fetch(`${URL}/share_delete`, {
      // 调用删除分享 API
      method: "POST", // 请求方法：POST
      body: JSON.stringify({ sessionID, secret }), // 请求体：会话 ID 和密钥
    }).then((x) => x.json()) // 解析 JSON 响应
  }
}
