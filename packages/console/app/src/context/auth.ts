import { getRequestEvent } from "solid-js/web"
import { and, Database, eq, inArray, isNull, sql } from "@opencode-ai/console-core/drizzle/index.js"
import { UserTable } from "@opencode-ai/console-core/schema/user.sql.js"
import { redirect } from "@solidjs/router"
import { Actor } from "@opencode-ai/console-core/actor.js"

import { createClient } from "@openauthjs/openauth/client"
import { useAuthSession } from "./auth.session"

/**
 * 认证客户端
 */
export const AuthClient = createClient({
  clientID: "app",
  issuer: import.meta.env.VITE_AUTH_URL,
})

/**
 * 获取参与者信息
 * @param workspace 工作区（可选）
 * @returns 参与者信息
 */
export const getActor = async (workspace?: string): Promise<Actor.Info> => {
  "use server"
  // 获取请求事件
  const evt = getRequestEvent()
  if (!evt) throw new Error("无请求事件")
  
  // 如果已有参与者信息，直接返回
  if (evt.locals.actor) return evt.locals.actor
  
  // 异步获取参与者信息并缓存
  evt.locals.actor = (async () => {
    // 获取认证会话
    const auth = await useAuthSession()
    
    // 如果没有指定工作区
    if (!workspace) {
      const account = auth.data.account ?? {}
      const current = account[auth.data.current ?? ""]
      
      // 如果有当前账户
      if (current) {
        return {
          type: "account",
          properties: {
            email: current.email,
            accountID: current.id,
          },
        }
      }
      
      // 如果有账户但没有当前账户，使用第一个账户
      if (Object.keys(account).length > 0) {
        const current = Object.values(account)[0]
        await auth.update((val) => ({
          ...val,
          current: current.id,
        }))
        return {
          type: "account",
          properties: {
            email: current.email,
            accountID: current.id,
          },
        }
      }
      
      // 公共访问
      return {
        type: "public",
        properties: {},
      }
    }
    
    // 如果指定了工作区
    const accounts = Object.keys(auth.data.account ?? {})
    if (accounts.length) {
      // 查询用户信息
      const user = await Database.use((tx) =>
        tx
          .select()
          .from(UserTable)
          .where(
            and(
              eq(UserTable.workspaceID, workspace),
              isNull(UserTable.timeDeleted),
              inArray(UserTable.accountID, accounts),
            ),
          )
          .limit(1)
          .execute()
          .then((x) => x[0]),
      )
      
      // 如果找到用户
      if (user) {
        // 更新用户最后访问时间
        await Database.use((tx) =>
          tx
            .update(UserTable)
            .set({ timeSeen: sql`now()` })
            .where(and(eq(UserTable.workspaceID, workspace), eq(UserTable.id, user.id))),
        )
        
        return {
          type: "user",
          properties: {
            userID: user.id,
            workspaceID: user.workspaceID,
            accountID: user.accountID,
            role: user.role,
          },
        }
      }
    }
    
    // 重定向到授权页面
    throw redirect("/auth/authorize")
  })()
  
  return evt.locals.actor
}
