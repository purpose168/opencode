import { render, useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid" // 从 @opentui/solid 导入渲染器、键盘、终端尺寸等核心 TUI 功能
import { Clipboard } from "@tui/util/clipboard" // 导入剪贴板工具
import { TextAttributes } from "@opentui/core" // 导入文本属性（如粗体、颜色等）
import { RouteProvider, useRoute } from "@tui/context/route" // 导入路由上下文提供者和钩子
import { Switch, Match, createEffect, untrack, ErrorBoundary, createSignal, onMount, batch, Show, on } from "solid-js" // 从 Solid.js 导入响应式核心功能
import { Installation } from "@/installation" // 导入安装管理模块
import { Flag } from "@/flag/flag" // 导入功能标志模块
import { DialogProvider, useDialog } from "@tui/ui/dialog" // 导入对话框上下文提供者和钩子
import { DialogProvider as DialogProviderList } from "@tui/component/dialog-provider" // 导入对话框列表提供者
import { SDKProvider, useSDK } from "@tui/context/sdk" // 导入 SDK 上下文提供者和钩子
import { SyncProvider, useSync } from "@tui/context/sync" // 导入同步上下文提供者和钩子
import { LocalProvider, useLocal } from "@tui/context/local" // 导入本地状态上下文提供者和钩子
import { DialogModel, useConnected } from "@tui/component/dialog-model" // 导入模型对话框和连接状态
import { DialogMcp } from "@tui/component/dialog-mcp" // 导入 MCP 对话框组件
import { DialogStatus } from "@tui/component/dialog-status" // 导入状态对话框组件
import { DialogThemeList } from "@tui/component/dialog-theme-list" // 导入主题列表对话框组件
import { DialogHelp } from "./ui/dialog-help" // 导入帮助对话框组件
import { CommandProvider, useCommandDialog } from "@tui/component/dialog-command" // 导入命令对话框上下文提供者和钩子
import { DialogAgent } from "@tui/component/dialog-agent" // 导入代理对话框组件
import { DialogSessionList } from "@tui/component/dialog-session-list" // 导入会话列表对话框组件
import { KeybindProvider } from "@tui/context/keybind" // 导入快捷键上下文提供者
import { ThemeProvider, useTheme } from "@tui/context/theme" // 导入主题上下文提供者和钩子
import { Home } from "@tui/routes/home" // 导入首页路由组件
import { Session } from "@tui/routes/session" // 导入会话路由组件
import { PromptHistoryProvider } from "./component/prompt/history" // 导入提示历史提供者
import { PromptStashProvider } from "./component/prompt/stash" // 导入提示暂存提供者
import { DialogAlert } from "./ui/dialog-alert" // 导入警告对话框组件
import { ToastProvider, useToast } from "./ui/toast" // 导入通知提供者和钩子
import { ExitProvider, useExit } from "./context/exit" // 导入退出上下文提供者和钩子
import { Session as SessionApi } from "@/session" // 导入会话 API
import { TuiEvent } from "./event" // 导入 TUI 事件定义
import { KVProvider, useKV } from "./context/kv" // 导入键值存储上下文提供者和钩子
import { Provider } from "@/provider/provider" // 导入提供者管理模块
import { ArgsProvider, useArgs, type Args } from "./context/args" // 导入命令行参数上下文提供者、钩子和类型
import open from "open" // 导入打开 URL 的工具
import { PromptRefProvider, usePromptRef } from "./context/prompt" // 导入提示引用上下文提供者和钩子

/**
 * getTerminalBackgroundColor 获取终端背景颜色
 * 
 * 功能说明：
 * - 检测终端的背景颜色是深色还是浅色
 * - 使用 ANSI 转义序列查询终端的背景颜色
 * - 支持多种颜色格式：rgb:RR/GG/BB、#RRGGBB、rgb(R,G,B)
 * - 使用相对亮度公式计算亮度，根据阈值判断是深色还是浅色
 * - 如果不是 TTY 终端，默认返回深色
 * - 设置 1 秒超时，超时后默认返回深色
 * 
 * 使用场景：
 * - 应用启动时需要根据终端背景颜色选择合适的主题
 * - 需要自动适配终端的深色/浅色模式时
 * - 需要提供更好的用户体验时
 * 
 * 返回值：
 * - 返回 "dark" 表示终端背景是深色
 * - 返回 "light" 表示终端背景是浅色
 */
async function getTerminalBackgroundColor(): Promise<"dark" | "light"> { // 异步函数，返回 "dark" 或 "light"
  if (!process.stdin.isTTY) return "dark" // 如果不是 TTY 终端，返回深色

  return new Promise((resolve) => { // 创建 Promise
    let timeout: NodeJS.Timeout // 超时定时器

    const cleanup = () => { // 清理函数
      process.stdin.setRawMode(false) // 关闭原始模式
      process.stdin.removeListener("data", handler) // 移除数据监听器
      clearTimeout(timeout) // 清除超时定时器
    }

    const handler = (data: Buffer) => { // 数据处理函数
      const str = data.toString() // 将 Buffer 转换为字符串
      const match = str.match(/\x1b]11;([^\x07\x1b]+)/) // 匹配 ANSI 转义序列中的背景颜色
      if (match) { // 如果匹配成功
        cleanup() // 清理资源
        const color = match[1] // 获取颜色字符串
        let r = 0, g = 0, b = 0 // 初始化 RGB 值

        if (color.startsWith("rgb:")) { // 如果颜色格式为 rgb:RR/GG/BB
          const parts = color.substring(4).split("/") // 分割颜色字符串
          r = parseInt(parts[0], 16) >> 8 // 将 16 位转换为 8 位
          g = parseInt(parts[1], 16) >> 8 // 将 16 位转换为 8 位
          b = parseInt(parts[2], 16) >> 8 // 将 16 位转换为 8 位
        } else if (color.startsWith("#")) { // 如果颜色格式为 #RRGGBB
          r = parseInt(color.substring(1, 3), 16) // 解析红色值
          g = parseInt(color.substring(3, 5), 16) // 解析绿色值
          b = parseInt(color.substring(5, 7), 16) // 解析蓝色值
        } else if (color.startsWith("rgb(")) { // 如果颜色格式为 rgb(R,G,B)
          const parts = color.substring(4, color.length - 1).split(",") // 分割颜色字符串
          r = parseInt(parts[0]) // 解析红色值
          g = parseInt(parts[1]) // 解析绿色值
          b = parseInt(parts[2]) // 解析蓝色值
        }

        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255 // 使用相对亮度公式计算亮度

        resolve(luminance > 0.5 ? "light" : "dark") // 根据亮度阈值判断是深色还是浅色
      }
    }

    process.stdin.setRawMode(true) // 开启原始模式
    process.stdin.on("data", handler) // 监听数据输入
    process.stdout.write("\x1b]11;?\x07") // 发送 ANSI 转义序列查询背景颜色

    timeout = setTimeout(() => { // 设置超时定时器
      cleanup() // 清理资源
      resolve("dark") // 超时后返回深色
    }, 1000) // 1 秒超时
  })
}

