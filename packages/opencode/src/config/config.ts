import { BunProc } from "@/bun" // 导入Bun进程工具
import { Installation } from "@/installation" // 导入安装管理模块
import { NamedError } from "@opencode-ai/util/error" // 导入命名错误类
import fs from "fs/promises" // 导入文件系统Promise
import { type ParseError as JsoncParseError, parse as parseJsonc, printParseErrorCode } from "jsonc-parser" // 导入JSONC解析器
import os from "os" // 导入操作系统模块
import path from "path" // 导入路径模块
import { mergeDeep, pipe, unique } from "remeda" // 导入工具函数
import { pathToFileURL } from "url" // 导入URL工具
import z from "zod" // 导入zod验证库
import { Auth } from "../auth" // 导入认证模块
import { Flag } from "../flag/flag" // 导入标志模块
import { Global } from "../global" // 导入全局配置
import { LSPServer } from "../lsp/server" // 导入LSP服务器
import { Instance } from "../project/instance" // 导入实例管理模块
import { ModelsDev } from "../provider/models" // 导入模型开发工具
import { Filesystem } from "../util/filesystem" // 导入文件系统工具
import { lazy } from "../util/lazy" // 导入懒加载工具
import { Log } from "../util/log" // 导入日志工具
import { ConfigMarkdown } from "./markdown" // 导入Markdown配置解析器

// 配置命名空间
export namespace Config {
  const log = Log.create({ service: "config" }) // 创建配置日志

  // Custom merge function that concatenates plugin arrays instead of replacing them
  // 自定义合并函数,连接插件数组而不是替换它们
  function mergeConfigWithPlugins(target: Info, source: Info): Info {
    const merged = mergeDeep(target, source)
    // If both configs have plugin arrays, concatenate them instead of replacing
    // 如果两个配置都有插件数组,则连接它们而不是替换
    if (target.plugin && source.plugin) {
      const pluginSet = new Set([...target.plugin, ...source.plugin])
      merged.plugin = Array.from(pluginSet)
    }
    return merged
  }

  // 配置状态
  export const state = Instance.state(async () => {
    const auth = await Auth.all() // 获取所有认证信息
    let result = await global() // 获取全局配置

    // Override with custom config if provided
    // 如果提供了自定义配置,则覆盖
    if (Flag.OPENCODE_CONFIG) {
      result = mergeConfigWithPlugins(result, await loadFile(Flag.OPENCODE_CONFIG))
      log.debug("已加载自定义配置", { path: Flag.OPENCODE_CONFIG })
    }

    for (const file of ["opencode.jsonc", "opencode.json"]) {
      const found = await Filesystem.findUp(file, Instance.directory, Instance.worktree)
      for (const resolved of found.toReversed()) {
        result = mergeConfigWithPlugins(result, await loadFile(resolved))
      }
    }

    if (Flag.OPENCODE_CONFIG_CONTENT) {
      result = mergeConfigWithPlugins(result, JSON.parse(Flag.OPENCODE_CONFIG_CONTENT))
      log.debug("已从OPENCODE_CONFIG_CONTENT加载自定义配置")
    }

    for (const [key, value] of Object.entries(auth)) {
      if (value.type === "wellknown") {
        process.env[value.key] = value.token
        const wellknown = (await fetch(`${key}/.well-known/opencode`).then((x) => x.json())) as any
        result = mergeConfigWithPlugins(result, await load(JSON.stringify(wellknown.config ?? {}), process.cwd()))
      }
    }

    result.agent = result.agent || {}
    result.mode = result.mode || {}
    result.plugin = result.plugin || []

    const directories = [
      Global.Path.config,
      ...(await Array.fromAsync(
        Filesystem.up({
          targets: [".opencode"],
          start: Instance.directory,
          stop: Instance.worktree,
        }),
      )),
      ...(await Array.fromAsync(
        Filesystem.up({
          targets: [".opencode"],
          start: Global.Path.home,
          stop: Global.Path.home,
        }),
      )),
    ]

    if (Flag.OPENCODE_CONFIG_DIR) {
      directories.push(Flag.OPENCODE_CONFIG_DIR)
      log.debug("正在从OPENCODE_CONFIG_DIR加载配置", { path: Flag.OPENCODE_CONFIG_DIR })
    }

    for (const dir of unique(directories)) {
      if (dir.endsWith(".opencode") || dir === Flag.OPENCODE_CONFIG_DIR) {
        for (const file of ["opencode.jsonc", "opencode.json"]) {
          log.debug(`正在从${path.join(dir, file)}加载配置`)
          result = mergeConfigWithPlugins(result, await loadFile(path.join(dir, file)))
          // to satisfy the type checker
          result.agent ??= {}
          result.mode ??= {}
          result.plugin ??= []
        }
      }

      installDependencies(dir)
      result.command = mergeDeep(result.command ?? {}, await loadCommand(dir))
      result.agent = mergeDeep(result.agent, await loadAgent(dir))
      result.agent = mergeDeep(result.agent, await loadMode(dir))
      result.plugin.push(...(await loadPlugin(dir)))
    }

    // Migrate deprecated mode field to agent field
    // 将已弃用的mode字段迁移到agent字段
    for (const [name, mode] of Object.entries(result.mode)) {
      result.agent = mergeDeep(result.agent ?? {}, {
        [name]: {
          ...mode,
          mode: "primary" as const,
        },
      })
    }

    if (Flag.OPENCODE_PERMISSION) {
      result.permission = mergeDeep(result.permission ?? {}, JSON.parse(Flag.OPENCODE_PERMISSION))
    }

    // Backwards compatibility: legacy top-level `tools` config
    // 向后兼容: 旧版顶级`tools`配置
    if (result.tools) {
      const perms: Record<string, Config.PermissionAction> = {}
      for (const [tool, enabled] of Object.entries(result.tools)) {
        const action: Config.PermissionAction = enabled ? "allow" : "deny"
        if (tool === "write" || tool === "edit" || tool === "patch" || tool === "multiedit") {
          perms.edit = action
          continue
        }
        perms[tool] = action
      }
      result.permission = mergeDeep(perms, result.permission ?? {})
    }

    if (!result.username) result.username = os.userInfo().username

    // Handle migration from autoshare to share field
    // 处理从autoshare到share字段的迁移
    if (result.autoshare === true && !result.share) {
      result.share = "auto"
    }

    if (!result.keybinds) result.keybinds = Info.shape.keybinds.parse({})

    // Apply flag overrides for compaction settings
    // 应用标志覆盖压缩设置
    if (Flag.OPENCODE_DISABLE_AUTOCOMPACT) {
      result.compaction = { ...result.compaction, auto: false }
    }
    if (Flag.OPENCODE_DISABLE_PRUNE) {
      result.compaction = { ...result.compaction, prune: false }
    }

    return {
      config: result,
      directories,
    }
  })

