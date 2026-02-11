import type { KVNamespace } from "@cloudflare/workers-types"
import { z } from "zod"
import { issuer } from "@openauthjs/openauth"
import type { Theme } from "@openauthjs/openauth/ui/theme"
import { createSubjects } from "@openauthjs/openauth/subject"
import { THEME_OPENAUTH } from "@openauthjs/openauth/ui/theme"
import { GithubProvider } from "@openauthjs/openauth/provider/github"
import { GoogleOidcProvider } from "@openauthjs/openauth/provider/google"
import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare"
import { Account } from "@opencode-ai/console-core/account.js"
import { Workspace } from "@opencode-ai/console-core/workspace.js"
import { Actor } from "@opencode-ai/console-core/actor.js"
import { Resource } from "@opencode-ai/console-resource"
import { User } from "@opencode-ai/console-core/user.js"
import { and, Database, eq, isNull, or } from "@opencode-ai/console-core/drizzle/index.js"
import { WorkspaceTable } from "@opencode-ai/console-core/schema/workspace.sql.js"
import { UserTable } from "@opencode-ai/console-core/schema/user.sql.js"
import { AuthTable } from "@opencode-ai/console-core/schema/auth.sql.js"
import { Identifier } from "@opencode-ai/console-core/identifier.js"

/**
 * 环境变量类型定义
 */
type Env = {
  /** 认证存储的 KV 命名空间 */
  AuthStorage: KVNamespace
}

/**
 * 认证主题定义
 * 创建账户和用户的身份验证主题
 */
export const subjects = createSubjects({
  account: z.object({
    accountID: z.string(),
    email: z.string(),
  }),
  user: z.object({
    userID: z.string(),
    workspaceID: z.string(),
  }),
})

/**
 * 自定义主题配置
 * 基于默认主题，修改了 logo 为 OpenCode 的 favicon
 */
const MY_THEME: Theme = {
  ...THEME_OPENAUTH,
  logo: "https://opencode.ai/favicon.svg",
}

/**
 * 认证服务主函数
 * 处理 OAuth 认证流程，支持 GitHub 和 Google 提供商
 */