/**
 * tui TUI 应用主入口函数
 * 
 * 功能说明：
 * - 初始化 TUI 应用并启动渲染循环
 * - 检测终端背景颜色并设置主题模式
 * - 设置多层上下文提供者，包括路由、SDK、同步、本地状态、主题、快捷键等
 * - 配置渲染器选项，包括目标帧率、控制台选项、键盘绑定等
 * - 处理退出逻辑，确保资源正确释放
 * - 使用 ErrorBoundary 捕获应用中的错误
 * 
 * 使用场景：
 * - 应用启动时调用此函数初始化 TUI 界面
 * - 需要启动 OpenCode 的终端用户界面时
 * - 需要配置 TUI 应用的各种上下文和选项时
 * 
 * 参数说明：
 * - input.url: SDK 服务器的 URL
 * - input.args: 命令行参数
 * - input.onExit: 退出回调函数
 * 
 * 返回值：
 * - 返回 Promise，在应用退出时解析
 */
export function tui(input: { url: string; args: Args; onExit?: () => Promise<void> }) { // 导出 TUI 主入口函数
  return new Promise<void>(async (resolve) => { // 创建 Promise，防止立即退出
    const mode = await getTerminalBackgroundColor() // 获取终端背景颜色
    const onExit = async () => { // 定义退出处理函数
      await input.onExit?.() // 调用用户提供的退出回调
      resolve() // 解析 Promise
    }

    render( // 启动 TUI 渲染
      () => { // 渲染函数
        return (
          <ErrorBoundary // 错误边界，捕获子组件中的错误
            fallback={(error, reset) => <ErrorComponent error={error} reset={reset} onExit={onExit} mode={mode} />} // 错误回退组件
          >
            <ArgsProvider {...input.args}> {/* 命令行参数提供者 */}
              <ExitProvider onExit={onExit}> {/* 退出处理提供者 */}
                <KVProvider> {/* 键值存储提供者 */}
                  <ToastProvider> {/* 通知提供者 */}
                    <RouteProvider> {/* 路由提供者 */}
                      <SDKProvider url={input.url}> {/* SDK 提供者 */}
                        <SyncProvider> {/* 同步状态提供者 */}
                          <ThemeProvider mode={mode}> {/* 主题提供者 */}
                            <LocalProvider> {/* 本地状态提供者 */}
                              <KeybindProvider> {/* 快捷键提供者 */}
                                <PromptStashProvider> {/* 提示暂存提供者 */}
                                  <DialogProvider> {/* 对话框提供者 */}
                                    <CommandProvider> {/* 命令对话框提供者 */}
                                      <PromptHistoryProvider> {/* 提示历史提供者 */}
                                        <PromptRefProvider> {/* 提示引用提供者 */}
                                          <App /> {/* 主应用组件 */}
                                        </PromptRefProvider>
                                      </PromptHistoryProvider>
                                    </CommandProvider>
                                  </DialogProvider>
                                </PromptStashProvider>
                              </KeybindProvider>
                            </LocalProvider>
                          </ThemeProvider>
                        </SyncProvider>
                      </SDKProvider>
                    </RouteProvider>
                  </ToastProvider>
                </KVProvider>
              </ExitProvider>
            </ArgsProvider>
          </ErrorBoundary>
        )
      },
      {
        targetFps: 60, // 目标帧率 60 FPS
        gatherStats: false, // 不收集统计信息
        exitOnCtrlC: false, // 不在 Ctrl+C 时退出（由应用自己处理）
        useKittyKeyboard: {}, // 使用 Kitty 键盘协议
        consoleOptions: { // 控制台选项
          keyBindings: [{ name: "y", ctrl: true, action: "copy-selection" }], // Ctrl+Y 复制选择
          onCopySelection: (text) => { // 复制选择回调
            Clipboard.copy(text).catch((error) => { // 复制到剪贴板
              console.error(`Failed to copy console selection to clipboard: ${error}`) // 输出错误信息
            })
          },
        },
      },
    )
  })
}

