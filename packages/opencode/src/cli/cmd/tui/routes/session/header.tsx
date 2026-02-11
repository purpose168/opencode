import type { AssistantMessage, Session } from "@opencode-ai/sdk/v2" // 导入 SDK 类型定义：助手消息类型、会话类型
import { SplitBorder } from "@tui/component/border" // 导入边框组件：分割边框、空边框
import { useRouteData } from "@tui/context/route" // 导入路由数据钩子，用于访问当前路由的数据
import { useSync } from "@tui/context/sync" // 导入同步上下文钩子，用于访问全局同步状态管理器
import { useTheme } from "@tui/context/theme" // 导入主题上下文钩子，用于访问主题配置
import { pipe, sumBy } from "remeda" // 导入 Remeda 函数式编程工具库：pipe 管道函数，sumBy 求和函数
import { type Accessor, createMemo, Match, Show, Switch } from "solid-js" // 导入 Solid.js 核心函数：Accessor 类型、createMemo 创建派生值，Match/Switch 条件渲染，Show 条件显示
import { useKeybind } from "../../context/keybind" // 导入快捷键上下文钩子，用于访问快捷键配置

/**
 * 会话标题子组件
 *
 * 功能说明：
 * 1. 显示会话标题，带有一个 # 前缀
 * 2. 使用粗体样式突出显示标题
 *
 * @param props - 组件属性对象
 * @param props.session - 会话对象的访问器函数
 * @returns 返回一个文本组件，显示会话标题
 */
const Title = (props: { session: Accessor<Session> }) => {
  const { theme } = useTheme() // 获取主题配置对象，包含颜色、样式等主题信息
  return (
    <text fg={theme.text}>
      {/* 说明：
          <text>：文本组件，用于显示文本内容
          fg={theme.text}：设置文本前景色为主题中的主要文字颜色
      */}
      <span style={{ bold: true }}>#</span> {/* # 符号，表示会话标题，使用粗体样式 */}
      <span style={{ bold: true }}>{props.session().title}</span> {/* 会话标题，使用粗体样式 */}
      {/* 说明：
          <span>：内联文本组件，用于设置样式
          style={{ bold: true }}：设置粗体样式
          props.session()：调用会话访问器函数，获取会话对象
          title：会话标题字段
          效果：显示 "# 会话标题"，如 "# My Session"
      */}
    </text>
  )
}

/**
 * 上下文信息子组件
 *
 * 功能说明：
 * 1. 显示当前上下文的 token 使用情况
 * 2. 显示会话的总成本
 * 3. 只在有上下文信息时显示
 *
 * @param props - 组件属性对象
 * @param props.context - 上下文信息的访问器函数
 * @param props.cost - 成本信息的访问器函数
 * @returns 返回一个文本组件，显示上下文信息和成本
 */
const ContextInfo = (props: { context: Accessor<string | undefined>; cost: Accessor<string> }) => {
  const { theme } = useTheme() // 获取主题配置对象，包含颜色、样式等主题信息
  return (
    <Show when={props.context()}>
      {/* 说明：
          <Show when={props.context()}>：条件显示，当上下文信息存在时显示
          props.context()：调用上下文访问器函数，获取上下文字符串
          返回值：上下文字符串，如 "4096 (50%)" 或 "8192"
      */}
      <text fg={theme.textMuted} wrapMode="none" flexShrink={0}>
        {/* 说明：
            <text>：文本组件，用于显示文本内容
            fg={theme.textMuted}：设置文本前景色为主题中的次要文字颜色
            wrapMode="none"：设置不换行模式，保持文本在一行显示
            flexShrink={0}：设置不收缩，确保内容完整显示
        */}
        {props.context()} {/* 上下文字符串，显示当前上下文的 token 使用情况 */}({props.cost()}){" "}
        {/* 成本字符串，显示会话的总成本，如 "$0.05" */}
        {/* 说明：
            props.context()：调用上下文访问器函数，获取上下文字符串
            props.cost()：调用成本访问器函数，获取成本字符串
            效果：显示 "4096 (50%) ($0.05)" 或 "8192 ($0.10)"
        */}
      </text>
    </Show>
  )
}