export default {
  /**
   * 处理 HTTP 请求
   * @param request HTTP 请求对象
   * @param env 环境变量
   * @param ctx 执行上下文
   * @returns HTTP 响应
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const result = await issuer({
      theme: MY_THEME,
      providers: {
        /**
         * GitHub 认证提供商配置
         * 请求读取用户信息和邮箱权限
         */
        github: GithubProvider({
          clientID: Resource.GITHUB_CLIENT_ID_CONSOLE.value,
          clientSecret: Resource.GITHUB_CLIENT_SECRET_CONSOLE.value,
          scopes: ["read:user", "user:email"],
        }),
        /**
         * Google 认证提供商配置
         * 请求 openid 和邮箱权限
         */
        google: GoogleOidcProvider({
          clientID: Resource.GOOGLE_CLIENT_ID.value,
          scopes: ["openid", "email"],
        }),
        // 邮箱验证码认证（暂时注释）
        // email: CodeProvider({
        //   async request(req, state, form, error) {
        //     console.log(state)
        //     const params = new URLSearchParams()
        //     if (error) {
        //       params.set("error", error.type)
        //     }
        //     if (state.type === "start") {
        //       return Response.redirect(process.env.AUTH_FRONTEND_URL + "/auth/email?" + params.toString(), 302)
        //     }

        //     if (state.type === "code") {
        //       return Response.redirect(process.env.AUTH_FRONTEND_URL + "/auth/code?" + params.toString(), 302)
        //     }

        //     return new Response("ok")
        //   },
        //   async sendCode(claims, code) {
        //     const email = z.string().email().parse(claims.email)
        //     const cmd = new SendEmailCommand({
        //       Destination: {
        //         ToAddresses: [email],
        //       },
        //       FromEmailAddress: `SST <auth@${Resource.Email.sender}>`,
        //       Content: {
        //         Simple: {
        //           Body: {
        //             Html: {
        //               Data: `Your pin code is <strong>${code}</strong>`,
        //             },
        //             Text: {
        //               Data: `Your pin code is ${code}`,
        //             },
        //           },
        //           Subject: {
        //             Data: "SST Console Pin Code: " + code,
        //           },
        //         },
        //       },
        //     })
        //     await ses.send(cmd)
        //   },
        // }),
      },
      /**
       * 存储配置
       * 使用 Cloudflare KV 存储 OAuth 会话数据
       */
      storage: CloudflareStorage({
        // @ts-ignore
        namespace: env.AuthStorage,
      }),
      subjects,
      /**
       * 认证成功后的回调
       * 处理用户信息，创建账户和工作区
       */
      async success(ctx, response) {
        console.log(response)

        let subject: string | undefined
        let email: string | undefined

        /**
         * 处理 GitHub 认证
         * 获取用户主邮箱并验证
         */
        if (response.provider === "github") {
          const emails = (await fetch("https://api.github.com/user/emails", {
            headers: {
              Authorization: `Bearer ${response.tokenset.access}`,
              "User-Agent": "opencode",
              Accept: "application/vnd.github+json",
            },
          }).then((x) => x.json())) as any
          const user = (await fetch("https://api.github.com/user", {
            headers: {
              Authorization: `Bearer ${response.tokenset.access}`,
              "User-Agent": "opencode",
              Accept: "application/vnd.github+json",
            },
          }).then((x) => x.json())) as any
          subject = user.id.toString()

          const primaryEmail = emails.find((x: any) => x.primary)
          if (!primaryEmail) throw new Error("未找到 GitHub 用户的主邮箱")
          if (!primaryEmail.verified) throw new Error("GitHub 用户的主邮箱未验证")
          email = primaryEmail.email
        } 
        /**
         * 处理 Google 认证
         * 验证邮箱是否已验证
         */
        else if (response.provider === "google") {
          if (!response.id.email_verified) throw new Error("Google 邮箱未验证")
          subject = response.id.sub as string
          email = response.id.email as string
        } 
        /**
         * 不支持的认证提供商
         */
        else throw new Error("不支持的认证提供商")

        if (!email) throw new Error("未找到邮箱")
        if (!subject) throw new Error("未找到认证主题")

        /**
         * 非生产环境下的邮箱验证
         * 仅允许 @anoma.ly 邮箱登录
         */
        if (Resource.App.stage !== "production" && !email.endsWith("@anoma.ly")) {
          throw new Error("无效的邮箱")
        }

        /**
         * 获取或创建账户
         * 查找现有账户，如不存在则创建新账户
         */
        const accountID = await (async () => {
          const matches = await Database.use(async (tx) =>
            tx
              .select({
                provider: AuthTable.provider,
                accountID: AuthTable.accountID,
              })
              .from(AuthTable)
              .where(
                or(
                  and(eq(AuthTable.provider, response.provider), eq(AuthTable.subject, subject)),
                  and(eq(AuthTable.provider, "email"), eq(AuthTable.subject, email)),
                ),
              ),
          )
          const idByProvider = matches.find((x) => x.provider === response.provider)?.accountID
          const idByEmail = matches.find((x) => x.provider === "email")?.accountID
          if (idByProvider && idByEmail) return idByProvider

          // 如果未找到账户，则创建新账户
          let accountID = idByProvider ?? idByEmail
          if (!accountID) {
            console.log("为", email, "创建账户")
            accountID = await Account.create({})
          }

          /**
           * 保存认证信息
           * 为当前提供商和邮箱创建认证记录
           */
          await Database.use(async (tx) =>
            tx
              .insert(AuthTable)
              .values([
                {
                  id: Identifier.create("auth"),
                  accountID,
                  provider: response.provider,
                  subject,
                },
                {
                  id: Identifier.create("auth"),
                  accountID,
                  provider: "email",
                  subject: email,
                },
              ])
              .onDuplicateKeyUpdate({
                set: {
                  timeDeleted: null,
                },
              }),
          )

          return accountID
        })()

        /**
         * 处理工作区
         * 加入已邀请的工作区，如无工作区则创建默认工作区
         */
        await Actor.provide("account", { accountID, email }, async () => {
          await User.joinInvitedWorkspaces()
          const workspaces = await Database.use((tx) =>
            tx
              .select({ id: WorkspaceTable.id })
              .from(WorkspaceTable)
              .innerJoin(UserTable, eq(UserTable.workspaceID, WorkspaceTable.id))
              .where(
                and(
                  eq(UserTable.accountID, accountID),
                  isNull(UserTable.timeDeleted),
                  isNull(WorkspaceTable.timeDeleted),
                ),
              ),
          )
          if (workspaces.length === 0) {
            await Workspace.create({ name: "默认" })
          }
        })
        
        /**
         * 设置账户主题并返回
         */
        return ctx.subject("account", accountID, { accountID, email })
      },
    }).fetch(request, env, ctx)
    return result
  },
}
