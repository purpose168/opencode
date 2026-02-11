import { createProviderDefinedToolFactory } from "@ai-sdk/provider-utils"
import { z } from "zod/v4"

// 参数验证Schema
export const webSearchPreviewArgsSchema = z.object({
  /**
   * 用于Web搜索的搜索上下文大小。
   * - high: 最全面的上下文,最高成本,响应较慢
   * - medium: 平衡的上下文、成本和延迟(默认)
   * - low: 最少的上下文,最低成本,响应最快
   */
  searchContextSize: z.enum(["low", "medium", "high"]).optional(),

  /**
   * 提供地理位置相关搜索结果的用户位置信息。
   */
  userLocation: z
    .object({
      /**
       * 位置类型(总是'approximate')
       */
      type: z.literal("approximate"),
      /**
       * 两字母ISO国家代码(例如,'US','GB')
       */
      country: z.string().optional(),
      /**
       * 城市名称(自由文本,例如,'Minneapolis')
       */
      city: z.string().optional(),
      /**
       * 地区名称(自由文本,例如,'Minnesota')
       */
      region: z.string().optional(),
      /**
       * IANA时区(例如,'America/Chicago')
       */
      timezone: z.string().optional(),
    })
    .optional(),
})

// Web搜索预览工具工厂
// 创建具有输入和输出Schema的Web搜索预览工具
export const webSearchPreview = createProviderDefinedToolFactory<
  {
    // Web搜索不接受输入参数 - 它由提示控制
  },
  {
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
  id: "openai.web_search_preview", // 工具ID
  name: "web_search_preview", // 工具名称
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
