import { z } from "zod"
import { fn } from "./util/fn"
import { Actor } from "./actor"
import { and, Database, eq, isNull, sql } from "./drizzle"
import { Identifier } from "./identifier"
import { KeyTable } from "./schema/key.sql"
import { UserTable } from "./schema/user.sql"
import { AuthTable } from "./schema/auth.sql"

/**
 * API 密钥管理命名空间
 * 提供密钥列表查询、创建和删除功能
 */
export namespace Key {
  /**
   * 获取密钥列表
   * @returns 密钥列表，包含密钥信息
   * @note 对于非管理员用户，只返回自己的密钥，密钥值会被隐藏
   */
  export const list = fn(z.void(), async () => {
    const keys = await Database.use((tx) =>
      tx
        .select({
          id: KeyTable.id,
          name: KeyTable.name,
          key: KeyTable.key,
          timeUsed: KeyTable.timeUsed,
          userID: KeyTable.userID,
          email: AuthTable.subject,
        })
        .from(KeyTable)
        .innerJoin(UserTable, and(eq(KeyTable.userID, UserTable.id), eq(KeyTable.workspaceID, UserTable.workspaceID)))
        .innerJoin(AuthTable, and(eq(UserTable.accountID, AuthTable.accountID), eq(AuthTable.provider, "email")))
        .where(
          and(
            ...[
              eq(KeyTable.workspaceID, Actor.workspace()),
              isNull(KeyTable.timeDeleted),
              ...(Actor.userRole() === "admin" ? [] : [eq(KeyTable.userID, Actor.userID())]),
            ],
          ),
        )
        .orderBy(sql`${KeyTable.name} DESC`),
    )
    // 只返回用户自己的密钥值
    return keys.map((key) => ({
      ...key,
      key: key.userID === Actor.userID() ? key.key : undefined,
      keyDisplay: `${key.key.slice(0, 7)}...${key.key.slice(-4)}`,
    }))
  })

  /**
   * 创建密钥
   * @param input 输入参数，包含用户 ID 和密钥名称
   * @returns 创建的密钥 ID
   */
  export const create = fn(
    z.object({
      userID: z.string(),
      name: z.string().min(1).max(255),
    }),
    async (input) => {
      const { name } = input

      // 生成密钥：sk- + 64 个随机字符（大写、小写、数字）
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
      let secretKey = "sk-"
      const array = new Uint32Array(64)
      crypto.getRandomValues(array)
      for (let i = 0, l = array.length; i < l; i++) {
        secretKey += chars[array[i] % chars.length]
      }
      const keyID = Identifier.create("key")

      await Database.use((tx) =>
        tx.insert(KeyTable).values({
          id: keyID,
          workspaceID: Actor.workspace(),
          userID: input.userID,
          name,
          key: secretKey,
          timeUsed: null,
        }),
      )

      return keyID
    },
  )

  /**
   * 删除密钥
   * @param input 输入参数，包含密钥 ID
   * @note 只有管理员可以删除其他用户的密钥
   */
  export const remove = fn(z.object({ id: z.string() }), async (input) => {
    // 只有管理员可以删除其他用户的密钥
    await Database.use((tx) =>
      tx
        .update(KeyTable)
        .set({
          timeDeleted: sql`now()`,
        })
        .where(
          and(
            ...[
              eq(KeyTable.id, input.id),
              eq(KeyTable.workspaceID, Actor.workspace()),
              ...(Actor.userRole() === "admin" ? [] : [eq(KeyTable.userID, Actor.userID())]),
            ],
          ),
        ),
    )
  })
}
