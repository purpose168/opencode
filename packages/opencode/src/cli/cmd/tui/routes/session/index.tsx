import { LANGUAGE_EXTENSIONS } from "@/lsp/language" // 导入语言扩展名映射
import { BashTool } from "@/tool/bash" // 导入 Bash 工具组件
import type { EditTool } from "@/tool/edit" // 导入编辑工具类型定义
import type { GlobTool } from "@/tool/glob" // 导入文件搜索工具类型定义
import type { GrepTool } from "@/tool/grep" // 导入内容搜索工具类型定义
import type { ListTool } from "@/tool/ls" // 导入目录列表工具类型定义
import type { PatchTool } from "@/tool/patch" // 导入补丁工具类型定义
import type { ReadTool } from "@/tool/read" // 导入读取工具类型定义
import type { TaskTool } from "@/tool/task" // 导入任务工具类型定义
import { TodoWriteTool } from "@/tool/todo" // 导入待办事项写入工具组件
import type { Tool } from "@/tool/tool" // 导入工具类型定义
import type { WebFetchTool } from "@/tool/webfetch" // 导入网页获取工具类型定义
import type { WriteTool } from "@/tool/write" // 导入写入工具类型定义
import { Filesystem } from "@/util/filesystem" // 导入文件系统工具
import { Locale } from "@/util/locale" // 导入本地化工具，用于时间格式化等功能
import type { AssistantMessage, Part, ReasoningPart, TextPart, ToolPart, UserMessage } from "@opencode-ai/sdk/v2" // 导入 SDK 消息类型定义
import {
  addDefaultParsers,
  BoxRenderable, // 导入添加默认解析器的函数
  MacOSScrollAccel, // 导入可渲染的盒子组件类型
  ScrollBoxRenderable, // 导入滚动加速类型
  TextAttributes, // 导入 macOS 滚动加速类
  type ScrollAcceleration, // 导入滚动加速类型
} from "@opentui/core"
import { useRenderer, useTerminalDimensions, type JSX } from "@opentui/solid" // 导入 TUI 核心功能钩子和类型
import { SplitBorder } from "@tui/component/border" // 导入分割边框组件
import { useCommandDialog } from "@tui/component/dialog-command" // 导入命令对话框钩子，用于注册和触发命令
import { Prompt, type PromptRef } from "@tui/component/prompt" // 导入提示组件及其引用类型
import { useKeybind } from "@tui/context/keybind" // 导入快捷键上下文钩子，用于访问快捷键配置
import { useLocal } from "@tui/context/local" // 导入本地配置上下文钩子
import { useRoute, useRouteData } from "@tui/context/route" // 导入路由上下文钩子，用于访问路由信息和数据
import { useSDK } from "@tui/context/sdk" // 导入 SDK 上下文钩子，用于访问 API 客户端
import { useSync } from "@tui/context/sync" // 导入同步上下文钩子，用于访问全局同步状态管理器
import { useTheme } from "@tui/context/theme" // 导入主题上下文钩子，用于访问主题配置
import { DialogConfirm } from "@tui/ui/dialog-confirm" // 导入确认对话框组件
import { parsePatch } from "diff" // 导入补丁解析函数
import path from "path" // 导入 Node.js 的 path 模块，用于路径处理
import {
  createContext, // 导入 Solid.js 的 createContext 函数，用于创建上下文
  createEffect, // 导入 Solid.js 的 createEffect 函数，用于创建副作用
  createMemo, // 导入 Solid.js 的 createMemo 函数，用于创建派生值
  createSignal, // 导入 Solid.js 的 createSignal 函数，用于创建响应式信号
  For, // 导入 Solid.js 的 For 组件，用于列表渲染
  Match, // 导入 Solid.js 的 Match 组件，用于条件匹配
  on, // 导入 Solid.js 的 on 函数，用于追踪依赖
  Show, // 导入 Solid.js 的 Show 组件，用于条件显示
  Switch, // 导入 Solid.js 的 Switch 组件，用于多条件分支
  useContext, // 导入 Solid.js 的 useContext 函数，用于使用上下文
} from "solid-js"
import { Dynamic } from "solid-js/web" // 导入 Solid.js 的 Dynamic 组件，用于动态组件渲染
import stripAnsi from "strip-ansi" // 导入 ANSI 转义码清除工具
import parsers from "../../../../../../parsers-config.ts" // 导入解析器配置
import { DialogSessionRename } from "../../component/dialog-session-rename" // 导入会话重命名对话框组件
import type { PromptInfo } from "../../component/prompt/history" // 导入提示信息类型定义
import { TodoItem } from "../../component/todo-item" // 导入待办事项项组件
import { useKV } from "../../context/kv.tsx" // 导入键值存储上下文钩子
import { usePromptRef } from "../../context/prompt" // 导入提示引用上下文钩子
import { useDialog } from "../../ui/dialog" // 导入对话框上下文钩子，用于控制对话框的显示和行为
import { DialogExportOptions } from "../../ui/dialog-export-options" // 导入导出选项对话框组件
import { Toast, useToast } from "../../ui/toast" // 导入提示消息组件和钩子
import { Clipboard } from "../../util/clipboard" // 导入剪贴板工具
import { Editor } from "../../util/editor" // 导入编辑器工具
import { formatTranscript } from "../../util/transcript" // 导入会话记录格式化工具
import { DialogForkFromTimeline } from "./dialog-fork-from-timeline" // 导入从时间线创建分支对话框组件
import { DialogMessage } from "./dialog-message" // 导入消息操作对话框组件
import { DialogTimeline } from "./dialog-timeline" // 导入时间线对话框组件
import { Footer } from "./footer.tsx" // 导入页脚组件
import { Header } from "./header" // 导入头部组件
import { PermissionPrompt } from "./permission" // 导入权限提示组件
import { Sidebar } from "./sidebar" // 导入侧边栏组件

// 添加默认解析器
addDefaultParsers(parsers.parsers)
// 说明：
//   addDefaultParsers：添加默认解析器到 TUI 系统
//   parsers.parsers：解析器配置对象，包含各种文件类型的解析器
//   作用：确保 TUI 能够正确解析和显示各种文件类型的内容

/**
 * 自定义滚动速度类
 * 实现滚动加速接口，提供固定速度的滚动效果
 *
 * 功能说明：
 * 1. 提供固定速度的滚动加速
 * 2. 不考虑时间因素，始终返回相同速度
 *
 * 使用场景：
 * - 用户配置了自定义滚动速度
 * - 需要精确控制滚动速度
 */
class CustomSpeedScroll implements ScrollAcceleration {
  constructor(private speed: number) {} // 构造函数，接收固定速度值
  // 说明：
  //   speed：固定滚动速度值
  //   private：私有属性，只能在类内部访问
  //   用途：存储用户配置的滚动速度

  // 计算当前滚动速度
  tick(_now?: number): number {
    return this.speed
  }
  // 说明：
  //   _now：可选的当前时间戳（未使用）
  //   返回值：固定速度值
  //   用途：提供固定速度的滚动加速效果

  // 重置滚动状态
  reset(): void {}
  // 说明：
  //   返回值：无返回值
  //   用途：接口要求的方法，此类中不需要重置逻辑
}

/**
 * 会话上下文类型定义
 * 定义会话组件共享的上下文数据结构
 */
const context = createContext<{
  width: number // 内容区域宽度
  sessionID: string // 会话 ID
  conceal: () => boolean // 是否隐藏代码
  showThinking: () => boolean // 是否显示思考过程
  showTimestamps: () => boolean // 是否显示时间戳
  usernameVisible: () => boolean // 是否显示用户名
  showDetails: () => boolean // 是否显示工具详情
  diffWrapMode: () => "word" | "none" // 差异显示的换行模式
  sync: ReturnType<typeof useSync> // 同步上下文实例
}>()

/**
 * 使用会话上下文的钩子函数
 *
 * 功能说明：
 * 1. 获取会话上下文实例
 * 2. 验证上下文是否在会话组件内部使用
 *
 * @returns 返回会话上下文对象
 * @throws 如果在会话组件外部使用，抛出错误
 */
function use() {
  const ctx = useContext(context) // 获取会话上下文实例
  if (!ctx) throw new Error("useContext must be used within a Session component") // 验证上下文是否在会话组件内部使用
  // 说明：
  //   !ctx：检查上下文是否为 undefined
  //   throw new Error：抛出错误，提醒开发者正确使用上下文
  //   原因：确保上下文只在会话组件内部使用，避免误用
  return ctx // 返回会话上下文对象
}

/**
 * 会话页面主组件
 *
 * 功能说明：
 * 1. 显示会话的所有消息（用户消息和助手消息）
 * 2. 提供消息操作功能（回退、复制、分支等）
 * 3. 支持快捷键导航和操作
 * 4. 显示侧边栏（主会话）
 * 5. 显示头部和页脚
 * 6. 支持权限提示
 * 7. 支持会话分享
 * 8. 支持子智能体会话
 *
 * 使用场景：
 * - 用户与 AI 进行对话
 * - 查看和管理会话历史
 * - 执行各种会话操作
 *
 * 组件特性：
 * - 使用 createMemo 自动追踪状态变化
 * - 使用 createEffect 处理副作用
 * - 使用 createSignal 管理本地状态
 * - 支持键盘快捷键
 * - 响应式更新所有内容
 *
 * @returns 返回会话页面布局组件
 */