  // 安装依赖
  async function installDependencies(dir: string) {
    if (Installation.isLocal()) return // 如果是本地安装,直接返回

    const pkg = path.join(dir, "package.json") // package.json路径

    if (!(await Bun.file(pkg).exists())) {
      await Bun.write(pkg, "{}") // 如果不存在,创建空文件
    }

    const gitignore = path.join(dir, ".gitignore") // .gitignore路径
    const hasGitIgnore = await Bun.file(gitignore).exists()
    if (!hasGitIgnore) await Bun.write(gitignore, ["node_modules", "package.json", "bun.lock", ".gitignore"].join("\n"))

    await BunProc.run(
      ["add", "@opencode-ai/plugin@" + (Installation.isLocal() ? "latest" : Installation.VERSION), "--exact"],
      {
        cwd: dir,
      },
    ).catch(() => {})

    // Install any additional dependencies defined in the package.json
    // This allows local plugins and custom tools to use external packages
    // 安装package.json中定义的任何额外依赖
    // 这允许本地插件和自定义工具使用外部包
    await BunProc.run(["install"], { cwd: dir }).catch(() => {})
  }

  const COMMAND_GLOB = new Bun.Glob("{command,commands}/**/*.md")
  // 加载命令
  async function loadCommand(dir: string) {
    const result: Record<string, Command> = {}
    for await (const item of COMMAND_GLOB.scan({
      absolute: true,
      followSymlinks: true,
      dot: true,
      cwd: dir,
    })) {
      const md = await ConfigMarkdown.parse(item)
      if (!md.data) continue

      const name = (() => {
        const patterns = ["/.opencode/command/", "/command/"]
        const pattern = patterns.find((p) => item.includes(p))

        if (pattern) {
          const index = item.indexOf(pattern)
          return item.slice(index + pattern.length, -3)
        }
        return path.basename(item, ".md")
      })()

      const config = {
        name,
        ...md.data,
        template: md.content.trim(),
      }
      const parsed = Command.safeParse(config)
      if (parsed.success) {
        result[config.name] = parsed.data
        continue
      }
      throw new InvalidError({ path: item, issues: parsed.error.issues }, { cause: parsed.error })
    }
    return result
  }

  const AGENT_GLOB = new Bun.Glob("{agent,agents}/**/*.md")
  // 加载智能体配置
  async function loadAgent(dir: string) {
    const result: Record<string, Agent> = {}

    for await (const item of AGENT_GLOB.scan({
      absolute: true,
      followSymlinks: true,
      dot: true,
      cwd: dir,
    })) {
      const md = await ConfigMarkdown.parse(item)
      if (!md.data) continue

      // Extract relative path from agent folder for nested agents
      // 从智能体文件夹提取嵌套智能体的相对路径
      let agentName = path.basename(item, ".md")
      const agentFolderPath = item.includes("/.opencode/agent/")
        ? item.split("/.opencode/agent/")[1]
        : item.includes("/agent/")
          ? item.split("/agent/")[1]
          : agentName + ".md"

      // If agent is in a subfolder, include folder path in name
      // 如果智能体在子文件夹中,则在名称中包含文件夹路径
      if (agentFolderPath.includes("/")) {
        const relativePath = agentFolderPath.replace(".md", "")
        const pathParts = relativePath.split("/")
        agentName = pathParts.slice(0, -1).join("/") + "/" + pathParts[pathParts.length - 1]
      }

      const config = {
        name: agentName,
        ...md.data,
        prompt: md.content.trim(),
      }
      const parsed = Agent.safeParse(config)
      if (parsed.success) {
        result[config.name] = parsed.data
        continue
      }
      throw new InvalidError({ path: item, issues: parsed.error.issues }, { cause: parsed.error })
    }
    return result
  }

