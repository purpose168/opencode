// 导入各种工具类
import { Flag } from "@/flag/flag" // 功能标志
import { Log } from "@/util/log" // 日志工具
import { type ToolDefinition } from "@opencode-ai/plugin" // 工具定义类型
import path from "path" // 路径处理模块
import z from "zod" // 数据验证库
import type { Agent } from "../agent/agent" // Agent类型定义
import { Config } from "../config/config" // 配置管理
import { Plugin } from "../plugin" // 插件管理
import { Instance } from "../project/instance" // 项目实例
import { BashTool } from "./bash" // Bash命令执行工具
import { BatchTool } from "./batch" // 批处理工具
import { CodeSearchTool } from "./codesearch" // 代码搜索工具
import { EditTool } from "./edit" // 文件编辑工具
import { GlobTool } from "./glob" // 文件模式匹配工具
import { GrepTool } from "./grep" // 文本搜索工具
import { InvalidTool } from "./invalid" // 无效工具
import { LspTool } from "./lsp" // 语言服务器协议工具
import { ReadTool } from "./read" // 文件读取工具
import { SkillTool } from "./skill" // 技能工具
import { TaskTool } from "./task" // 任务工具
import { TodoReadTool, TodoWriteTool } from "./todo" // 待办事项读写工具
import { Tool } from "./tool" // 工具基类
import { WebFetchTool } from "./webfetch" // 网页获取工具
import { WebSearchTool } from "./websearch" // 网络搜索工具
import { WriteTool } from "./write" // 文件写入工具

export namespace ToolRegistry {
  const log = Log.create({ service: "tool.registry" }) // 创建工具注册服务的日志记录器

  export const state = Instance.state(async () => {
    const custom = [] as Tool.Info[] // 自定义工具信息列表
    const glob = new Bun.Glob("tool/*.{js,ts}") // 创建文件模式匹配器，匹配tool目录下的js和ts文件

    // 遍历所有配置目录
    for (const dir of await Config.directories()) {
      // 扫描匹配的文件
      for await (const match of glob.scan({
        cwd: dir,
        absolute: true,
        followSymlinks: true,
        dot: true,
      })) {
        const namespace = path.basename(match, path.extname(match)) // 获取文件名作为命名空间
        const mod = await import(match) // 动态导入模块
        // 遍历模块中的工具定义
        for (const [id, def] of Object.entries<ToolDefinition>(mod)) {
          custom.push(fromPlugin(id === "default" ? namespace : `${namespace}_${id}`, def))
        }
      }
    }

    const plugins = await Plugin.list() // 获取所有插件列表
    for (const plugin of plugins) {
      // 遍历插件中的工具定义
      for (const [id, def] of Object.entries(plugin.tool ?? {})) {
        custom.push(fromPlugin(id, def))
      }
    }

    return { custom }
  })

  // 从插件定义创建工具信息
  function fromPlugin(id: string, def: ToolDefinition): Tool.Info {
    return {
      id,
      init: async () => ({
        parameters: z.object(def.args), // 参数验证schema
        description: def.description, // 工具描述
        execute: async (args, ctx) => {
          const result = await def.execute(args as any, ctx) // 执行工具逻辑
          return {
            title: "",
            output: result,
            metadata: {},
          }
        },
      }),
    }
  }

  // 注册工具
  export async function register(tool: Tool.Info) {
    const { custom } = await state()
    const idx = custom.findIndex((t) => t.id === tool.id)
    if (idx >= 0) {
      custom.splice(idx, 1, tool) // 替换已存在的工具
      return
    }
    custom.push(tool) // 添加新工具
  }

  // 获取所有工具
  async function all(): Promise<Tool.Info[]> {
    const custom = await state().then((x) => x.custom)
    const config = await Config.get()

    return [
      InvalidTool,
      BashTool,
      ReadTool,
      GlobTool,
      GrepTool,
      EditTool,
      WriteTool,
      TaskTool,
      WebFetchTool,
      TodoWriteTool,
      TodoReadTool,
      WebSearchTool,
      CodeSearchTool,
      SkillTool,
      ...(Flag.OPENCODE_EXPERIMENTAL_LSP_TOOL ? [LspTool] : []), // 根据实验性标志添加LSP工具
      ...(config.experimental?.batch_tool === true ? [BatchTool] : []), // 根据配置添加批处理工具
      ...custom,
    ]
  }

  // 获取所有工具ID
  export async function ids() {
    return all().then((x) => x.map((t) => t.id))
  }

  // 获取指定提供者的工具列表
  export async function tools(providerID: string, agent?: Agent.Info) {
    const tools = await all()
    const result = await Promise.all(
      tools
        .filter((t) => {
          // 为zen用户或通过启用标志启用网络搜索/代码搜索
          if (t.id === "codesearch" || t.id === "websearch") {
            return providerID === "opencode" || Flag.OPENCODE_ENABLE_EXA
          }
          return true
        })
        .map(async (t) => {
          using _ = log.time(t.id) // 记录工具初始化时间
          return {
            id: t.id,
            ...(await t.init({ agent })),
          }
        }),
    )
    return result
  }
}
