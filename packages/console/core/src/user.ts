import { z } from "zod"
import { and, eq, getTableColumns, isNull, sql } from "drizzle-orm"
import { fn } from "./util/fn"
import { Database } from "./drizzle"
import { UserRole, UserTable } from "./schema/user.sql"
import { Actor } from "./actor"
import { Identifier } from "./identifier"
import { render } from "@jsx-email/render"
import { AWS } from "./aws"
import { Key } from "./key"
import { KeyTable } from "./schema/key.sql"
import { WorkspaceTable } from "./schema/workspace.sql"
import { AuthTable } from "./schema/auth.sql"

/**
 * 用户管理命名空间
 * 提供用户列表查询、创建、更新和删除功能
 */
export namespace User {
  /**
   * 断言不是当前用户
   * @param id 用户 ID
   * @throws 如果是当前用户则抛出错误
   */
  const assertNotSelf = (id: string) => {
    if (Actor.userID() !== id) return
    throw new Error(`期望不是当前用户，实际是当前用户`)
  }

  /**
   * 获取用户列表
   * @returns 用户列表，包含用户信息和认证邮箱
   */
  export const list = fn(z.void(), () =>
    Database.use((tx) =>
      tx
        .select({
          ...getTableColumns(UserTable),
          authEmail: AuthTable.subject,
        })
        .from(UserTable)
        .leftJoin(AuthTable, and(eq(UserTable.accountID, AuthTable.accountID), eq(AuthTable.provider, "email")))
        .where(and(eq(UserTable.workspaceID, Actor.workspace()), isNull(UserTable.timeDeleted))),
    ),
  )

  /**
   * 根据 ID 查询用户
   * @param id 用户 ID
   * @returns 用户信息，如果不存在则返回 undefined
   */
  export const fromID = fn(z.string(), (id) =>
    Database.use((tx) =>
      tx
        .select()
        .from(UserTable)
        .where(and(eq(UserTable.workspaceID, Actor.workspace()), eq(UserTable.id, id), isNull(UserTable.timeDeleted)))
        .then((rows) => rows[0]),
    ),
  )

  /**
   * 获取用户认证邮箱
   * @param id 用户 ID
   * @returns 用户邮箱，如果不存在则返回 undefined
   */
  export const getAuthEmail = fn(z.string(), (id) =>
    Database.use((tx) =>
      tx
        .select({
          email: AuthTable.subject,
        })
        .from(UserTable)
        .leftJoin(AuthTable, and(eq(UserTable.accountID, AuthTable.accountID), eq(AuthTable.provider, "email")))
        .where(and(eq(UserTable.workspaceID, Actor.workspace()), eq(UserTable.id, id)))
        .then((rows) => rows[0]?.email),
    ),
  )