export function Session() {
  const route = useRouteData("session") // 获取会话路由数据
  const { navigate } = useRoute() // 获取路由导航函数
  const sync = useSync() // 获取同步上下文实例
  const kv = useKV() // 获取键值存储实例
  const { theme } = useTheme() // 获取主题配置对象
  const promptRef = usePromptRef() // 获取提示引用上下文

  // 创建派生值，获取当前会话对象
  const session = createMemo(() => sync.session.get(route.sessionID)!)
  // 说明：
  //   sync.session.get(route.sessionID)：从同步数据中获取指定会话对象
  //   route.sessionID：当前会话的唯一标识符
  //   !：非空断言，确保返回值不为 undefined
  //   createMemo：创建派生值，当会话数据变化时自动重新计算
  // 返回值：会话对象，包含标题、ID、父会话 ID、分享信息等

  // 创建派生值，获取子会话列表
  const children = createMemo(() => {
    const parentID = session()?.parentID ?? session()?.id // 获取父会话 ID，如果没有父会话则使用当前会话 ID
    return sync.data.session // 获取所有会话
      .filter((x) => x.parentID === parentID || x.id === parentID) // 过滤出父会话 ID 匹配的会话
      .toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) // 按 ID 排序
  })
  // 说明：
  //   parentID：父会话 ID，用于筛选子会话
  //   sync.data.session：同步数据中的所有会话
  //   filter：过滤函数，筛选出指定父会话的所有子会话
  //   toSorted：排序函数，按会话 ID 升序排列
  //   返回值：子会话列表，按 ID 排序

  // 创建派生值，获取当前会话的所有消息
  const messages = createMemo(() => sync.data.message[route.sessionID] ?? [])
  // 说明：
  //   sync.data.message[route.sessionID]：从同步数据中获取指定会话的所有消息数组
  //   route.sessionID：当前会话的唯一标识符
  //   ?? []：空值合并运算符，如果会话不存在则返回空数组
  //   createMemo：创建派生值，当消息数据变化时自动重新计算
  // 返回值：消息数组，包含用户消息和助手消息

  // 创建派生值，获取权限列表
  const permissions = createMemo(() => {
    // 如果是子智能体会话，只返回当前会话的权限
    if (session().parentID) return sync.data.permission[route.sessionID] ?? []
    // 如果是主会话，返回所有子会话的权限
    return children().flatMap((x) => sync.data.permission[x.id] ?? [])
  })
  // 说明：
  //   session().parentID：检查是否是子智能体会话
  //   sync.data.permission[route.sessionID]：获取当前会话的权限列表
  //   children()：获取所有子会话
  //   flatMap：将所有子会话的权限列表合并为一个数组
  //   返回值：权限列表，包含所有待处理的权限请求

  // 创建派生值，获取待处理的助手消息 ID
  const pending = createMemo(() => {
    return messages().findLast((x) => x.role === "assistant" && !x.time.completed)?.id
  })
  // 说明：
  //   messages()：获取消息列表
  //   findLast：从数组末尾开始查找第一个满足条件的元素
  //   x.role === "assistant"：只查找助手消息
  //   !x.time.completed：只查找未完成的消息
  //   返回值：待处理消息的 ID，如果没有则返回 undefined

  // 创建派生值，获取最后一个助手消息
  const lastAssistant = createMemo(() => {
    return messages().findLast((x) => x.role === "assistant")
  })
  // 说明：
  //   messages()：获取消息列表
  //   findLast：从数组末尾开始查找第一个满足条件的元素
  //   x.role === "assistant"：只查找助手消息
  //   返回值：最后一个助手消息对象，如果没有则返回 undefined

  // 获取终端尺寸
  const dimensions = useTerminalDimensions()
  // 说明：
  //   useTerminalDimensions()：终端尺寸钩子函数
  //   返回值：终端尺寸对象，包含 width 和 height 属性
  //   用途：根据终端尺寸动态调整布局

  // 创建侧边栏显示状态信号
  const [sidebar, setSidebar] = createSignal<"show" | "hide" | "auto">(kv.get("sidebar", "auto"))
  // 说明：
  //   createSignal：创建响应式信号
  //   kv.get("sidebar", "auto")：从键值存储中获取侧边栏配置，默认值为 "auto"
  //   类型：联合类型 "show" | "hide" | "auto"
  //   sidebar：侧边栏显示状态信号
  //   setSidebar：侧边栏显示状态设置函数

  // 创建代码隐藏状态信号
  const [conceal, setConceal] = createSignal(true)
  // 说明：
  //   createSignal：创建响应式信号
  //   true：默认值为 true，表示隐藏代码
  //   conceal：代码隐藏状态信号
  //   setConceal：代码隐藏状态设置函数

  // 创建思考过程显示状态信号
  const [showThinking, setShowThinking] = createSignal(kv.get("thinking_visibility", true))
  // 说明：
  //   createSignal：创建响应式信号
  //   kv.get("thinking_visibility", true)：从键值存储中获取思考可见性配置，默认值为 true
  //   showThinking：思考过程显示状态信号
  //   setShowThinking：思考过程显示状态设置函数

  // 创建时间戳显示状态信号
  const [showTimestamps, setShowTimestamps] = createSignal(kv.get("timestamps", "hide") === "show")
  // 说明：
  //   createSignal：创建响应式信号
  //   kv.get("timestamps", "hide")：从键值存储中获取时间戳配置，默认值为 "hide"
  //   === "show"：检查配置是否为 "show"
  //   showTimestamps：时间戳显示状态信号
  //   setShowTimestamps：时间戳显示状态设置函数

  // 创建用户名显示状态信号
  const [usernameVisible, setUsernameVisible] = createSignal(kv.get("username_visible", true))
  // 说明：
  //   createSignal：创建响应式信号
  //   kv.get("username_visible", true)：从键值存储中获取用户名可见性配置，默认值为 true
  //   usernameVisible：用户名显示状态信号
  //   setUsernameVisible：用户名显示状态设置函数

  // 创建工具详情显示状态信号
  const [showDetails, setShowDetails] = createSignal(kv.get("tool_details_visibility", true))
  // 说明：
  //   createSignal：创建响应式信号
  //   kv.get("tool_details_visibility", true)：从键值存储中获取工具详情可见性配置，默认值为 true
  //   showDetails：工具详情显示状态信号
  //   setShowDetails：工具详情显示状态设置函数

  // 创建助手元数据显示状态信号
  const [showAssistantMetadata, setShowAssistantMetadata] = createSignal(kv.get("assistant_metadata_visibility", true))
  // 说明：
  //   createSignal：创建响应式信号
  //   kv.get("assistant_metadata_visibility", true)：从键值存储中获取助手元数据可见性配置，默认值为 true
  //   showAssistantMetadata：助手元数据显示状态信号
  //   setShowAssistantMetadata：助手元数据显示状态设置函数

  // 创建滚动条显示状态信号
  const [showScrollbar, setShowScrollbar] = createSignal(kv.get("scrollbar_visible", false))
  // 说明：
  //   createSignal：创建响应式信号
  //   kv.get("scrollbar_visible", false)：从键值存储中获取滚动条可见性配置，默认值为 false
  //   showScrollbar：滚动条显示状态信号
  //   setShowScrollbar：滚动条显示状态设置函数

  // 创建差异换行模式信号
  const [diffWrapMode, setDiffWrapMode] = createSignal<"word" | "none">("word")
  // 说明：
  //   createSignal：创建响应式信号
  //   "word"：默认值为 "word"，表示按单词换行
  //   类型：联合类型 "word" | "none"
  //   diffWrapMode：差异换行模式信号
  //   setDiffWrapMode：差异换行模式设置函数

  // 创建动画启用状态信号
  const [animationsEnabled, setAnimationsEnabled] = createSignal(kv.get("animations_enabled", true))
  // 说明：
  //   createSignal：创建响应式信号
  //   kv.get("animations_enabled", true)：从键值存储中获取动画启用配置，默认值为 true
  //   animationsEnabled：动画启用状态信号
  //   setAnimationsEnabled：动画启用状态设置函数

  // 创建派生值，判断是否为宽屏模式
  const wide = createMemo(() => dimensions().width > 120)
  // 说明：
  //   dimensions().width：获取终端宽度
  //   > 120：判断宽度是否大于 120 列
  //   createMemo：创建派生值，当终端尺寸变化时自动重新计算
  // 返回值：布尔值，true 表示宽屏模式，false 表示窄屏模式

  // 创建派生值，判断侧边栏是否可见
  const sidebarVisible = createMemo(() => {
    // 如果是子智能体会话，不显示侧边栏
    if (session()?.parentID) return false
    // 如果侧边栏设置为显示，则显示
    if (sidebar() === "show") return true
    // 如果侧边栏设置为自动且为宽屏，则显示
    if (sidebar() === "auto" && wide()) return true
    // 其他情况不显示
    return false
  })
  // 说明：
  //   session()?.parentID：检查是否是子智能体会话
  //   sidebar()：获取侧边栏显示状态
  //   wide()：获取宽屏模式状态
  //   createMemo：创建派生值，当相关状态变化时自动重新计算
  // 返回值：布尔值，true 表示侧边栏可见，false 表示不可见

  // 创建派生值，计算内容区域宽度
  const contentWidth = createMemo(() => dimensions().width - (sidebarVisible() ? 42 : 0) - 4)
  // 说明：
  //   dimensions().width：获取终端宽度
  //   sidebarVisible() ? 42 : 0：如果侧边栏可见则减去 42 列，否则不减
  //   - 4：减去 4 列的内边距
  //   createMemo：创建派生值，当终端尺寸或侧边栏状态变化时自动重新计算
  // 返回值：内容区域的宽度，单位为列

  // 创建派生值，获取滚动加速配置
  const scrollAcceleration = createMemo(() => {
    const tui = sync.data.config.tui // 获取 TUI 配置
    // 如果启用了 macOS 滚动加速，使用 macOS 滚动加速
    if (tui?.scroll_acceleration?.enabled) {
      return new MacOSScrollAccel()
    }
    // 如果配置了自定义滚动速度，使用自定义滚动速度
    if (tui?.scroll_speed) {
      return new CustomSpeedScroll(tui.scroll_speed)
    }
    // 默认使用速度为 3 的自定义滚动
    return new CustomSpeedScroll(3)
  })
  // 说明：
  //   sync.data.config.tui：TUI 配置对象
  //   scroll_acceleration?.enabled：检查是否启用 macOS 滚动加速
  //   scroll_speed：自定义滚动速度配置
  //   MacOSScrollAccel：macOS 滚动加速类
  //   CustomSpeedScroll：自定义滚动速度类
  //   createMemo：创建派生值，当配置变化时自动重新计算
  // 返回值：滚动加速对象，用于控制滚动速度

  // 创建副作用，同步会话数据
  createEffect(async () => {
    await sync.session // 等待会话数据加载完成
      .sync(route.sessionID) // 同步指定会话的数据
      .then(() => {
        // 同步成功后，滚动到底部
        if (scroll) scroll.scrollBy(100_000)
      })
      .catch((e) => {
        // 同步失败，显示错误提示并导航到首页
        console.error(e)
        toast.show({
          message: `Session not found: ${route.sessionID}`,
          variant: "error",
        })
        return navigate({ type: "home" })
      })
  })
  // 说明：
  //   createEffect：创建副作用，当依赖变化时执行
  //   async：异步副作用
  //   sync.session.sync：同步会话数据方法
  //   route.sessionID：要同步的会话 ID
  //   scroll.scrollBy(100_000)：滚动到底部（100_000 是一个很大的值，确保滚动到最底部）
  //   toast.show：显示提示消息
  //   navigate({ type: "home" })：导航到首页
  //   作用：确保会话数据同步，并在同步失败时提供错误反馈

  // 获取提示消息钩子
  const toast = useToast()
  // 说明：
  //   useToast()：提示消息钩子函数
  //   返回值：提示消息对象，包含 show 方法
  //   用途：显示各种提示消息（成功、错误、警告等）

  // 获取 SDK 上下文
  const sdk = useSDK()
  // 说明：
  //   useSDK()：SDK 上下文钩子函数
  //   返回值：SDK 对象，包含 API 客户端
  //   用途：调用各种 API 方法（分享、回退、分支等）

  // 创建副作用，处理从分支创建的初始提示
  createEffect(() => {
    if (route.initialPrompt && prompt) {
      // 如果路由有初始提示且提示组件已加载
      prompt.set(route.initialPrompt) // 设置初始提示内容
    }
  })
  // 说明：
  //   createEffect：创建副作用，当依赖变化时执行
  //   route.initialPrompt：路由的初始提示信息
  //   prompt：提示组件引用
  //   prompt.set：设置提示内容的方法
  //   作用：从分支创建会话时，自动填充提示内容

  // 定义滚动盒子引用
  let scroll: ScrollBoxRenderable
  // 说明：
  //   ScrollBoxRenderable：可渲染的滚动盒子组件类型
  //   scroll：滚动盒子组件引用，用于控制滚动
  //   用途：控制消息区域的滚动行为

  // 定义提示组件引用
  let prompt: PromptRef
  // 说明：
  //   PromptRef：提示组件引用类型
  //   prompt：提示组件引用，用于控制提示组件
  //   用途：设置和获取提示内容

  // 获取快捷键配置
  const keybind = useKeybind()
  // 说明：
  //   useKeybind()：快捷键上下文钩子函数
  //   返回值：快捷键配置对象，包含所有快捷键的定义
  //   用途：显示快捷键提示和触发快捷键操作

  // 辅助函数：查找指定方向的下一个可见消息边界
  const findNextVisibleMessage = (direction: "next" | "prev"): string | null => {
    const children = scroll.getChildren() // 获取滚动区域的所有子元素
    const messagesList = messages() // 获取消息列表
    const scrollTop = scroll.y // 获取当前滚动位置

    // 获取可见消息，按位置排序，过滤有效的非合成、非忽略内容
    const visibleMessages = children
      .filter((c) => {
        if (!c.id) return false // 如果子元素没有 ID，则跳过
        const message = messagesList.find((m) => m.id === c.id) // 查找对应的消息对象
        if (!message) return false // 如果找不到消息，则跳过

        // 检查消息是否有有效的非合成、非忽略文本部分
        const parts = sync.data.part[message.id] // 获取消息的所有部分
        if (!parts || !Array.isArray(parts)) return false // 如果部分不存在或不是数组，则跳过

        // 检查是否有有效的文本部分（非合成、非忽略）
        return parts.some((part) => part && part.type === "text" && !part.synthetic && !part.ignored)
      })
      .sort((a, b) => a.y - b.y) // 按 Y 坐标排序，从上到下

    // 如果没有可见消息，返回 null
    if (visibleMessages.length === 0) return null

    // 根据方向查找消息
    if (direction === "next") {
      // 查找当前滚动位置下方的第一个消息
      return visibleMessages.find((c) => c.y > scrollTop + 10)?.id ?? null
      // 说明：
      //   c.y > scrollTop + 10：消息位置在当前滚动位置下方 10 像素以上
      //   ?.id：获取消息 ID，如果未找到则为 undefined
      //   ?? null：如果未找到，返回 null
    }
    // 查找当前滚动位置上方的最后一个消息
    return [...visibleMessages].reverse().find((c) => c.y < scrollTop - 10)?.id ?? null
    // 说明：
    //   [...visibleMessages].reverse()：反转数组，从下往上查找
    //   c.y < scrollTop - 10：消息位置在当前滚动位置上方 10 像素以上
    //   ?.id：获取消息 ID，如果未找到则为 undefined
    //   ?? null：如果未找到，返回 null
  }
  // 说明：
  //   direction：滚动方向，"next" 表示向下，"prev" 表示向上
  //   返回值：目标消息的 ID，如果没有找到则返回 null
  //   用途：在消息列表中快速定位到下一个或上一个可见消息

  // 辅助函数：滚动到指定方向的消息或回退到页面滚动
  const scrollToMessage = (direction: "next" | "prev", dialog: ReturnType<typeof useDialog>) => {
    const targetID = findNextVisibleMessage(direction) // 查找目标消息 ID

    // 如果没有找到目标消息，执行页面滚动
    if (!targetID) {
      scroll.scrollBy(direction === "next" ? scroll.height : -scroll.height) // 向下或向上滚动一页
      dialog.clear() // 清除对话框
      return
    }

    // 滚动到目标消息
    const child = scroll.getChildren().find((c) => c.id === targetID) // 查找目标消息的子元素
    if (child) scroll.scrollBy(child.y - scroll.y - 1) // 滚动到目标消息位置
    dialog.clear() // 清除对话框
  }
  // 说明：
  //   direction：滚动方向，"next" 表示向下，"prev" 表示向上
  //   dialog：对话框实例，用于清除对话框
  //   scroll.height：滚动区域的高度
  //   child.y - scroll.y - 1：计算滚动距离，使目标消息位于顶部
  //   用途：快速导航到下一个或上一个可见消息

  // 滚动到底部的函数
  function toBottom() {
    setTimeout(() => {
      // 延迟 50 毫秒后执行，确保 DOM 已更新
      if (scroll) scroll.scrollTo(scroll.scrollHeight) // 滚动到最底部
      // 说明：
      //   scroll.scrollHeight：滚动区域的总高度
      //   scrollTo：滚动到指定位置
    }, 50)
  }
  // 说明：
  //   setTimeout：延迟执行，确保 DOM 更新完成
  //   50：延迟时间，单位为毫秒
  //   用途：在发送消息后自动滚动到底部

  // 获取本地配置上下文
  const local = useLocal()
  // 说明：
  //   useLocal()：本地配置上下文钩子函数
  //   返回值：本地配置对象，包含模型、提供者等配置
  //   用途：访问本地配置，如当前选择的模型和提供者

  // 切换子会话的函数
  function moveChild(direction: number) {
    // 如果只有一个子会话，则不执行切换
    if (children().length === 1) return

    // 计算下一个子会话的索引
    let next = children().findIndex((x) => x.id === session()?.id) + direction
    // 说明：
    //   children().findIndex：查找当前会话在子会话列表中的索引
    //   session()?.id：当前会话的 ID
    //   + direction：加上方向参数（1 或 -1）

    // 处理索引越界
    if (next >= children().length) next = 0 // 如果超过最后一个，回到第一个
    if (next < 0) next = children().length - 1 // 如果小于第一个，跳到最后一个

    // 导航到目标会话
    if (children()[next]) {
      navigate({
        type: "session",
        sessionID: children()[next].id,
      })
    }
  }
  // 说明：
  //   direction：切换方向，1 表示下一个，-1 表示上一个
  //   children().length：子会话总数
  //   navigate：导航函数，用于切换会话
  //   用途：在子会话之间快速切换

  // 获取命令对话框钩子
  const command = useCommandDialog()
  // 说明：
  //   useCommandDialog()：命令对话框钩子函数
  //   返回值：命令对话框对象，包含 register 方法
  //   用途：注册会话相关的命令

  // 注册会话命令
  command.register(() => [
    // 如果分享功能未禁用，注册分享会话命令
    ...(sync.data.config.share !== "disabled"
      ? [
          {
            title: "Share session", // 命令标题
            value: "session.share", // 命令值
            suggested: route.type === "session", // 是否建议显示
            keybind: "session_share" as const, // 快捷键
            disabled: !!session()?.share?.url, // 如果已分享则禁用
            category: "Session", // 命令分类
            onSelect: async (dialog: any) => {
              // 选中命令时的回调
              await sdk.client.session // 调用 SDK 的分享会话 API
                .share({
                  sessionID: route.sessionID, // 会话 ID
                })
                .then(
                  (
                    res, // 分享成功后复制 URL 到剪贴板
                  ) =>
                    Clipboard.copy(res.data!.share!.url).catch(() =>
                      toast.show({ message: "Failed to copy URL to clipboard", variant: "error" }),
                    ),
                )
                .then(() => toast.show({ message: "Share URL copied to clipboard!", variant: "success" })) // 显示成功提示
                .catch(() => toast.show({ message: "Failed to share session", variant: "error" })) // 显示错误提示
              dialog.clear() // 清除对话框
            },
          },
        ]
      : []),
    {
      title: "Rename session", // 命令标题
      value: "session.rename", // 命令值
      keybind: "session_rename", // 快捷键
      category: "Session", // 命令分类
      onSelect: (dialog) => {
        // 选中命令时的回调
        dialog.replace(() => <DialogSessionRename session={route.sessionID} />) // 替换为重命名对话框
      },
    },
    {
      title: "Jump to message", // 命令标题
      value: "session.timeline", // 命令值
      keybind: "session_timeline", // 快捷键
      category: "Session", // 命令分类
      onSelect: (dialog) => {
        // 选中命令时的回调
        dialog.replace(() => (
          // 替换为时间线对话框
          <DialogTimeline
            onMove={(messageID) => {
              // 移动到指定消息时的回调
              const child = scroll.getChildren().find((child) => {
                return child.id === messageID // 查找目标消息的子元素
              })
              if (child) scroll.scrollBy(child.y - scroll.y - 1) // 滚动到目标消息
            }}
            sessionID={route.sessionID} // 会话 ID
            setPrompt={(promptInfo) => prompt.set(promptInfo)} // 设置提示内容
          />
        ))
      },
    },
    {
      title: "Fork from message", // 命令标题
      value: "session.fork", // 命令值
      keybind: "session_fork", // 快捷键
      category: "Session", // 命令分类
      onSelect: (dialog) => {
        // 选中命令时的回调
        dialog.replace(() => (
          // 替换为从时间线创建分支对话框
          <DialogForkFromTimeline
            onMove={(messageID) => {
              // 移动到指定消息时的回调
              const child = scroll.getChildren().find((child) => {
                return child.id === messageID // 查找目标消息的子元素
              })
              if (child) scroll.scrollBy(child.y - scroll.y - 1) // 滚动到目标消息
            }}
            sessionID={route.sessionID} // 会话 ID
          />
        ))
      },
    },
    {
      title: "Compact session", // 命令标题
      value: "session.compact", // 命令值
      keybind: "session_compact", // 快捷键
      category: "Session", // 命令分类
      onSelect: (dialog) => {
        // 选中命令时的回调
        const selectedModel = local.model.current() // 获取当前选择的模型
        // 如果没有选择模型，显示警告提示
        if (!selectedModel) {
          toast.show({
            variant: "warning",
            message: "Connect a provider to summarize this session",
            duration: 3000,
          })
          return
        }
        // 调用 SDK 的会话摘要 API
        sdk.client.session.summarize({
          sessionID: route.sessionID, // 会话 ID
          modelID: selectedModel.modelID, // 模型 ID
          providerID: selectedModel.providerID, // 提供者 ID
        })
        dialog.clear() // 清除对话框
      },
    },
    {
      title: "Unshare session", // 命令标题
      value: "session.unshare", // 命令值
      keybind: "session_unshare", // 快捷键
      disabled: !session()?.share?.url, // 如果未分享则禁用
      category: "Session", // 命令分类
      onSelect: async (dialog) => {
        // 选中命令时的回调
        await sdk.client.session // 调用 SDK 的取消分享 API
          .unshare({
            sessionID: route.sessionID, // 会话 ID
          })
          .then(() => toast.show({ message: "Session unshared successfully", variant: "success" })) // 显示成功提示
          .catch(() => toast.show({ message: "Failed to unshare session", variant: "error" })) // 显示错误提示
        dialog.clear() // 清除对话框
      },
    },
    {
      title: "Undo previous message", // 命令标题
      value: "session.undo", // 命令值
      keybind: "messages_undo", // 快捷键
      category: "Session", // 命令分类
      onSelect: async (dialog) => {
        // 选中命令时的回调
        const status = sync.data.session_status?.[route.sessionID] // 获取会话状态
        // 如果会话不是空闲状态，先中止会话
        if (status?.type !== "idle") await sdk.client.session.abort({ sessionID: route.sessionID }).catch(() => {})

        const revert = session().revert?.messageID // 获取回退消息 ID
        // 查找最近的用户消息
        const message = messages().findLast((x) => (!revert || x.id < revert) && x.role === "user")
        // 说明：
        //   !revert || x.id < revert：如果没有回退点，或者消息 ID 小于回退点
        //   x.role === "user"：只查找用户消息
        //   findLast：从数组末尾开始查找

        if (!message) return // 如果没有找到消息，则返回

        // 调用 SDK 的回退 API
        sdk.client.session
          .revert({
            sessionID: route.sessionID, // 会话 ID
            messageID: message.id, // 消息 ID
          })
          .then(() => {
            toBottom() // 滚动到底部
          })

        // 恢复提示内容
        const parts = sync.data.part[message.id] // 获取消息的所有部分
        prompt.set(
          parts.reduce(
            (agg, part) => {
              // 遍历消息部分，构建提示信息
              if (part.type === "text") {
                // 如果是文本部分
                if (!part.synthetic) agg.input += part.text // 如果不是合成文本，添加到输入
              }
              if (part.type === "file") agg.parts.push(part) // 如果是文件部分，添加到部分列表
              return agg
            },
            { input: "", parts: [] as PromptInfo["parts"] }, // 初始值
          ),
        )
        dialog.clear() // 清除对话框
      },
    },
    {
      title: "Redo", // 命令标题
      value: "session.redo", // 命令值
      keybind: "messages_redo", // 快捷键
      disabled: !session()?.revert?.messageID, // 如果没有回退点则禁用
      category: "Session", // 命令分类
      onSelect: (dialog) => {
        // 选中命令时的回调
        dialog.clear() // 清除对话框
        const messageID = session().revert?.messageID // 获取回退消息 ID
        if (!messageID) return // 如果没有回退点，则返回

        // 查找回退点之后的用户消息
        const message = messages().find((x) => x.role === "user" && x.id > messageID)
        // 说明：
        //   x.role === "user"：只查找用户消息
        //   x.id > messageID：消息 ID 大于回退点
        //   find：查找第一个满足条件的消息

        // 如果没有找到消息，取消回退
        if (!message) {
          sdk.client.session.unrevert({
            // 调用 SDK 的取消回退 API
            sessionID: route.sessionID, // 会话 ID
          })
          prompt.set({ input: "", parts: [] }) // 清空提示内容
          return
        }
        // 调用 SDK 的回退 API
        sdk.client.session.revert({
          sessionID: route.sessionID, // 会话 ID
          messageID: message.id, // 消息 ID
        })
      },
    },
    {
      title: sidebarVisible() ? "Hide sidebar" : "Show sidebar", // 命令标题，根据侧边栏状态动态显示
      value: "session.sidebar.toggle", // 命令值
      keybind: "sidebar_toggle", // 快捷键
      category: "Session", // 命令分类
      onSelect: (dialog) => {
        // 选中命令时的回调
        setSidebar((prev) => {
          // 切换侧边栏状态
          if (prev === "auto") return sidebarVisible() ? "hide" : "show" // 如果是自动模式，根据当前可见性切换
          if (prev === "show") return "hide" // 如果是显示，则隐藏
          return "show" // 如果是隐藏，则显示
        })
        // 保存配置
        if (sidebar() === "show") kv.set("sidebar", "auto") // 如果是显示，设置为自动
        if (sidebar() === "hide") kv.set("sidebar", "hide") // 如果是隐藏，设置为隐藏
        dialog.clear() // 清除对话框
      },
    },
    {
      title: usernameVisible() ? "Hide username" : "Show username", // 命令标题，根据用户名可见性动态显示
      value: "session.username_visible.toggle", // 命令值
      keybind: "username_toggle", // 快捷键
      category: "Session", // 命令分类
      onSelect: (dialog) => {
        // 选中命令时的回调
        setUsernameVisible((prev) => {
          // 切换用户名可见性
          const next = !prev // 取反
          kv.set("username_visible", next) // 保存配置
          return next
        })
        dialog.clear() // 清除对话框
      },
    },
    {
      title: "Toggle code concealment", // 命令标题：切换代码隐藏状态
      value: "session.toggle.conceal", // 命令值
      keybind: "messages_toggle_conceal" as any, // 快捷键绑定
      category: "Session", // 命令分类：会话相关
      onSelect: (dialog) => {
        // 选中命令时的回调函数
        setConceal((prev) => !prev) // 切换代码隐藏状态（取反）
        dialog.clear() // 清除对话框
      },
    },
    {
      title: showTimestamps() ? "Hide timestamps" : "Show timestamps", // 命令标题，根据当前时间戳显示状态动态显示
      value: "session.toggle.timestamps", // 命令值
      category: "Session", // 命令分类：会话相关
      onSelect: (dialog) => {
        // 选中命令时的回调函数
        setShowTimestamps((prev) => {
          // 切换时间戳显示状态
          const next = !prev // 取反
          kv.set("timestamps", next ? "show" : "hide") // 保存配置到键值存储
          return next
        })
        dialog.clear() // 清除对话框
      },
    },
    {
      title: showThinking() ? "Hide thinking" : "Show thinking", // 命令标题，根据当前思考过程显示状态动态显示
      value: "session.toggle.thinking", // 命令值
      category: "Session", // 命令分类：会话相关
      onSelect: (dialog) => {
        // 选中命令时的回调函数
        setShowThinking((prev) => {
          // 切换思考过程显示状态
          const next = !prev // 取反
          kv.set("thinking_visibility", next) // 保存配置到键值存储
          return next
        })
        dialog.clear() // 清除对话框
      },
    },
    {
      title: "Toggle diff wrapping", // 命令标题：切换差异换行模式
      value: "session.toggle.diffwrap", // 命令值
      category: "Session", // 命令分类：会话相关
      onSelect: (dialog) => {
        // 选中命令时的回调函数
        setDiffWrapMode((prev) => (prev === "word" ? "none" : "word")) // 切换差异换行模式（单词换行/不换行）
        dialog.clear() // 清除对话框
      },
    },
    {
      title: showDetails() ? "Hide tool details" : "Show tool details", // 命令标题，根据当前工具详情显示状态动态显示
      value: "session.toggle.actions", // 命令值
      keybind: "tool_details", // 快捷键绑定
      category: "Session", // 命令分类：会话相关
      onSelect: (dialog) => {
        // 选中命令时的回调函数
        const newValue = !showDetails() // 切换工具详情显示状态
        setShowDetails(newValue)
        kv.set("tool_details_visibility", newValue) // 保存配置到键值存储
        dialog.clear() // 清除对话框
      },
    },
    {
      title: "Toggle session scrollbar", // 命令标题：切换会话滚动条显示
      value: "session.toggle.scrollbar", // 命令值
      keybind: "scrollbar_toggle", // 快捷键绑定
      category: "Session", // 命令分类：会话相关
      onSelect: (dialog) => {
        // 选中命令时的回调函数
        setShowScrollbar((prev) => {
          // 切换滚动条显示状态
          const next = !prev // 取反
          kv.set("scrollbar_visible", next) // 保存配置到键值存储
          return next
        })
        dialog.clear() // 清除对话框
      },
    },
    {
      title: animationsEnabled() ? "Disable animations" : "Enable animations", // 命令标题，根据当前动画启用状态动态显示
      value: "session.toggle.animations", // 命令值
      category: "Session", // 命令分类：会话相关
      onSelect: (dialog) => {
        // 选中命令时的回调函数
        setAnimationsEnabled((prev) => {
          // 切换动画启用状态
          const next = !prev // 取反
          kv.set("animations_enabled", next) // 保存配置到键值存储
          return next
        })
        dialog.clear() // 清除对话框
      },
    },
    {
      title: "Page up", // 命令标题：向上翻页
      value: "session.page.up", // 命令值
      keybind: "messages_page_up", // 快捷键绑定
      category: "Session", // 命令分类：会话相关
      disabled: true, // 禁用状态
      onSelect: (dialog) => {
        // 选中命令时的回调函数
        scroll.scrollBy(-scroll.height / 2) // 向上滚动半页高度
        dialog.clear() // 清除对话框
      },
    },
    {
      title: "Page down", // 命令标题：向下翻页
      value: "session.page.down", // 命令值
      keybind: "messages_page_down", // 快捷键绑定
      category: "Session", // 命令分类：会话相关
      disabled: true, // 禁用状态
      onSelect: (dialog) => {
        // 选中命令时的回调函数
        scroll.scrollBy(scroll.height / 2) // 向下滚动半页高度
        dialog.clear() // 清除对话框
      },
    },
    {
      title: "Half page up", // 命令标题：向上翻半页
      value: "session.half.page.up", // 命令值
      keybind: "messages_half_page_up", // 快捷键绑定
      category: "Session", // 命令分类：会话相关
      disabled: true, // 禁用状态
      onSelect: (dialog) => {
        // 选中命令时的回调函数
        scroll.scrollBy(-scroll.height / 4) // 向上滚动四分之一页高度
        dialog.clear() // 清除对话框
      },
    },
    {
      title: "Half page down", // 命令标题：向下翻半页
      value: "session.half.page.down", // 命令值
      keybind: "messages_half_page_down", // 快捷键绑定
      category: "Session", // 命令分类：会话相关
      disabled: true, // 禁用状态
      onSelect: (dialog) => {
        // 选中命令时的回调函数
        scroll.scrollBy(scroll.height / 4) // 向下滚动四分之一页高度
        dialog.clear() // 清除对话框
      },
    },
    {
      title: "First message", // 命令标题：跳转到第一条消息
      value: "session.first", // 命令值
      keybind: "messages_first", // 快捷键绑定
      category: "Session", // 命令分类：会话相关
      disabled: true, // 禁用状态
      onSelect: (dialog) => {
        // 选中命令时的回调函数
        scroll.scrollTo(0) // 滚动到顶部（位置0）
        dialog.clear() // 清除对话框
      },
    },
    {
      title: "Last message", // 命令标题：跳转到最后一条消息
      value: "session.last", // 命令值
      keybind: "messages_last", // 快捷键绑定
      category: "Session", // 命令分类：会话相关
      disabled: true, // 禁用状态
      onSelect: (dialog) => {
        // 选中命令时的回调函数
        scroll.scrollTo(scroll.scrollHeight) // 滚动到底部（总高度）
        dialog.clear() // 清除对话框
      },
    },
    {
      title: "Jump to last user message", // 命令标题：跳转到最后一条用户消息
      value: "session.messages_last_user", // 命令值
      keybind: "messages_last_user", // 快捷键绑定
      category: "Session", // 命令分类：会话相关
      onSelect: () => {
        // 选中命令时的回调函数
        const messages = sync.data.message[route.sessionID] // 获取当前会话的所有消息
        if (!messages || !messages.length) return // 如果没有消息，直接返回

        // 查找最近的有有效非合成、非忽略文本部分的用户消息
        for (let i = messages.length - 1; i >= 0; i--) {
          // 从后往前遍历消息
          const message = messages[i]
          if (!message || message.role !== "user") continue // 跳过非用户消息

          const parts = sync.data.part[message.id] // 获取消息的所有部分
          if (!parts || !Array.isArray(parts)) continue // 如果部分不存在或不是数组，则跳过

          // 检查是否有有效的文本部分（非合成、非忽略）
          const hasValidTextPart = parts.some(
            (part) => part && part.type === "text" && !part.synthetic && !part.ignored,
          )

          if (hasValidTextPart) {
            // 如果有有效的文本部分
            const child = scroll.getChildren().find((child) => {
              return child.id === message.id // 查找目标消息的子元素
            })
            if (child) scroll.scrollBy(child.y - scroll.y - 1) // 滚动到目标消息位置
            break // 找到后退出循环
          }
        }
      },
    },
    {
      title: "Next message", // 命令标题：下一条消息
      value: "session.message.next", // 命令值
      keybind: "messages_next", // 快捷键绑定
      category: "Session", // 命令分类：会话相关
      disabled: true, // 禁用状态
      onSelect: (dialog) => scrollToMessage("next", dialog), // 选中命令时的回调函数，滚动到下一条消息
    },
    {
      title: "Previous message", // 命令标题：上一条消息
      value: "session.message.previous", // 命令值
      keybind: "messages_previous", // 快捷键
      category: "Session", // 命令分类
      disabled: true, // 禁用
      onSelect: (dialog) => scrollToMessage("prev", dialog), // 选中命令时的回调
    },
    {
      title: "Copy last assistant message", // 命令标题
      value: "messages.copy", // 命令值
      keybind: "messages_copy", // 快捷键
      category: "Session", // 命令分类
      onSelect: (dialog) => {
        // 选中命令时的回调
        const revertID = session()?.revert?.messageID // 获取回退消息 ID
        // 查找最后一个助手消息
        const lastAssistantMessage = messages().findLast(
          (msg) => msg.role === "assistant" && (!revertID || msg.id < revertID),
        )
        // 说明：
        //   msg.role === "assistant"：只查找助手消息
        //   !revertID || msg.id < revertID：如果没有回退点，或者消息 ID 小于回退点
        //   findLast：从数组末尾开始查找

        if (!lastAssistantMessage) {
          // 如果没有找到助手消息
          toast.show({ message: "No assistant messages found", variant: "error" })
          dialog.clear()
          return
        }

        const parts = sync.data.part[lastAssistantMessage.id] ?? [] // 获取消息的所有部分
        const textParts = parts.filter((part) => part.type === "text") // 过滤出文本部分
        if (textParts.length === 0) {
          // 如果没有文本部分
          toast.show({ message: "No text parts found in last assistant message", variant: "error" })
          dialog.clear()
          return
        }

        // 构建文本内容
        const text = textParts
          .map((part) => part.text) // 提取所有文本
          .join("\n") // 用换行符连接
          .trim() // 去除首尾空白

        if (!text) {
          // 如果没有文本内容
          toast.show({
            message: "No text content found in last assistant message",
            variant: "error",
          })
          dialog.clear()
          return
        }

        // 使用 OSC 52 序列复制到剪贴板（支持 tmux）
        const base64 = Buffer.from(text).toString("base64") // 将文本转换为 Base64 编码
        const osc52 = `\x1b]52;c;${base64}\x07` // OSC 52 转义序列
        const finalOsc52 = process.env["TMUX"] ? `\x1bPtmux;\x1b${osc52}\x1b\\` : osc52 // 如果在 tmux 中，添加 tmux 前缀
        /* @ts-expect-error */ // 忽略 TypeScript 类型检查
        renderer.writeOut(finalOsc52) // 写入 OSC 52 序列到终端输出

        // 同时使用 Clipboard API 复制
        Clipboard.copy(text)
          .then(() => toast.show({ message: "Message copied to clipboard!", variant: "success" })) // 显示成功提示
          .catch(() => toast.show({ message: "Failed to copy to clipboard", variant: "error" })) // 显示错误提示
        dialog.clear() // 清除对话框
      },
    },
    {
      title: "Copy session transcript", // 命令标题
      value: "session.copy", // 命令值
      keybind: "session_copy", // 快捷键
      category: "Session", // 命令分类
      onSelect: async (dialog) => {
        // 选中命令时的回调
        try {
          const sessionData = session() // 获取会话数据
          const sessionMessages = messages() // 获取会话消息
          // 格式化会话记录
          const transcript = formatTranscript(
            sessionData,
            sessionMessages.map((msg) => ({ info: msg, parts: sync.data.part[msg.id] ?? [] })),
            {
              thinking: showThinking(), // 是否显示思考过程
              toolDetails: showDetails(), // 是否显示工具详情
              assistantMetadata: showAssistantMetadata(), // 是否显示助手元数据
            },
          )
          await Clipboard.copy(transcript) // 复制到剪贴板
          toast.show({ message: "Session transcript copied to clipboard!", variant: "success" }) // 显示成功提示
        } catch (error) {
          // 捕获错误
          toast.show({ message: "Failed to copy session transcript", variant: "error" }) // 显示错误提示
        }
        dialog.clear() // 清除对话框
      },
    },
    {
      title: "Export session transcript", // 命令标题
      value: "session.export", // 命令值
      keybind: "session_export", // 快捷键
      category: "Session", // 命令分类
      onSelect: async (dialog) => {
        // 选中命令时的回调
        try {
          const sessionData = session() // 获取会话数据
          const sessionMessages = messages() // 获取会话消息

          // 生成默认文件名
          const defaultFilename = `session-${sessionData.id.slice(0, 8)}.md`

          // 显示导出选项对话框
          const options = await DialogExportOptions.show(
            dialog,
            defaultFilename,
            showThinking(),
            showDetails(),
            showAssistantMetadata(),
            false,
          )

          if (options === null) return // 如果用户取消，则返回

          // 格式化会话记录
          const transcript = formatTranscript(
            sessionData,
            sessionMessages.map((msg) => ({ info: msg, parts: sync.data.part[msg.id] ?? [] })),
            {
              thinking: options.thinking, // 是否显示思考过程
              toolDetails: options.toolDetails, // 是否显示工具详情
              assistantMetadata: options.assistantMetadata, // 是否显示助手元数据
            },
          )

          if (options.openWithoutSaving) {
            // 如果选择不保存直接打开
            // 只在编辑器中打开，不保存
            await Editor.open({ value: transcript, renderer })
          } else {
            // 否则保存到文件
            const exportDir = process.cwd() // 获取当前工作目录
            const filename = options.filename.trim() // 文件名（去除首尾空白）
            const filepath = path.join(exportDir, filename) // 拼接完整文件路径

            await Bun.write(filepath, transcript) // 写入文件

            // 如果可用，使用 EDITOR 打开
            const result = await Editor.open({ value: transcript, renderer })
            if (result !== undefined) {
              // 如果编辑器返回了修改后的内容
              await Bun.write(filepath, result) // 写入修改后的内容
            }

            toast.show({ message: `Session exported to ${filename}`, variant: "success" }) // 显示成功提示
          }
        } catch (error) {
          // 捕获错误
          toast.show({ message: "Failed to export session", variant: "error" }) // 显示错误提示
        }
        dialog.clear() // 清除对话框
      },
    },
    {
      title: "Next child session", // 命令标题
      value: "session.child.next", // 命令值
      keybind: "session_child_cycle", // 快捷键
      category: "Session", // 命令分类
      disabled: true, // 禁用
      onSelect: (dialog) => {
        // 选中命令时的回调
        moveChild(1) // 切换到下一个子会话
        dialog.clear() // 清除对话框
      },
    },
    {
      title: "Previous child session", // 命令标题
      value: "session.child.previous", // 命令值
      keybind: "session_child_cycle_reverse", // 快捷键
      category: "Session", // 命令分类
      disabled: true, // 禁用
      onSelect: (dialog) => {
        // 选中命令时的回调
        moveChild(-1) // 切换到上一个子会话
        dialog.clear() // 清除对话框
      },
    },
    {
      title: "Go to parent session", // 命令标题
      value: "session.parent", // 命令值
      keybind: "session_parent", // 快捷键
      category: "Session", // 命令分类
      disabled: true, // 禁用
      onSelect: (dialog) => {
        // 选中命令时的回调
        const parentID = session()?.parentID // 获取父会话 ID
        if (parentID) {
          // 如果有父会话
          navigate({
            // 导航到父会话
            type: "session",
            sessionID: parentID,
          })
        }
        dialog.clear()
      },
    },
  ])

  const revertInfo = createMemo(() => session()?.revert)
  const revertMessageID = createMemo(() => revertInfo()?.messageID)

  const revertDiffFiles = createMemo(() => {
    const diffText = revertInfo()?.diff ?? ""
    if (!diffText) return []

    try {
      const patches = parsePatch(diffText)
      return patches.map((patch) => {
        const filename = patch.newFileName || patch.oldFileName || "unknown"
        const cleanFilename = filename.replace(/^[ab]\//, "")
        return {
          filename: cleanFilename,
          additions: patch.hunks.reduce(
            (sum, hunk) => sum + hunk.lines.filter((line) => line.startsWith("+")).length,
            0,
          ),
          deletions: patch.hunks.reduce(
            (sum, hunk) => sum + hunk.lines.filter((line) => line.startsWith("-")).length,
            0,
          ),
        }
      })
    } catch (error) {
      return []
    }
  })

  const revertRevertedMessages = createMemo(() => {
    const messageID = revertMessageID()
    if (!messageID) return []
    return messages().filter((x) => x.id >= messageID && x.role === "user")
  })

  const revert = createMemo(() => {
    const info = revertInfo()
    if (!info) return
    if (!info.messageID) return
    return {
      messageID: info.messageID,
      reverted: revertRevertedMessages(),
      diff: info.diff,
      diffFiles: revertDiffFiles(),
    }
  })

  const dialog = useDialog()
  const renderer = useRenderer()

  // snap to bottom when session changes
  createEffect(on(() => route.sessionID, toBottom))

  return (
    <context.Provider
      value={{
        get width() {
          return contentWidth()
        },
        sessionID: route.sessionID,
        conceal,
        showThinking,
        showTimestamps,
        usernameVisible,
        showDetails,
        diffWrapMode,
        sync,
      }}
    >
      <box flexDirection="row">
        <box flexGrow={1} paddingBottom={1} paddingTop={1} paddingLeft={2} paddingRight={2} gap={1}>
          <Show when={session()}>
            <Show when={!sidebarVisible()}>
              <Header />
            </Show>
            <scrollbox
              ref={(r) => (scroll = r)}
              viewportOptions={{
                paddingRight: showScrollbar() ? 1 : 0,
              }}
              verticalScrollbarOptions={{
                paddingLeft: 1,
                visible: showScrollbar(),
                trackOptions: {
                  backgroundColor: theme.backgroundElement,
                  foregroundColor: theme.border,
                },
              }}
              stickyScroll={true}
              stickyStart="bottom"
              flexGrow={1}
              scrollAcceleration={scrollAcceleration()}
            >
              <For each={messages()}>
                {(message, index) => (
                  <Switch>
                    <Match when={message.id === revert()?.messageID}>
                      {(function () {
                        const command = useCommandDialog()
                        const [hover, setHover] = createSignal(false)
                        const dialog = useDialog()

                        const handleUnrevert = async () => {
                          const confirmed = await DialogConfirm.show(
                            dialog,
                            "Confirm Redo",
                            "Are you sure you want to restore the reverted messages?",
                          )
                          if (confirmed) {
                            command.trigger("session.redo")
                          }
                        }

                        return (
                          <box
                            onMouseOver={() => setHover(true)}
                            onMouseOut={() => setHover(false)}
                            onMouseUp={handleUnrevert}
                            marginTop={1}
                            flexShrink={0}
                            border={["left"]}
                            customBorderChars={SplitBorder.customBorderChars}
                            borderColor={theme.backgroundPanel}
                          >
                            <box
                              paddingTop={1}
                              paddingBottom={1}
                              paddingLeft={2}
                              backgroundColor={hover() ? theme.backgroundElement : theme.backgroundPanel}
                            >
                              <text fg={theme.textMuted}>{revert()!.reverted.length} message reverted</text>
                              <text fg={theme.textMuted}>
                                <span style={{ fg: theme.text }}>{keybind.print("messages_redo")}</span> or /redo to
                                restore
                              </text>
                              <Show when={revert()!.diffFiles?.length}>
                                <box marginTop={1}>
                                  <For each={revert()!.diffFiles}>
                                    {(file) => (
                                      <text fg={theme.text}>
                                        {file.filename}
                                        <Show when={file.additions > 0}>
                                          <span style={{ fg: theme.diffAdded }}> +{file.additions}</span>
                                        </Show>
                                        <Show when={file.deletions > 0}>
                                          <span style={{ fg: theme.diffRemoved }}> -{file.deletions}</span>
                                        </Show>
                                      </text>
                                    )}
                                  </For>
                                </box>
                              </Show>
                            </box>
                          </box>
                        )
                      })()}
                    </Match>
                    <Match when={revert()?.messageID && message.id >= revert()!.messageID}>
                      <></>
                    </Match>
                    <Match when={message.role === "user"}>
                      <UserMessage
                        index={index()}
                        onMouseUp={() => {
                          if (renderer.getSelection()?.getSelectedText()) return
                          dialog.replace(() => (
                            <DialogMessage
                              messageID={message.id}
                              sessionID={route.sessionID}
                              setPrompt={(promptInfo) => prompt.set(promptInfo)}
                            />
                          ))
                        }}
                        message={message as UserMessage}
                        parts={sync.data.part[message.id] ?? []}
                        pending={pending()}
                      />
                    </Match>
                    <Match when={message.role === "assistant"}>
                      <AssistantMessage
                        last={lastAssistant()?.id === message.id}
                        message={message as AssistantMessage}
                        parts={sync.data.part[message.id] ?? []}
                      />
                    </Match>
                  </Switch>
                )}
              </For>
            </scrollbox>
            <box flexShrink={0}>
              <Show when={permissions().length > 0}>
                <PermissionPrompt request={permissions()[0]} />
              </Show>
              <Prompt
                visible={!session().parentID && permissions().length === 0}
                ref={(r) => {
                  prompt = r
                  promptRef.set(r)
                }}
                disabled={permissions().length > 0}
                onSubmit={() => {
                  toBottom()
                }}
                sessionID={route.sessionID}
              />
            </box>
            <Show when={!sidebarVisible()}>
              <Footer />
            </Show>
          </Show>
          <Toast />
        </box>
        <Show when={sidebarVisible()}>
          <Sidebar sessionID={route.sessionID} />
        </Show>
      </box>
    </context.Provider>
  )
}

