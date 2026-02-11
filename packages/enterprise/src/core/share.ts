import { FileDiff, Message, Model, Part, Session } from "@opencode-ai/sdk/v2"
import { fn } from "@opencode-ai/util/fn"
import { iife } from "@opencode-ai/util/iife"
import { Identifier } from "@opencode-ai/util/identifier"
import z from "zod"
import { Storage } from "./storage"
import { Binary } from "@opencode-ai/util/binary"

/**
 * 分享功能模块
 * 用于创建、管理和同步会话分享
 */
export namespace Share {
  /**
   * 分享信息的模式定义
   * 包含分享ID、密钥和会话ID
   */
  export const Info = z.object({
    id: z.string(),           // 分享的唯一标识符
    secret: z.string(),       // 分享的密钥，用于验证
    sessionID: z.string(),    // 关联的会话ID
  })
  export type Info = z.infer<typeof Info>

  /**
   * 分享数据的模式定义
   * 支持多种类型的数据分享
   */
  export const Data = z.discriminatedUnion("type", [
    z.object({
      type: z.literal("session"),     // 会话类型
      data: z.custom<Session>(),       // 会话数据
    }),
    z.object({
      type: z.literal("message"),     // 消息类型
      data: z.custom<Message>(),       // 消息数据
    }),
    z.object({
      type: z.literal("part"),        // 消息部分类型
      data: z.custom<Part>(),          // 消息部分数据
    }),
    z.object({
      type: z.literal("session_diff"), // 会话差异类型
      data: z.custom<FileDiff[]>(),    // 文件差异数据数组
    }),
    z.object({
      type: z.literal("model"),        // 模型类型
      data: z.custom<Model[]>(),       // 模型数据数组
    }),
  ])
  export type Data = z.infer<typeof Data>

  /**
   * 创建新的分享
   * @param body 包含会话ID的请求体
   * @returns 创建的分享信息
   */
  export const create = fn(z.object({ sessionID: z.string() }), async (body) => {
    // 检查是否为测试环境或测试会话
    const isTest = process.env.NODE_ENV === "test" || body.sessionID.startsWith("test_")
    // 构建分享信息
    const info: Info = {
      id: (isTest ? "test_" : "") + body.sessionID.slice(-8),  // 生成分享ID
      sessionID: body.sessionID,                               // 关联的会话ID
      secret: crypto.randomUUID(),                             // 生成随机密钥
    }
    // 检查分享是否已存在
    const exists = await get(info.id)
    if (exists) throw new Errors.AlreadyExists(info.id)
    // 写入分享信息到存储
    await Storage.write(["share", info.id], info)
    return info
  })

  /**
   * 获取分享信息
   * @param id 分享ID
   * @returns 分享信息或undefined
   */
  export async function get(id: string) {
    return Storage.read<Info>(["share", id])
  }

  /**
   * 删除分享
   * @param body 包含分享ID和密钥的请求体
   */
  export const remove = fn(Info.pick({ id: true, secret: true }), async (body) => {
    // 获取分享信息
    const share = await get(body.id)
    if (!share) throw new Errors.NotFound(body.id)
    // 验证密钥
    if (share.secret !== body.secret) throw new Errors.InvalidSecret(body.id)
    // 删除分享信息
    await Storage.remove(["share", body.id])
    // 删除关联的分享数据
    const list = await Storage.list({ prefix: ["share_data", body.id] })
    for (const item of list) {
      await Storage.remove(item)
    }
  })

  /**
   * 同步分享数据
   * @param input 包含分享信息和数据的输入
   */
  export const sync = fn(
    z.object({
      share: Info.pick({ id: true, secret: true }),  // 分享ID和密钥
      data: Data.array(),                           // 要同步的数据数组
    }),
    async (input) => {
      // 获取分享信息
      const share = await get(input.share.id)
      if (!share) throw new Errors.NotFound(input.share.id)
      // 验证密钥
      if (share.secret !== input.share.secret) throw new Errors.InvalidSecret(input.share.id)
      // 写入同步事件
      await Storage.write(["share_event", input.share.id, Identifier.descending()], input.data)
    },
  )

  /**
   * 压缩数据结构
   * 用于合并多个分享事件
   */
  type Compaction = {
    event?: string  // 最后处理的事件ID
    data: Data[]    // 压缩后的数据数组
  }

