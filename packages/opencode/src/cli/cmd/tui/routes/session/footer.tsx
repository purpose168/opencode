import { createMemo, Match, onCleanup, onMount, Show, Switch } from "solid-js" // 导入 Solid.js 核心函数：createMemo 创建派生值，Match/Switch 条件渲染，onCleanup 清理副作用，onMount 生命周期钩子，Show 条件显示
import { createStore } from "solid-js/store" // 导入 Solid.js store 创建函数，用于本地状态管理
import { useConnected } from "../../component/dialog-model" // 导入连接状态钩子，用于判断是否已连接到服务
import { useDirectory } from "../../context/directory" // 导入目录路径钩子，用于获取当前工作目录
import { useRoute } from "../../context/route" // 导入路由上下文钩子，用于访问当前路由信息
import { useSync } from "../../context/sync" // 导入同步上下文钩子，用于访问全局同步状态管理器
import { useTheme } from "../../context/theme" // 导入主题上下文钩子，用于访问主题配置

/**
 * 会话页面页脚组件
 *
 * 功能说明：
 * 1. 显示当前工作目录路径
 * 2. 显示欢迎提示（未连接时）
 * 3. 显示权限警告信息
 * 4. 显示 LSP（语言服务器协议）连接状态
 * 5. 显示 MCP（模型上下文协议）连接状态
 * 6. 提供快速访问 /status 命令的提示
 *
 * 使用场景：
 * - 在会话页面底部显示系统状态信息
 * - 帮助用户了解当前连接状态和可用服务
 * - 提供快速访问常用命令的提示
 *
 * 组件特性：
 * - 使用 createMemo 自动追踪状态变化并更新显示
 * - 使用 onMount/onCleanup 管理欢迎提示的定时器
 * - 使用 createStore 管理本地欢迎状态
 * - 使用 Switch/Match/Show 实现条件渲染
 * - 响应式更新所有状态信息
 *
 * @returns 返回一个页脚布局组件，显示系统状态信息
 */