const MIME_BADGE: Record<string, string> = {
  "text/plain": "txt",
  "image/png": "img",
  "image/jpeg": "img",
  "image/gif": "img",
  "image/webp": "img",
  "application/pdf": "pdf",
  "application/x-directory": "dir",
}

function UserMessage(props: {
  message: UserMessage
  parts: Part[]
  onMouseUp: () => void
  index: number
  pending?: string
}) {
  const ctx = use()
  const local = useLocal()
  const text = createMemo(() => props.parts.flatMap((x) => (x.type === "text" && !x.synthetic ? [x] : []))[0])
  const files = createMemo(() => props.parts.flatMap((x) => (x.type === "file" ? [x] : [])))
  const sync = useSync()
  const { theme } = useTheme()
  const [hover, setHover] = createSignal(false)
  const queued = createMemo(() => props.pending && props.message.id > props.pending)
  const color = createMemo(() => (queued() ? theme.accent : local.agent.color(props.message.agent)))

  const compaction = createMemo(() => props.parts.find((x) => x.type === "compaction"))

  return (
    <>
      <Show when={text()}>
        <box
          id={props.message.id}
          border={["left"]}
          borderColor={color()}
          customBorderChars={SplitBorder.customBorderChars}
          marginTop={props.index === 0 ? 0 : 1}
        >
          <box
            onMouseOver={() => {
              setHover(true)
            }}
            onMouseOut={() => {
              setHover(false)
            }}
            onMouseUp={props.onMouseUp}
            paddingTop={1}
            paddingBottom={1}
            paddingLeft={2}
            backgroundColor={hover() ? theme.backgroundElement : theme.backgroundPanel}
            flexShrink={0}
          >
            <text fg={theme.text}>{text()?.text}</text>
            <Show when={files().length}>
              <box flexDirection="row" paddingBottom={1} paddingTop={1} gap={1} flexWrap="wrap">
                <For each={files()}>
                  {(file) => {
                    const bg = createMemo(() => {
                      if (file.mime.startsWith("image/")) return theme.accent
                      if (file.mime === "application/pdf") return theme.primary
                      return theme.secondary
                    })
                    return (
                      <text fg={theme.text}>
                        <span style={{ bg: bg(), fg: theme.background }}> {MIME_BADGE[file.mime] ?? file.mime} </span>
                        <span style={{ bg: theme.backgroundElement, fg: theme.textMuted }}> {file.filename} </span>
                      </text>
                    )
                  }}
                </For>
              </box>
            </Show>
            <text fg={theme.textMuted}>
              {ctx.usernameVisible() ? `${sync.data.config.username ?? "You "}` : "You "}
              <Show
                when={queued()}
                fallback={
                  <Show when={ctx.showTimestamps()}>
                    <span style={{ fg: theme.textMuted }}>
                      {ctx.usernameVisible() ? " · " : " "}
                      {Locale.todayTimeOrDateTime(props.message.time.created)}
                    </span>
                  </Show>
                }
              >
                <span> </span>
                <span style={{ bg: theme.accent, fg: theme.backgroundPanel, bold: true }}> QUEUED </span>
              </Show>
            </text>
          </box>
        </box>
      </Show>
      <Show when={compaction()}>
        <box
          marginTop={1}
          border={["top"]}
          title=" Compaction "
          titleAlignment="center"
          borderColor={theme.borderActive}
        />
      </Show>
    </>
  )
}

