import { env } from "cloudflare:workers"
export { waitUntil } from "cloudflare:workers"

/**
 * 资源代理对象
 * 用于从 Cloudflare Workers 环境变量中获取资源配置
 * 提供了统一的接口来访问各种资源配置
 */
export const Resource = new Proxy(
  {},
  {
    /**
     * 获取资源配置
     * @param _target 目标对象（未使用）
     * @param prop 资源属性名
     * @returns 资源配置值
     * @throws 如果资源未在 sst.config.ts 中链接，则抛出错误
     */
    get(_target, prop: string) {
      // 检查环境变量中是否存在该属性
      if (prop in env) {
        // @ts-expect-error 类型检查忽略
        const value = env[prop]
        // 如果值是字符串，则解析为 JSON 对象
        return typeof value === "string" ? JSON.parse(value) : value
      } 
      // 特殊处理 App 资源
      else if (prop === "App") {
        // @ts-expect-error 类型检查忽略
        return JSON.parse(env.SST_RESOURCE_App)
      }
      // 如果资源未找到，则抛出错误
      throw new Error(`"${prop}" 未在您的 sst.config.ts 中链接 (cloudflare)`) 
    },
  },
) as Record<string, any>
