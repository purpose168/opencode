import type { KVNamespaceListOptions, KVNamespaceListResult, KVNamespacePutOptions } from "@cloudflare/workers-types"
import { Resource as ResourceBase } from "sst"
import Cloudflare from "cloudflare"

/**
 * 等待异步操作完成
 * @param promise 要等待的 Promise
 */
export const waitUntil = async (promise: Promise<any>) => {
  await promise
}

/**
 * 资源代理对象
 * 用于从 SST 的 ResourceBase 中获取资源配置
 * 对特定类型的资源（如 Bucket 和 Kv）进行特殊处理
 */
export const Resource = new Proxy(
  {},
  {
    /**
     * 获取资源配置
     * @param _target 目标对象（未使用）
     * @param prop 资源属性名
     * @returns 资源配置值，对于特定类型的资源返回处理后的对象
     */
    get(_target, prop: keyof typeof ResourceBase) {
      const value = ResourceBase[prop]
      
      // 检查资源是否有类型属性
      if ("type" in value) {
        // @ts-ignore 类型检查忽略
        // 处理 Cloudflare Bucket 资源
        if (value.type === "sst.cloudflare.Bucket") {
          return {
            put: async () => {}, // 空实现
          }
        }
        
        // @ts-ignore 类型检查忽略
        // 处理 Cloudflare KV 资源
        if (value.type === "sst.cloudflare.Kv") {
          // 创建 Cloudflare 客户端
          const client = new Cloudflare({
            apiToken: ResourceBase.CLOUDFLARE_API_TOKEN.value,
          })
          // @ts-ignore 类型检查忽略
          const namespaceId = value.namespaceId
          const accountId = ResourceBase.CLOUDFLARE_DEFAULT_ACCOUNT_ID.value
          
          // 返回 KV 命名空间操作对象
          return {
            /**
             * 获取 KV 存储中的值
             * @param k 键名或键名数组
             * @returns 单个值或键值对 Map
             */
            get: (k: string | string[]) => {
              const isMulti = Array.isArray(k)
              return client.kv.namespaces
                .bulkGet(namespaceId, {
                  keys: Array.isArray(k) ? k : [k],
                  account_id: accountId,
                })
                .then((result) => (isMulti ? new Map(Object.entries(result?.values ?? {})) : result?.values?.[k]))
            },
            
            /**
             * 向 KV 存储中写入值
             * @param k 键名
             * @param v 值
             * @param opts 选项，包括过期时间等
             */
            put: (k: string, v: string, opts?: KVNamespacePutOptions) =>
              client.kv.namespaces.values.update(namespaceId, k, {
                account_id: accountId,
                value: v,
                expiration: opts?.expiration,
                expiration_ttl: opts?.expirationTtl,
                metadata: opts?.metadata,
              }),
            
            /**
             * 从 KV 存储中删除值
             * @param k 键名
             */
            delete: (k: string) =>
              client.kv.namespaces.values.delete(namespaceId, k, {
                account_id: accountId,
              }),
            
            /**
             * 列出 KV 存储中的键
             * @param opts 选项，包括前缀等
             * @returns 键列表结果
             */
            list: (opts?: KVNamespaceListOptions): Promise<KVNamespaceListResult<unknown, string>> =>
              client.kv.namespaces.keys
                .list(namespaceId, {
                  account_id: accountId,
                  prefix: opts?.prefix ?? undefined,
                })
                .then((result) => {
                  return {
                    keys: result.result,
                    list_complete: true,
                    cacheStatus: null,
                  }
                }),
          }
        }
      }
      
      // 返回原始资源值
      return value
    },
  },
) as Record<string, any>