function AssistantMessage(props: { message: AssistantMessage; parts: Part[]; last: boolean }) {
  const local = useLocal()
  const { theme } = useTheme()
  const sync = useSync()
  const messages = createMemo(() => sync.data.message[props.message.sessionID] ?? [])

  const final = createMemo(() => {
    return props.message.finish && !["tool-calls", "unknown"].includes(props.message.finish)
  })

  const duration = createMemo(() => {
    if (!final()) return 0
    if (!props.message.time.completed) return 0
    const user = messages().find((x) => x.role === "user" && x.id === props.message.parentID)
    if (!user || !user.time) return 0
    return props.message.time.completed - user.time.created
  })

  return (
    <>
      <For each={props.parts}>
        {(part, index) => {
          const component = createMemo(() => PART_MAPPING[part.type as keyof typeof PART_MAPPING])
          return (
            <Show when={component()}>
              <Dynamic
                last={index() === props.parts.length - 1}
                component={component()}
                part={part as any}
                message={props.message}
              />
            </Show>
          )
        }}
      </For>
      <Show when={props.message.error}>
        <box
          border={["left"]}
          paddingTop={1}
          paddingBottom={1}
          paddingLeft={2}
          marginTop={1}
          backgroundColor={theme.backgroundPanel}
          customBorderChars={SplitBorder.customBorderChars}
          borderColor={theme.error}
        >
          <text fg={theme.textMuted}>{props.message.error?.data.message}</text>
        </box>
      </Show>
      <Switch>
        <Match when={props.last || final()}>
          <box paddingLeft={3}>
            <text marginTop={1}>
              <span style={{ fg: local.agent.color(props.message.agent) }}>▣ </span>{" "}
              <span style={{ fg: theme.text }}>{Locale.titlecase(props.message.mode)}</span>
              <span style={{ fg: theme.textMuted }}> · {props.message.modelID}</span>
              <Show when={duration()}>
                <span style={{ fg: theme.textMuted }}> · {Locale.duration(duration())}</span>
              </Show>
            </text>
          </box>
        </Match>
      </Switch>
    </>
  )
}

