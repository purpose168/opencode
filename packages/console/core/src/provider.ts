import { z } from "zod"
import { fn } from "./util/fn"
import { Actor } from "./actor"
import { and, Database, eq, isNull } from "./drizzle"
import { Identifier } from "./identifier"
import { ProviderTable } from "./schema/provider.sql"

/**
 * 提供商管理命名空间
 * 提供提供商列表查询、创建和删除功能
 */
export namespace Provider {
  /**
   * 获取提供商列表
   * @returns 提供商列表
   */
  export const list = fn(z.void(), () =>
    Database.use((tx) =>
      tx
        .select()
        .from(ProviderTable)
        .where(and(eq(ProviderTable.workspaceID, Actor.workspace()), isNull(ProviderTable.timeDeleted))),
    ),
  )

  /**
   * 创建提供商
   * @param input 输入参数，包含提供商名称和凭证
   * @returns 创建的提供商 ID
   */
  export const create = fn(
    z.object({
      provider: z.string().min(1).max(64),
      credentials: z.string(),
    }),
    async ({ provider, credentials }) => {
      Actor.assertAdmin()
      return Database.use((tx) =>
        tx
          .insert(ProviderTable)
          .values({
            id: Identifier.create("provider"),
            workspaceID: Actor.workspace(),
            provider,
            credentials,
          })
          .onDuplicateKeyUpdate({
            set: {
              credentials, // 更新凭证
              timeDeleted: null, // 清除删除时间
            },
          }),
      )
    },
  )

  /**
   * 删除提供商
   * @param input 输入参数，包含提供商名称
   */
  export const remove = fn(
    z.object({
      provider: z.string(),
    }),
    async ({ provider }) => {
      Actor.assertAdmin()
      return Database.use((tx) =>
        tx
          .delete(ProviderTable)
          .where(and(eq(ProviderTable.provider, provider), eq(ProviderTable.workspaceID, Actor.workspace()))),
      )
    },
  )
}