  const MODE_GLOB = new Bun.Glob("{mode,modes}/*.md")
  async function loadMode(dir: string) {
    const result: Record<string, Agent> = {}
    for await (const item of MODE_GLOB.scan({
      absolute: true,
      followSymlinks: true,
      dot: true,
      cwd: dir,
    })) {
      const md = await ConfigMarkdown.parse(item)
      if (!md.data) continue

      const config = {
        name: path.basename(item, ".md"),
        ...md.data,
        prompt: md.content.trim(),
      }
      const parsed = Agent.safeParse(config)
      if (parsed.success) {
        result[config.name] = {
          ...parsed.data,
          mode: "primary" as const,
        }
        continue
      }
    }
    return result
  }

  const PLUGIN_GLOB = new Bun.Glob("{plugin,plugins}/*.{ts,js}")
  async function loadPlugin(dir: string) {
    const plugins: string[] = []

    for await (const item of PLUGIN_GLOB.scan({
      absolute: true,
      followSymlinks: true,
      dot: true,
      cwd: dir,
    })) {
      plugins.push(pathToFileURL(item).href)
    }
    return plugins
  }

  export const McpLocal = z
    .object({
      type: z.literal("local").describe("MCP服务器连接类型"),
      command: z.string().array().describe("运行MCP服务器的命令和参数"),
      environment: z.record(z.string(), z.string()).optional().describe("运行MCP服务器时设置的环境变量"),
      enabled: z.boolean().optional().describe("启动时启用或禁用MCP服务器"),
      timeout: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("从MCP服务器获取工具的超时时间(毫秒)。如果未指定,默认为5000(5秒)。"),
    })
    .strict()
    .meta({
      ref: "McpLocalConfig",
    })

  export const McpOAuth = z
    .object({
      clientId: z.string().optional().describe("OAuth客户端ID。如果未提供,将尝试动态客户端注册(RFC 7591)。"),
      clientSecret: z.string().optional().describe("OAuth客户端密钥(如果授权服务器需要)"),
      scope: z.string().optional().describe("授权期间请求的OAuth范围"),
    })
    .strict()
    .meta({
      ref: "McpOAuthConfig",
    })
  export type McpOAuth = z.infer<typeof McpOAuth>

  export const McpRemote = z
    .object({
      type: z.literal("remote").describe("MCP服务器连接类型"),
      url: z.string().describe("远程MCP服务器的URL"),
      enabled: z.boolean().optional().describe("启动时启用或禁用MCP服务器"),
      headers: z.record(z.string(), z.string()).optional().describe("随请求发送的标头"),
      oauth: z
        .union([McpOAuth, z.literal(false)])
        .optional()
        .describe("MCP服务器的OAuth身份验证配置。设置为false以禁用OAuth自动检测。"),
      timeout: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("从MCP服务器获取工具的超时时间(毫秒)。如果未指定,默认为5000(5秒)。"),
    })
    .strict()
    .meta({
      ref: "McpRemoteConfig",
    })

  export const Mcp = z.discriminatedUnion("type", [McpLocal, McpRemote])
  export type Mcp = z.infer<typeof Mcp>

  export const PermissionAction = z.enum(["ask", "allow", "deny"]).meta({
    ref: "PermissionActionConfig",
  })
  export type PermissionAction = z.infer<typeof PermissionAction>

  export const PermissionObject = z.record(z.string(), PermissionAction).meta({
    ref: "PermissionObjectConfig",
  })
  export type PermissionObject = z.infer<typeof PermissionObject>

  export const PermissionRule = z.union([PermissionAction, PermissionObject]).meta({
    ref: "PermissionRuleConfig",
  })
  export type PermissionRule = z.infer<typeof PermissionRule>

  export const Permission = z
    .object({
      read: PermissionRule.optional(),
      edit: PermissionRule.optional(),
      glob: PermissionRule.optional(),
      grep: PermissionRule.optional(),
      list: PermissionRule.optional(),
      bash: PermissionRule.optional(),
      task: PermissionRule.optional(),
      external_directory: PermissionRule.optional(),
      todowrite: PermissionAction.optional(),
      todoread: PermissionAction.optional(),
      webfetch: PermissionAction.optional(),
      websearch: PermissionAction.optional(),
      codesearch: PermissionAction.optional(),
      lsp: PermissionRule.optional(),
      doom_loop: PermissionAction.optional(),
    })
    .catchall(PermissionRule)
    .or(PermissionAction)
    .transform((x) => (typeof x === "string" ? { "*": x } : x))
    .meta({
      ref: "PermissionConfig",
    })
  export type Permission = z.infer<typeof Permission>