const PART_MAPPING = {
  text: TextPart,
  tool: ToolPart,
  reasoning: ReasoningPart,
}

function ReasoningPart(props: { last: boolean; part: ReasoningPart; message: AssistantMessage }) {
  const { theme, subtleSyntax } = useTheme()
  const ctx = use()
  const content = createMemo(() => {
    // Filter out redacted reasoning chunks from OpenRouter
    // OpenRouter sends encrypted reasoning data that appears as [REDACTED]
    return props.part.text.replace("[REDACTED]", "").trim()
  })
  return (
    <Show when={content() && ctx.showThinking()}>
      <box
        id={"text-" + props.part.id}
        paddingLeft={2}
        marginTop={1}
        flexDirection="column"
        border={["left"]}
        customBorderChars={SplitBorder.customBorderChars}
        borderColor={theme.backgroundElement}
      >
        <code
          filetype="markdown"
          drawUnstyledText={false}
          streaming={true}
          syntaxStyle={subtleSyntax()}
          content={"_Thinking:_ " + content()}
          conceal={ctx.conceal()}
          fg={theme.textMuted}
        />
      </box>
    </Show>
  )
}

function TextPart(props: { last: boolean; part: TextPart; message: AssistantMessage }) {
  const ctx = use()
  const { theme, syntax } = useTheme()
  return (
    <Show when={props.part.text.trim()}>
      <box id={"text-" + props.part.id} paddingLeft={3} marginTop={1} flexShrink={0}>
        <code
          filetype="markdown"
          drawUnstyledText={false}
          streaming={true}
          syntaxStyle={syntax()}
          content={props.part.text.trim()}
          conceal={ctx.conceal()}
          fg={theme.text}
        />
      </box>
    </Show>
  )
}