export function Footer() {
  const { theme } = useTheme() // 获取主题配置对象，包含颜色、样式等主题信息
  const sync = useSync() // 获取同步上下文实例，用于访问 MCP、LSP、权限等同步数据
  const route = useRoute() // 获取路由上下文实例，用于访问当前路由信息（会话 ID、路由类型等）

  // 创建派生值，计算已连接的 MCP 服务器数量
  const mcp = createMemo(() => Object.values(sync.data.mcp).filter((x) => x.status === "connected").length)
  // 说明：
  //   sync.data.mcp：同步数据中的 MCP 服务器状态存储
  //   Object.values()：获取所有 MCP 服务器的值数组
  //   filter((x) => x.status === "connected")：过滤出状态为 "connected" 的服务器
  //   length：获取已连接服务器的数量
  //   createMemo：创建派生值，当 MCP 数据变化时自动重新计算
  // 用途：在页脚中显示已连接的 MCP 服务器数量

  // 创建派生值，判断是否存在 MCP 连接错误
  const mcpError = createMemo(() => Object.values(sync.data.mcp).some((x) => x.status === "failed"))
  // 说明：
  //   sync.data.mcp：同步数据中的 MCP 服务器状态存储
  //   Object.values()：获取所有 MCP 服务器的值数组
  //   some((x) => x.status === "failed")：检查是否存在状态为 "failed" 的服务器
  //   返回值：布尔值，true 表示存在连接错误，false 表示所有服务器正常
  //   createMemo：创建派生值，当 MCP 数据变化时自动重新计算
  // 用途：在页脚中用不同颜色显示 MCP 状态指示器

  // 创建派生值，获取所有 LSP 服务器的键名
  const lsp = createMemo(() => Object.keys(sync.data.lsp))
  // 说明：
  //   sync.data.lsp：同步数据中的 LSP 服务器状态存储
  //   Object.keys()：获取所有 LSP 服务器的键名数组
  //   返回值：字符串数组，包含所有 LSP 服务器的标识符
  //   createMemo：创建派生值，当 LSP 数据变化时自动重新计算
  // 用途：在页脚中显示已连接的 LSP 服务器数量

  // 创建派生值，获取当前会话的权限列表
  const permissions = createMemo(() => {
    // 检查当前路由类型是否为会话页面
    if (route.data.type !== "session") return []
    // 说明：
    //   route.data.type：当前路由的类型（"session"、"home" 等）
    //   如果不是会话页面，返回空数组（不显示权限信息）
    //   原因：权限信息只在会话页面中显示，其他页面不需要

    // 返回当前会话的权限列表
    return sync.data.permission[route.data.sessionID] ?? []
    // 说明：
    //   sync.data.permission：同步数据中的权限存储，键为会话 ID，值为权限数组
    //   route.data.sessionID：当前会话的唯一标识符
    //   ?? []：空值合并运算符，如果会话没有权限则返回空数组
    //   权限数组结构：
    //     [
    //       { type: "file", path: "/path/to/file", action: "read" },
    //       { type: "command", name: "shell" },
    //       ...
    //     ]
    //   用途：在页脚中显示当前会话的权限数量，提醒用户注意权限请求
  })

  // 获取当前工作目录的显示路径
  const directory = useDirectory()
  // 说明：
  //   useDirectory()：目录路径钩子函数
  //   返回值：一个派生值函数，调用后返回格式化后的目录路径字符串
  //   路径格式：将用户主目录替换为 ~，并附加版本控制分支信息（如果有）
  //   示例输出："~/projects/opencode:main"
  //   用途：在页脚左侧显示当前工作目录

  // 判断是否已连接到服务
  const connected = useConnected()
  // 说明：
  //   useConnected()：连接状态钩子函数
  //   返回值：一个派生值函数，调用后返回布尔值，表示是否已连接
  //   连接条件：至少有一个提供者已连接，或者 opencode 提供者有非零成本的模型
  //   用途：根据连接状态决定显示欢迎提示还是状态信息

  // 创建本地状态存储，用于管理欢迎提示的显示状态
  const [store, setStore] = createStore({
    welcome: false, // 欢迎提示的显示状态，false 表示不显示，true 表示显示
  })
  // 说明：
  //   createStore：Solid.js 的状态管理函数，创建响应式状态存储
  //   store：状态对象，包含 welcome 字段
  //   setStore：状态更新函数，用于修改状态
  //   welcome：欢迎提示的显示状态，用于控制欢迎提示的显示和隐藏
  // 用途：管理欢迎提示的定时显示和隐藏逻辑

  // 组件挂载时设置欢迎提示的定时器
  onMount(() => {
    // 定义定时器变量，用于存储 setTimeout 的返回值
    let timeout: ReturnType<typeof setTimeout> | undefined

    // 定义定时器函数，用于控制欢迎提示的显示和隐藏
    function tick() {
      // 第一步：检查是否已连接
      if (connected()) return
      // 说明：
      //   connected()：调用连接状态函数，获取当前连接状态
      //   如果已连接，直接返回（不显示欢迎提示）
      //   原因：欢迎提示只在未连接时显示，连接后应该隐藏

      // 第二步：检查欢迎提示是否未显示
      if (!store.welcome) {
        // 如果欢迎提示未显示，则显示欢迎提示
        setStore("welcome", true)
        // 说明：
        //   setStore("welcome", true)：更新状态，将 welcome 设置为 true
        //   效果：触发组件重新渲染，显示欢迎提示

        // 设置 5 秒后再次调用 tick 函数
        timeout = setTimeout(() => tick(), 5000)
        // 说明：
        //   setTimeout：设置定时器，延迟执行函数
        //   5000：延迟 5000 毫秒（5 秒）
        //   tick：定时器到期后执行的函数
        //   timeout：存储定时器 ID，用于后续清除定时器
        // 用途：显示欢迎提示 5 秒后，隐藏欢迎提示

        return
      }

      // 第三步：检查欢迎提示是否已显示
      if (store.welcome) {
        // 如果欢迎提示已显示，则隐藏欢迎提示
        setStore("welcome", false)
        // 说明：
        //   setStore("welcome", false)：更新状态，将 welcome 设置为 false
        //   效果：触发组件重新渲染，隐藏欢迎提示

        // 设置 10 秒后再次调用 tick 函数
        timeout = setTimeout(() => tick(), 10_000)
        // 说明：
        //   setTimeout：设置定时器，延迟执行函数
        //   10_000：延迟 10000 毫秒（10 秒）
        //   tick：定时器到期后执行的函数
        //   timeout：存储定时器 ID，用于后续清除定时器
        // 用途：隐藏欢迎提示 10 秒后，再次显示欢迎提示
        // 目的：循环显示欢迎提示，引导用户连接服务

        return
      }
    }

    // 初始定时器：10 秒后开始显示欢迎提示
    timeout = setTimeout(() => tick(), 10_000)
    // 说明：
    //   setTimeout：设置定时器，延迟执行函数
    //   10_000：延迟 10000 毫秒（10 秒）
    //   tick：定时器到期后执行的函数
    //   timeout：存储定时器 ID，用于后续清除定时器
    // 目的：组件挂载后等待 10 秒，然后开始显示欢迎提示
    // 原因：给用户一些时间熟悉界面，避免立即显示提示造成干扰

    // 组件卸载时清除定时器，防止内存泄漏
    onCleanup(() => {
      clearTimeout(timeout)
      // 说明：
      //   clearTimeout：清除定时器，取消定时器的执行
      //   timeout：要清除的定时器 ID
      //   onCleanup：Solid.js 的生命周期钩子，在组件卸载时执行
      // 目的：防止组件卸载后定时器仍然执行，导致内存泄漏或错误
    })
  })

  // 返回页脚布局组件
  return (
    <box flexDirection="row" justifyContent="space-between" gap={1} flexShrink={0}>
      {/* 左侧：显示当前工作目录 */}
      <text fg={theme.textMuted}>{directory()}</text>
      {/* 说明：
          <text>：文本组件，用于显示文本内容
          fg={theme.textMuted}：设置文本前景色为主题中的次要文字颜色
          directory()：调用目录路径函数，获取当前工作目录的显示路径
          效果：在页脚左侧显示当前工作目录，如 "~/projects/opencode:main"
      */}

      {/* 右侧：显示状态信息 */}
      <box gap={2} flexDirection="row" flexShrink={0}>
        {/* 说明：
            <box>：容器组件，用于布局
            gap={2}：设置子元素之间的间距为 2
            flexDirection="row"：设置布局方向为水平排列
            flexShrink={0}：设置不收缩，确保内容完整显示
        */}

        {/* 条件渲染：根据状态显示不同的内容 */}
        <Switch>
          {/* 情况 1：显示欢迎提示（未连接时） */}
          <Match when={store.welcome}>
            <text fg={theme.text}>
              Get started <span style={{ fg: theme.textMuted }}>/connect</span>
            </text>
            {/* 说明：
                <Match when={store.welcome}>：条件匹配，当 welcome 为 true 时显示
                <text>：文本组件
                fg={theme.text}：设置文本前景色为主题中的主要文字颜色
                Get started：欢迎文本
                <span>：内联文本组件，用于设置样式
                style={{ fg: theme.textMuted }}：设置内联文本的前景色为次要文字颜色
                /connect：命令提示，引导用户使用 /connect 命令连接服务
                效果：显示 "Get started /connect"，引导用户连接服务
            */}
          </Match>

          {/* 情况 2：显示状态信息（已连接时） */}
          <Match when={connected()}>
            {/* 显示权限警告信息 */}
            <Show when={permissions().length > 0}>
              <text fg={theme.warning}>
                <span style={{ fg: theme.warning }}>△</span> {permissions().length} Permission
                {permissions().length > 1 ? "s" : ""}
              </text>
              {/* 说明：
                  <Show when={permissions().length > 0}>：条件显示，当权限数量大于 0 时显示
                  <text>：文本组件
                  fg={theme.warning}：设置文本前景色为主题中的警告颜色（黄色）
                  <span>：内联文本组件，用于设置样式
                  style={{ fg: theme.warning }}：设置内联文本的前景色为警告颜色
                  △：警告符号，三角形图标
                  {permissions().length}：权限数量
                  Permission：权限文本
                  {permissions().length > 1 ? "s" : ""}：复数形式，权限数量大于 1 时添加 "s"
                  效果：显示 "△ 1 Permission" 或 "△ 2 Permissions"，提醒用户有权限请求
              */}
            </Show>

            {/* 显示 LSP 连接状态 */}
            <text fg={theme.text}>
              <span style={{ fg: theme.success }}>•</span> {lsp().length} LSP
            </text>
            {/* 说明：
                <text>：文本组件
                fg={theme.text}：设置文本前景色为主题中的主要文字颜色
                <span>：内联文本组件，用于设置样式
                style={{ fg: theme.success }}：设置内联文本的前景色为成功颜色（绿色）
                •：状态符号，圆点图标
                {lsp().length}：LSP 服务器数量
                LSP：LSP 文本
                效果：显示 "• 3 LSP"，表示已连接 3 个 LSP 服务器
            */}

            {/* 显示 MCP 连接状态（有连接时才显示） */}
            <Show when={mcp()}>
              <text fg={theme.text}>
                {/* 条件渲染：根据 MCP 错误状态显示不同的颜色 */}
                <Switch>
                  {/* 情况 1：存在 MCP 连接错误 */}
                  <Match when={mcpError()}>
                    <span style={{ fg: theme.error }}>⊙ </span>
                  </Match>
                  {/* 说明：
                      <Match when={mcpError()}>：条件匹配，当存在 MCP 错误时显示
                      <span>：内联文本组件，用于设置样式
                      style={{ fg: theme.error }}：设置内联文本的前景色为错误颜色（红色）
                      ⊙：状态符号，圆圈图标
                      效果：显示红色的 ⊙，表示 MCP 连接存在错误
                  */}

                  {/* 情况 2：所有 MCP 连接正常 */}
                  <Match when={true}>
                    <span style={{ fg: theme.success }}>⊙ </span>
                  </Match>
                  {/* 说明：
                      <Match when={true}>：条件匹配，默认情况（无错误）时显示
                      <span>：内联文本组件，用于设置样式
                      style={{ fg: theme.success }}：设置内联文本的前景色为成功颜色（绿色）
                      ⊙：状态符号，圆圈图标
                      效果：显示绿色的 ⊙，表示 MCP 连接正常
                  */}
                </Switch>
                {/* 显示 MCP 服务器数量 */}
                {mcp()} MCP
                {/* 说明：
                    {mcp()}：已连接的 MCP 服务器数量
                    MCP：MCP 文本
                    效果：显示 "2 MCP"，表示已连接 2 个 MCP 服务器
                */}
              </text>
            </Show>

            {/* 显示状态命令提示 */}
            <text fg={theme.textMuted}>/status</text>
            {/* 说明：
                <text>：文本组件
                fg={theme.textMuted}：设置文本前景色为主题中的次要文字颜色
                /status：命令提示
                效果：显示 "/status"，提示用户可以使用 /status 命令查看详细状态
            */}
          </Match>
        </Switch>
      </box>
    </box>
  )
}