  export const Command = z.object({
    template: z.string(),
    description: z.string().optional(),
    agent: z.string().optional(),
    model: z.string().optional(),
    subtask: z.boolean().optional(),
  })
  export type Command = z.infer<typeof Command>

  export const Agent = z
    .object({
      model: z.string().optional(),
      temperature: z.number().optional(),
      top_p: z.number().optional(),
      prompt: z.string().optional(),
      tools: z.record(z.string(), z.boolean()).optional().describe("@deprecated 使用'permission'字段代替"),
      disable: z.boolean().optional(),
      description: z.string().optional().describe("智能体使用时机描述"),
      mode: z.enum(["subagent", "primary", "all"]).optional(),
      options: z.record(z.string(), z.any()).optional(),
      color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color format")
        .optional()
        .describe("智能体的十六进制颜色代码(例如,#FF5733)"),
      steps: z.number().int().positive().optional().describe("强制纯文本响应前的最大智能体迭代次数"),
      maxSteps: z.number().int().positive().optional().describe("@deprecated 使用'steps'字段代替。"),
      permission: Permission.optional(),
    })
    .catchall(z.any())
    .transform((agent, ctx) => {
      const knownKeys = new Set([
        "model",
        "prompt",
        "description",
        "temperature",
        "top_p",
        "mode",
        "color",
        "steps",
        "maxSteps",
        "options",
        "permission",
        "disable",
        "tools",
      ])

      // Extract unknown properties into options
      const options: Record<string, unknown> = { ...agent.options }
      for (const [key, value] of Object.entries(agent)) {
        if (!knownKeys.has(key)) options[key] = value
      }

      // Convert legacy tools config to permissions
      const permission: Permission = { ...agent.permission }
      for (const [tool, enabled] of Object.entries(agent.tools ?? {})) {
        const action = enabled ? "allow" : "deny"
        // write, edit, patch, multiedit all map to edit permission
        if (tool === "write" || tool === "edit" || tool === "patch" || tool === "multiedit") {
          permission.edit = action
        } else {
          permission[tool] = action
        }
      }

      // Convert legacy maxSteps to steps
      const steps = agent.steps ?? agent.maxSteps

      return { ...agent, options, permission, steps } as typeof agent & {
        options?: Record<string, unknown>
        permission?: Permission
        steps?: number
      }
    })
    .meta({
      ref: "AgentConfig",
    })
  export type Agent = z.infer<typeof Agent>