// Pending messages moved to individual tool pending functions

function ToolPart(props: { last: boolean; part: ToolPart; message: AssistantMessage }) {
  const sync = useSync()

  const toolprops = {
    get metadata() {
      return props.part.state.status === "pending" ? {} : (props.part.state.metadata ?? {})
    },
    get input() {
      return props.part.state.input ?? {}
    },
    get output() {
      return props.part.state.status === "completed" ? props.part.state.output : undefined
    },
    get permission() {
      const permissions = sync.data.permission[props.message.sessionID] ?? []
      const permissionIndex = permissions.findIndex((x) => x.tool?.callID === props.part.callID)
      return permissions[permissionIndex]
    },
    get tool() {
      return props.part.tool
    },
    get part() {
      return props.part
    },
  }

  return (
    <Switch>
      <Match when={props.part.tool === "bash"}>
        <Bash {...toolprops} />
      </Match>
      <Match when={props.part.tool === "glob"}>
        <Glob {...toolprops} />
      </Match>
      <Match when={props.part.tool === "read"}>
        <Read {...toolprops} />
      </Match>
      <Match when={props.part.tool === "grep"}>
        <Grep {...toolprops} />
      </Match>
      <Match when={props.part.tool === "list"}>
        <List {...toolprops} />
      </Match>
      <Match when={props.part.tool === "webfetch"}>
        <WebFetch {...toolprops} />
      </Match>
      <Match when={props.part.tool === "codesearch"}>
        <CodeSearch {...toolprops} />
      </Match>
      <Match when={props.part.tool === "websearch"}>
        <WebSearch {...toolprops} />
      </Match>
      <Match when={props.part.tool === "write"}>
        <Write {...toolprops} />
      </Match>
      <Match when={props.part.tool === "edit"}>
        <Edit {...toolprops} />
      </Match>
      <Match when={props.part.tool === "task"}>
        <Task {...toolprops} />
      </Match>
      <Match when={props.part.tool === "patch"}>
        <Patch {...toolprops} />
      </Match>
      <Match when={props.part.tool === "todowrite"}>
        <TodoWrite {...toolprops} />
      </Match>
      <Match when={true}>
        <GenericTool {...toolprops} />
      </Match>
    </Switch>
  )
}

