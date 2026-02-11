import { createProviderDefinedToolFactoryWithOutputSchema } from "@ai-sdk/provider-utils"
import { z } from "zod/v4"
import type {
  OpenAIResponsesFileSearchToolComparisonFilter,
  OpenAIResponsesFileSearchToolCompoundFilter,
} from "../openai-responses-api-types"

// 比较过滤器Schema定义
// 用于定义文件搜索的比较条件
const comparisonFilterSchema = z.object({
  key: z.string(), // 过滤键
  type: z.enum(["eq", "ne", "gt", "gte", "lt", "lte"]), // 比较类型:等于、不等于、大于、大于等于、小于、小于等于
  value: z.union([z.string(), z.number(), z.boolean()]), // 比较值:字符串、数字或布尔值
})

// 复合过滤器Schema定义
// 用于定义多个过滤器的逻辑组合(AND或OR)
const compoundFilterSchema: z.ZodType<any> = z.object({
  type: z.enum(["and", "or"]), // 逻辑类型:与、或
  filters: z.array(z.union([comparisonFilterSchema, z.lazy(() => compoundFilterSchema)])), // 过滤器数组
})

// 文件搜索参数Schema定义
export const fileSearchArgsSchema = z.object({
  vectorStoreIds: z.array(z.string()), // 要搜索的向量存储ID列表
  maxNumResults: z.number().optional(), // 返回的最大搜索结果数(可选)
  ranking: z
    .object({
      ranker: z.string().optional(), // 排序器(可选)
      scoreThreshold: z.number().optional(), // 分数阈值(可选)
    })
    .optional(), // 排序选项(可选)
  filters: z.union([comparisonFilterSchema, compoundFilterSchema]).optional(), // 过滤器(可选)
})

// 文件搜索输出Schema定义
export const fileSearchOutputSchema = z.object({
  queries: z.array(z.string()), // 搜索查询列表
  results: z
    .array(
      z.object({
        attributes: z.record(z.string(), z.unknown()), // 文件属性:键值对集合
        fileId: z.string(), // 文件唯一ID
        filename: z.string(), // 文件名
        score: z.number(), // 相关性分数:0到1之间的值
        text: z.string(), // 从文件中检索的文本
      }),
    )
    .nullable(), // 可以为null
})

// 文件搜索工具工厂
// 创建具有输入和输出Schema的文件搜索工具
export const fileSearch = createProviderDefinedToolFactoryWithOutputSchema<
  {}, // 空输入类型
  {
    /**
     * 要执行的搜索查询。
     */
    queries: string[]

    /**
     * 文件搜索工具调用的结果。
     */
    results:
      | null
      | {
          /**
           * 可以附加到对象的16个键值对集合。
           * 这对于以结构化格式存储有关对象的附加信息,
           * 并通过API或仪表板查询对象非常有用。
           * 键是最大长度为64个字符的字符串。
           * 值是最大长度为512个字符的字符串、布尔值或数字。
           */
          attributes: Record<string, unknown>

          /**
           * 文件的唯一ID。
           */
          fileId: string

          /**
           * 文件的名称。
           */
          filename: string

          /**
           * 文件的相关性分数 - 0到1之间的值。
           */
          score: number

          /**
           * 从文件中检索的文本。
           */
          text: string
        }[]
  },
  {
    /**
     * 要搜索的向量存储ID列表。
     */
    vectorStoreIds: string[]

    /**
     * 要返回的最大搜索结果数。默认为10。
     */
    maxNumResults?: number

    /**
     * 搜索的排序选项。
     */
    ranking?: {
      /**
       * 用于文件搜索的排序器。
       */
      ranker?: string

      /**
       * 文件搜索的分数阈值,0到1之间的数字。
       * 接近1的数字将尝试仅返回最相关的结果,
       * 但可能返回较少的结果。
       */
      scoreThreshold?: number
    }

    /**
     * 要应用的过滤器。
     */
    filters?: OpenAIResponsesFileSearchToolComparisonFilter | OpenAIResponsesFileSearchToolCompoundFilter
  }
>({
  id: "openai.file_search", // 工具ID
  name: "file_search", // 工具名称
  inputSchema: z.object({}), // 输入Schema(空对象)
  outputSchema: fileSearchOutputSchema, // 输出Schema
})