  export const Keybinds = z
    .object({
      leader: z.string().optional().default("ctrl+x").describe("键绑定组合的前导键"),
      app_exit: z.string().optional().default("ctrl+c,ctrl+d,<leader>q").describe("退出应用程序"),
      editor_open: z.string().optional().default("<leader>e").describe("打开外部编辑器"),
      theme_list: z.string().optional().default("<leader>t").describe("列出可用主题"),
      sidebar_toggle: z.string().optional().default("<leader>b").describe("切换侧边栏"),
      scrollbar_toggle: z.string().optional().default("none").describe("切换会话滚动条"),
      username_toggle: z.string().optional().default("none").describe("切换用户名可见性"),
      status_view: z.string().optional().default("<leader>s").describe("查看状态"),
      session_export: z.string().optional().default("<leader>x").describe("将会话导出到编辑器"),
      session_new: z.string().optional().default("<leader>n").describe("创建新会话"),
      session_list: z.string().optional().default("<leader>l").describe("列出所有会话"),
      session_timeline: z.string().optional().default("<leader>g").describe("显示会话时间线"),
      session_fork: z.string().optional().default("none").describe("从消息分叉会话"),
      session_rename: z.string().optional().default("none").describe("重命名会话"),
      session_share: z.string().optional().default("none").describe("共享当前会话"),
      session_unshare: z.string().optional().default("none").describe("取消共享当前会话"),
      session_interrupt: z.string().optional().default("escape").describe("中断当前会话"),
      session_compact: z.string().optional().default("<leader>c").describe("压缩会话"),
      messages_page_up: z.string().optional().default("pageup").describe("向上滚动一页消息"),
      messages_page_down: z.string().optional().default("pagedown").describe("向下滚动一页消息"),
      messages_half_page_up: z.string().optional().default("ctrl+alt+u").describe("向上滚动半页消息"),
      messages_half_page_down: z.string().optional().default("ctrl+alt+d").describe("向下滚动半页消息"),
      messages_first: z.string().optional().default("ctrl+g,home").describe("导航到第一条消息"),
      messages_last: z.string().optional().default("ctrl+alt+g,end").describe("导航到最后一条消息"),
      messages_next: z.string().optional().default("none").describe("导航到下一条消息"),
      messages_previous: z.string().optional().default("none").describe("导航到上一条消息"),
      messages_last_user: z.string().optional().default("none").describe("导航到最后一条用户消息"),
      messages_copy: z.string().optional().default("<leader>y").describe("复制消息"),
      messages_undo: z.string().optional().default("<leader>u").describe("撤销消息"),
      messages_redo: z.string().optional().default("<leader>r").describe("重做消息"),
      messages_toggle_conceal: z.string().optional().default("<leader>h").describe("切换消息中的代码块隐藏"),
      tool_details: z.string().optional().default("none").describe("切换工具详情可见性"),
      model_list: z.string().optional().default("<leader>m").describe("列出可用模型"),
      model_cycle_recent: z.string().optional().default("f2").describe("下一个最近使用的模型"),
      model_cycle_recent_reverse: z.string().optional().default("shift+f2").describe("上一个最近使用的模型"),
      model_cycle_favorite: z.string().optional().default("none").describe("下一个收藏模型"),
      model_cycle_favorite_reverse: z.string().optional().default("none").describe("上一个收藏模型"),
      command_list: z.string().optional().default("ctrl+p").describe("列出可用命令"),
      agent_list: z.string().optional().default("<leader>a").describe("列出智能体"),
      agent_cycle: z.string().optional().default("tab").describe("下一个智能体"),
      agent_cycle_reverse: z.string().optional().default("shift+tab").describe("上一个智能体"),
      variant_cycle: z.string().optional().default("ctrl+t").describe("循环模型变体"),
      input_clear: z.string().optional().default("ctrl+c").describe("清除输入字段"),
      input_paste: z.string().optional().default("ctrl+v").describe("从剪贴板粘贴"),
      input_submit: z.string().optional().default("return").describe("提交输入"),
      input_newline: z
        .string()
        .optional()
        .default("shift+return,ctrl+return,alt+return,ctrl+j")
        .describe("在输入中插入换行符"),
      input_move_left: z.string().optional().default("left,ctrl+b").describe("在输入中向左移动光标"),
      input_move_right: z.string().optional().default("right,ctrl+f").describe("在输入中向右移动光标"),
      input_move_up: z.string().optional().default("up").describe("在输入中向上移动光标"),
      input_move_down: z.string().optional().default("down").describe("在输入中向下移动光标"),
      input_select_left: z.string().optional().default("shift+left").describe("在输入中向左选择"),
      input_select_right: z.string().optional().default("shift+right").describe("在输入中向右选择"),
      input_select_up: z.string().optional().default("shift+up").describe("在输入中向上选择"),
      input_select_down: z.string().optional().default("shift+down").describe("在输入中向下选择"),
      input_line_home: z.string().optional().default("ctrl+a").describe("在输入中移动到行首"),
      input_line_end: z.string().optional().default("ctrl+e").describe("在输入中移动到行尾"),
      input_select_line_home: z.string().optional().default("ctrl+shift+a").describe("在输入中选择到行首"),
      input_select_line_end: z.string().optional().default("ctrl+shift+e").describe("在输入中选择到行尾"),
      input_visual_line_home: z.string().optional().default("alt+a").describe("在输入中移动到可视行首"),
      input_visual_line_end: z.string().optional().default("alt+e").describe("在输入中移动到可视行尾"),
      input_select_visual_line_home: z.string().optional().default("alt+shift+a").describe("在输入中选择到可视行首"),
      input_select_visual_line_end: z.string().optional().default("alt+shift+e").describe("在输入中选择到可视行尾"),
      input_buffer_home: z.string().optional().default("home").describe("在输入中移动到缓冲区首"),
      input_buffer_end: z.string().optional().default("end").describe("在输入中移动到缓冲区尾"),
      input_select_buffer_home: z.string().optional().default("shift+home").describe("在输入中选择到缓冲区首"),
      input_select_buffer_end: z.string().optional().default("shift+end").describe("在输入中选择到缓冲区尾"),
      input_delete_line: z.string().optional().default("ctrl+shift+d").describe("在输入中删除行"),
      input_delete_to_line_end: z.string().optional().default("ctrl+k").describe("在输入中删除到行尾"),
      input_delete_to_line_start: z.string().optional().default("ctrl+u").describe("在输入中删除到行首"),
      input_backspace: z.string().optional().default("backspace,shift+backspace").describe("在输入中退格"),
      input_delete: z.string().optional().default("ctrl+d,delete,shift+delete").describe("在输入中删除字符"),
      input_undo: z.string().optional().default("ctrl+-,super+z").describe("在输入中撤销"),
      input_redo: z.string().optional().default("ctrl+.,super+shift+z").describe("在输入中重做"),
      input_word_forward: z.string().optional().default("alt+f,alt+right,ctrl+right").describe("在输入中向前移动单词"),
      input_word_backward: z.string().optional().default("alt+b,alt+left,ctrl+left").describe("在输入中向后移动单词"),
      input_select_word_forward: z
        .string()
        .optional()
        .default("alt+shift+f,alt+shift+right")
        .describe("在输入中向前选择单词"),
      input_select_word_backward: z
        .string()
        .optional()
        .default("alt+shift+b,alt+shift+left")
        .describe("在输入中向后选择单词"),
      input_delete_word_forward: z
        .string()
        .optional()
        .default("alt+d,alt+delete,ctrl+delete")
        .describe("在输入中向前删除单词"),
      input_delete_word_backward: z
        .string()
        .optional()
        .default("ctrl+w,ctrl+backspace,alt+backspace")
        .describe("在输入中向后删除单词"),
      history_previous: z.string().optional().default("up").describe("上一条历史记录"),
      history_next: z.string().optional().default("down").describe("下一条历史记录"),
      session_child_cycle: z.string().optional().default("<leader>right").describe("下一个子会话"),
      session_child_cycle_reverse: z.string().optional().default("<leader>left").describe("上一个子会话"),
      session_parent: z.string().optional().default("<leader>up").describe("转到父会话"),
      terminal_suspend: z.string().optional().default("ctrl+z").describe("挂起终端"),
      terminal_title_toggle: z.string().optional().default("none").describe("切换终端标题"),
      tips_toggle: z.string().optional().default("<leader>h").describe("在主屏幕上切换提示"),
    })
    .strict()
    .meta({
      ref: "KeybindsConfig",
    })

