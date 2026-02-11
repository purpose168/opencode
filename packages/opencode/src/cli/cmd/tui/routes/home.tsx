import { Installation } from "@/installation" // 导入安装信息
import { Locale } from "@/util/locale" // 导入本地化工具
import { Prompt, type PromptRef } from "@tui/component/prompt" // 导入提示组件和提示引用类型
import { useRouteData } from "@tui/context/route" // 导入路由数据钩子
import { useTheme } from "@tui/context/theme" // 导入主题上下文钩子
import { createMemo, Match, onMount, Show, Switch } from "solid-js" // 导入 Solid.js 核心函数：派生值、条件匹配、生命周期钩子、条件渲染、条件切换
import { useCommandDialog } from "../component/dialog-command" // 导入命令对话框钩子
import { DidYouKnow, randomizeTip } from "../component/did-you-know" // 导入"你知道吗"提示组件和随机提示函数
import { Logo } from "../component/logo" // 导入 Logo 组件
import { useArgs } from "../context/args" // 导入命令行参数上下文钩子
import { useDirectory } from "../context/directory" // 导入目录上下文钩子
import { useKV } from "../context/kv" // 导入键值存储上下文钩子
import { usePromptRef } from "../context/prompt" // 导入提示引用上下文钩子
import { useSync } from "../context/sync" // 导入同步上下文钩子
import { Toast } from "../ui/toast" // 导入提示消息组件

// TODO: what is the best way to do this? // TODO：最佳实现方式是什么？
let once = false // 全局标志，用于确保初始提示只处理一次

/**
 * Home 主页组件
 *
 * 功能说明：
 * - 显示 OpenCode Logo
 * - 显示提示输入框，允许用户输入命令或问题
 * - 显示 MCP（模型上下文协议）服务器状态提示
 * - 显示"你知道吗"提示信息（非首次用户）
 * - 显示当前工作目录
 * - 显示 MCP 服务器连接状态和数量
 * - 显示应用版本信息
 *
 * 使用场景：
 * - 用户打开应用时显示的主页
 * - 用户可以在此输入命令或问题开始新的会话
 * - 显示系统状态和提示信息帮助用户快速上手
 *
 * 组件特性：
 * - 使用 createMemo 自动追踪状态变化并更新显示
 * - 使用 onMount 处理组件挂载时的初始化逻辑
 * - 使用 Show/Switch/Match 实现条件渲染
 * - 支持命令行参数传递初始提示
 * - 支持路由参数传递初始提示
 * - 响应式更新所有状态信息
 *
 * 返回值：
 * - 返回一个主页布局组件，包含 Logo、提示输入框、状态信息等
 */