/**
 * App 主应用组件
 * 
 * 功能说明：
 * - TUI 应用的根组件，负责整体布局和功能协调
 * - 处理路由切换（首页和会话页面）
 * - 管理终端标题，根据当前路由和会话动态更新
 * - 注册和管理命令对话框的命令列表
 * - 处理剪贴板复制功能（控制台选择和鼠标选择）
 * - 监听 SDK 事件并做出响应（命令执行、通知显示、会话删除、错误处理、更新通知等）
 * - 处理命令行参数（代理、模型、会话 ID、继续上次会话等）
 * - 显示 OpenRouter 警告提示
 * 
 * 使用场景：
 * - TUI 应用的主入口组件
 * - 需要协调各个子组件和功能模块时
 * - 需要处理全局事件和状态时
 */
function App() { // 主应用组件
  const route = useRoute() // 获取路由上下文
  const dimensions = useTerminalDimensions() // 获取终端尺寸
  const renderer = useRenderer() // 获取渲染器实例
  renderer.disableStdoutInterception() // 禁用标准输出拦截
  const dialog = useDialog() // 获取对话框上下文
  const local = useLocal() // 获取本地状态上下文
  const kv = useKV() // 获取键值存储上下文
  const command = useCommandDialog() // 获取命令对话框上下文
  const sdk = useSDK() // 获取 SDK 上下文
  const toast = useToast() // 获取通知上下文
  const { theme, mode, setMode } = useTheme() // 获取主题上下文
  const sync = useSync() // 获取同步状态上下文
  const exit = useExit() // 获取退出上下文
  const promptRef = usePromptRef() // 获取提示引用上下文

  renderer.console.onCopySelection = async (text: string) => { // 设置控制台复制回调
    if (!text || text.length === 0) return // 如果文本为空，直接返回

    const base64 = Buffer.from(text).toString("base64")
    const osc52 = `\x1b]52;c;${base64}\x07`
    const finalOsc52 = process.env["TMUX"] ? `\x1bPtmux;\x1b${osc52}\x1b\\` : osc52
    // @ts-expect-error writeOut is not in type definitions
    renderer.writeOut(finalOsc52)
    await Clipboard.copy(text)
      .then(() => toast.show({ message: "Copied to clipboard", variant: "info" }))
      .catch(toast.error)
    renderer.clearSelection()
  }
  const [terminalTitleEnabled, setTerminalTitleEnabled] = createSignal(kv.get("terminal_title_enabled", true)) // 创建终端标题启用状态信号

  createEffect(() => { // 创建副作用
    console.log(JSON.stringify(route.data)) // 输出路由数据到控制台（调试用）
  })

  createEffect(() => { // 创建副作用：更新终端窗口标题
    if (!terminalTitleEnabled() || Flag.OPENCODE_DISABLE_TERMINAL_TITLE) return // 如果终端标题被禁用，直接返回

    if (route.data.type === "home") { // 如果当前路由是首页
      renderer.setTerminalTitle("OpenCode") // 设置终端标题为 "OpenCode"
      return
    }

    if (route.data.type === "session") { // 如果当前路由是会话页面
      const session = sync.session.get(route.data.sessionID) // 获取会话信息
      if (!session || SessionApi.isDefaultTitle(session.title)) { // 如果会话不存在或使用默认标题
        renderer.setTerminalTitle("OpenCode") // 设置终端标题为 "OpenCode"
        return
      }

      const title = session.title.length > 40 ? session.title.slice(0, 37) + "..." : session.title // 截断标题到 40 个字符
      renderer.setTerminalTitle(`OC | ${title}`) // 设置终端标题为 "OC | {标题}"
    }
  })

  const args = useArgs() // 获取命令行参数
  onMount(() => { // 组件挂载时的回调
    batch(() => { // 批量更新状态
      if (args.agent) local.agent.set(args.agent) // 如果指定了代理，设置代理
      if (args.model) { // 如果指定了模型
        const { providerID, modelID } = Provider.parseModel(args.model) // 解析模型字符串
        if (!providerID || !modelID) // 如果解析失败
          return toast.show({ // 显示警告通知
            variant: "warning",
            message: `Invalid model format: ${args.model}`,
            duration: 3000,
          })
        local.model.set({ providerID, modelID }, { recent: true }) // 设置模型并标记为最近使用
      }
      if (args.sessionID) { // 如果指定了会话 ID
        route.navigate({ // 导航到指定会话
          type: "session",
          sessionID: args.sessionID,
        })
      }
    })
  })

  let continued = false // 标记是否已经继续上次会话
  createEffect(() => { // 创建副作用：处理 --continue 参数
    if (continued || sync.status === "loading" || !args.continue) return // 如果已经继续、正在加载或未指定继续，直接返回
    const match = sync.data.session // 获取会话列表
      .toSorted((a, b) => b.time.updated - a.time.updated) // 按更新时间降序排序
      .find((x) => x.parentID === undefined)?.id // 找到最近更新的根会话 ID
    if (match) { // 如果找到匹配的会话
      continued = true // 标记为已继续
      route.navigate({ type: "session", sessionID: match }) // 导航到该会话
    }
  })

  createEffect( // 创建副作用：处理空提供者状态
    on(
      () => sync.status === "complete" && sync.data.provider.length === 0, // 监听同步状态和提供者数量
      (isEmpty, wasEmpty) => { // 回调函数，接收当前状态和之前状态
        if (!isEmpty || wasEmpty) return // 只在从非空状态转换为空状态时触发
        dialog.replace(() => <DialogProviderList />) // 显示提供者列表对话框
      },
    ),
  )

  const connected = useConnected() // 获取连接状态
  command.register(() => [ // 注册命令对话框的命令列表
    {
      title: "Switch session", // 命令标题
      value: "session.list", // 命令值
      keybind: "session_list", // 快捷键绑定
      category: "Session", // 命令分类
      suggested: sync.data.session.length > 0, // 是否建议显示
      onSelect: () => { // 选择时的回调
        dialog.replace(() => <DialogSessionList />) // 显示会话列表对话框
      },
    },
    {
      title: "New session", // 命令标题
      suggested: route.data.type === "session", // 是否建议显示
      value: "session.new", // 命令值
      keybind: "session_new", // 快捷键绑定
      category: "Session", // 命令分类
      onSelect: () => { // 选择时的回调
        const current = promptRef.current // 获取当前提示引用
        const currentPrompt = current?.current?.input ? current.current : undefined // 获取当前提示内容
        route.navigate({ // 导航到首页
          type: "home",
          initialPrompt: currentPrompt, // 保留当前提示内容
        })
        dialog.clear() // 清除对话框
      },
    },
    {
      title: "Switch model", // 命令标题
      value: "model.list", // 命令值
      keybind: "model_list", // 快捷键绑定
      suggested: true, // 建议显示
      category: "Agent", // 命令分类
      onSelect: () => { // 选择时的回调
        dialog.replace(() => <DialogModel />) // 显示模型列表对话框
      },
    },
    {
      title: "Model cycle", // 命令标题
      disabled: true, // 禁用
      value: "model.cycle_recent", // 命令值
      keybind: "model_cycle_recent", // 快捷键绑定
      category: "Agent", // 命令分类
      onSelect: () => { // 选择时的回调
        local.model.cycle(1) // 循环切换到下一个最近使用的模型
      },
    },
    {
      title: "Model cycle reverse", // 命令标题
      disabled: true, // 禁用
      value: "model.cycle_recent_reverse", // 命令值
      keybind: "model_cycle_recent_reverse", // 快捷键绑定
      category: "Agent", // 命令分类
      onSelect: () => { // 选择时的回调
        local.model.cycle(-1) // 循环切换到上一个最近使用的模型
      },
    },
    {
      title: "Favorite cycle", // 命令标题
      value: "model.cycle_favorite", // 命令值
      keybind: "model_cycle_favorite", // 快捷键绑定
      category: "Agent", // 命令分类
      onSelect: () => { // 选择时的回调
        local.model.cycleFavorite(1) // 循环切换到下一个收藏的模型
      },
    },
    {
      title: "Favorite cycle reverse", // 命令标题
      value: "model.cycle_favorite_reverse", // 命令值
      keybind: "model_cycle_favorite_reverse", // 快捷键绑定
      category: "Agent", // 命令分类
      onSelect: () => { // 选择时的回调
        local.model.cycleFavorite(-1) // 循环切换到上一个收藏的模型
      },
    },
    {
      title: "Switch agent", // 命令标题
      value: "agent.list", // 命令值
      keybind: "agent_list", // 快捷键绑定
      category: "Agent", // 命令分类
      onSelect: () => { // 选择时的回调
        dialog.replace(() => <DialogAgent />) // 显示代理列表对话框
      },
    },
    {
      title: "Toggle MCPs", // 命令标题
      value: "mcp.list", // 命令值
      category: "Agent", // 命令分类
      onSelect: () => { // 选择时的回调
        dialog.replace(() => <DialogMcp />) // 显示 MCP 列表对话框
      },
    },
    {
      title: "Agent cycle", // 命令标题
      value: "agent.cycle", // 命令值
      keybind: "agent_cycle", // 快捷键绑定
      category: "Agent", // 命令分类
      disabled: true, // 禁用
      onSelect: () => { // 选择时的回调
        local.agent.move(1) // 循环切换到下一个代理
      },
    },
    {
      title: "Variant cycle", // 命令标题
      value: "variant.cycle", // 命令值
      keybind: "variant_cycle", // 快捷键绑定
      category: "Agent", // 命令分类
      onSelect: () => { // 选择时的回调
        local.model.variant.cycle() // 循环切换模型变体
      },
    },
    {
      title: "Agent cycle reverse", // 命令标题
      value: "agent.cycle.reverse", // 命令值
      keybind: "agent_cycle_reverse", // 快捷键绑定
      category: "Agent", // 命令分类
      disabled: true, // 禁用
      onSelect: () => { // 选择时的回调
        local.agent.move(-1) // 循环切换到上一个代理
      },
    },
    {
      title: "Connect provider", // 命令标题
      value: "provider.connect", // 命令值
      suggested: !connected(), // 是否建议显示（未连接时建议）
      onSelect: () => { // 选择时的回调
        dialog.replace(() => <DialogProviderList />) // 显示提供者列表对话框
      },
      category: "Provider", // 命令分类
    },
    {
      title: "View status", // 命令标题
      keybind: "status_view", // 快捷键绑定
      value: "opencode.status", // 命令值
      onSelect: () => { // 选择时的回调
        dialog.replace(() => <DialogStatus />) // 显示状态对话框
      },
      category: "System", // 命令分类
    },
    {
      title: "Switch theme", // 命令标题
      value: "theme.switch", // 命令值
      onSelect: () => { // 选择时的回调
        dialog.replace(() => <DialogThemeList />) // 显示主题列表对话框
      },
      category: "System", // 命令分类
    },
    {
      title: "Toggle appearance", // 命令标题
      value: "theme.switch_mode", // 命令值
      onSelect: (dialog) => { // 选择时的回调
        setMode(mode() === "dark" ? "light" : "dark") // 切换深色/浅色模式
        dialog.clear() // 清除对话框
      },
      category: "System", // 命令分类
    },
    {
      title: "Help", // 命令标题
      value: "help.show", // 命令值
      onSelect: () => { // 选择时的回调
        dialog.replace(() => <DialogHelp />) // 显示帮助对话框
      },
      category: "System", // 命令分类
    },
    {
      title: "Open docs", // 命令标题
      value: "docs.open", // 命令值
      onSelect: () => { // 选择时的回调
        open("https://opencode.ai/docs").catch(() => {}) // 打开文档 URL
        dialog.clear() // 清除对话框
      },
      category: "System", // 命令分类
    },
    {
      title: "Open WebUI", // 命令标题
      value: "webui.open", // 命令值
      onSelect: () => { // 选择时的回调
        open(sdk.url).catch(() => {}) // 打开 WebUI URL
        dialog.clear() // 清除对话框
      },
      category: "System", // 命令分类
    },
    {
      title: "Exit the app", // 命令标题
      value: "app.exit", // 命令值
      onSelect: () => exit(), // 选择时的回调：退出应用
      category: "System", // 命令分类
    },
    {
      title: "Toggle debug panel", // 命令标题
      category: "System", // 命令分类
      value: "app.debug", // 命令值
      onSelect: (dialog) => { // 选择时的回调
        renderer.toggleDebugOverlay() // 切换调试面板
        dialog.clear() // 清除对话框
      },
    },
    {
      title: "Toggle console", // 命令标题
      category: "System", // 命令分类
      value: "app.console", // 命令值
      onSelect: (dialog) => { // 选择时的回调
        renderer.console.toggle() // 切换控制台
        dialog.clear() // 清除对话框
      },
    },
    {
      title: "Suspend terminal", // 命令标题
      value: "terminal.suspend", // 命令值
      keybind: "terminal_suspend", // 快捷键绑定
      category: "System", // 命令分类
      onSelect: () => { // 选择时的回调
        process.once("SIGCONT", () => { // 监听继续信号
          renderer.resume() // 恢复渲染
        })

        renderer.suspend() // 暂停渲染
        process.kill(0, "SIGTSTP") // 发送暂停信号到进程组
      },
    },
    {
      title: terminalTitleEnabled() ? "Disable terminal title" : "Enable terminal title", // 命令标题（动态）
      value: "terminal.title.toggle", // 命令值
      keybind: "terminal_title_toggle", // 快捷键绑定
      category: "System", // 命令分类
      onSelect: (dialog) => { // 选择时的回调
        setTerminalTitleEnabled((prev) => { // 切换终端标题启用状态
          const next = !prev // 切换状态
          kv.set("terminal_title_enabled", next) // 保存到键值存储
          if (!next) renderer.setTerminalTitle("") // 如果禁用，清空终端标题
          return next // 返回新状态
        })
        dialog.clear() // 清除对话框
      },
    },
  ])

  createEffect(() => { // 创建副作用：显示 OpenRouter 警告
    const currentModel = local.model.current() // 获取当前模型
    if (!currentModel) return // 如果没有模型，直接返回
    if (currentModel.providerID === "openrouter" && !kv.get("openrouter_warning", false)) { // 如果使用 OpenRouter 且未显示过警告
      untrack(() => { // 在不追踪依赖的情况下执行
        DialogAlert.show( // 显示警告对话框
          dialog,
          "Warning",
          "While openrouter is a convenient way to access LLMs your request will often be routed to subpar providers that do not work well in our testing.\n\nFor reliable access to models check out OpenCode Zen\nhttps://opencode.ai/zen",
        ).then(() => kv.set("openrouter_warning", true)) // 标记已显示警告
      })
    }
  })

  sdk.event.on(TuiEvent.CommandExecute.type, (evt) => { // 监听命令执行事件
    command.trigger(evt.properties.command) // 触发命令对话框
  })

  sdk.event.on(TuiEvent.ToastShow.type, (evt) => { // 监听通知显示事件
    toast.show({ // 显示通知
      title: evt.properties.title,
      message: evt.properties.message,
      variant: evt.properties.variant,
      duration: evt.properties.duration,
    })
  })

  sdk.event.on(SessionApi.Event.Deleted.type, (evt) => { // 监听会话删除事件
    if (route.data.type === "session" && route.data.sessionID === evt.properties.info.id) { // 如果当前会话被删除
      route.navigate({ type: "home" }) // 导航到首页
      toast.show({ // 显示通知
        variant: "info",
        message: "The current session was deleted",
      })
    }
  })

  sdk.event.on(SessionApi.Event.Error.type, (evt) => { // 监听会话错误事件
    const error = evt.properties.error // 获取错误对象
    const message = (() => { // 提取错误消息
      if (!error) return "An error occurred" // 如果没有错误，返回默认消息

      if (typeof error === "object") { // 如果错误是对象
        const data = error.data // 获取错误数据
        if ("message" in data && typeof data.message === "string") { // 如果数据中包含消息
          return data.message // 返回错误消息
        }
      }
      return String(error) // 返回错误的字符串表示
    })()

    toast.show({ // 显示错误通知
      variant: "error",
      message,
      duration: 5000,
    })
  })

  sdk.event.on(Installation.Event.Updated.type, (evt) => { // 监听安装更新完成事件
    toast.show({ // 显示成功通知
      variant: "success",
      title: "Update Complete",
      message: `OpenCode updated to v${evt.properties.version}`,
      duration: 5000,
    })
  })

  sdk.event.on(Installation.Event.UpdateAvailable.type, (evt) => { // 监听更新可用事件
    toast.show({ // 显示信息通知
      variant: "info",
      title: "Update Available",
      message: `OpenCode v${evt.properties.version} is available. Run 'opencode upgrade' to update manually.`,
      duration: 10000,
    })
  })

  return ( // 返回 JSX
    <box
      width={dimensions().width} // 宽度为终端宽度
      height={dimensions().height} // 高度为终端高度
      backgroundColor={theme.background} // 背景色为主题背景色
      onMouseUp={async () => { // 鼠标释放事件处理
        if (Flag.OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT) { // 如果禁用选择复制
          renderer.clearSelection() // 清除选择
          return
        }
        const text = renderer.getSelection()?.getSelectedText()
        if (text && text.length > 0) {
          const base64 = Buffer.from(text).toString("base64")
          const osc52 = `\x1b]52;c;${base64}\x07`
          const finalOsc52 = process.env["TMUX"] ? `\x1bPtmux;\x1b${osc52}\x1b\\` : osc52
          /* @ts-expect-error */
          renderer.writeOut(finalOsc52)
          await Clipboard.copy(text)
            .then(() => toast.show({ message: "Copied to clipboard", variant: "info" }))
            .catch(toast.error)
          renderer.clearSelection()
        }
      }}
    >
      <Switch> {/* 路由切换 */}
        <Match when={route.data.type === "home"}> {/* 匹配首页路由 */}
          <Home /> {/* 首页组件 */}
        </Match>
        <Match when={route.data.type === "session"}> {/* 匹配会话路由 */}
          <Session /> {/* 会话组件 */}
        </Match>
      </Switch>
    </box>
  )
}