/**
 * 会话页面头部组件
 *
 * 功能说明：
 * 1. 显示会话标题
 * 2. 显示上下文信息和成本
 * 3. 根据会话类型显示不同的内容：
 *    - 主会话：显示标题、上下文信息、分享链接
 *    - 子智能体会话：显示子智能体提示、快捷键提示、上下文信息
 * 4. 显示分享链接（如果已分享）
 * 5. 显示快捷键提示（子智能体会话）
 *
 * 使用场景：
 * - 在会话页面顶部显示会话信息
 * - 帮助用户了解当前会话的状态和成本
 * - 提供快速访问父会话和子会话的快捷键提示
 * - 显示分享链接，方便用户分享会话
 *
 * 组件特性：
 * - 使用 createMemo 自动追踪状态变化并更新显示
 * - 使用 Switch/Match/Show 实现条件渲染
 * - 使用 pipe 和 sumBy 计算总成本和上下文使用情况
 * - 响应式更新所有状态信息
 * - 根据会话类型动态显示不同的内容
 *
 * @returns 返回一个头部布局组件，显示会话信息
 */
export function Header() {
  const route = useRouteData("session") // 获取当前会话路由数据，包含会话 ID 等信息
  const sync = useSync() // 获取同步上下文实例，用于访问会话、消息、提供者等同步数据

  // 创建派生值，获取当前会话对象
  const session = createMemo(() => sync.session.get(route.sessionID)!)
  // 说明：
  //   sync.session.get(route.sessionID)：从同步数据中获取指定会话对象
  //   route.sessionID：当前会话的唯一标识符
  //   !：非空断言，确保返回值不为 undefined
  //   createMemo：创建派生值，当会话数据变化时自动重新计算
  // 返回值：会话对象，包含标题、ID、父会话 ID、分享信息等
  // 用途：在头部显示会话标题和其他信息

  // 创建派生值，获取当前会话的所有消息
  const messages = createMemo(() => sync.data.message[route.sessionID] ?? [])
  // 说明：
  //   sync.data.message[route.sessionID]：从同步数据中获取指定会话的所有消息数组
  //   route.sessionID：当前会话的唯一标识符
  //   ?? []：空值合并运算符，如果会话不存在则返回空数组
  //   createMemo：创建派生值，当消息数据变化时自动重新计算
  // 返回值：消息数组，包含用户消息和助手消息
  // 用途：计算成本和上下文使用情况

  // 创建派生值，判断分享功能是否启用
  const shareEnabled = createMemo(() => sync.data.config.share !== "disabled")
  // 说明：
  //   sync.data.config.share：同步数据中的分享配置
  //   !== "disabled"：检查分享配置是否不等于 "disabled"
  //   createMemo：创建派生值，当配置变化时自动重新计算
  // 返回值：布尔值，true 表示分享功能启用，false 表示分享功能禁用
  // 用途：决定是否显示分享链接

  // 创建派生值，计算会话的总成本
  const cost = createMemo(() => {
    // 使用管道函数计算总成本
    const total = pipe(
      messages(), // 第一步：获取消息数组
      sumBy((x) => (x.role === "assistant" ? x.cost : 0)), // 第二步：对所有助手消息的成本求和
    )
    // 说明：
    //   pipe：管道函数，将多个函数串联起来依次执行
    //   messages()：调用消息派生值函数，获取消息数组
    //   sumBy：求和函数，对数组元素进行求和
    //   (x) => (x.role === "assistant" ? x.cost : 0)：求和函数，只计算助手消息的成本
    //   x.role：消息角色，"user" 或 "assistant"
    //   x.cost：消息成本，单位为美元
    //   total：总成本，单位为美元
    // 用途：计算会话的总成本，用于在头部显示

    // 格式化成本为美元货币格式
    return new Intl.NumberFormat("en-US", {
      style: "currency", // 货币样式
      currency: "USD", // 美元货币
    }).format(total)
    // 说明：
    //   Intl.NumberFormat：国际化数字格式化 API
    //   "en-US"：使用美国英语地区设置
    //   style: "currency"：设置为货币格式
    //   currency: "USD"：使用美元货币
    //   format(total)：格式化总成本为货币字符串
    //   返回值：格式化后的成本字符串，如 "$0.05" 或 "$1.23"
    // 用途：在头部显示格式化的成本信息
  })

  // 创建派生值，计算当前上下文的 token 使用情况
  const context = createMemo(() => {
    // 查找最后一个有输出 token 的助手消息
    const last = messages().findLast((x) => x.role === "assistant" && x.tokens.output > 0) as AssistantMessage
    // 说明：
    //   messages()：调用消息派生值函数，获取消息数组
    //   findLast()：从数组末尾开始查找第一个满足条件的元素
    //   x.role === "assistant"：只查找助手消息
    //   x.tokens.output > 0：只查找有输出 token 的消息
    //   as AssistantMessage：类型断言，确认为助手消息类型
    //   last：最后一个有输出 token 的助手消息，用于计算上下文使用情况

    // 如果没有找到符合条件的消息，返回 undefined
    if (!last) return
    // 说明：
    //   !last：检查 last 是否为 undefined 或 null
    //   return：返回 undefined，表示没有上下文信息
    // 原因：如果没有助手消息，则无法计算上下文使用情况

    // 计算总 token 数量
    const total =
      last.tokens.input + last.tokens.output + last.tokens.reasoning + last.tokens.cache.read + last.tokens.cache.write
    // 说明：
    //   last.tokens.input：输入 token 数量
    //   last.tokens.output：输出 token 数量
    //   last.tokens.reasoning：推理 token 数量
    //   last.tokens.cache.read：缓存读取 token 数量
    //   last.tokens.cache.write：缓存写入 token 数量
    //   total：总 token 数量，包含所有类型的 token
    // 用途：显示当前上下文的 token 使用情况

    // 查找模型信息
    const model = sync.data.provider.find((x) => x.id === last.providerID)?.models[last.modelID]
    // 说明：
    //   sync.data.provider：同步数据中的提供者列表
    //   find((x) => x.id === last.providerID)：查找与消息提供者 ID 匹配的提供者
    //   ?：可选链，如果提供者不存在则返回 undefined
    //   .models[last.modelID]：获取提供者的模型列表中与消息模型 ID 匹配的模型
    //   model：模型对象，包含上下文限制等信息

    // 格式化 token 数量为字符串
    let result = total.toLocaleString()
    // 说明：
    //   total.toLocaleString()：将数字转换为本地化字符串格式
    //   返回值：格式化后的字符串，如 "4,096" 或 "8,192"
    //   result：格式化后的 token 数量字符串

    // 如果模型有上下文限制，添加百分比信息
    if (model?.limit.context) {
      // 说明：
      //   model?.limit.context：模型的上下文限制，单位为 token
      //   ?：可选链，如果模型或限制不存在则跳过
      //   用途：计算当前上下文使用量占限制的百分比

      // 计算百分比并添加到结果字符串
      result += "  " + Math.round((total / model.limit.context) * 100) + "%"
      // 说明：
      //   total / model.limit.context：计算当前使用量占总限制的比例
      //   * 100：转换为百分比
      //   Math.round()：四舍五入到整数
      //   "  "：添加两个空格作为分隔符
      //   + "%"：添加百分号
      //   示例：如果 total=4096，limit.context=8192，则结果为 "4,096  50%"
    }

    // 返回格式化后的上下文字符串
    return result
  })

  // 获取主题配置对象
  const { theme } = useTheme()
  // 说明：
  //   useTheme()：主题上下文钩子函数
  //   返回值：主题配置对象，包含颜色、样式等主题信息
  // 用途：在头部组件中使用主题颜色和样式

  // 获取快捷键配置对象
  const keybind = useKeybind()
  // 说明：
  //   useKeybind()：快捷键上下文钩子函数
  //   返回值：快捷键配置对象，包含所有快捷键的定义
  // 用途：在头部显示快捷键提示

  // 返回头部布局组件
  return (
    <box flexShrink={0}>
      {/* 说明：
          <box>：容器组件，用于布局
          flexShrink={0}：设置不收缩，确保内容完整显示
      */}

      {/* 头部内容容器 */}
      <box
        paddingTop={1} // 设置顶部内边距为 1
        paddingBottom={1} // 设置底部内边距为 1
        paddingLeft={2} // 设置左侧内边距为 2
        paddingRight={1} // 设置右侧内边距为 1
        {...SplitBorder} // 展开分割边框配置
        border={["left"]} // 设置左侧边框
        borderColor={theme.border} // 设置边框颜色为主题中的边框颜色
        flexShrink={0} // 设置不收缩，确保内容完整显示
        backgroundColor={theme.backgroundPanel} // 设置背景色为主题中的面板背景色
      >
        {/* 说明：
            paddingTop/paddingBottom：设置上下内边距，增加视觉留白
            paddingLeft：设置左侧内边距，为左侧边框留出空间
            paddingRight：设置右侧内边距，增加右侧留白
            {...SplitBorder}：展开分割边框配置，包含边框字符等属性
            border={["left"]}：设置左侧边框，用于区分头部和主内容区
            borderColor：设置边框颜色，与主题保持一致
            flexShrink={0}：设置不收缩，确保头部内容完整显示
            backgroundColor：设置背景色，与主题面板背景色保持一致
        */}

        {/* 条件渲染：根据会话类型显示不同的内容 */}
        <Switch>
          {/* 情况 1：子智能体会话 */}
          <Match when={session()?.parentID}>
            {/* 说明：
                <Match when={session()?.parentID}>：条件匹配，当会话有父会话 ID 时显示
                session()?.parentID：会话的父会话 ID，如果存在则表示这是子智能体会话
                用途：显示子智能体特有的信息，如父会话提示和快捷键
            */}
            <box flexDirection="row" gap={2}>
              {/* 说明：
                  <box>：容器组件，用于布局
                  flexDirection="row"：设置布局方向为水平排列
                  gap={2}：设置子元素之间的间距为 2
              */}

              {/* 显示子智能体提示 */}
              <text fg={theme.text}>
                <b>Subagent session</b>
              </text>
              {/* 说明：
                  <text>：文本组件
                  fg={theme.text}：设置文本前景色为主题中的主要文字颜色
                  <b>：粗体文本组件
                  Subagent session：子智能体会话提示文本
                  效果：显示 "Subagent session"，提醒用户当前是子智能体会话
              */}

              {/* 显示父会话快捷键提示 */}
              <text fg={theme.text}>
                Parent <span style={{ fg: theme.textMuted }}>{keybind.print("session_parent")}</span>
              </text>
              {/* 说明：
                  <text>：文本组件
                  fg={theme.text}：设置文本前景色为主题中的主要文字颜色
                  Parent：父会话提示文本
                  <span>：内联文本组件，用于设置样式
                  style={{ fg: theme.textMuted }}：设置内联文本的前景色为次要文字颜色
                  keybind.print("session_parent")：打印父会话快捷键
                  效果：显示 "Parent Ctrl+P"，提示用户使用快捷键跳转到父会话
              */}

              {/* 显示上一个子会话快捷键提示 */}
              <text fg={theme.text}>
                Prev <span style={{ fg: theme.textMuted }}>{keybind.print("session_child_cycle_reverse")}</span>
              </text>
              {/* 说明：
                  <text>：文本组件
                  fg={theme.text}：设置文本前景色为主题中的主要文字颜色
                  Prev：上一个提示文本
                  <span>：内联文本组件，用于设置样式
                  style={{ fg: theme.textMuted }}：设置内联文本的前景色为次要文字颜色
                  keybind.print("session_child_cycle_reverse")：打印上一个子会话快捷键
                  效果：显示 "Prev Ctrl+["，提示用户使用快捷键切换到上一个子会话
              */}

              {/* 显示下一个子会话快捷键提示 */}
              <text fg={theme.text}>
                Next <span style={{ fg: theme.textMuted }}>{keybind.print("session_child_cycle")}</span>
              </text>
              {/* 说明：
                  <text>：文本组件
                  fg={theme.text}：设置文本前景色为主题中的主要文字颜色
                  Next：下一个提示文本
                  <span>：内联文本组件，用于设置样式
                  style={{ fg: theme.textMuted }}：设置内联文本的前景色为次要文字颜色
                  keybind.print("session_child_cycle")：打印下一个子会话快捷键
                  效果：显示 "Next Ctrl+]"，提示用户使用快捷键切换到下一个子会话
              */}

              {/* 弹性空间，将上下文信息推到右侧 */}
              <box flexGrow={1} flexShrink={1} />
              {/* 说明：
                  <box>：容器组件，用于布局
                  flexGrow={1}：设置弹性增长因子为 1，占据所有可用空间
                  flexShrink={1}：设置弹性收缩因子为 1，可以收缩
                  用途：将上下文信息推到右侧，保持布局美观
              */}

              {/* 显示上下文信息和成本 */}
              <ContextInfo context={context} cost={cost} />
              {/* 说明：
                  ContextInfo：上下文信息子组件
                  context：上下文信息的访问器函数
                  cost：成本信息的访问器函数
                  效果：显示上下文使用情况和成本，如 "4,096  50% ($0.05)"
              */}
            </box>
          </Match>

          {/* 情况 2：主会话 */}
          <Match when={true}>
            {/* 说明：
                <Match when={true}>：条件匹配，默认情况（主会话）时显示
                用途：显示主会话的标题、上下文信息和分享链接
            */}
            <box flexDirection="row" justifyContent="space-between" gap={1}>
              {/* 说明：
                  <box>：容器组件，用于布局
                  flexDirection="row"：设置布局方向为水平排列
                  justifyContent="space-between"：设置两端对齐，子元素分布在两端
                  gap={1}：设置子元素之间的间距为 1
              */}

              {/* 显示会话标题 */}
              <Title session={session} />
              {/* 说明：
                  Title：会话标题子组件
                  session：会话对象的访问器函数
                  效果：显示 "# 会话标题"
              */}

              {/* 显示上下文信息和成本 */}
              <ContextInfo context={context} cost={cost} />
              {/* 说明：
                  ContextInfo：上下文信息子组件
                  context：上下文信息的访问器函数
                  cost：成本信息的访问器函数
                  效果：显示上下文使用情况和成本，如 "4,096  50% ($0.05)"
              */}
            </box>

            {/* 显示分享链接（如果分享功能启用） */}
            <Show when={shareEnabled()}>
              {/* 说明：
                  <Show when={shareEnabled()}>：条件显示，当分享功能启用时显示
                  shareEnabled()：调用分享启用派生值函数，获取分享功能是否启用
                  用途：显示分享链接或分享提示
              */}
              <box flexDirection="row" justifyContent="space-between" gap={1}>
                {/* 说明：
                    <box>：容器组件，用于布局
                    flexDirection="row"：设置布局方向为水平排列
                    justifyContent="space-between"：设置两端对齐，子元素分布在两端
                    gap={1}：设置子元素之间的间距为 1
                */}

                {/* 分享链接容器 */}
                <box flexGrow={1} flexShrink={1}>
                  {/* 说明：
                      <box>：容器组件，用于布局
                      flexGrow={1}：设置弹性增长因子为 1，占据所有可用空间
                      flexShrink={1}：设置弹性收缩因子为 1，可以收缩
                      用途：让分享链接占据所有可用空间
                  */}

                  {/* 条件渲染：根据是否已分享显示不同的内容 */}
                  <Switch>
                    {/* 情况 1：已分享，显示分享链接 */}
                    <Match when={session().share?.url}>
                      <text fg={theme.textMuted} wrapMode="word">
                        {session().share!.url}
                      </text>
                      {/* 说明：
                          <Match when={session().share?.url}>：条件匹配，当会话有分享链接时显示
                          session().share?.url：会话的分享链接 URL
                          <text>：文本组件
                          fg={theme.textMuted}：设置文本前景色为主题中的次要文字颜色
                          wrapMode="word"：设置按单词换行模式
                          效果：显示分享链接，如 "https://example.com/share/abc123"
                      */}
                    </Match>

                    {/* 情况 2：未分享，显示分享提示 */}
                    <Match when={true}>
                      <text fg={theme.text} wrapMode="word">
                        /share <span style={{ fg: theme.textMuted }}>copy link</span>
                      </text>
                      {/* 说明：
                          <Match when={true}>：条件匹配，默认情况（未分享）时显示
                          <text>：文本组件
                          fg={theme.text}：设置文本前景色为主题中的主要文字颜色
                          wrapMode="word"：设置按单词换行模式
                          /share：分享命令提示
                          <span>：内联文本组件，用于设置样式
                          style={{ fg: theme.textMuted }}：设置内联文本的前景色为次要文字颜色
                          copy link：复制链接提示文本
                          效果：显示 "/share copy link"，提示用户使用 /share 命令分享会话
                      */}
                    </Match>
                  </Switch>
                </box>
              </box>
            </Show>
          </Match>
        </Switch>
      </box>
    </box>
  )
}
