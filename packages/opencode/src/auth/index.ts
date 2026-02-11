import path from "path"
import { Global } from "../global"
import fs from "fs/promises"
import z from "zod"

/**
 * 认证模块
 * 负责管理不同类型的认证信息，包括OAuth、API密钥和WellKnown认证
 */
export namespace Auth {
  /**
   * OAuth认证配置模式
   * 包含类型、刷新令牌、访问令牌、过期时间和企业URL
   */
  export const Oauth = z
    .object({
      type: z.literal("oauth"), // 认证类型为oauth
      refresh: z.string(), // 刷新令牌
      access: z.string(), // 访问令牌
      expires: z.number(), // 过期时间戳
      enterpriseUrl: z.string().optional(), // 企业URL（可选）
    })
    .meta({ ref: "OAuth" }) // 设置元数据引用

  /**
   * API密钥认证配置模式
   * 包含类型和API密钥
   */
  export const Api = z
    .object({
      type: z.literal("api"), // 认证类型为api
      key: z.string(), // API密钥
    })
    .meta({ ref: "ApiAuth" }) // 设置元数据引用

  /**
   * WellKnown认证配置模式
   * 包含类型、密钥和令牌
   */
  export const WellKnown = z
    .object({
      type: z.literal("wellknown"), // 认证类型为wellknown
      key: z.string(), // 密钥
      token: z.string(), // 令牌
    })
    .meta({ ref: "WellKnownAuth" }) // 设置元数据引用

  /**
   * 认证信息联合类型
   * 根据type字段区分不同的认证类型
   */
  export const Info = z.discriminatedUnion("type", [Oauth, Api, WellKnown]).meta({ ref: "Auth" })
  /**
   * 认证信息类型
   * 从Info模式推断出的TypeScript类型
   */
  export type Info = z.infer<typeof Info>

  // 认证信息存储文件路径
  const filepath = path.join(Global.Path.data, "auth.json")

  /**
   * 获取指定提供商的认证信息
   * @param providerID 提供商ID
   * @returns 认证信息，如果不存在则返回undefined
   */
  export async function get(providerID: string) {
    const auth = await all()
    return auth[providerID]
  }

  /**
   * 获取所有认证信息
   * @returns 所有认证信息的记录对象
   */
  export async function all(): Promise<Record<string, Info>> {
    const file = Bun.file(filepath)
    // 读取文件内容，解析为JSON，如果失败则返回空对象
    const data = await file.json().catch(() => ({}) as Record<string, unknown>)
    // 过滤并解析有效的认证信息
    return Object.entries(data).reduce(
      (acc, [key, value]) => {
        const parsed = Info.safeParse(value)
        if (!parsed.success) return acc
        acc[key] = parsed.data
        return acc
      },
      {} as Record<string, Info>,
    )
  }

  /**
   * 设置指定提供商的认证信息
   * @param key 提供商ID
   * @param info 认证信息
   */
  export async function set(key: string, info: Info) {
    const file = Bun.file(filepath)
    const data = await all()
    // 写入更新后的认证信息
    await Bun.write(file, JSON.stringify({ ...data, [key]: info }, null, 2))
    // 设置文件权限为600（仅所有者可读写）
    await fs.chmod(file.name!, 0o600)
  }

  /**
   * 删除指定提供商的认证信息
   * @param key 提供商ID
   */
  export async function remove(key: string) {
    const file = Bun.file(filepath)
    const data = await all()
    delete data[key]
    // 写入更新后的认证信息
    await Bun.write(file, JSON.stringify(data, null, 2))
    // 设置文件权限为600（仅所有者可读写）
    await fs.chmod(file.name!, 0o600)
  }
}
