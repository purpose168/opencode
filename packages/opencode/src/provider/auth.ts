import { Auth } from "@/auth"
import { Instance } from "@/project/instance"
import { fn } from "@/util/fn"
import type { AuthOuathResult } from "@opencode-ai/plugin"
import { NamedError } from "@opencode-ai/util/error"
import { filter, fromEntries, map, mapValues, pipe } from "remeda"
import z from "zod"
import { Plugin } from "../plugin"

export namespace ProviderAuth {
  // 状态管理 - 存储认证方法和待处理的OAuth结果
  const state = Instance.state(async () => {
    const methods = pipe(
      await Plugin.list(), // 获取所有插件列表
      filter((x) => x.auth?.provider !== undefined), // 过滤出有认证提供者的插件
      map((x) => [x.auth!.provider, x.auth!] as const), // 映射为[提供者ID,认证配置]的数组
      fromEntries(), // 转换为对象
    )
    return { methods, pending: {} as Record<string, AuthOuathResult> } // 返回认证方法和待处理的OAuth结果
  })

  // 认证方法Schema定义
  export const Method = z
    .object({
      type: z.union([z.literal("oauth"), z.literal("api")]), // 类型:oauth或api
      label: z.string(), // 标签
    })
    .meta({
      ref: "ProviderAuthMethod", // 引用名称
    })
  export type Method = z.infer<typeof Method> // 认证方法类型

  /**
   * 获取所有认证方法
   * @returns 认证方法映射表
   */
  export async function methods() {
    const s = await state().then((x) => x.methods) // 获取认证方法状态
    return mapValues(s, (x) =>
      x.methods.map(
        (y): Method => ({
          // 映射为认证方法类型
          type: y.type, // 类型
          label: y.label, // 标签
        }),
      ),
    )
  }

  // 授权信息Schema定义
  export const Authorization = z
    .object({
      url: z.string(), // 授权URL
      method: z.union([z.literal("auto"), z.literal("code")]), // 方法:auto或code
      instructions: z.string(), // 说明
    })
    .meta({
      ref: "ProviderAuthAuthorization", // 引用名称
    })
  export type Authorization = z.infer<typeof Authorization> // 授权信息类型

  /**
   * 开始授权流程
   * @param input - 输入参数,包含提供者ID和方法索引
   * @returns 授权信息或undefined
   */
  export const authorize = fn(
    z.object({
      providerID: z.string(), // 提供者ID
      method: z.number(), // 方法索引
    }),
    async (input): Promise<Authorization | undefined> => {
      const auth = await state().then((s) => s.methods[input.providerID]) // 获取认证配置
      const method = auth.methods[input.method] // 获取指定的认证方法
      if (method.type === "oauth") {
        // 如果是OAuth类型
        const result = await method.authorize() // 调用授权方法
        await state().then((s) => (s.pending[input.providerID] = result)) // 保存待处理的OAuth结果
        return {
          url: result.url, // 授权URL
          method: result.method, // 方法
          instructions: result.instructions, // 说明
        }
      }
    },
  )

  /**
   * 处理OAuth回调
   * @param input - 输入参数,包含提供者ID、方法索引和授权码
   */
  export const callback = fn(
    z.object({
      providerID: z.string(), // 提供者ID
      method: z.number(), // 方法索引
      code: z.string().optional(), // 授权码(可选)
    }),
    async (input) => {
      const match = await state().then((s) => s.pending[input.providerID]) // 获取待处理的OAuth结果
      if (!match) throw new OauthMissing({ providerID: input.providerID }) // 如果没有待处理的结果则抛出错误
      let result // 结果变量

      if (match.method === "code") {
        // 如果是code方法
        if (!input.code) throw new OauthCodeMissing({ providerID: input.providerID }) // 如果没有授权码则抛出错误
        result = await match.callback(input.code) // 调用回调函数
      }

      if (match.method === "auto") {
        // 如果是auto方法
        result = await match.callback() // 调用回调函数
      }

      if (result?.type === "success") {
        // 如果结果类型是success
        if ("key" in result) {
          // 如果结果包含key
          await Auth.set(input.providerID, {
            // 设置API密钥认证
            type: "api", // 类型:api
            key: result.key, // 密钥
          })
        }
        if ("refresh" in result) {
          // 如果结果包含refresh
          await Auth.set(input.providerID, {
            // 设置OAuth认证
            type: "oauth", // 类型:oauth
            access: result.access, // 访问令牌
            refresh: result.refresh, // 刷新令牌
            expires: result.expires, // 过期时间
          })
        }
        return // 返回成功
      }

      throw new OauthCallbackFailed({}) // 抛出回调失败错误
    },
  )

  /**
   * 设置API密钥
   * @param input - 输入参数,包含提供者ID和密钥
   */
  export const api = fn(
    z.object({
      providerID: z.string(), // 提供者ID
      key: z.string(), // 密钥
    }),
    async (input) => {
      await Auth.set(input.providerID, {
        // 设置API密钥认证
        type: "api", // 类型:api
        key: input.key, // 密钥
      })
    },
  )

  // OAuth缺失错误
  export const OauthMissing = NamedError.create(
    "ProviderAuthOauthMissing", // 错误名称
    z.object({
      providerID: z.string(), // 提供者ID
    }),
  )
  // OAuth授权码缺失错误
  export const OauthCodeMissing = NamedError.create(
    "ProviderAuthOauthCodeMissing", // 错误名称
    z.object({
      providerID: z.string(), // 提供者ID
    }),
  )
  // OAuth回调失败错误
  export const OauthCallbackFailed = NamedError.create("ProviderAuthOauthCallbackFailed", z.object({})) // 错误名称
}
