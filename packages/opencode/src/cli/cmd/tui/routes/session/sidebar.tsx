import { Installation } from "@/installation" // 导入安装信息，包含版本号等
import { Locale } from "@/util/locale" // 导入本地化工具，用于文本截断等本地化操作
import type { AssistantMessage } from "@opencode-ai/sdk/v2" // 导入助手消息类型定义
import { useSync } from "@tui/context/sync" // 导入同步上下文钩子，用于获取会话同步数据
import path from "path" // 导入 Node.js 路径模块，用于处理文件路径
import { createMemo, For, Match, Show, Switch } from "solid-js" // 导入 Solid.js 核心函数：createMemo（创建派生值）、For（列表渲染）、Show（条件渲染）、Switch/Match（多条件匹配）
import { createStore } from "solid-js/store" // 导入 Solid.js store 创建函数，用于管理本地状态
import { TodoItem } from "../../component/todo-item" // 导入待办事项组件，用于显示单个待办事项
import { useDirectory } from "../../context/directory" // 导入目录上下文钩子，用于获取当前工作目录
import { useKV } from "../../context/kv" // 导入键值存储上下文钩子，用于持久化配置
import { useTheme } from "../../context/theme" // 导入主题上下文钩子，用于获取主题配置

/**
 * Sidebar 组件 - 会话侧边栏
 *
 * 功能说明：
 * - 显示会话标题和分享链接
 * - 显示上下文信息（token 使用情况、成本）
 * - 显示 MCP（模型上下文协议）服务器状态
 * - 显示 LSP（语言服务器协议）服务器状态
 * - 显示待办事项列表
 * - 显示修改的文件列表（带差异统计）
 * - 显示入门指南（当没有配置提供商时）
 * - 显示当前工作目录
 * - 显示应用版本信息
 *
 * 使用场景：
 * - 在会话页面右侧显示会话相关的所有信息
 * - 帮助用户了解当前会话的状态和资源使用情况
 * - 提供快速访问各种系统状态的界面
 *
 * 组件特性：
 * - 使用 createMemo 自动追踪状态变化并更新显示
 * - 使用 createStore 管理各部分的展开/折叠状态
 * - 支持点击展开/折叠各部分（当项目数量超过2个时）
 * - 使用 Switch/Match/Show 实现条件渲染
 * - 响应式更新所有状态信息
 *
 * @param props - 组件属性
 * @param props.sessionID - 当前会话的唯一标识符
 * @returns 返回一个侧边栏布局组件，显示会话相关信息
 */