  export const TUI = z.object({
    scroll_speed: z.number().min(0.001).optional().describe("TUI滚动速度"),
    scroll_acceleration: z
      .object({
        enabled: z.boolean().describe("启用滚动加速"),
      })
      .optional()
      .describe("滚动加速设置"),
    diff_style: z
      .enum(["auto", "stacked"])
      .optional()
      .describe("控制差异渲染样式:'auto'适应终端宽度,'stacked'始终显示单列"),
  })

  export const Server = z
    .object({
      port: z.number().int().positive().optional().describe("监听端口"),
      hostname: z.string().optional().describe("监听主机名"),
      mdns: z.boolean().optional().describe("启用mDNS服务发现"),
      cors: z.array(z.string()).optional().describe("允许CORS的额外域名"),
    })
    .strict()
    .meta({
      ref: "ServerConfig",
    })

  export const Layout = z.enum(["auto", "stretch"]).meta({
    ref: "LayoutConfig",
  })
  export type Layout = z.infer<typeof Layout>

  export const Provider = ModelsDev.Provider.partial()
    .extend({
      whitelist: z.array(z.string()).optional(),
      blacklist: z.array(z.string()).optional(),
      models: z
        .record(
          z.string(),
          ModelsDev.Model.partial().extend({
            variants: z
              .record(
                z.string(),
                z
                  .object({
                    disabled: z.boolean().optional().describe("禁用此模型的此变体"),
                  })
                  .catchall(z.any()),
              )
              .optional()
              .describe("特定变体的配置"),
          }),
        )
        .optional(),
      options: z
        .object({
          apiKey: z.string().optional(),
          baseURL: z.string().optional(),
          enterpriseUrl: z.string().optional().describe("用于copilot身份验证的GitHub企业URL"),
          setCacheKey: z.boolean().optional().describe("为此提供者启用promptCacheKey(默认false)"),
          timeout: z
            .union([
              z
                .number()
                .int()
                .positive()
                .describe("请求此提供者的超时时间(毫秒)。默认为300000(5分钟)。设置为false以禁用超时。"),
              z.literal(false).describe("完全禁用此提供者的超时。"),
            ])
            .optional()
            .describe("请求此提供者的超时时间(毫秒)。默认为300000(5分钟)。设置为false以禁用超时。"),
        })
        .catchall(z.any())
        .optional(),
    })
    .strict()
    .meta({
      ref: "ProviderConfig",
    })
  export type Provider = z.infer<typeof Provider>

