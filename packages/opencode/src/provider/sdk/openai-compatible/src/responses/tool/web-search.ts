import { createProviderDefinedToolFactory } from "@ai-sdk/provider-utils"
import { z } from "zod/v4"

// Web搜索参数Schema定义
export const webSearchArgsSchema = z.object({
  filters: z
    .object({
      allowedDomains: z.array(z.string()).optional(), // 允许的域名数组(可选)
    })
    .optional(), // 过滤器(可选)

  searchContextSize: z.enum(["low", "medium", "high"]).optional(), // 搜索上下文大小(可选)

  userLocation: z
    .object({
      type: z.literal("approximate"), // 位置类型(总是'approximate')
      country: z.string().optional(), // 两字母ISO国家代码(例如,'US','GB')(可选)
      city: z.string().optional(), // 城市名称(自由文本,例如,'Minneapolis')(可选)
      region: z.string().optional(), // 地区名称(自由文本,例如,'Minnesota')(可选)
      timezone: z.string().optional(), // IANA时区(例如,'America/Chicago')(可选)
    })
    .optional(), // 用户位置信息(可选)
})

// Web搜索工具工厂
// 创建具有输入和输出Schema的Web搜索工具
export const webSearchToolFactory = createProviderDefinedToolFactory<
  {
    // Web搜索不接受输入参数 - 它由提示控制
  },
  {
    /**
     * 搜索的过滤器。
     */
    filters?: {
      /**
       * 搜索的允许域名。
       * 如果未提供,则允许所有域名。
       * 提供域名的子域名也被允许。
       */
      allowedDomains?: string[]
    }

    /**
     * 用于Web搜索的搜索上下文大小。
     * - high: 最全面的上下文,最高成本,响应较慢
     * - medium: 平衡的上下文、成本和延迟(默认)
     * - low: 最少的上下文,最低成本,响应最快
     */
    searchContextSize?: "low" | "medium" | "high"

    /**
     * 提供地理位置相关搜索结果的用户位置信息。
     */
    userLocation?: {
      /**
       * 位置类型(总是'approximate')
       */
      type: "approximate"
      /**
       * 两字母ISO国家代码(例如,'US','GB')
       */
      country?: string
      /**
       * 城市名称(自由文本,例如,'Minneapolis')
       */
      city?: string
      /**
       * 地区名称(自由文本,例如,'Minnesota')
       */
      region?: string
      /**
       * IANA时区(例如,'America/Chicago')
       */
      timezone?: string
    }
  }
>({
  id: "openai.web_search", // 工具ID
  name: "web_search", // 工具名称
  inputSchema: z.object({
    // 输入Schema
    action: z
      .discriminatedUnion("type", [
        z.object({
          type: z.literal("search"), // 搜索动作
          query: z.string().nullish(), // 搜索查询(可为null)
        }),
        z.object({
          type: z.literal("open_page"), // 打开页面动作
          url: z.string(), // 页面URL
        }),
        z.object({
          type: z.literal("find"), // 查找动作
          url: z.string(), // 页面URL
          pattern: z.string(), // 查找模式
        }),
      ])
      .nullish(), // 可以为null
  }),
})

// Web搜索函数
// 创建并返回Web搜索工具实例
export const webSearch = (
  args: Parameters<typeof webSearchToolFactory>[0] = {}, // 默认参数为空对象
) => {
  return webSearchToolFactory(args)
}