  /**
   * 获取分享数据
   * 会自动压缩未处理的事件
   * @param shareID 分享ID
   * @returns 分享的数据数组
   */
  export async function data(shareID: string) {
    console.log("reading compaction")
    // 读取现有的压缩数据
    const compaction: Compaction = (await Storage.read<Compaction>(["share_compaction", shareID])) ?? {
      data: [],
      event: undefined,
    }
    console.log("读取未处理的事件")
    // 读取未处理的事件
    const list = await Storage.list({
      prefix: ["share_event", shareID],
      before: compaction.event,
    }).then((x) => x.toReversed())

    console.log("compacting", list.length)

    // 如果有未处理的事件，进行压缩
    if (list.length > 0) {
      // 读取所有事件的数据并扁平化
      const data = await Promise.all(list.map(async (event) => await Storage.read<Data[]>(event))).then((x) => x.flat())
      // 处理每个数据项
      for (const item of data) {
        if (!item) continue
        // 生成数据项的唯一键
        const key = (item: Data) => {
          switch (item.type) {
            case "session":
              return "session"
            case "message":
              return `message/${item.data.id}`
            case "part":
              return `${item.data.messageID}/${item.data.id}`
            case "session_diff":
              return "session_diff"
            case "model":
              return "model"
          }
        }
        const id = key(item)
        // 搜索数据项是否已存在
        const result = Binary.search(compaction.data, id, key)
        if (result.found) {
          // 如果存在，更新数据
          compaction.data[result.index] = item
        } else {
          // 如果不存在，插入数据
          compaction.data.splice(result.index, 0, item)
        }
      }
      // 更新最后处理的事件ID
      compaction.event = list.at(-1)?.at(-1)
      // 写入压缩后的数据
      await Storage.write(["share_compaction", shareID], compaction)
    }
    return compaction.data
  }

  /**
   * 旧版同步方法
   * 直接将数据写入存储，不使用事件系统
   * @param input 包含分享信息和数据的输入
   */
  export const syncOld = fn(
    z.object({
      share: Info.pick({ id: true, secret: true }),  // 分享ID和密钥
      data: Data.array(),                           // 要同步的数据数组
    }),
    async (input) => {
      // 获取分享信息
      const share = await get(input.share.id)
      if (!share) throw new Errors.NotFound(input.share.id)
      // 验证密钥
      if (share.secret !== input.share.secret) throw new Errors.InvalidSecret(input.share.id)
      
      const promises = []
      // 处理每个数据项
      for (const item of input.data) {
        promises.push(
          iife(async () => {
            switch (item.type) {
              case "session":
                // 写入会话数据
                await Storage.write(["share_data", input.share.id, "session"], item.data)
                break
              case "message": {
                const data = item.data as Message
                // 写入消息数据
                await Storage.write(["share_data", input.share.id, "message", data.id], item.data)
                break
              }
              case "part": {
                const data = item.data as Part
                // 写入消息部分数据
                await Storage.write(["share_data", input.share.id, "part", data.messageID, data.id], item.data)
                break
              }
              case "session_diff":
                // 写入会话差异数据
                await Storage.write(["share_data", input.share.id, "session_diff"], item.data)
                break
              case "model":
                // 写入模型数据
                await Storage.write(["share_data", input.share.id, "model"], item.data)
                break
            }
          }),
        )
      }
      // 并行处理所有写入操作
      await Promise.all(promises)
    },
  )

  /**
   * 错误类定义
   * 用于处理分享相关的错误
   */
  export const Errors = {
    /**
     * 分享未找到错误
     */
    NotFound: class extends Error {
      constructor(public id: string) {
        super(`分享未找到: ${id}`)  // 分享未找到：{id}
      }
    },
    /**
     * 分享密钥无效错误
     */
    InvalidSecret: class extends Error {
      constructor(public id: string) {
        super(`分享密钥无效: ${id}`)  // 分享密钥无效：{id}
      }
    },
    /**
     * 分享已存在错误
     */
    AlreadyExists: class extends Error {
      constructor(public id: string) {
        super(`分享已存在: ${id}`)  // 分享已存在：{id}
      }
    },
  }
}