/**
 * ErrorComponent 错误显示组件
 * 
 * 功能说明：
 * - 在应用发生致命错误时显示友好的错误界面
 * - 显示错误消息和堆栈跟踪
 * - 提供复制问题报告 URL 的功能
 * - 提供打开 GitHub 问题页面的链接
 * - 支持通过 Ctrl+C 退出应用
 * - 根据主题模式（深色/浅色）选择合适的颜色
 * 
 * 使用场景：
 * - 应用发生未捕获的异常时
 * - 需要向用户报告错误并引导用户反馈时
 * - 需要收集错误信息用于调试时
 * 
 * 参数说明：
 * - error: 错误对象
 * - reset: 重置函数
 * - onExit: 退出回调函数
 * - mode: 主题模式（"dark" 或 "light"）
 */
function ErrorComponent(props: { // 错误组件属性
  error: Error // 错误对象
  reset: () => void // 重置函数
  onExit: () => Promise<void> // 退出回调
  mode?: "dark" | "light" // 主题模式
}) {
  const term = useTerminalDimensions() // 获取终端尺寸
  useKeyboard((evt) => { // 监听键盘事件
    if (evt.ctrl && evt.name === "c") { // 如果按下 Ctrl+C
      props.onExit() // 退出应用
    }
  })
  const [copied, setCopied] = createSignal(false) // 创建复制状态信号

  const issueURL = new URL("https://github.com/sst/opencode/issues/new?template=bug-report.yml") // 创建 GitHub 问题 URL

  const isLight = props.mode === "light" // 判断是否为浅色模式
  const colors = { // 定义颜色方案
    bg: isLight ? "#ffffff" : "#0a0a0a", // 背景色
    text: isLight ? "#1a1a1a" : "#eeeeee", // 文本色
    muted: isLight ? "#8a8a8a" : "#808080", // 弱化文本色
    primary: isLight ? "#3b7dd8" : "#fab283", // 主色调
  }

  if (props.error.message) { // 如果有错误消息
    issueURL.searchParams.set("title", `opentui: fatal: ${props.error.message}`) // 设置问题标题
  }

  if (props.error.stack) { // 如果有堆栈跟踪
    issueURL.searchParams.set( // 设置问题描述
      "description",
      "```\n" + props.error.stack.substring(0, 6000 - issueURL.toString().length) + "...\n```",
    )
  }

  issueURL.searchParams.set("opencode-version", Installation.VERSION) // 设置 OpenCode 版本

  const copyIssueURL = () => { // 复制问题 URL 函数
    Clipboard.copy(issueURL.toString()).then(() => { // 复制到剪贴板
      setCopied(true) // 设置复制状态为 true
    })
  }

  return (
    <box flexDirection="column" gap={1} backgroundColor={colors.bg}>
      <box flexDirection="row" gap={1} alignItems="center">
        <text attributes={TextAttributes.BOLD} fg={colors.text}>
          Please report an issue.
        </text>
        <box onMouseUp={copyIssueURL} backgroundColor={colors.primary} padding={1}>
          <text attributes={TextAttributes.BOLD} fg={colors.bg}>
            Copy issue URL (exception info pre-filled)
          </text>
        </box>
        {copied() && <text fg={colors.muted}>Successfully copied</text>}
      </box>
      <box flexDirection="row" gap={2} alignItems="center">
        <text fg={colors.text}>A fatal error occurred!</text>
        <box onMouseUp={props.reset} backgroundColor={colors.primary} padding={1}>
          <text fg={colors.bg}>Reset TUI</text>
        </box>
        <box onMouseUp={props.onExit} backgroundColor={colors.primary} padding={1}>
          <text fg={colors.bg}>Exit</text>
        </box>
      </box>
      <scrollbox height={Math.floor(term().height * 0.7)}>
        <text fg={colors.muted}>{props.error.stack}</text>
      </scrollbox>
      <text fg={colors.text}>{props.error.message}</text>
    </box>
  )
}
