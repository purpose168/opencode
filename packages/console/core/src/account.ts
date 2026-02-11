import { z } from "zod"
import { eq } from "drizzle-orm"
import { fn } from "./util/fn"
import { Database } from "./drizzle"
import { Identifier } from "./identifier"
import { AccountTable } from "./schema/account.sql"

/**
 * 账户管理命名空间
 * 提供账户创建和查询功能
 */
export namespace Account {
  /**
   * 创建账户
   * @param input 输入参数，包含可选的账户 ID
   * @returns 创建的账户 ID
   */
  export const create = fn(
    z.object({
      id: z.string().optional(),
    }),
    async (input) =>
      Database.use(async (tx) => {
        // 如果未提供 ID，则生成新的账户 ID
        const id = input.id ?? Identifier.create("account")
        await tx.insert(AccountTable).values({
          id,
        })
        return id
      }),
  )

  /**
   * 根据 ID 查询账户
   * @param id 账户 ID
   * @returns 账户信息，如果不存在则返回 undefined
   */
  export const fromID = fn(z.string(), async (id) =>
    Database.use((tx) =>
      tx
        .select()
        .from(AccountTable)
        .where(eq(AccountTable.id, id))
        .then((rows) => rows[0]),
    ),
  )
}
