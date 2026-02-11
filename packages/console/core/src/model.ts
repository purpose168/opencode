import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { Database } from "./drizzle"
import { ModelTable } from "./schema/model.sql"
import { Identifier } from "./identifier"
import { fn } from "./util/fn"
import { Actor } from "./actor"
import { Resource } from "@opencode-ai/console-resource"

/**
 * Zen 模型数据命名空间
 * 提供模型配置验证和模型管理功能
 */
export namespace ZenData {
  // 模型格式枚举
  const FormatSchema = z.enum(["anthropic", "google", "openai", "oa-compat"])
  // 试用配置 schema
  const TrialSchema = z.object({
    provider: z.string(), // 提供商名称
    limits: z.array(
      z.object({
        limit: z.number(), // 限制数量
        client: z.enum(["cli", "desktop"]).optional(), // 客户端类型（可选）
      }),
    ),
  })
  export type Format = z.infer<typeof FormatSchema>
  export type Trial = z.infer<typeof TrialSchema>

  // 模型成本 schema
  const ModelCostSchema = z.object({
    input: z.number(), // 输入 token 价格
    output: z.number(), // 输出 token 价格
    cacheRead: z.number().optional(), // 缓存读取价格（可选）
    cacheWrite5m: z.number().optional(), // 5分钟缓存写入价格（可选）
    cacheWrite1h: z.number().optional(), // 1小时缓存写入价格（可选）
  })

  // 模型 schema
  const ModelSchema = z.object({
    name: z.string(), // 模型名称
    cost: ModelCostSchema, // 模型成本
    cost200K: ModelCostSchema.optional(), // 200K 上下文成本（可选）
    allowAnonymous: z.boolean().optional(), // 是否允许匿名访问（可选）
    byokProvider: z.enum(["openai", "anthropic", "google"]).optional(), // Byok 提供商（可选）
    stickyProvider: z.boolean().optional(), // 是否固定提供商（可选）
    trial: TrialSchema.optional(), // 试用配置（可选）
    rateLimit: z.number().optional(), // 速率限制（可选）
    fallbackProvider: z.string().optional(), // 备用提供商（可选）
    providers: z.array(
      z.object({
        id: z.string(), // 提供商 ID
        model: z.string(), // 模型名称
        weight: z.number().optional(), // 权重（可选）
        disabled: z.boolean().optional(), // 是否禁用（可选）
        storeModel: z.string().optional(), // 存储模型（可选）
      }),
    ),
  })

  // 提供商 schema
  const ProviderSchema = z.object({
    api: z.string(), // API 端点
    apiKey: z.string(), // API 密钥
    format: FormatSchema, // 模型格式
    headerMappings: z.record(z.string(), z.string()).optional(), // 请求头映射（可选）
  })

  // 模型集合 schema
  const ModelsSchema = z.object({
    models: z.record(z.string(), z.union([ModelSchema, z.array(ModelSchema.extend({ formatFilter: FormatSchema }))])),
    providers: z.record(z.string(), ProviderSchema),
  })

  /**
   * 验证模型配置
   * @param input 模型配置数据
   * @returns 验证后的模型配置
   */
  export const validate = fn(ModelsSchema, (input) => {
    return input
  })

  /**
   * 获取模型配置
   * @returns 模型配置数据
   */
  export const list = fn(z.void(), () => {
    const json = JSON.parse(
      Resource.ZEN_MODELS1.value +
        Resource.ZEN_MODELS2.value +
        Resource.ZEN_MODELS3.value +
        Resource.ZEN_MODELS4.value +
        Resource.ZEN_MODELS5.value +
        Resource.ZEN_MODELS6.value,
    )
    return ModelsSchema.parse(json)
  })
}

/**
 * 模型管理命名空间
 * 提供模型启用、禁用和查询功能
 */
export namespace Model {
  /**
   * 启用模型
   * @param input 输入参数，包含模型名称
   */
  export const enable = fn(z.object({ model: z.string() }), ({ model }) => {
    Actor.assertAdmin()
    return Database.use((db) =>
      db.delete(ModelTable).where(and(eq(ModelTable.workspaceID, Actor.workspace()), eq(ModelTable.model, model))),
    )
  })

  /**
   * 禁用模型
   * @param input 输入参数，包含模型名称
   */
  export const disable = fn(z.object({ model: z.string() }), ({ model }) => {
    Actor.assertAdmin()
    return Database.use((db) =>
      db
        .insert(ModelTable)
        .values({
          id: Identifier.create("model"),
          workspaceID: Actor.workspace(),
          model: model,
        })
        .onDuplicateKeyUpdate({
          set: {
            timeDeleted: null, // 清除删除时间
          },
        }),
    )
  })

  /**
   * 获取已禁用的模型列表
   * @returns 已禁用的模型名称列表
   */
  export const listDisabled = fn(z.void(), () => {
    return Database.use((db) =>
      db
        .select({ model: ModelTable.model })
        .from(ModelTable)
        .where(eq(ModelTable.workspaceID, Actor.workspace()))
        .then((rows) => rows.map((row) => row.model)),
    )
  })

  /**
   * 检查模型是否已禁用
   * @param input 输入参数，包含模型名称
   * @returns 如果模型已禁用则返回 true，否则返回 false
   */
  export const isDisabled = fn(
    z.object({
      model: z.string(),
    }),
    ({ model }) => {
      return Database.use(async (db) => {
        const result = await db
          .select()
          .from(ModelTable)
          .where(and(eq(ModelTable.workspaceID, Actor.workspace()), eq(ModelTable.model, model)))
          .limit(1)

        return result.length > 0
      })
    },
  )
}
