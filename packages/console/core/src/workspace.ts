import { z } from "zod"
import { fn } from "./util/fn"
import { Actor } from "./actor"
import { Database } from "./drizzle"
import { Identifier } from "./identifier"
import { UserTable } from "./schema/user.sql"
import { BillingTable } from "./schema/billing.sql"
import { WorkspaceTable } from "./schema/workspace.sql"
import { Key } from "./key"
import { eq, sql } from "drizzle-orm"

/**
 * 工作区管理命名空间
 * 提供工作区创建、更新和删除功能
 */
export namespace Workspace {
  /**
   * 创建工作区
   * @param input 输入参数，包含工作区名称
   * @returns 创建的工作区 ID
   * @throws 如果不是账户类型的 Actor 则抛出错误
   */
  export const create = fn(
    z.object({
      name: z.string().min(1),
    }),
    async ({ name }) => {
      const account = Actor.assert("account")
      const workspaceID = Identifier.create("workspace")
      const userID = Identifier.create("user")
      await Database.transaction(async (tx) => {
        // 创建工作区
        await tx.insert(WorkspaceTable).values({
          id: workspaceID,
          name,
        })
        // 创建用户（管理员）
        await tx.insert(UserTable).values({
          workspaceID,
          id: userID,
          accountID: account.properties.accountID,
          name: "",
          role: "admin",
        })
        // 创建账单记录
        await tx.insert(BillingTable).values({
          workspaceID,
          id: Identifier.create("billing"),
          balance: 0,
        })
      })
      // 创建默认 API 密钥
      await Actor.provide(
        "system",
        {
          workspaceID,
        },
        () => Key.create({ userID, name: "Default API Key" }),
      )
      return workspaceID
    },
  )

  /**
   * 更新工作区名称
   * @param input 输入参数，包含新的工作区名称
   * @returns 更新操作的结果
   * @throws 如果不是管理员则抛出错误
   */
  export const update = fn(
    z.object({
      name: z.string().min(1).max(255),
    }),
    async ({ name }) => {
      Actor.assertAdmin()
      const workspaceID = Actor.workspace()
      return await Database.use((tx) =>
        tx
          .update(WorkspaceTable)
          .set({
            name,
          })
          .where(eq(WorkspaceTable.id, workspaceID)),
      )
    },
  )

  /**
   * 删除工作区
   * @returns 删除操作的结果
   */
  export const remove = fn(z.void(), async () => {
    await Database.use((tx) =>
      tx
        .update(WorkspaceTable)
        .set({ timeDeleted: sql`now()` })
        .where(eq(WorkspaceTable.id, Actor.workspace())),
    )
  })
}