  export const Info = z
    .object({
      $schema: z.string().optional().describe("配置验证的JSON架构引用"),
      theme: z.string().optional().describe("界面使用的主题名称"),
      keybinds: Keybinds.optional().describe("自定义键绑定配置"),
      logLevel: Log.Level.optional().describe("日志级别"),
      tui: TUI.optional().describe("TUI特定设置"),
      server: Server.optional().describe("opencode serve和web命令的服务器配置"),
      command: z.record(z.string(), Command).optional().describe("命令配置,参见https://opencode.ai/docs/commands"),
      watcher: z
        .object({
          ignore: z.array(z.string()).optional(),
        })
        .optional(),
      plugin: z.string().array().optional(),
      snapshot: z.boolean().optional(),
      share: z
        .enum(["manual", "auto", "disabled"])
        .optional()
        .describe("控制共享行为:'manual'允许通过命令手动共享,'auto'启用自动共享,'disabled'禁用所有共享"),
      autoshare: z.boolean().optional().describe("@deprecated 使用'share'字段代替。自动共享新创建的会话"),
      autoupdate: z
        .union([z.boolean(), z.literal("notify")])
        .optional()
        .describe("自动更新到最新版本。设置为true以自动更新,false以禁用,或'notify'以显示更新通知"),
      disabled_providers: z.array(z.string()).optional().describe("禁用自动加载的提供者"),
      enabled_providers: z.array(z.string()).optional().describe("设置后,仅启用这些提供者。所有其他提供者将被忽略"),
      model: z.string().describe("要使用的模型,格式为provider/model,例如anthropic/claude-2").optional(),
      small_model: z.string().describe("用于标题生成等任务的小模型,格式为provider/model").optional(),
      default_agent: z
        .string()
        .optional()
        .describe("未指定时使用的默认智能体。必须是主要智能体。如果未设置或指定的智能体无效,则回退到'build'。"),
      username: z.string().optional().describe("在对话中显示的自定义用户名,而不是系统用户名"),
      mode: z
        .object({
          build: Agent.optional(),
          plan: Agent.optional(),
        })
        .catchall(Agent)
        .optional()
        .describe("@deprecated 使用`agent`字段代替。"),
      agent: z
        .object({
          // primary
          plan: Agent.optional(),
          build: Agent.optional(),
          // subagent
          general: Agent.optional(),
          explore: Agent.optional(),
          // specialized
          title: Agent.optional(),
          summary: Agent.optional(),
          compaction: Agent.optional(),
        })
        .catchall(Agent)
        .optional()
        .describe("智能体配置,参见https://opencode.ai/docs/agent"),
      provider: z.record(z.string(), Provider).optional().describe("自定义提供者配置和模型覆盖"),
      mcp: z.record(z.string(), Mcp).optional().describe("MCP(模型上下文协议)服务器配置"),
      formatter: z
        .union([
          z.literal(false),
          z.record(
            z.string(),
            z.object({
              disabled: z.boolean().optional(),
              command: z.array(z.string()).optional(),
              environment: z.record(z.string(), z.string()).optional(),
              extensions: z.array(z.string()).optional(),
            }),
          ),
        ])
        .optional(),
      lsp: z
        .union([
          z.literal(false),
          z.record(
            z.string(),
            z.union([
              z.object({
                disabled: z.literal(true),
              }),
              z.object({
                command: z.array(z.string()),
                extensions: z.array(z.string()).optional(),
                disabled: z.boolean().optional(),
                env: z.record(z.string(), z.string()).optional(),
                initialization: z.record(z.string(), z.any()).optional(),
              }),
            ]),
          ),
        ])
        .optional()
        .refine(
          (data) => {
            if (!data) return true
            if (typeof data === "boolean") return true
            const serverIds = new Set(Object.values(LSPServer).map((s) => s.id))

            return Object.entries(data).every(([id, config]) => {
              if (config.disabled) return true
              if (serverIds.has(id)) return true
              return Boolean(config.extensions)
            })
          },
          {
            error: "对于自定义LSP服务器,'extensions'数组是必需的。",
          },
        ),
      instructions: z.array(z.string()).optional().describe("要包含的其他指令文件或模式"),
      layout: Layout.optional().describe("@deprecated 始终使用stretch布局。"),
      permission: Permission.optional(),
      tools: z.record(z.string(), z.boolean()).optional(),
      enterprise: z
        .object({
          url: z.string().optional().describe("企业URL"),
        })
        .optional(),
      compaction: z
        .object({
          auto: z.boolean().optional().describe("上下文已满时启用自动压缩(默认:true)"),
          prune: z.boolean().optional().describe("启用修剪旧工具输出(默认:true)"),
        })
        .optional(),
      experimental: z
        .object({
          hook: z
            .object({
              file_edited: z
                .record(
                  z.string(),
                  z
                    .object({
                      command: z.string().array(),
                      environment: z.record(z.string(), z.string()).optional(),
                    })
                    .array(),
                )
                .optional(),
              session_completed: z
                .object({
                  command: z.string().array(),
                  environment: z.record(z.string(), z.string()).optional(),
                })
                .array()
                .optional(),
            })
            .optional(),
          chatMaxRetries: z.number().optional().describe("聊天完成失败时的重试次数"),
          disable_paste_summary: z.boolean().optional(),
          batch_tool: z.boolean().optional().describe("启用批量工具"),
          openTelemetry: z
            .boolean()
            .optional()
            .describe("为AI SDK调用启用OpenTelemetry跟踪(使用'experimental_telemetry'标志)"),
          primary_tools: z.array(z.string()).optional().describe("仅对主要智能体可用的工具。"),
          continue_loop_on_deny: z.boolean().optional().describe("当工具调用被拒绝时继续智能体循环"),
          mcp_timeout: z.number().int().positive().optional().describe("模型上下文协议(MCP)请求的超时时间(毫秒)"),
        })
        .optional(),
    })
    .strict()
    .meta({
      ref: "Config",
    })

  export type Info = z.output<typeof Info>