type ToolProps<T extends Tool.Info> = {
  input: Partial<Tool.InferParameters<T>>
  metadata: Partial<Tool.InferMetadata<T>>
  permission: Record<string, any>
  tool: string
  output?: string
  part: ToolPart
}
function GenericTool(props: ToolProps<any>) {
  return (
    <InlineTool icon="⚙" pending="Writing command..." complete={true} part={props.part}>
      {props.tool} {input(props.input)}
    </InlineTool>
  )
}

function ToolTitle(props: { fallback: string; when: any; icon: string; children: JSX.Element }) {
  const { theme } = useTheme()
  return (
    <text paddingLeft={3} fg={props.when ? theme.textMuted : theme.text}>
      <Show fallback={<>~ {props.fallback}</>} when={props.when}>
        <span style={{ bold: true }}>{props.icon}</span> {props.children}
      </Show>
    </text>
  )
}

function InlineTool(props: { icon: string; complete: any; pending: string; children: JSX.Element; part: ToolPart }) {
  const [margin, setMargin] = createSignal(0)
  const { theme } = useTheme()
  const ctx = use()
  const sync = useSync()

  const permission = createMemo(() => {
    const callID = sync.data.permission[ctx.sessionID]?.at(0)?.tool?.callID
    if (!callID) return false
    return callID === props.part.callID
  })

  const fg = createMemo(() => {
    if (permission()) return theme.warning
    if (props.complete) return theme.textMuted
    return theme.text
  })

  const error = createMemo(() => (props.part.state.status === "error" ? props.part.state.error : undefined))

  const denied = createMemo(() => error()?.includes("rejected permission"))

  return (
    <box
      marginTop={margin()}
      paddingLeft={3}
      renderBefore={function () {
        const el = this as BoxRenderable
        const parent = el.parent
        if (!parent) {
          return
        }
        if (el.height > 1) {
          setMargin(1)
          return
        }
        const children = parent.getChildren()
        const index = children.indexOf(el)
        const previous = children[index - 1]
        if (!previous) {
          setMargin(0)
          return
        }
        if (previous.height > 1 || previous.id.startsWith("text-")) {
          setMargin(1)
          return
        }
      }}
    >
      <text paddingLeft={3} fg={fg()} attributes={denied() ? TextAttributes.STRIKETHROUGH : undefined}>
        <Show fallback={<>~ {props.pending}</>} when={props.complete}>
          <span style={{ bold: true }}>{props.icon}</span> {props.children}
        </Show>
      </text>
      <Show when={error() && !denied()}>
        <text fg={theme.error}>{error()}</text>
      </Show>
    </box>
  )
}

function BlockTool(props: { title: string; children: JSX.Element; onClick?: () => void }) {
  const { theme } = useTheme()
  const renderer = useRenderer()
  const [hover, setHover] = createSignal(false)
  return (
    <box
      border={["left"]}
      paddingTop={1}
      paddingBottom={1}
      paddingLeft={2}
      marginTop={1}
      gap={1}
      backgroundColor={hover() ? theme.backgroundMenu : theme.backgroundPanel}
      customBorderChars={SplitBorder.customBorderChars}
      borderColor={theme.background}
      onMouseOver={() => props.onClick && setHover(true)}
      onMouseOut={() => setHover(false)}
      onMouseUp={() => {
        if (renderer.getSelection()?.getSelectedText()) return
        props.onClick?.()
      }}
    >
      <text paddingLeft={3} fg={theme.textMuted}>
        {props.title}
      </text>
      {props.children}
    </box>
  )
}

