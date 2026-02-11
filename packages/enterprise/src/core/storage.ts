import { AwsClient } from "aws4fetch"
import { lazy } from "@opencode-ai/util/lazy"

/**
 * 存储模块，提供对S3和R2存储服务的操作接口
 */
export namespace Storage {
  /**
   * 存储适配器接口，定义了存储操作的基本方法
   */
  export interface Adapter {
    /**
     * 读取指定路径的内容
     * @param path 存储路径
     * @returns 返回读取的内容，若不存在则返回undefined
     */
    read(path: string): Promise<string | undefined>
    
    /**
     * 向指定路径写入内容
     * @param path 存储路径
     * @param value 要写入的内容
     */
    write(path: string, value: string): Promise<void>
    
    /**
     * 删除指定路径的内容
     * @param path 存储路径
     */
    remove(path: string): Promise<void>
    
    /**
     * 列出指定前缀的所有路径
     * @param options 列表选项
     * @param options.prefix 路径前缀
     * @param options.limit 返回数量限制
     * @param options.after 分页标记，返回此标记之后的结果
     * @param options.before 分页标记，返回此标记之前的结果
     * @returns 返回路径数组
     */
    list(options?: { prefix?: string; limit?: number; after?: string; before?: string }): Promise<string[]>
  }

  /**
   * 创建存储适配器
   * @param client AWS客户端实例
   * @param endpoint 存储服务端点
   * @param bucket 存储桶名称
   * @returns 存储适配器实例
   */
  function createAdapter(client: AwsClient, endpoint: string, bucket: string): Adapter {
    const base = `${endpoint}/${bucket}`
    return {
      /**
       * 读取指定路径的内容
       * @param path 存储路径
       * @returns 返回读取的内容，若不存在则返回undefined
       */
      async read(path: string): Promise<string | undefined> {
        const response = await client.fetch(`${base}/${path}`)
        if (response.status === 404) return undefined
        if (!response.ok) throw new Error(`读取${path}失败: ${response.status}`)
        return response.text()
      },

      /**
       * 向指定路径写入内容
       * @param path 存储路径
       * @param value 要写入的内容
       */
      async write(path: string, value: string): Promise<void> {
        const response = await client.fetch(`${base}/${path}`, {
          method: "PUT",
          body: value,
          headers: {
            "Content-Type": "application/json",
          },
        })
        if (!response.ok) throw new Error(`写入${path}失败: ${response.status}`)
      },

      /**
       * 删除指定路径的内容
       * @param path 存储路径
       */
      async remove(path: string): Promise<void> {
        const response = await client.fetch(`${base}/${path}`, {
          method: "DELETE",
        })
        if (!response.ok) throw new Error(`删除${path}失败: ${response.status}`)
      },

      /**
       * 列出指定前缀的所有路径
       * @param options 列表选项
       * @returns 返回路径数组
       */
      async list(options?: { prefix?: string; limit?: number; after?: string; before?: string }): Promise<string[]> {
        const prefix = options?.prefix || ""
        const params = new URLSearchParams({ "list-type": "2", prefix })
        if (options?.limit) params.set("max-keys", options.limit.toString())
        if (options?.after) {
          const afterPath = prefix + options.after + ".json"
          params.set("start-after", afterPath)
        }
        const response = await client.fetch(`${base}?${params}`)
        if (!response.ok) throw new Error(`列出${prefix}失败: ${response.status}`)
        const xml = await response.text()
        const keys: string[] = []
        const regex = /<Key>([^<]+)<\/Key>/g
        let match
        while ((match = regex.exec(xml)) !== null) {
          keys.push(match[1])
        }
        if (options?.before) {
          const beforePath = prefix + options.before + ".json"
          return keys.filter((key) => key < beforePath)
        }
        return keys
      },
    }
  }

  /**
   * 创建S3存储适配器
   * @returns S3存储适配器实例
   */
  function s3(): Adapter {
    const bucket = process.env.OPENCODE_STORAGE_BUCKET!
    const region = process.env.OPENCODE_STORAGE_REGION || "us-east-1"
    const client = new AwsClient({
      region,
      accessKeyId: process.env.OPENCODE_STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.OPENCODE_STORAGE_SECRET_ACCESS_KEY!,
    })
    return createAdapter(client, `https://s3.${region}.amazonaws.com`, bucket)
  }

  /**
   * 创建R2存储适配器
   * @returns R2存储适配器实例
   */
  function r2() {
    const accountId = process.env.OPENCODE_STORAGE_ACCOUNT_ID!
    const client = new AwsClient({
      accessKeyId: process.env.OPENCODE_STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.OPENCODE_STORAGE_SECRET_ACCESS_KEY!,
    })
    return createAdapter(client, `https://${accountId}.r2.cloudflarestorage.com`, process.env.OPENCODE_STORAGE_BUCKET!)
  }

  /**
   * 延迟加载存储适配器，根据配置选择使用S3还是R2
   */
  const adapter = lazy(() => {
    const type = process.env.OPENCODE_STORAGE_ADAPTER
    if (type === "r2") return r2()
    if (type === "s3") return s3()
    throw new Error("未配置存储适配器")
  })

  /**
   * 解析存储键路径
   * @param key 键路径数组
   * @returns 格式化后的存储路径
   */
  function resolve(key: string[]) {
    return key.join("/") + ".json"
  }

  /**
   * 读取存储内容
   * @param key 键路径数组
   * @returns 解析后的JSON对象，若不存在则返回undefined
   */
  export async function read<T>(key: string[]) {
    const result = await adapter().read(resolve(key))
    if (!result) return undefined
    return JSON.parse(result) as T
  }

  /**
   * 写入存储内容
   * @param key 键路径数组
   * @param value 要写入的值
   */
  export function write<T>(key: string[], value: T) {
    return adapter().write(resolve(key), JSON.stringify(value))
  }

  /**
   * 删除存储内容
   * @param key 键路径数组
   */
  export function remove(key: string[]) {
    return adapter().remove(resolve(key))
  }

  /**
   * 列出存储内容
   * @param options 列表选项
   * @param options.prefix 路径前缀数组
   * @param options.limit 返回数量限制
   * @param options.after 分页标记，返回此标记之后的结果
   * @param options.before 分页标记，返回此标记之前的结果
   * @returns 返回路径数组的数组
   */
  export async function list(options?: { prefix?: string[]; limit?: number; after?: string; before?: string }) {
    const p = options?.prefix ? options.prefix.join("/") + (options.prefix.length ? "/" : "") : ""
    const result = await adapter().list({
      prefix: p,
      limit: options?.limit,
      after: options?.after,
      before: options?.before,
    })
    return result.map((x) => x.replace(/\.json$/, "").split("/"))
  }

  /**
   * 更新存储内容
   * @param key 键路径数组
   * @param fn 更新函数，接收当前值并进行修改
   * @returns 更新后的值
   */
  export async function update<T>(key: string[], fn: (draft: T) => void) {
    const val = await read<T>(key)
    if (!val) throw new Error("未找到")
    fn(val)
    await write(key, val)
    return val
  }
}