  /**
   * 邀请用户
   * @param input 输入参数，包含邮箱、角色和可选的月度限额
   * @throws 如果不是管理员则抛出错误
   */
  export const invite = fn(
    z.object({
      email: z.string(),
      role: z.enum(UserRole),
      monthlyLimit: z.number().nullable().optional(),
    }),
    async ({ email, role, monthlyLimit }) => {
      Actor.assertAdmin()
      const workspaceID = Actor.workspace()

      // 创建用户
      const accountID = await Database.use((tx) =>
        tx
          .select({
            accountID: AuthTable.accountID,
          })
          .from(AuthTable)
          .where(and(eq(AuthTable.provider, "email"), eq(AuthTable.subject, email)))
          .then((rows) => rows[0]?.accountID),
      )
      await Database.use((tx) =>
        tx
          .insert(UserTable)
          .values({
            id: Identifier.create("user"),
            name: "",
            ...(accountID
              ? {
                  accountID,
                }
              : {
                  email,
                }),
            workspaceID,
            role,
            monthlyLimit,
          })
          .onDuplicateKeyUpdate({
            set: {
              role,
              monthlyLimit,
              timeDeleted: null,
            },
          }),
      )

      // 创建 API 密钥
      if (accountID) {
        await Database.use(async (tx) => {
          const user = await tx
            .select()
            .from(UserTable)
            .where(and(eq(UserTable.workspaceID, workspaceID), eq(UserTable.accountID, accountID)))
            .then((rows) => rows[0])

          const key = await tx
            .select()
            .from(KeyTable)
            .where(and(eq(KeyTable.workspaceID, workspaceID), eq(KeyTable.userID, user.id)))
            .then((rows) => rows[0])

          if (key) return

          await Key.create({ userID: user.id, name: "Default API Key" })
        })
      }

      // 发送邮件，忽略错误
      try {
        const emailInfo = await Database.use((tx) =>
          tx
            .select({
              inviterEmail: AuthTable.subject,
              workspaceName: WorkspaceTable.name,
            })
            .from(UserTable)
            .innerJoin(AuthTable, and(eq(UserTable.accountID, AuthTable.accountID), eq(AuthTable.provider, "email")))
            .innerJoin(WorkspaceTable, eq(WorkspaceTable.id, workspaceID))
            .where(
              and(eq(UserTable.workspaceID, workspaceID), eq(UserTable.id, Actor.assert("user").properties.userID)),
            )
            .then((rows) => rows[0]),
        )

        const { InviteEmail } = await import("@opencode-ai/console-mail/InviteEmail.jsx")
        await AWS.sendEmail({
          to: email,
          subject: `您已被邀请加入 OpenCode 上的 ${emailInfo.workspaceName} 工作区`,
          body: render(
            // @ts-ignore
            InviteEmail({
              inviter: emailInfo.inviterEmail,
              assetsUrl: `https://opencode.ai/email`,
              workspaceID: workspaceID,
              workspaceName: emailInfo.workspaceName,
            }),
          ),
        })
      } catch (e) {
        console.error(e)
      }
    },
  )

  /**
   * 加入已邀请的工作区
   * 当用户登录时，处理所有发送到其邮箱的邀请
   */
  export const joinInvitedWorkspaces = fn(z.void(), async () => {
    const account = Actor.assert("account")
    const invitations = await Database.use(async (tx) => {
      const invitations = await tx
        .select({
          id: UserTable.id,
          workspaceID: UserTable.workspaceID,
        })
        .from(UserTable)
        .where(eq(UserTable.email, account.properties.email))

      await tx
        .update(UserTable)
        .set({
          accountID: account.properties.accountID,
          email: null,
        })
        .where(eq(UserTable.email, account.properties.email))
      return invitations
    })

    await Promise.all(
      invitations.map((invite) =>
        Actor.provide(
          "system",
          {
            workspaceID: invite.workspaceID,
          },
          () => Key.create({ userID: invite.id, name: "Default API Key" }),
        ),
      ),
    )
  })

  /**
   * 更新用户信息
   * @param input 输入参数，包含用户 ID、角色和月度限额
   * @throws 如果不是管理员则抛出错误
   * @throws 如果尝试将自己降级为成员则抛出错误
   */
  export const update = fn(
    z.object({
      id: z.string(),
      role: z.enum(UserRole),
      monthlyLimit: z.number().nullable(),
    }),
    async ({ id, role, monthlyLimit }) => {
      Actor.assertAdmin()
      if (role === "member") assertNotSelf(id)
      return await Database.use((tx) =>
        tx
          .update(UserTable)
          .set({ role, monthlyLimit })
          .where(and(eq(UserTable.id, id), eq(UserTable.workspaceID, Actor.workspace()))),
      )
    },
  )

  /**
   * 删除用户
   * @param id 用户 ID
   * @throws 如果不是管理员则抛出错误
   * @throws 如果尝试删除自己则抛出错误
   */
  export const remove = fn(z.string(), async (id) => {
    Actor.assertAdmin()
    assertNotSelf(id)

    return await Database.use((tx) =>
      tx
        .update(UserTable)
        .set({
          timeDeleted: sql`now()`,
        })
        .where(and(eq(UserTable.id, id), eq(UserTable.workspaceID, Actor.workspace()))),
    )
  })
}
