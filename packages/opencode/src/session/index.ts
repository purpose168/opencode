import { Bus } from "@/bus" // 导入总线工具
import { BusEvent } from "@/bus/bus-event" // 导入总线事件类型
import { type LanguageModelUsage, type ProviderMetadata } from "ai" // 导入语言模型使用情况和提供商元数据类型
import { Decimal } from "decimal.js" // 导入 Decimal 类用于精确计算
import z from "zod" // 导入 Zod 数据验证库
import { Config } from "../config/config" // 导入配置管理器
import { Flag } from "../flag/flag" // 导入标志管理器
import { Identifier } from "../id/id" // 导入标识符工具
import { Installation } from "../installation" // 导入安装信息

import { Snapshot } from "@/snapshot" // 导入快照模块
import { fn } from "@/util/fn" // 导入函数工具
import { Command } from "../command" // 导入命令模块
import { Instance } from "../project/instance" // 导入实例类
import { Storage } from "../storage/storage" // 导入存储工具
import { Log } from "../util/log" // 导入日志工具
import { MessageV2 } from "./message-v2" // 导入消息类
import { SessionPrompt } from "./prompt" // 导入会话提示词模块

import { PermissionNext } from "@/permission/next" // 导入权限管理器
import type { Provider } from "@/provider/provider" // 导入提供商类型

export namespace Session {
  const log = Log.create({ service: "session" }) // 创建会话的日志记录器

  const parentTitlePrefix = "New session - " // 父会话标题前缀
  const childTitlePrefix = "Child session - " // 子会话标题前缀

  function createDefaultTitle(isChild = false) {
    // 创建默认标题
    return (isChild ? childTitlePrefix : parentTitlePrefix) + new Date().toISOString() // 根据是否为子会话生成标题
  }

  export function isDefaultTitle(title: string) {
    // 判断是否为默认标题
    return new RegExp( // 使用正则表达式匹配默认标题格式
      `^(${parentTitlePrefix}|${childTitlePrefix})\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$`,
    ).test(title)
  }

  export const Info = z // 定义会话信息的数据结构
    .object({
      id: Identifier.schema("session"), // 会话 ID
      projectID: z.string(), // 项目 ID
      directory: z.string(), // 目录
      parentID: Identifier.schema("session").optional(), // 父会话 ID
      summary: z // 摘要信息
        .object({
          additions: z.number(), // 新增行数
          deletions: z.number(), // 删除行数
          files: z.number(), // 文件数量
          diffs: Snapshot.FileDiff.array().optional(), // 文件差异列表
        })
        .optional(),
      share: z // 共享信息
        .object({
          url: z.string(), // 共享 URL
        })
        .optional(),
      title: z.string(), // 标题
      version: z.string(), // 版本
      time: z // 时间信息
        .object({
          created: z.number(), // 创建时间
          updated: z.number(), // 更新时间
          compacting: z.number().optional(), // 压缩时间
          archived: z.number().optional(), // 归档时间
        }),
      permission: PermissionNext.Ruleset.optional(), // 权限规则集
      revert: z // 还原信息
        .object({
          messageID: z.string(), // 消息 ID
          partID: z.string().optional(), // 部分 ID
          snapshot: z.string().optional(), // 快照
          diff: z.string().optional(), // 差异
        })
        .optional(),
    })
    .meta({
      ref: "Session", // 引用名称
    })
  export type Info = z.output<typeof Info> // 导出 Info 类型

  export const ShareInfo = z // 定义共享信息的数据结构
    .object({
      secret: z.string(), // 密钥
      url: z.string(), // URL
    })
    .meta({
      ref: "SessionShare", // 引用名称
    })
  export type ShareInfo = z.output<typeof ShareInfo> // 导出 ShareInfo 类型

  export const Event = {
    // 定义会话事件
    Created: BusEvent.define(
      // 会话创建事件
      "session.created",
      z.object({
        info: Info, // 会话信息
      }),
    ),
    Updated: BusEvent.define(
      // 会话更新事件
      "session.updated",
      z.object({
        info: Info, // 会话信息
      }),
    ),
    Deleted: BusEvent.define(
      // 会话删除事件
      "session.deleted",
      z.object({
        info: Info, // 会话信息
      }),
    ),
    Diff: BusEvent.define(
      // 会话差异事件
      "session.diff",
      z.object({
        sessionID: z.string(), // 会话 ID
        diff: Snapshot.FileDiff.array(), // 文件差异列表
      }),
    ),
    Error: BusEvent.define(
      // 会话错误事件
      "session.error",
      z.object({
        sessionID: z.string().optional(), // 会话 ID
        error: MessageV2.Assistant.shape.error, // 错误信息
      }),
    ),
  }

