import { splitWhen } from "remeda" // 导入数组分割工具
import z from "zod" // 导入 Zod 验证库
import { Session } from "." // 导入会话模块
import { Bus } from "../bus" // 导入事件总线
import { Identifier } from "../id/id" // 导入标识符工具
import { Snapshot } from "../snapshot" // 导入快照管理模块
import { Storage } from "../storage/storage" // 导入存储模块
import { Log } from "../util/log" // 导入日志工具
import { MessageV2 } from "./message-v2" // 导入消息 V2 模块
import { SessionPrompt } from "./prompt" // 导入会话提示词模块

export namespace SessionRevert {
  const log = Log.create({ service: "session.revert" }) // 创建日志实例

  /**
   * 回退输入参数的 Zod schema 定义
   * 用于验证回退操作的输入参数
   */
  export const RevertInput = z.object({
    sessionID: Identifier.schema("session"), // 会话 ID
    messageID: Identifier.schema("message"), // 消息 ID
    partID: Identifier.schema("part").optional(), // 部分 ID（可选）
  })
  export type RevertInput = z.infer<typeof RevertInput> // 回退输入参数类型

  /**
   * 执行回退操作，将会话回退到指定消息或部分
   * @param input - 回退输入参数，包含会话 ID、消息 ID 和可选的部分 ID
   * @returns Promise<Session.Info> - 更新后的会话信息
   */
  export async function revert(input: RevertInput) {
    SessionPrompt.assertNotBusy(input.sessionID) // 检查会话是否忙碌
    const all = await Session.messages({ sessionID: input.sessionID }) // 获取会话的所有消息
    let lastUser: MessageV2.User | undefined // 最后一条用户消息
    const session = await Session.get(input.sessionID) // 获取会话信息

    let revert: Session.Info["revert"] // 回退信息
    const patches: Snapshot.Patch[] = [] // 补丁列表
    for (const msg of all) {
      // 遍历所有消息
      if (msg.info.role === "user") lastUser = msg.info // 记录最后一条用户消息
      const remaining = [] // 保留的部分列表
      for (const part of msg.parts) {
        // 遍历消息的所有部分
        if (revert) {
          // 如果已经找到回退点
          if (part.type === "patch") {
            // 如果是补丁类型
            patches.push(part) // 添加到补丁列表
          }
          continue // 跳过后续处理
        }

        if (!revert) {
          // 如果还未找到回退点
          if ((msg.info.id === input.messageID && !input.partID) || part.id === input.partID) {
            // 如果匹配到目标消息或部分
            const partID = remaining.some((item) => ["text", "tool"].includes(item.type)) ? input.partID : undefined // 如果消息中没有有用的部分，等同于回退整个消息
            revert = {
              // 设置回退信息
              messageID: !partID && lastUser ? lastUser.id : msg.info.id, // 回退到的消息 ID
              partID, // 回退到的部分 ID
            }
          }
          remaining.push(part) // 添加到保留列表
        }
      }
    }

    if (revert) {
      // 如果设置了回退信息
      const session = await Session.get(input.sessionID) // 获取会话信息
      revert.snapshot = session.revert?.snapshot ?? (await Snapshot.track()) // 设置快照，如果已有则使用，否则创建新快照
      await Snapshot.revert(patches) // 回退补丁
      if (revert.snapshot) revert.diff = await Snapshot.diff(revert.snapshot) // 计算快照差异
      return Session.update(input.sessionID, (draft) => {
        // 更新会话
        draft.revert = revert // 设置回退信息
      })
    }
    return session // 返回会话信息
  }

  /**
   * 取消回退操作，恢复到回退前的状态
   * @param input - 包含会话 ID 的对象
   * @returns Promise<Session.Info> - 更新后的会话信息
   */
  export async function unrevert(input: { sessionID: string }) {
    log.info("unreverting", input) // 记录取消回退日志
    SessionPrompt.assertNotBusy(input.sessionID) // 检查会话是否忙碌
    const session = await Session.get(input.sessionID) // 获取会话信息
    if (!session.revert) return session // 如果没有回退信息，直接返回
    if (session.revert.snapshot) await Snapshot.restore(session.revert.snapshot) // 如果有快照，恢复快照
    const next = await Session.update(input.sessionID, (draft) => {
      // 更新会话
      draft.revert = undefined // 清除回退信息
    })
    return next // 返回更新后的会话
  }

  /**
   * 清理回退操作，删除回退点之后的所有消息和部分
   * @param session - 会话信息
   * @returns Promise<void>
   */
  export async function cleanup(session: Session.Info) {
    if (!session.revert) return // 如果没有回退信息，直接返回
    const sessionID = session.id // 获取会话 ID
    let msgs = await Session.messages({ sessionID }) // 获取会话的所有消息
    const messageID = session.revert.messageID // 获取回退消息 ID
    const [preserve, remove] = splitWhen(msgs, (x) => x.info.id === messageID) // 分割消息为保留和删除两部分
    msgs = preserve // 保留的消息
    for (const msg of remove) {
      // 遍历要删除的消息
      await Storage.remove(["message", sessionID, msg.info.id]) // 从存储中删除消息
      await Bus.publish(MessageV2.Event.Removed, { sessionID: sessionID, messageID: msg.info.id }) // 发布消息删除事件
    }
    const last = preserve.at(-1) // 获取保留的最后一条消息
    if (session.revert.partID && last) {
      // 如果有部分 ID 且存在最后一条消息
      const partID = session.revert.partID // 获取部分 ID
      const [preserveParts, removeParts] = splitWhen(last.parts, (x) => x.id === partID) // 分割部分为保留和删除两部分
      last.parts = preserveParts // 保留的部分
      for (const part of removeParts) {
        // 遍历要删除的部分
        await Storage.remove(["part", last.info.id, part.id]) // 从存储中删除部分
        await Bus.publish(MessageV2.Event.PartRemoved, {
          // 发布部分删除事件
          sessionID: sessionID,
          messageID: last.info.id,
          partID: part.id,
        })
      }
    }
    await Session.update(sessionID, (draft) => {
      // 更新会话
      draft.revert = undefined // 清除回退信息
    })
  }
}