function Bash(props: ToolProps<typeof BashTool>) {
  const output = createMemo(() => stripAnsi(props.metadata.output?.trim() ?? ""))
  const { theme } = useTheme()
  return (
    <Switch>
      <Match when={props.metadata.output !== undefined}>
        <BlockTool title={"# " + (props.input.description ?? "Shell")}>
          <box gap={1}>
            <text fg={theme.text}>$ {props.input.command}</text>
            <text fg={theme.text}>{output()}</text>
          </box>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="$" pending="Writing command..." complete={props.input.command} part={props.part}>
          {props.input.command}
        </InlineTool>
      </Match>
    </Switch>
  )
}

function Write(props: ToolProps<typeof WriteTool>) {
  const { theme, syntax } = useTheme()
  const code = createMemo(() => {
    if (!props.input.content) return ""
    return props.input.content
  })

  const diagnostics = createMemo(() => {
    const filePath = Filesystem.normalizePath(props.input.filePath ?? "")
    return props.metadata.diagnostics?.[filePath] ?? []
  })

  return (
    <Switch>
      <Match when={props.metadata.diagnostics !== undefined}>
        <BlockTool title={"# Wrote " + normalizePath(props.input.filePath!)}>
          <line_number fg={theme.textMuted} minWidth={3} paddingRight={1}>
            <code
              conceal={false}
              fg={theme.text}
              filetype={filetype(props.input.filePath!)}
              syntaxStyle={syntax()}
              content={code()}
            />
          </line_number>
          <Show when={diagnostics().length}>
            <For each={diagnostics()}>
              {(diagnostic) => (
                <text fg={theme.error}>
                  Error [{diagnostic.range.start.line}:{diagnostic.range.start.character}]: {diagnostic.message}
                </text>
              )}
            </For>
          </Show>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="←" pending="Preparing write..." complete={props.input.filePath} part={props.part}>
          Write {normalizePath(props.input.filePath!)}
        </InlineTool>
      </Match>
    </Switch>
  )
}

function Glob(props: ToolProps<typeof GlobTool>) {
  return (
    <InlineTool icon="✱" pending="Finding files..." complete={props.input.pattern} part={props.part}>
      Glob "{props.input.pattern}" <Show when={props.input.path}>in {normalizePath(props.input.path)} </Show>
      <Show when={props.metadata.count}>({props.metadata.count} matches)</Show>
    </InlineTool>
  )
}

function Read(props: ToolProps<typeof ReadTool>) {
  return (
    <InlineTool icon="→" pending="Reading file..." complete={props.input.filePath} part={props.part}>
      Read {normalizePath(props.input.filePath!)} {input(props.input, ["filePath"])}
    </InlineTool>
  )
}

function Grep(props: ToolProps<typeof GrepTool>) {
  return (
    <InlineTool icon="✱" pending="Searching content..." complete={props.input.pattern} part={props.part}>
      Grep "{props.input.pattern}" <Show when={props.input.path}>in {normalizePath(props.input.path)} </Show>
      <Show when={props.metadata.matches}>({props.metadata.matches} matches)</Show>
    </InlineTool>
  )
}

function List(props: ToolProps<typeof ListTool>) {
  const dir = createMemo(() => {
    if (props.input.path) {
      return normalizePath(props.input.path)
    }
    return ""
  })
  return (
    <InlineTool icon="→" pending="Listing directory..." complete={props.input.path !== undefined} part={props.part}>
      List {dir()}
    </InlineTool>
  )
}

function WebFetch(props: ToolProps<typeof WebFetchTool>) {
  return (
    <InlineTool icon="%" pending="Fetching from the web..." complete={(props.input as any).url} part={props.part}>
      WebFetch {(props.input as any).url}
    </InlineTool>
  )
}

function CodeSearch(props: ToolProps<any>) {
  const input = props.input as any
  const metadata = props.metadata as any
  return (
    <InlineTool icon="◇" pending="Searching code..." complete={input.query} part={props.part}>
      Exa Code Search "{input.query}" <Show when={metadata.results}>({metadata.results} results)</Show>
    </InlineTool>
  )
}

function WebSearch(props: ToolProps<any>) {
  const input = props.input as any
  const metadata = props.metadata as any
  return (
    <InlineTool icon="◈" pending="Searching web..." complete={input.query} part={props.part}>
      Exa Web Search "{input.query}" <Show when={metadata.numResults}>({metadata.numResults} results)</Show>
    </InlineTool>
  )
}

function Task(props: ToolProps<typeof TaskTool>) {
  const { theme } = useTheme()
  const keybind = useKeybind()
  const { navigate } = useRoute()

  const current = createMemo(() => props.metadata.summary?.findLast((x) => x.state.status !== "pending"))

  return (
    <Switch>
      <Match when={props.metadata.summary?.length}>
        <BlockTool
          title={"# " + Locale.titlecase(props.input.subagent_type ?? "unknown") + " Task"}
          onClick={
            props.metadata.sessionId
              ? () => navigate({ type: "session", sessionID: props.metadata.sessionId! })
              : undefined
          }
        >
          <box>
            <text style={{ fg: theme.textMuted }}>
              {props.input.description} ({props.metadata.summary?.length} toolcalls)
            </text>
            <Show when={current()}>
              <text style={{ fg: current()!.state.status === "error" ? theme.error : theme.textMuted }}>
                └ {Locale.titlecase(current()!.tool)}{" "}
                {current()!.state.status === "completed" ? current()!.state.title : ""}
              </text>
            </Show>
          </box>
          <text fg={theme.text}>
            {keybind.print("session_child_cycle")}
            <span style={{ fg: theme.textMuted }}> view subagents</span>
          </text>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool
          icon="◉"
          pending="Delegating..."
          complete={props.input.subagent_type ?? props.input.description}
          part={props.part}
        >
          {Locale.titlecase(props.input.subagent_type ?? "unknown")} Task "{props.input.description}"
        </InlineTool>
      </Match>
    </Switch>
  )
}

function Edit(props: ToolProps<typeof EditTool>) {
  const ctx = use()
  const { theme, syntax } = useTheme()

  const view = createMemo(() => {
    const diffStyle = ctx.sync.data.config.tui?.diff_style
    if (diffStyle === "stacked") return "unified"
    // Default to "auto" behavior
    return ctx.width > 120 ? "split" : "unified"
  })

  const ft = createMemo(() => filetype(props.input.filePath))

  const diffContent = createMemo(() => props.metadata.diff)

  const diagnostics = createMemo(() => {
    const filePath = Filesystem.normalizePath(props.input.filePath ?? "")
    const arr = props.metadata.diagnostics?.[filePath] ?? []
    return arr.filter((x) => x.severity === 1).slice(0, 3)
  })

  return (
    <Switch>
      <Match when={props.metadata.diff !== undefined}>
        <BlockTool title={"← Edit " + normalizePath(props.input.filePath!)}>
          <box paddingLeft={1}>
            <diff
              diff={diffContent()}
              view={view()}
              filetype={ft()}
              syntaxStyle={syntax()}
              showLineNumbers={true}
              width="100%"
              wrapMode={ctx.diffWrapMode()}
              fg={theme.text}
              addedBg={theme.diffAddedBg}
              removedBg={theme.diffRemovedBg}
              contextBg={theme.diffContextBg}
              addedSignColor={theme.diffHighlightAdded}
              removedSignColor={theme.diffHighlightRemoved}
              lineNumberFg={theme.diffLineNumber}
              lineNumberBg={theme.diffContextBg}
              addedLineNumberBg={theme.diffAddedLineNumberBg}
              removedLineNumberBg={theme.diffRemovedLineNumberBg}
            />
          </box>
          <Show when={diagnostics().length}>
            <box>
              <For each={diagnostics()}>
                {(diagnostic) => (
                  <text fg={theme.error}>
                    Error [{diagnostic.range.start.line + 1}:{diagnostic.range.start.character + 1}]{" "}
                    {diagnostic.message}
                  </text>
                )}
              </For>
            </box>
          </Show>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="←" pending="Preparing edit..." complete={props.input.filePath} part={props.part}>
          Edit {normalizePath(props.input.filePath!)} {input({ replaceAll: props.input.replaceAll })}
        </InlineTool>
      </Match>
    </Switch>
  )
}

function Patch(props: ToolProps<typeof PatchTool>) {
  const { theme } = useTheme()
  return (
    <Switch>
      <Match when={props.output !== undefined}>
        <BlockTool title="# Patch">
          <box>
            <text fg={theme.text}>{props.output?.trim()}</text>
          </box>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="%" pending="Preparing patch..." complete={false} part={props.part}>
          Patch
        </InlineTool>
      </Match>
    </Switch>
  )
}

function TodoWrite(props: ToolProps<typeof TodoWriteTool>) {
  return (
    <Switch>
      <Match when={props.metadata.todos?.length}>
        <BlockTool title="# Todos">
          <box>
            <For each={props.input.todos ?? []}>
              {(todo) => <TodoItem status={todo.status} content={todo.content} />}
            </For>
          </box>
        </BlockTool>
      </Match>
      <Match when={true}>
        <InlineTool icon="⚙" pending="Updating todos..." complete={false} part={props.part}>
          Updating todos...
        </InlineTool>
      </Match>
    </Switch>
  )
}

function normalizePath(input?: string) {
  if (!input) return ""
  if (path.isAbsolute(input)) {
    return path.relative(process.cwd(), input) || "."
  }
  return input
}

function input(input: Record<string, any>, omit?: string[]): string {
  const primitives = Object.entries(input).filter(([key, value]) => {
    if (omit?.includes(key)) return false
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
  })
  if (primitives.length === 0) return ""
  return `[${primitives.map(([key, value]) => `${key}=${value}`).join(", ")}]`
}

function filetype(input?: string) {
  if (!input) return "none"
  const ext = path.extname(input)
  const language = LANGUAGE_EXTENSIONS[ext]
  if (["typescriptreact", "javascriptreact", "javascript"].includes(language)) return "typescript"
  return language
}