  export const create = fn(
    // 创建会话的函数
    z
      .object({
        parentID: Identifier.schema("session").optional(), // 父会话 ID
        title: z.string().optional(), // 标题
        permission: Info.shape.permission, // 权限规则集
      })
      .optional(),
    async (input) => {
      return createNext({
        // 调用 createNext 创建会话
        parentID: input?.parentID,
        directory: Instance.directory,
        title: input?.title,
        permission: input?.permission,
      })
    },
  )

  export const fork = fn(
    // 分支会话的函数
    z.object({
      sessionID: Identifier.schema("session"), // 会话 ID
      messageID: Identifier.schema("message").optional(), // 消息 ID
    }),
    async (input) => {
      const session = await createNext({
        // 创建新会话
        directory: Instance.directory,
      })
      const msgs = await messages({ sessionID: input.sessionID }) // 获取原会话的消息
      for (const msg of msgs) {
        // 遍历消息
        if (input.messageID && msg.info.id >= input.messageID) break // 如果指定了消息 ID 且当前消息 ID 大于等于指定 ID，停止
        const cloned = await updateMessage({
          // 克隆消息
          ...msg.info,
          sessionID: session.id,
          id: Identifier.ascending("message"),
        })

        for (const part of msg.parts) {
          // 遍历消息部分
          await updatePart({
            // 克隆消息部分
            ...part,
            id: Identifier.ascending("part"),
            messageID: cloned.id,
            sessionID: session.id,
          })
        }
      }
      return session // 返回新会话
    },
  )

  export const touch = fn(Identifier.schema("session"), async (sessionID) => {
    // 更新会话时间戳的函数
    await update(sessionID, (draft) => {
      // 更新会话
      draft.time.updated = Date.now() // 更新更新时间
    })
  })

  export async function createNext(input: {
    // 创建下一个会话的函数
    id?: string
    title?: string
    parentID?: string
    directory: string
    permission?: PermissionNext.Ruleset
  }) {
    const result: Info = {
      // 构建会话信息
      id: Identifier.descending("session", input.id), // 生成会话 ID
      version: Installation.VERSION, // 版本号
      projectID: Instance.project.id, // 项目 ID
      directory: input.directory, // 目录
      parentID: input.parentID, // 父会话 ID
      title: input.title ?? createDefaultTitle(!!input.parentID), // 标题
      permission: input.permission, // 权限规则集
      time: {
        created: Date.now(), // 创建时间
        updated: Date.now(), // 更新时间
      },
    }
    log.info("created", result) // 记录创建日志
    await Storage.write(["session", Instance.project.id, result.id], result) // 写入存储
    Bus.publish(Event.Created, {
      // 发布创建事件
      info: result,
    })
    const cfg = await Config.get() // 获取配置
    if (!result.parentID && (Flag.OPENCODE_AUTO_SHARE || cfg.share === "auto"))
      // 如果是根会话且自动共享
      share(result.id) // 共享会话
        .then((share) => {
          // 共享成功后
          update(result.id, (draft) => {
            // 更新会话
            draft.share = share // 保存共享信息
          })
        })
        .catch(() => {
          // 忽略共享错误
          // Silently ignore sharing errors during session creation
        })
    Bus.publish(Event.Updated, {
      // 发布更新事件
      info: result,
    })
    return result // 返回会话信息
  }

  export const get = fn(Identifier.schema("session"), async (id) => {
    // 获取会话的函数
    const read = await Storage.read<Info>(["session", Instance.project.id, id]) // 读取存储
    return read as Info // 返回会话信息
  })

  export const getShare = fn(Identifier.schema("session"), async (id) => {
    // 获取共享信息的函数
    return Storage.read<ShareInfo>(["share", id]) // 读取共享信息
  })

  export const share = fn(Identifier.schema("session"), async (id) => {
    // 共享会话的函数
    const cfg = await Config.get() // 获取配置
    if (cfg.share === "disabled") {
      // 如果禁用共享
      throw new Error("配置中已禁用共享") // 抛出错误
    }
    const { ShareNext } = await import("@/share/share-next") // 导入共享模块
    const share = await ShareNext.create(id) // 创建共享
    await update(id, (draft) => {
      // 更新会话
      draft.share = {
        // 保存共享信息
        url: share.url,
      }
    })
    return share // 返回共享信息
  })

