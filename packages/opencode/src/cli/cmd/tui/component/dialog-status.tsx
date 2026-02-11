import { TextAttributes } from "@opentui/core" // 文本属性枚举
import { useTheme } from "../context/theme" // 主题上下文，用于获取主题颜色
import { useSync } from "@tui/context/sync" // 同步上下文，用于管理与服务器的数据同步
import { For, Match, Switch, Show, createMemo } from "solid-js" // Solid.js 响应式 API：循环、匹配、切换、条件渲染、创建派生值

// 对话框状态组件的属性接口
export type DialogStatusProps = {}

// 对话框状态组件，显示系统状态信息
export function DialogStatus() {
  const sync = useSync() // 获取同步上下文
  const { theme } = useTheme() // 获取主题配置

  // 创建启用的格式化器列表的 memo
  const enabledFormatters = createMemo(() => sync.data.formatter.filter((f) => f.enabled))

  // 创建插件列表的 memo
  const plugins = createMemo(() => {
    const list = sync.data.config.plugin ?? [] // 获取插件列表，如果不存在则使用空数组
    const result = list.map((value) => {
      if (value.startsWith("file://")) {
        // 处理本地文件插件
        const path = value.substring("file://".length) // 移除 "file://" 前缀
        const parts = path.split("/")
        const filename = parts.pop() || path // 获取文件名
        if (!filename.includes(".")) return { name: filename } // 如果文件名没有扩展名，直接使用文件名
        const basename = filename.split(".")[0] // 获取文件名（不含扩展名）
        if (basename === "index") {
          // 如果是 index 文件，使用目录名
          const dirname = parts.pop()
          const name = dirname || basename
          return { name }
        }
        return { name: basename } // 使用文件名（不含扩展名）
      }
      // 处理远程插件（npm 包格式）
      const index = value.lastIndexOf("@") // 查找版本号分隔符
      if (index <= 0) return { name: value, version: "latest" } // 如果没有版本号，默认为 "latest"
      const name = value.substring(0, index) // 获取插件名称
      const version = value.substring(index + 1) // 获取插件版本
      return { name, version }
    })
    return result.toSorted((a, b) => a.name.localeCompare(b.name)) // 按插件名称排序
  })

  // 返回状态对话框界面
  return (
    <box paddingLeft={2} paddingRight={2} gap={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Status {/* 对话框标题 */}
        </text>
        <text fg={theme.textMuted}>esc</text> {/* 取消提示 */}
      </box>
      {/* MCP 服务器状态 */}
      <Show when={Object.keys(sync.data.mcp).length > 0} fallback={<text fg={theme.text}>No MCP Servers</text>}>
        <box>
          <text fg={theme.text}>{Object.keys(sync.data.mcp).length} MCP Servers</text> {/* MCP 服务器数量 */}
          <For each={Object.entries(sync.data.mcp)}>
            {/* 遍历 MCP 服务器 */}
            {([key, item]) => (
              <box flexDirection="row" gap={1}>
                <text
                  flexShrink={0}
                  style={{
                    fg: (
                      {
                        connected: theme.success, // 已连接：成功颜色
                        failed: theme.error, // 失败：错误颜色
                        disabled: theme.textMuted, // 禁用：静音文本颜色
                        needs_auth: theme.warning, // 需要认证：警告颜色
                        needs_client_registration: theme.error, // 需要客户端注册：错误颜色
                      } as Record<string, typeof theme.success>
                    )[item.status],
                  }}
                >
                  • {/* 状态标记 */}
                </text>
                <text fg={theme.text} wrapMode="word">
                  <b>{key}</b> {/* 服务器名称 */}
                  <span style={{ fg: theme.textMuted }}>
                    <Switch fallback={item.status}>
                      {" "}
                      {/* 根据状态显示不同的文本 */}
                      <Match when={item.status === "connected"}>Connected</Match> {/* 已连接 */}
                      <Match when={item.status === "failed" && item}>{(val) => val().error}</Match>{" "}
                      {/* 失败：显示错误信息 */}
                      <Match when={item.status === "disabled"}>Disabled in configuration</Match> {/* 禁用 */}
                      <Match when={(item.status as string) === "needs_auth"}>
                        Needs authentication (run: opencode mcp auth {key}) {/* 需要认证 */}
                      </Match>
                      <Match when={(item.status as string) === "needs_client_registration" && item}>
                        {(val) => (val() as { error: string }).error}
                        {/* 需要客户端注册：显示错误信息 */}
                      </Match>
                    </Switch>
                  </span>
                </text>
              </box>
            )}
          </For>
        </box>
      </Show>
      {/* LSP 服务器状态 */}
      {sync.data.lsp.length > 0 && (
        <box>
          <text fg={theme.text}>{sync.data.lsp.length} LSP Servers</text> {/* LSP 服务器数量 */}
          <For each={sync.data.lsp}>
            {/* 遍历 LSP 服务器 */}
            {(item) => (
              <box flexDirection="row" gap={1}>
                <text
                  flexShrink={0}
                  style={{
                    fg: {
                      connected: theme.success, // 已连接：成功颜色
                      error: theme.error,   // 错误：错误颜色
                    }[item.status],
                  }}
                >
                  • {/* 状态标记 */}
                </text>
                <text fg={theme.text} wrapMode="word">
                  <b>{item.id}</b> <span style={{ fg: theme.textMuted }}>{item.root}</span> {/* 服务器 ID 和根路径 */}
                </text>
              </box>
            )}
          </For>
        </box>
      )}
      {/* 格式化器状态 */}
      <Show when={enabledFormatters().length > 0} fallback={<text fg={theme.text}>No Formatters</text>}>
        <box>
          <text fg={theme.text}>{enabledFormatters().length} Formatters</text>
          {/* 格式化器数量 */}
          <For each={enabledFormatters()}>
            {/* 遍历启用的格式化器 */}
            {(item) => (
              <box flexDirection="row" gap={1}>
                <text
                  flexShrink={0}
                  style={{
                    fg: theme.success, // 启用：成功颜色
                  }}
                >
                  • {/* 状态标记 */}
                </text>
                <text wrapMode="word" fg={theme.text}>
                  <b>{item.name}</b> {/* 格式化器名称 */}
                </text>
              </box>
            )}
          </For>
        </box>
      </Show>
      {/* 插件状态 */}
      <Show when={plugins().length > 0} fallback={<text fg={theme.text}>No Plugins</text>}>
        <box>
          <text fg={theme.text}>{plugins().length} Plugins</text>
          {/* 插件数量 */}
          <For each={plugins()}>
            {/* 遍历插件 */}
            {(item) => (
              <box flexDirection="row" gap={1}>
                <text
                  flexShrink={0}
                  style={{
                    fg: theme.success, // 插件：成功颜色
                  }}
                >
                  • {/* 状态标记 */}
                </text>
                <text wrapMode="word" fg={theme.text}>
                  <b>{item.name}</b>
                  {/* 插件名称 */}
                  {item.version && <span style={{ fg: theme.textMuted }}> @{item.version}</span>}
                  {/* 插件版本 */}
                </text>
              </box>
            )}
          </For>
        </box>
      </Show>
    </box>
  )
}