export function Home() {
  const sync = useSync() // 获取同步上下文，用于访问会话数据、MCP 服务器状态等
  const kv = useKV() // 获取键值存储上下文，用于持久化用户配置
  const { theme } = useTheme() // 获取主题配置对象，用于设置颜色和样式
  const route = useRouteData("home") // 获取主页路由数据，包含初始提示等参数
  const promptRef = usePromptRef() // 获取提示引用，用于全局访问提示组件
  const command = useCommandDialog() // 获取命令对话框钩子，用于注册和显示命令

  // 创建派生值：判断是否存在 MCP 服务器配置
  const mcp = createMemo(() => Object.keys(sync.data.mcp).length > 0) // 检查 MCP 服务器对象是否有键名

  // 创建派生值：判断是否存在 MCP 连接错误
  const mcpError = createMemo(() => {
    return Object.values(sync.data.mcp).some((x) => x.status === "failed") // 检查是否有任何 MCP 服务器处于失败状态
  })

  // 创建派生值：统计已连接的 MCP 服务器数量
  const connectedMcpCount = createMemo(() => {
    return Object.values(sync.data.mcp).filter((x) => x.status === "connected").length // 过滤出状态为 connected 的服务器并计数
  })

  // 创建派生值：判断是否为首次使用用户（没有任何会话）
  const isFirstTimeUser = createMemo(() => sync.data.session.length === 0) // 检查会话列表是否为空

  // 创建派生值：获取提示信息是否被隐藏的配置
  const tipsHidden = createMemo(() => kv.get("tips_hidden", false)) // 从键值存储读取提示隐藏配置，默认为 false

  // 创建派生值：判断是否显示提示信息
  const showTips = createMemo(() => {
    return false // 当前禁用提示信息显示
    // Don't show tips for first-time users // 不为首次用户显示提示
    if (isFirstTimeUser()) return false // 如果是首次用户，不显示提示
    return !tipsHidden() // 如果提示未被隐藏，则显示提示
  })

  // 注册主页命令
  command.register(() => [
    {
      title: tipsHidden() ? "Show tips" : "Hide tips", // 命令标题，根据当前提示显示状态动态显示
      value: "tips.toggle", // 命令值
      keybind: "tips_toggle", // 快捷键绑定
      category: "System", // 命令分类：系统相关
      onSelect: (dialog) => {
        // 选中命令时的回调函数
        kv.set("tips_hidden", !tipsHidden()) // 切换提示隐藏状态（取反）
        dialog.clear() // 清除对话框
      },
    },
  ])

  // 创建 MCP 服务器状态提示组件
  const Hint = (
    <Show when={connectedMcpCount() > 0}>
      {" "}
      // 只在有已连接的 MCP 服务器时显示
      <box flexShrink={0} flexDirection="row" gap={1}>
        {" "}
        // 提示容器：不收缩、水平排列、间距为 1
        <text fg={theme.text}>
          {" "}
          // 文本容器：使用主题文本颜色
          <Switch>
            {" "}
            // 条件切换组件
            <Match when={mcpError()}>
              {" "}
              // 匹配条件：存在 MCP 连接错误
              <span style={{ fg: theme.error }}>•</span> mcp errors // 红色圆点图标 + 错误提示文本 + 快捷键提示
              <span style={{ fg: theme.textMuted }}>ctrl+x s</span> // 使用静音色显示快捷键
            </Match>
            <Match when={true}>
              {" "}
              // 默认匹配条件：所有 MCP 连接正常
              <span style={{ fg: theme.success }}>•</span> // 绿色圆点图标 + 空格
              {Locale.pluralize(connectedMcpCount(), "{} mcp server", "{} mcp servers")} // 根据服务器数量显示单复数形式
            </Match>
          </Switch>
        </text>
      </box>
    </Show>
  )

  let prompt: PromptRef // 定义提示组件引用变量
  const args = useArgs() // 获取命令行参数上下文

  // 组件挂载时的初始化逻辑
  onMount(() => {
    randomizeTip() // 随机化"你知道吗"提示内容
    if (once) return // 如果已经处理过初始提示，直接返回
    if (route.initialPrompt) {
      // 检查路由是否有初始提示参数
      prompt.set(route.initialPrompt) // 设置提示内容为路由的初始提示
      once = true // 标记已处理初始提示
    } else if (args.prompt) {
      // 检查命令行参数是否有提示内容
      prompt.set({ input: args.prompt, parts: [] }) // 设置提示内容为命令行参数的提示
      once = true // 标记已处理初始提示
      prompt.submit() // 自动提交提示，开始新的会话
    }
  })

  const directory = useDirectory() // 获取当前工作目录的显示路径

  // 返回主页布局组件
  return (
    <>
      {/* 主内容区域：居中显示 Logo 和提示输入框 */}
      <box flexGrow={1} justifyContent="center" alignItems="center" paddingLeft={2} paddingRight={2} gap={1}>
        <Logo /> {/* 显示 OpenCode Logo */}
        <box width="100%" maxWidth={75} zIndex={1000} paddingTop={1}>
          {" "}
          {/* 提示输入框容器：全宽、最大宽度 75、高 z-index、顶部内边距 */}
          <Prompt
            ref={(r) => {
              // 设置提示组件引用
              prompt = r // 保存引用到局部变量
              promptRef.set(r) // 同时保存到全局提示引用上下文
            }}
            hint={Hint} // 设置 MCP 服务器状态提示
          />
        </box>
        <Toast /> {/* 显示提示消息组件 */}
      </box>

      {/* "你知道吗"提示信息区域：只在非首次用户且提示启用时显示 */}
      <Show when={!isFirstTimeUser()}>
        <Show when={showTips()}>
          <DidYouKnow /> {/* 显示"你知道吗"提示组件 */}
        </Show>
      </Show>

      {/* 底部状态栏：显示目录、MCP 状态、版本信息 */}
      <box paddingTop={1} paddingBottom={1} paddingLeft={2} paddingRight={2} flexDirection="row" flexShrink={0} gap={2}>
        {/* 左侧：显示当前工作目录 */}
        <text fg={theme.textMuted}>{directory()}</text> {/* 使用静音色显示目录路径 */}
        {/* 中间：显示 MCP 服务器状态 */}
        <box gap={1} flexDirection="row" flexShrink={0}>
          {" "}
          {/* MCP 状态容器：间距 1、水平排列、不收缩 */}
          <Show when={mcp()}>
            {" "}
            {/* 只在配置了 MCP 服务器时显示 */}
            <text fg={theme.text}>
              {" "}
              {/* 文本容器：使用主题文本颜色 */}
              <Switch>
                {" "}
                {/* 条件切换组件 */}
                <Match when={mcpError()}>
                  {" "}
                  {/* 匹配条件：存在 MCP 连接错误 */}
                  <span style={{ fg: theme.error }}>⊙ </span> {/* 红色空心圆图标 */}
                </Match>
                <Match when={true}>
                  {" "}
                  {/* 默认匹配条件：所有 MCP 连接正常 */}
                  <span style={{ fg: theme.success }}>⊙ </span> {/* 绿色空心圆图标 */}
                </Match>
              </Switch>
              {connectedMcpCount()} MCP {/* 显示已连接的 MCP 服务器数量 */}
            </text>
            <text fg={theme.textMuted}>/status</text> {/* 使用静音色显示状态命令提示 */}
          </Show>
        </box>
        {/* 弹性空间，将版本信息推到右侧 */}
        <box flexGrow={1} />
        {/* 右侧：显示应用版本信息 */}
        <box flexShrink={0}>
          {" "}
          {/* 版本信息容器：不收缩 */}
          <text fg={theme.textMuted}>{Installation.VERSION}</text> {/* 使用静音色显示版本号 */}
        </box>
      </box>
    </>
  )
}