  export const unshare = fn(Identifier.schema("session"), async (id) => {
    // 取消共享的函数
    // Use ShareNext to remove share (same as share function uses ShareNext to create)
    const { ShareNext } = await import("@/share/share-next") // 导入共享模块
    await ShareNext.remove(id) // 移除共享
    await update(id, (draft) => {
      // 更新会话
      draft.share = undefined // 清除共享信息
    })
  })

  export async function update(id: string, editor: (session: Info) => void) {
    // 更新会话的函数
    const project = Instance.project // 获取项目
    const result = await Storage.update<Info>(["session", project.id, id], (draft) => {
      // 更新存储
      editor(draft) // 调用编辑器函数
      draft.time.updated = Date.now() // 更新更新时间
    })
    Bus.publish(Event.Updated, {
      // 发布更新事件
      info: result,
    })
    return result // 返回更新后的会话信息
  }

  export const diff = fn(Identifier.schema("session"), async (sessionID) => {
    // 获取差异的函数
    const diffs = await Storage.read<Snapshot.FileDiff[]>(["session_diff", sessionID]) // 读取差异
    return diffs ?? [] // 返回差异列表
  })

  export const messages = fn(
    // 获取消息的函数
    z.object({
      sessionID: Identifier.schema("session"), // 会话 ID
      limit: z.number().optional(), // 限制数量
    }),
    async (input) => {
      const result = [] as MessageV2.WithParts[] // 初始化结果数组
      for await (const msg of MessageV2.stream(input.sessionID)) {
        // 流式读取消息
        if (input.limit && result.length >= input.limit) break // 如果达到限制数量，停止
        result.push(msg) // 添加消息到结果
      }
      result.reverse() // 反转数组
      return result // 返回结果
    },
  )

  export async function* list() {
    // 列出会话的生成器函数
    const project = Instance.project // 获取项目
    for (const item of await Storage.list(["session", project.id])) {
      // 遍历存储中的会话
      yield Storage.read<Info>(item) // 生成会话信息
    }
  }

  export const children = fn(Identifier.schema("session"), async (parentID) => {
    // 获取子会话的函数
    const project = Instance.project // 获取项目
    const result = [] as Session.Info[] // 初始化结果数组
    for (const item of await Storage.list(["session", project.id])) {
      // 遍历存储中的会话
      const session = await Storage.read<Info>(item) // 读取会话信息
      if (session.parentID !== parentID) continue // 如果不是子会话，跳过
      result.push(session) // 添加到结果
    }
    return result // 返回子会话列表
  })

  export const remove = fn(Identifier.schema("session"), async (sessionID) => {
    // 删除会话的函数
    const project = Instance.project // 获取项目
    try {
      const session = await get(sessionID) // 获取会话信息
      for (const child of await children(sessionID)) {
        // 遍历子会话
        await remove(child.id) // 递归删除子会话
      }
      await unshare(sessionID).catch(() => {}) // 取消共享
      for (const msg of await Storage.list(["message", sessionID])) {
        // 遍历消息
        for (const part of await Storage.list(["part", msg.at(-1)!])) {
          // 遍历消息部分
          await Storage.remove(part) // 删除消息部分
        }
        await Storage.remove(msg) // 删除消息
      }
      await Storage.remove(["session", project.id, sessionID]) // 删除会话
      Bus.publish(Event.Deleted, {
        // 发布删除事件
        info: session,
      })
    } catch (e) {
      log.error(e) // 记录错误
    }
  })

  export const updateMessage = fn(MessageV2.Info, async (msg) => {
    // 更新消息的函数
    await Storage.write(["message", msg.sessionID, msg.id], msg) // 写入存储
    Bus.publish(MessageV2.Event.Updated, {
      // 发布更新事件
      info: msg,
    })
    return msg // 返回消息
  })

  export const removeMessage = fn(
    // 删除消息的函数
    z.object({
      sessionID: Identifier.schema("session"), // 会话 ID
      messageID: Identifier.schema("message"), // 消息 ID
    }),
    async (input) => {
      await Storage.remove(["message", input.sessionID, input.messageID]) // 删除消息
      Bus.publish(MessageV2.Event.Removed, {
        // 发布删除事件
        sessionID: input.sessionID,
        messageID: input.messageID,
      })
      return input.messageID // 返回消息 ID
    },
  )

  export const removePart = fn(
    // 删除消息部分的函数
    z.object({
      sessionID: Identifier.schema("session"), // 会话 ID
      messageID: Identifier.schema("message"), // 消息 ID
      partID: Identifier.schema("part"), // 部分 ID
    }),
    async (input) => {
      await Storage.remove(["part", input.messageID, input.partID]) // 删除消息部分
      Bus.publish(MessageV2.Event.PartRemoved, {
        // 发布删除事件
        sessionID: input.sessionID,
        messageID: input.messageID,
        partID: input.partID,
      })
      return input.partID // 返回部分 ID
    },
  )