export function Sidebar(props: { sessionID: string }) {
  const sync = useSync() // 获取同步上下文，用于访问会话数据
  const { theme } = useTheme() // 获取主题配置对象，用于设置颜色和样式
  const session = createMemo(() => sync.session.get(props.sessionID)!) // 获取当前会话对象（派生值）
  const diff = createMemo(() => sync.data.session_diff[props.sessionID] ?? []) // 获取当前会话的文件差异列表（派生值）
  const todo = createMemo(() => sync.data.todo[props.sessionID] ?? []) // 获取当前会话的待办事项列表（派生值）
  const messages = createMemo(() => sync.data.message[props.sessionID] ?? []) // 获取当前会话的所有消息（派生值）

  const [expanded, setExpanded] = createStore({
    // 创建本地状态存储，管理各部分的展开/折叠状态
    mcp: true, // MCP 服务器列表是否展开
    diff: true, // 文件差异列表是否展开
    todo: true, // 待办事项列表是否展开
    lsp: true, // LSP 服务器列表是否展开
  })

  // 按字母顺序排序 MCP 服务器，以保持一致的显示顺序
  const mcpEntries = createMemo(() => Object.entries(sync.data.mcp).sort(([a], [b]) => a.localeCompare(b)))

  // 统计已连接和出错的 MCP 服务器数量，用于折叠时的头部显示
  const connectedMcpCount = createMemo(() => mcpEntries().filter(([_, item]) => item.status === "connected").length) // 统计已连接的 MCP 服务器数量
  const errorMcpCount = createMemo(
    // 统计出错的 MCP 服务器数量
    () =>
      mcpEntries().filter(
        // 过滤出状态为失败、需要认证或需要客户端注册的 MCP 服务器
        ([_, item]) =>
          item.status === "failed" || item.status === "needs_auth" || item.status === "needs_client_registration",
      ).length,
  )

  const cost = createMemo(() => {
    // 计算会话的总成本（派生值）
    const total = messages().reduce((sum, x) => sum + (x.role === "assistant" ? x.cost : 0), 0) // 累加所有助手消息的成本
    return new Intl.NumberFormat("en-US", {
      // 使用美国英语格式化数字
      style: "currency", // 设置为货币格式
      currency: "USD", // 使用美元作为货币单位
    }).format(total) // 格式化总成本
  })

  const context = createMemo(() => {
    // 计算当前上下文的 token 使用情况（派生值）
    const last = messages().findLast((x) => x.role === "assistant" && x.tokens.output > 0) as AssistantMessage // 查找最后一个有输出 token 的助手消息
    if (!last) return // 如果没有找到，返回 undefined
    const total = // 计算总 token 数量
      last.tokens.input + last.tokens.output + last.tokens.reasoning + last.tokens.cache.read + last.tokens.cache.write
    const model = sync.data.provider.find((x) => x.id === last.providerID)?.models[last.modelID] // 查找模型信息
    return {
      tokens: total.toLocaleString(), // 格式化 token 数量为字符串（添加千位分隔符）
      percentage: model?.limit.context ? Math.round((total / model.limit.context) * 100) : null, // 如果模型有上下文限制，计算使用百分比
    }
  })

  const directory = useDirectory() // 获取当前工作目录
  const kv = useKV() // 获取键值存储上下文

  const hasProviders = createMemo(
    () =>
      // 判断是否配置了付费提供商（派生值）
      sync.data.provider.some((x) => x.id !== "opencode" || Object.values(x.models).some((y) => y.cost?.input !== 0)), // 检查是否有非 OpenCode 提供商或有成本的模型
  )
  const gettingStartedDismissed = createMemo(() => kv.get("dismissed_getting_started", false)) // 获取入门指南是否已被忽略（派生值）

  return (
    // 返回侧边栏布局组件
    <Show when={session()}>
      {" "}
      // 条件渲染：只在会话存在时显示侧边栏
      <box // 侧边栏主容器
        backgroundColor={theme.backgroundPanel} // 设置背景色为主题面板背景色
        width={42} // 设置宽度为 42 个字符
        paddingTop={1} // 设置顶部内边距
        paddingBottom={1} // 设置底部内边距
        paddingLeft={2} // 设置左侧内边距
        paddingRight={2} // 设置右侧内边距
      >
        <scrollbox flexGrow={1}>
          {" "}
          // 滚动容器，占据剩余空间
          <box flexShrink={0} gap={1} paddingRight={1}>
            {" "}
            // 内容容器，不收缩，有间距和右侧内边距
            <box>
              {" "}
              // 会话标题部分
              <text fg={theme.text}>
                {" "}
                // 会话标题文本
                <b>{session().title}</b> // 粗体显示会话标题
              </text>
              <Show when={session().share?.url}>
                {" "}
                // 条件渲染：只在有分享链接时显示
                <text fg={theme.textMuted}>{session().share!.url}</text> // 显示分享链接（使用静音色）
              </Show>
            </box>
            <box>
              {" "}
              // 上下文信息部分
              <text fg={theme.text}>
                {" "}
                // 上下文标签
                <b>Context</b> // 粗体显示
              </text>
              <text fg={theme.textMuted}>{context()?.tokens ?? 0} tokens</text> // 显示 token 数量（使用静音色）
              <text fg={theme.textMuted}>{context()?.percentage ?? 0}% used</text> // 显示上下文使用百分比（使用静音色）
              <text fg={theme.textMuted}>{cost()} spent</text> // 显示已花费的成本（使用静音色）
            </box>
            <Show when={mcpEntries().length > 0}>
              {" "}
              // 条件渲染：只在有 MCP 服务器时显示
              <box>
                {" "}
                // MCP 服务器部分
                <box // MCP 标题栏
                  flexDirection="row" // 水平排列
                  gap={1} // 间距
                  onMouseDown={() => mcpEntries().length > 2 && setExpanded("mcp", !expanded.mcp)} // 鼠标点击时切换展开/折叠状态（只在服务器数量超过2个时）
                >
                  <Show when={mcpEntries().length > 2}>
                    {" "}
                    // 条件渲染：只在服务器数量超过2个时显示展开/折叠图标
                    <text fg={theme.text}>{expanded.mcp ? "▼" : "▶"}</text> // 显示展开或折叠图标
                  </Show>
                  <text fg={theme.text}>
                    {" "}
                    // MCP 标签
                    <b>MCP</b> // 粗体显示
                    <Show when={!expanded.mcp}>
                      {" "}
                      // 条件渲染：只在折叠时显示统计信息
                      <span style={{ fg: theme.textMuted }}>
                        {" "}
                        // 使用静音色 ({connectedMcpCount()} active // 显示已连接的服务器数量
                        {errorMcpCount() > 0 ? `, ${errorMcpCount()} error${errorMcpCount() > 1 ? "s" : ""}` : ""} //
                        显示出错的服务器数量（如果有）
                      </span>
                    </Show>
                  </text>
                </box>
                <Show when={mcpEntries().length <= 2 || expanded.mcp}>
                  <For each={mcpEntries()}>
                    {([key, item]) => (
                      <box flexDirection="row" gap={1}>
                        {" "}
                        // 服务器项容器，水平排列，有间距
                        <text // 状态指示器
                          flexShrink={0} // 不收缩
                          style={{
                            fg: // 根据状态设置颜色
                            (
                              {
                                connected: theme.success, // 已连接：成功色（绿色）
                                failed: theme.error, // 失败：错误色（红色）
                                disabled: theme.textMuted, // 禁用：静音色
                                needs_auth: theme.warning, // 需要认证：警告色（黄色）
                                needs_client_registration: theme.error, // 需要客户端注册：错误色（红色）
                              } as Record<string, typeof theme.success>
                            )[item.status],
                          }}
                        >
                          • {/* 状态指示点 */}
                        </text>
                        <text fg={theme.text} wrapMode="word">
                          {" "}
                          // 服务器名称文本，单词换行
                          {key} {/* 服务器名称 */}
                          <span style={{ fg: theme.textMuted }}>
                            {" "}
                            {/* 使用静音色 */}
                            <Switch fallback={item.status}>
                              {" "}
                              {/* 多条件匹配，显示状态文本 */}
                              <Match when={item.status === "connected"}>Connected</Match> {/* 已连接 */}
                              <Match when={item.status === "failed" && item}>
                                {(val) => <i>{val().error}</i>}
                              </Match>{" "}
                              {/* 失败：显示错误信息（斜体） */}
                              <Match when={item.status === "disabled"}>Disabled</Match> {/* 已禁用 */}
                              <Match when={(item.status as string) === "needs_auth"}>Needs auth</Match> {/* 需要认证 */}
                              <Match when={(item.status as string) === "needs_client_registration"}>
                                {" "}
                                {/* 需要客户端注册 */}
                                Needs client ID
                              </Match>
                            </Switch>
                          </span>
                        </text>
                      </box>
                    )}
                  </For>
                </Show>
              </box>
            </Show>
            <box>
              {" "}
              // LSP 服务器部分
              <box // LSP 标题栏
                flexDirection="row" // 水平排列
                gap={1} // 间距
                onMouseDown={() => sync.data.lsp.length > 2 && setExpanded("lsp", !expanded.lsp)} // 鼠标点击时切换展开/折叠状态（只在服务器数量超过2个时）
              >
                <Show when={sync.data.lsp.length > 2}>
                  {" "}
                  // 条件渲染：只在服务器数量超过2个时显示展开/折叠图标
                  <text fg={theme.text}>{expanded.lsp ? "▼" : "▶"}</text> // 显示展开或折叠图标
                </Show>
                <text fg={theme.text}>
                  {" "}
                  // LSP 标签
                  <b>LSP</b> // 粗体显示
                </text>
              </box>
              <Show when={sync.data.lsp.length <= 2 || expanded.lsp}>
                {" "}
                // 条件渲染：只在服务器数量不超过2个或展开时显示服务器列表
                <Show when={sync.data.lsp.length === 0}>
                  {" "}
                  // 条件渲染：只在没有 LSP 服务器时显示提示信息
                  <text fg={theme.textMuted}>
                    {" "}
                    {/* 使用静音色 */}
                    {sync.data.config.lsp === false // 检查 LSP 是否在设置中被禁用
                      ? "LSPs have been disabled in settings" // 已禁用：显示禁用提示
                      : "LSPs will activate as files are read"}{" "}
                    // 未禁用：显示激活提示
                  </text>
                </Show>
                <For each={sync.data.lsp}>
                  {(item) => (
                    <box flexDirection="row" gap={1}>
                      {" "}
                      // 服务器项容器，水平排列，有间距
                      <text // 状态指示器
                        flexShrink={0} // 不收缩
                        style={{
                          fg: {
                            // 根据状态设置颜色
                            connected: theme.success, // 已连接：成功色（绿色）
                            error: theme.error, // 错误：错误色（红色）
                          }[item.status],
                        }}
                      >
                        • {/* 状态指示点 */}
                      </text>
                      <text fg={theme.textMuted}>
                        {" "}
                        {/* 服务器信息（使用静音色） */}
                        {item.id} {item.root} {/* 显示服务器 ID 和根路径 */}
                      </text>
                    </box>
                  )}
                </For>
              </Show>
            </box>
            <Show when={todo().length > 0 && todo().some((t) => t.status !== "completed")}>
              {" "}
              {/* 条件渲染：只在有待办事项且至少有一个未完成时显示 */}
              <box>
                {" "}
                // 待办事项部分
                <box // 待办事项标题栏
                  flexDirection="row" // 水平排列
                  gap={1} // 间距
                  onMouseDown={() => todo().length > 2 && setExpanded("todo", !expanded.todo)} // 鼠标点击时切换展开/折叠状态（只在待办事项数量超过2个时）
                >
                  <Show when={todo().length > 2}>
                    {" "}
                    // 条件渲染：只在待办事项数量超过2个时显示展开/折叠图标
                    <text fg={theme.text}>{expanded.todo ? "▼" : "▶"}</text> // 显示展开或折叠图标
                  </Show>
                  <text fg={theme.text}>
                    {" "}
                    {/* 待办事项标签 */}
                    <b>Todo</b> {/* 粗体显示 */}
                  </text>
                </box>
                <Show when={todo().length <= 2 || expanded.todo}>
                  {" "}
                  {/* 条件渲染：只在待办事项数量不超过2个或展开时显示待办事项列表 */}
                  <For each={todo()}>{(todo) => <TodoItem status={todo.status} content={todo.content} />}</For>{" "}
                  {/* 遍历待办事项列表，渲染每个待办事项 */}
                </Show>
              </box>
            </Show>
            <Show when={diff().length > 0}>
              {" "}
              {/* 条件渲染：只在有文件差异时显示 */}
              <box>
                {" "}
                // 修改文件部分
                <box // 修改文件标题栏
                  flexDirection="row" // 水平排列
                  gap={1} // 间距
                  onMouseDown={() => diff().length > 2 && setExpanded("diff", !expanded.diff)} // 鼠标点击时切换展开/折叠状态（只在文件数量超过2个时）
                >
                  <Show when={diff().length > 2}>
                    {" "}
                    {/* 条件渲染：只在文件数量超过2个时显示展开/折叠图标 */}
                    <text fg={theme.text}>{expanded.diff ? "▼" : "▶"}</text> {/* 显示展开或折叠图标 */}
                  </Show>
                  <text fg={theme.text}>
                    <b>Modified Files</b>
                  </text>
                </box>
                <Show when={diff().length <= 2 || expanded.diff}>
                  <For each={diff() || []}>
                    {(item) => {
                      // 文件差异项
                      const file = createMemo(() => {
                        // 创建派生值，计算文件路径显示文本
                        const splits = item.file.split(path.sep).filter(Boolean) // 分割文件路径并过滤空字符串
                        const last = splits.at(-1)! // 获取文件名
                        const rest = splits.slice(0, -1).join(path.sep) // 获取目录路径
                        if (!rest) return last // 如果没有目录路径，只返回文件名
                        return Locale.truncateMiddle(rest, 30 - last.length) + "/" + last // 截断中间部分，添加文件名
                      })
                      return (
                        // 返回文件项
                        <box flexDirection="row" gap={1} justifyContent="space-between">
                          {" "}
                          {/* 文件项容器，水平排列，两端对齐 */}
                          <text fg={theme.textMuted} wrapMode="char">
                            {" "}
                            {/* 文件路径文本（使用静音色，字符换行） */}
                            {file()} {/* 显示文件路径 */}
                          </text>
                          <box flexDirection="row" gap={1} flexShrink={0}>
                            {" "}
                            {/* 差异统计容器，水平排列，不收缩 */}
                            <Show when={item.additions}>
                              {" "}
                              {/* 条件渲染：只在有新增行时显示 */}
                              <text fg={theme.diffAdded}>+{item.additions}</text> {/* 显示新增行数（绿色） */}
                            </Show>
                            <Show when={item.deletions}>
                              {" "}
                              {/* 条件渲染：只在有删除行时显示 */}
                              <text fg={theme.diffRemoved}>-{item.deletions}</text> {/* 显示删除行数（红色） */}
                            </Show>
                          </box>
                        </box>
                      )
                    }}
                  </For>
                </Show>
              </box>
            </Show>
          </box>
        </scrollbox>

        <box flexShrink={0} gap={1} paddingTop={1}>
          {" "}
          {/* 底部信息容器，不收缩，有间距和顶部内边距 */}
          <Show when={!hasProviders() && !gettingStartedDismissed()}>
            {" "}
            {/* 条件渲染：只在没有付费提供商且入门指南未被忽略时显示 */}
            <box // 入门指南容器
              backgroundColor={theme.backgroundElement} // 设置背景色为主题元素背景色
              paddingTop={1} // 设置顶部内边距
              paddingBottom={1} // 设置底部内边距
              paddingLeft={2} // 设置左侧内边距
              paddingRight={2} // 设置右侧内边距
              flexDirection="row" // 水平排列
              gap={1} // 间距
            >
              <text flexShrink={0} fg={theme.text}>
                {" "}
                {/* 图标文本，不收缩 */}⬖ {/* OpenCode 图标 */}
              </text>
              <box flexGrow={1} gap={1}>
                {" "}
                {/* 内容容器，占据剩余空间，有间距 */}
                <box flexDirection="row" justifyContent="space-between">
                  {" "}
                  {/* 标题栏，水平排列，两端对齐 */}
                  <text fg={theme.text}>
                    {" "}
                    {/* 标题文本 */}
                    <b>Getting started</b> {/* 粗体显示 */}
                  </text>
                  <text fg={theme.textMuted} onMouseDown={() => kv.set("dismissed_getting_started", true)}>
                    {" "}
                    {/* 关闭按钮（使用静音色） */}✕ {/* 关闭图标 */}
                  </text>
                </box>
                <text fg={theme.textMuted}>OpenCode includes free models so you can start immediately.</text>{" "}
                {/* 提示文本1 */}
                <text fg={theme.textMuted}>
                  {" "}
                  {/* 提示文本2 */}
                  Connect from 75+ providers to use other models, including Claude, GPT, Gemini etc
                </text>
                <box flexDirection="row" gap={1} justifyContent="space-between">
                  {" "}
                  {/* 操作提示栏，水平排列，两端对齐 */}
                  <text fg={theme.text}>Connect provider</text> {/* 操作文本 */}
                  <text fg={theme.textMuted}>/connect</text> {/* 命令提示（使用静音色） */}
                </box>
              </box>
            </box>
          </Show>
          <text>
            {" "}
            {/* 当前工作目录文本 */}
            <span style={{ fg: theme.textMuted }}>{directory().split("/").slice(0, -1).join("/")}/</span>{" "}
            {/* 显示目录路径（使用静音色） */}
            <span style={{ fg: theme.text }}>{directory().split("/").at(-1)}</span>{" "}
            {/* 显示当前目录名（使用正常文本色） */}
          </text>
          <text fg={theme.textMuted}>
            {" "}
            {/* 版本信息文本（使用静音色） */}
            <span style={{ fg: theme.success }}>•</span> <b>Open</b> {/* 成功色圆点 + Open */}
            <span style={{ fg: theme.text }}>
              {" "}
              {/* 使用正常文本色 */}
              <b>Code</b> {/* Code */}
            </span>{" "}
            {/* 空格 */}
            <span>{Installation.VERSION}</span> {/* 显示版本号 */}
          </text>
        </box>
      </box>
    </Show>
  )
}