  // 全局配置
  export const global = lazy(async () => {
    let result: Info = pipe(
      {},
      mergeDeep(await loadFile(path.join(Global.Path.config, "config.json"))),
      mergeDeep(await loadFile(path.join(Global.Path.config, "opencode.json"))),
      mergeDeep(await loadFile(path.join(Global.Path.config, "opencode.jsonc"))),
    )

    await import(path.join(Global.Path.config, "config"), {
      with: {
        type: "toml",
      },
    })
      .then(async (mod) => {
        const { provider, model, ...rest } = mod.default
        if (provider && model) result.model = `${provider}/${model}`
        result["$schema"] = "https://opencode.ai/config.json"
        result = mergeDeep(result, rest)
        await Bun.write(path.join(Global.Path.config, "config.json"), JSON.stringify(result, null, 2))
        await fs.unlink(path.join(Global.Path.config, "config"))
      })
      .catch(() => {})

    return result
  })

  async function loadFile(filepath: string): Promise<Info> {
    log.info("正在加载", { path: filepath })
    let text = await Bun.file(filepath)
      .text()
      .catch((err) => {
        if (err.code === "ENOENT") return
        throw new JsonError({ path: filepath }, { cause: err })
      })
    if (!text) return {}
    return load(text, filepath)
  }

  // 加载配置
  async function load(text: string, configFilepath: string) {
    text = text.replace(/\{env:([^}]+)\}/g, (_, varName) => {
      return process.env[varName] || ""
    })

    const fileMatches = text.match(/\{file:[^}]+\}/g)
    if (fileMatches) {
      const configDir = path.dirname(configFilepath)
      const lines = text.split("\n")

      for (const match of fileMatches) {
        const lineIndex = lines.findIndex((line) => line.includes(match))
        if (lineIndex !== -1 && lines[lineIndex].trim().startsWith("//")) {
          continue // Skip if line is commented
        }
        let filePath = match.replace(/^\{file:/, "").replace(/\}$/, "")
        if (filePath.startsWith("~/")) {
          filePath = path.join(os.homedir(), filePath.slice(2))
        }
        const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(configDir, filePath)
        const fileContent = (
          await Bun.file(resolvedPath)
            .text()
            .catch((error) => {
              const errMsg = `错误的文件引用: "${match}"`
              if (error.code === "ENOENT") {
                throw new InvalidError(
                  {
                    path: configFilepath,
                    message: errMsg + ` ${resolvedPath} 不存在`,
                  },
                  { cause: error },
                )
              }
              throw new InvalidError({ path: configFilepath, message: errMsg }, { cause: error })
            })
        ).trim()
        // escape newlines/quotes, strip outer quotes
        // 转义换行符/引号,去除外部引号
        text = text.replace(match, JSON.stringify(fileContent).slice(1, -1))
      }
    }

    const errors: JsoncParseError[] = []
    const data = parseJsonc(text, errors, { allowTrailingComma: true })
    if (errors.length) {
      const lines = text.split("\n")
      const errorDetails = errors
        .map((e) => {
          const beforeOffset = text.substring(0, e.offset).split("\n")
          const line = beforeOffset.length
          const column = beforeOffset[beforeOffset.length - 1].length + 1
          const problemLine = lines[line - 1]

          const error = `${printParseErrorCode(e.error)} at line ${line}, column ${column}`
          if (!problemLine) return error

          return `${error}\n   Line ${line}: ${problemLine}\n${"".padStart(column + 9)}^`
        })
        .join("\n")

      throw new JsonError({
        path: configFilepath,
        message: `\n--- JSONC Input ---\n${text}\n--- Errors ---\n${errorDetails}\n--- End ---`,
      })
    }

    const parsed = Info.safeParse(data)
    if (parsed.success) {
      if (!parsed.data.$schema) {
        parsed.data.$schema = "https://opencode.ai/config.json"
        await Bun.write(configFilepath, JSON.stringify(parsed.data, null, 2))
      }
      const data = parsed.data
      if (data.plugin) {
        for (let i = 0; i < data.plugin.length; i++) {
          const plugin = data.plugin[i]
          try {
            data.plugin[i] = import.meta.resolve!(plugin, configFilepath)
          } catch (err) {}
        }
      }
      return data
    }

    throw new InvalidError({
      path: configFilepath,
      issues: parsed.error.issues,
    })
  }
  export const JsonError = NamedError.create(
    "ConfigJsonError",
    z.object({
      path: z.string(),
      message: z.string().optional(),
    }),
  )

  export const ConfigDirectoryTypoError = NamedError.create(
    "ConfigDirectoryTypoError",
    z.object({
      path: z.string(),
      dir: z.string(),
      suggestion: z.string(),
    }),
  )

  export const InvalidError = NamedError.create(
    "ConfigInvalidError",
    z.object({
      path: z.string(),
      issues: z.custom<z.core.$ZodIssue[]>().optional(),
      message: z.string().optional(),
    }),
  )

  export async function get() {
    return state().then((x) => x.config)
  }

  export async function update(config: Info) {
    const filepath = path.join(Instance.directory, "config.json")
    const existing = await loadFile(filepath)
    await Bun.write(filepath, JSON.stringify(mergeDeep(existing, config), null, 2))
    await Instance.dispose()
  }

  export async function directories() {
    return state().then((x) => x.directories)
  }
}