  const UpdatePartInput = z.union([
    // 定义更新消息部分的输入类型
    MessageV2.Part, // 消息部分
    z.object({
      part: MessageV2.TextPart, // 文本部分
      delta: z.string(), // 增量
    }),
    z.object({
      part: MessageV2.ReasoningPart, // 推理部分
      delta: z.string(), // 增量
    }),
  ])

  export const updatePart = fn(UpdatePartInput, async (input) => {
    // 更新消息部分的函数
    const part = "delta" in input ? input.part : input // 获取消息部分
    const delta = "delta" in input ? input.delta : undefined // 获取增量
    await Storage.write(["part", part.messageID, part.id], part) // 写入存储
    Bus.publish(MessageV2.Event.PartUpdated, {
      // 发布更新事件
      part,
      delta,
    })
    return part // 返回消息部分
  })

  export const getUsage = fn(
    // 计算使用情况的函数
    z.object({
      model: z.custom<Provider.Model>(), // 模型
      usage: z.custom<LanguageModelUsage>(), // 使用情况
      metadata: z.custom<ProviderMetadata>().optional(), // 元数据
    }),
    (input) => {
      const cachedInputTokens = input.usage.cachedInputTokens ?? 0 // 缓存的输入 token 数
      const excludesCachedTokens = !!(input.metadata?.["anthropic"] || input.metadata?.["bedrock"]) // 是否排除缓存 token
      const adjustedInputTokens = excludesCachedTokens // 调整后的输入 token 数
        ? (input.usage.inputTokens ?? 0)
        : (input.usage.inputTokens ?? 0) - cachedInputTokens
      const safe = (value: number) => {
        // 安全数值函数
        if (!Number.isFinite(value)) return 0 // 如果不是有限数，返回 0
        return value // 返回数值
      }

      const tokens = {
        // token 统计
        input: safe(adjustedInputTokens), // 输入 token
        output: safe(input.usage.outputTokens ?? 0), // 输出 token
        reasoning: safe(input.usage?.reasoningTokens ?? 0), // 推理 token
        cache: {
          // 缓存 token
          write: safe(
            // 写入 token
            (input.metadata?.["anthropic"]?.["cacheCreationInputTokens"] ??
              // @ts-expect-error
              input.metadata?.["bedrock"]?.["usage"]?.["cacheWriteInputTokens"] ??
              0) as number,
          ),
          read: safe(cachedInputTokens), // 读取 token
        },
      }

      const costInfo = // 成本信息
        input.model.cost?.experimentalOver200K && tokens.input + tokens.cache.read > 200_000 // 超过 200k token 的特殊定价
          ? input.model.cost.experimentalOver200K
          : input.model.cost
      return {
        // 返回成本和 token 统计
        cost: safe(
          // 计算成本
          new Decimal(0)
            .add(new Decimal(tokens.input).mul(costInfo?.input ?? 0).div(1_000_000)) // 输入成本
            .add(new Decimal(tokens.output).mul(costInfo?.output ?? 0).div(1_000_000)) // 输出成本
            .add(new Decimal(tokens.cache.read).mul(costInfo?.cache?.read ?? 0).div(1_000_000)) // 缓存读取成本
            .add(new Decimal(tokens.cache.write).mul(costInfo?.cache?.write ?? 0).div(1_000_000)) // 缓存写入成本
            // TODO: update models.dev to have better pricing model, for now:
            // charge reasoning tokens at the same rate as output tokens
            .add(new Decimal(tokens.reasoning).mul(costInfo?.output ?? 0).div(1_000_000)) // 推理成本
            .toNumber(),
        ),
        tokens, // token 统计
      }
    },
  )

  export class BusyError extends Error {
    // 忙碌错误类
    constructor(public readonly sessionID: string) {
      // 构造函数
      super(`Session ${sessionID} is busy`) // 调用父类构造函数
    }
  }

  export const initialize = fn(
    // 初始化会话的函数
    z.object({
      sessionID: Identifier.schema("session"), // 会话 ID
      modelID: z.string(), // 模型 ID
      providerID: z.string(), // 提供商 ID
      messageID: Identifier.schema("message"), // 消息 ID
    }),
    async (input) => {
      await SessionPrompt.command({
        // 发送初始化命令
        sessionID: input.sessionID,
        messageID: input.messageID,
        model: input.providerID + "/" + input.modelID,
        command: Command.Default.INIT,
        arguments: "",
      })
    },
  )
}
