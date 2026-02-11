import path from "path"
import z from "zod"
import { Flag } from "../flag/flag"
import { Global } from "../global"
import { Installation } from "../installation"
import { Log } from "../util/log"
import { data } from "./models-macro" with { type: "macro" }

export namespace ModelsDev {
  const log = Log.create({ service: "models.dev" }) // 创建日志记录器
  const filepath = path.join(Global.Path.cache, "models.json") // 模型数据文件路径

  // 模型Schema定义
  export const Model = z.object({
    id: z.string(), // 模型ID
    name: z.string(), // 模型名称
    family: z.string().optional(), // 模型系列(可选)
    release_date: z.string(), // 发布日期
    attachment: z.boolean(), // 是否支持附件
    reasoning: z.boolean(), // 是否支持推理
    temperature: z.boolean(), // 是否支持温度参数
    tool_call: z.boolean(), // 是否支持工具调用
    interleaved: z // 交错模式
      .union([
        z.literal(true), // true表示启用
        z
          .object({
            field: z.enum(["reasoning_content", "reasoning_details"]), // 字段:reasoning_content或reasoning_details
          })
          .strict(), // 严格模式
      ])
      .optional(), // 可选
    cost: z // 成本信息
      .object({
        input: z.number(), // 输入成本
        output: z.number(), // 输出成本
        cache_read: z.number().optional(), // 缓存读取成本(可选)
        cache_write: z.number().optional(), // 缓存写入成本(可选)
        context_over_200k: z // 超过200k上下文的成本
          .object({
            input: z.number(), // 输入成本
            output: z.number(), // 输出成本
            cache_read: z.number().optional(), // 缓存读取成本(可选)
            cache_write: z.number().optional(), // 缓存写入成本(可选)
          })
          .optional(), // 可选
      })
      .optional(), // 可选
    limit: z.object({
      // 限制信息
      context: z.number(), // 上下文限制
      output: z.number(), // 输出限制
    }),
    modalities: z // 模态信息
      .object({
        input: z.array(z.enum(["text", "audio", "image", "video", "pdf"])), // 输入模态:文本、音频、图像、视频、PDF
        output: z.array(z.enum(["text", "audio", "image", "video", "pdf"])), // 输出模态:文本、音频、图像、视频、PDF
      })
      .optional(), // 可选
    experimental: z.boolean().optional(), // 是否为实验性功能(可选)
    status: z.enum(["alpha", "beta", "deprecated"]).optional(), // 状态:alpha、beta或deprecated(可选)
    options: z.record(z.string(), z.any()), // 选项配置
    headers: z.record(z.string(), z.string()).optional(), // 请求头(可选)
    provider: z.object({ npm: z.string() }).optional(), // 提供者信息(可选)
    variants: z.record(z.string(), z.record(z.string(), z.any())).optional(), // 变体配置(可选)
  })
  export type Model = z.infer<typeof Model> // 模型类型

  // 提供者Schema定义
  export const Provider = z.object({
    api: z.string().optional(), // API地址(可选)
    name: z.string(), // 提供者名称
    env: z.array(z.string()), // 环境变量数组
    id: z.string(), // 提供者ID
    npm: z.string().optional(), // NPM包名(可选)
    models: z.record(z.string(), Model), // 模型映射表
  })

  export type Provider = z.infer<typeof Provider> // 提供者类型

  /**
   * 获取模型数据
   * @returns 提供者映射表
   */
  export async function get() {
    refresh() // 刷新模型数据
    const file = Bun.file(filepath) // 读取缓存文件
    const result = await file.json().catch(() => {}) // 尝试解析JSON,失败则返回空对象
    if (result) return result as Record<string, Provider> // 如果有结果则返回
    const json = await data() // 否则从宏数据获取
    return JSON.parse(json) as Record<string, Provider> // 解析JSON并返回
  }

  /**
   * 刷新模型数据
   * 从 models.dev API 获取最新的模型数据
   */
  export async function refresh() {
    if (Flag.OPENCODE_DISABLE_MODELS_FETCH) return // 如果禁用模型获取则直接返回
    const file = Bun.file(filepath) // 获取文件对象
    log.info("正在刷新", {
      // 记录刷新日志
      file,
    })
    const result = await fetch("https://models.dev/api.json", {
      // 获取模型数据
      headers: {
        "User-Agent": Installation.USER_AGENT, // 设置用户代理
      },
      signal: AbortSignal.timeout(10 * 1000), // 设置10秒超时
    }).catch((e) => {
      log.error("获取 models.dev 失败", {
        // 记录错误日志
        error: e,
      })
    })
    if (result && result.ok) await Bun.write(file, await result.text()) // 如果成功则写入文件
  }
}

// 每小时刷新一次模型数据
setInterval(() => ModelsDev.refresh(), 60 * 1000 * 60).unref() // 设置定时器,60分钟刷新一次,不阻止进程退出
