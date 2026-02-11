import type { Hooks, PluginInput, Plugin as PluginInstance } from "@opencode-ai/plugin"
import { createOpencodeClient } from "@opencode-ai/sdk"
import { BunProc } from "../bun"
import { Bus } from "../bus"
import { Config } from "../config/config"
import { Flag } from "../flag/flag"
import { Instance } from "../project/instance"
import { Server } from "../server/server"
import { Log } from "../util/log"

export namespace Plugin {
  const log = Log.create({ service: "plugin" })

  // 插件状态管理
  // 使用实例状态来管理插件的加载和初始化
  const state = Instance.state(async () => {
    // 创建OpenCode客户端,用于与插件系统通信
    const client = createOpencodeClient({
      baseUrl: "http://localhost:4096",
      // @ts-ignore - fetch类型不兼容
      fetch: async (...args) => Server.App().fetch(...args),
    })
    const config = await Config.get()
    const hooks = []
    // 构建插件输入对象,包含插件运行所需的所有上下文信息
    const input: PluginInput = {
      client, // OpenCode客户端实例
      project: Instance.project, // 项目信息
      worktree: Instance.worktree, // 工作树信息
      directory: Instance.directory, // 目录信息
      serverUrl: Server.url(), // 服务器URL
      $: Bun.$, // Bun命令执行器
    }
    // 获取配置中的插件列表
    const plugins = [...(config.plugin ?? [])]
    // 如果未禁用默认插件,添加默认插件
    if (!Flag.OPENCODE_DISABLE_DEFAULT_PLUGINS) {
      plugins.push("opencode-copilot-auth@0.0.9") // Copilot认证插件
      plugins.push("opencode-anthropic-auth@0.0.5") // Anthropic认证插件
    }
    // 加载所有插件
    for (let plugin of plugins) {
      log.info("loading plugin", { path: plugin })
      // 如果不是本地文件路径,需要安装插件
      if (!plugin.startsWith("file://")) {
        // 解析插件包名和版本
        const lastAtIndex = plugin.lastIndexOf("@")
        const pkg = lastAtIndex > 0 ? plugin.substring(0, lastAtIndex) : plugin
        const version = lastAtIndex > 0 ? plugin.substring(lastAtIndex + 1) : "latest"
        // 安装插件
        plugin = await BunProc.install(pkg, version)
      }
      // 导入插件模块
      const mod = await import(plugin)
      // 遍历模块中的所有插件导出
      for (const [_name, fn] of Object.entries<PluginInstance>(mod)) {
        // 初始化插件并获取钩子
        const init = await fn(input)
        hooks.push(init)
      }
    }

    return {
      hooks, // 插件钩子列表
      input, // 插件输入对象
    }
  })

  // 触发插件钩子函数
  // 根据钩子名称触发所有已注册插件中对应的钩子函数
  // 支持泛型类型推断,确保输入和输出的类型安全
  export async function trigger<
    Name extends Exclude<keyof Required<Hooks>, "auth" | "event" | "tool">,
    Input = Parameters<Required<Hooks>[Name]>[0],
    Output = Parameters<Required<Hooks>[Name]>[1],
  >(name: Name, input: Input, output: Output): Promise<Output> {
    if (!name) return output
    // 获取所有插件钩子
    for (const hook of await state().then((x) => x.hooks)) {
      const fn = hook[name]
      if (!fn) continue
      // @ts-expect-error 如果你想要冒险,请修复类型,如果放弃请增加try-counter
      // try-counter: 2
      // 调用插件钩子函数
      await fn(input, output)
    }
    return output
  }

  // 列出所有已加载的插件钩子
  export async function list() {
    return state().then((x) => x.hooks)
  }

  // 初始化插件系统
  // 调用所有插件的配置钩子,并订阅所有事件
  export async function init() {
    const hooks = await state().then((x) => x.hooks)
    const config = await Config.get()
    // 调用所有插件的配置钩子
    for (const hook of hooks) {
      // @ts-expect-error 这是因为我们还没有将插件迁移到SDK v2
      await hook.config?.(config)
    }
    // 订阅所有事件,将事件分发给所有插件
    Bus.subscribeAll(async (input) => {
      const hooks = await state().then((x) => x.hooks)
      for (const hook of hooks) {
        hook["event"]?.({
          event: input,
        })
      }
    })
  }
}
