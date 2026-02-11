import type { BoxRenderable, TextareaRenderable, KeyEvent, ScrollBoxRenderable } from "@opentui/core" // TUI 核心组件类型定义
import fuzzysort from "fuzzysort" // 模糊搜索库，用于自动补全的模糊匹配
import { firstBy } from "remeda" // 数组排序工具，用于查找最大值等操作
import { createMemo, createResource, createEffect, onMount, onCleanup, For, Show, createSignal } from "solid-js" // Solid.js 响应式 API
import { createStore } from "solid-js/store" // Solid.js 状态管理
import { useSDK } from "@tui/context/sdk" // SDK 上下文，用于调用后端 API
import { useSync } from "@tui/context/sync" // 同步上下文，用于获取实时数据
import { useTheme, selectedForeground } from "@tui/context/theme" // 主题上下文，用于获取颜色和样式
import { SplitBorder } from "@tui/component/border" // 分割边框组件
import { useCommandDialog } from "@tui/component/dialog-command" // 命令对话框上下文
import { useTerminalDimensions } from "@opentui/solid" // 终端尺寸钩子，用于获取终端大小
import { Locale } from "@/util/locale" // 本地化工具，用于文本截断等操作
import type { PromptInfo } from "./history" // 提示词信息类型定义

function removeLineRange(input: string) {
  // 移除输入中的行号范围部分（如 #10-20），返回基础查询字符串
  const hashIndex = input.lastIndexOf("#")
  return hashIndex !== -1 ? input.substring(0, hashIndex) : input
}

function extractLineRange(input: string) {
  // 从输入中提取行号范围信息
  const hashIndex = input.lastIndexOf("#")
  if (hashIndex === -1) {
    // 没有行号范围，返回原始查询
    return { baseQuery: input }
  }

  const baseName = input.substring(0, hashIndex) // 基础文件名
  const linePart = input.substring(hashIndex + 1) // 行号部分
  const lineMatch = linePart.match(/^(\d+)(?:-(\d*))?$/) // 匹配行号格式：10 或 10-20

  if (!lineMatch) {
    // 行号格式无效，返回基础查询
    return { baseQuery: baseName }
  }

  const startLine = Number(lineMatch[1]) // 起始行号
  const endLine = lineMatch[2] && startLine < Number(lineMatch[2]) ? Number(lineMatch[2]) : undefined // 结束行号（可选）

  return {
    lineRange: {
      // 行号范围对象
      baseName,
      startLine,
      endLine,
    },
    baseQuery: baseName, // 基础查询字符串
  }
}

export type AutocompleteRef = {
  onInput: (value: string) => void // 输入事件处理函数
  onKeyDown: (e: KeyEvent) => void // 键盘事件处理函数
  visible: false | "@" | "/" // 自动补全可见性状态：false 表示隐藏，@ 表示文件/代理补全，/ 表示命令补全
}

export type AutocompleteOption = {
  display: string // 选项显示文本
  aliases?: string[] // 选项别名列表
  disabled?: boolean // 是否禁用该选项
  description?: string // 选项描述信息
  onSelect?: () => void // 选中选项时的回调函数
}

export function Autocomplete(props: {
  value: string // 输入框的当前值
  sessionID?: string // 会话 ID，用于获取会话相关命令
  setPrompt: (input: (prompt: PromptInfo) => void) => void // 设置提示词信息的函数
  setExtmark: (partIndex: number, extmarkId: number) => void // 设置扩展标记的函数，用于高亮显示
  anchor: () => BoxRenderable // 锚点组件，用于定位自动补全框
  input: () => TextareaRenderable // 输入框组件
  ref: (ref: AutocompleteRef) => void // 组件引用，用于父组件调用方法
  fileStyleId: number // 文件部分的样式 ID
  agentStyleId: number // 代理部分的样式 ID
  promptPartTypeId: () => number // 提示词部分的类型 ID
}) {
  const sdk = useSDK() // 获取 SDK 实例，用于调用后端 API
  const sync = useSync() // 获取同步实例，用于获取实时数据
  const command = useCommandDialog() // 获取命令对话框实例
  const { theme } = useTheme() // 获取主题配置
  const dimensions = useTerminalDimensions() // 获取终端尺寸

  // 创建状态 store，管理自动补全的状态
  const [store, setStore] = createStore({
    index: 0, // 触发字符的位置索引
    selected: 0, // 当前选中的选项索引
    visible: false as AutocompleteRef["visible"], // 自动补全可见性状态
  })

  const [positionTick, setPositionTick] = createSignal(0) // 位置更新计数器，用于触发重新计算位置

  // 监听锚点位置变化，自动更新自动补全框位置
  createEffect(() => {
    if (store.visible) {
      let lastPos = { x: 0, y: 0, width: 0 } // 记录上一次的位置
      // 每 50ms 检查一次锚点位置是否变化
      const interval = setInterval(() => {
        const anchor = props.anchor()
        // 如果位置发生变化，触发位置更新
        if (anchor.x !== lastPos.x || anchor.y !== lastPos.y || anchor.width !== lastPos.width) {
          lastPos = { x: anchor.x, y: anchor.y, width: anchor.width }
          setPositionTick((t) => t + 1)
        }
      }, 50)

      // 清理定时器
      onCleanup(() => clearInterval(interval))
    }
  })

  // 计算自动补全框的显示位置
  const position = createMemo(() => {
    if (!store.visible) return { x: 0, y: 0, width: 0 } // 不可见时返回零位置
    const dims = dimensions()
    positionTick() // 触发位置更新
    const anchor = props.anchor()
    const parent = anchor.parent
    const parentX = parent?.x ?? 0
    const parentY = parent?.y ?? 0

    // 返回相对于父容器的位置
    return {
      x: anchor.x - parentX,
      y: anchor.y - parentY,
      width: anchor.width,
    }
  })

  // 计算当前过滤查询字符串
  const filter = createMemo(() => {
    if (!store.visible) return // 不可见时返回 undefined
    // 引用 props.value 使 memo 对文本变化做出响应
    props.value // <- there surely is a better way to do this, like making .input() reactive

    // 获取从触发字符位置到光标位置的文本
    return props.input().getTextRange(store.index + 1, props.input().cursorOffset)
  })

  // 将选中的部分（文件或代理）插入到输入框中
  function insertPart(text: string, part: PromptInfo["parts"][number]) {
    const input = props.input()
    const currentCursorOffset = input.cursorOffset

    // 检查光标后是否有空格，如果没有则添加空格
    const charAfterCursor = props.value.at(currentCursorOffset)
    const needsSpace = charAfterCursor !== " "
    const append = "@" + text + (needsSpace ? " " : "")

    // 获取要替换的文本范围
    input.cursorOffset = store.index
    const startCursor = input.logicalCursor
    input.cursorOffset = currentCursorOffset
    const endCursor = input.logicalCursor

    // 删除触发字符到光标位置的文本，插入新文本
    input.deleteRange(startCursor.row, startCursor.col, endCursor.row, endCursor.col)
    input.insertText(append)

    // 创建虚拟文本标记，用于高亮显示
    const virtualText = "@" + text
    const extmarkStart = store.index
    const extmarkEnd = extmarkStart + Bun.stringWidth(virtualText)

    // 根据部分类型选择样式 ID
    const styleId = part.type === "file" ? props.fileStyleId : part.type === "agent" ? props.agentStyleId : undefined

    // 创建扩展标记
    const extmarkId = input.extmarks.create({
      start: extmarkStart,
      end: extmarkEnd,
      virtual: true,
      styleId,
      typeId: props.promptPartTypeId(),
    })

    // 更新提示词信息，添加新的部分
    props.setPrompt((draft) => {
      if (part.type === "file" && part.source?.text) {
        // 更新文件部分的源信息
        part.source.text.start = extmarkStart
        part.source.text.end = extmarkEnd
        part.source.text.value = virtualText
      } else if (part.type === "agent" && part.source) {
        // 更新代理部分的源信息
        part.source.start = extmarkStart
        part.source.end = extmarkEnd
        part.source.value = virtualText
      }
      const partIndex = draft.parts.length
      draft.parts.push(part)
      props.setExtmark(partIndex, extmarkId)
    })
  }

  // 创建文件资源，用于异步加载文件列表
  const [files] = createResource(
    () => filter(),
    async (query) => {
      // 如果不可见或是命令模式，返回空数组
      if (!store.visible || store.visible === "/") return []

      // 从查询字符串中提取行号范围和基础查询
      const { lineRange, baseQuery } = extractLineRange(query ?? "")

      // 从 SDK 获取文件列表
      const result = await sdk.client.find.files({
        query: baseQuery,
      })

      const options: AutocompleteOption[] = []

      // 添加文件选项
      if (!result.error && result.data) {
        const width = props.anchor().width - 4 // 计算可用宽度
        options.push(
          ...result.data.map((item): AutocompleteOption => {
            let url = `file://${process.cwd()}/${item}` // 构建 file:// URL
            let filename = item
            // 如果有行号范围且不是目录，添加行号到文件名
            if (lineRange && !item.endsWith("/")) {
              filename = `${item}#${lineRange.startLine}${lineRange.endLine ? `-${lineRange.endLine}` : ""}`
              const urlObj = new URL(url)
              urlObj.searchParams.set("start", String(lineRange.startLine))
              if (lineRange.endLine !== undefined) {
                urlObj.searchParams.set("end", String(lineRange.endLine))
              }
              url = urlObj.toString()
            }

            return {
              // 截断文件名以适应显示宽度
              display: Locale.truncateMiddle(filename, width),
              onSelect: () => {
                // 选中时插入文件部分
                insertPart(filename, {
                  type: "file",
                  mime: "text/plain",
                  filename,
                  url,
                  source: {
                    type: "file",
                    text: {
                      start: 0,
                      end: 0,
                      value: "",
                    },
                    path: item,
                  },
                })
              },
            }
          }),
        )
      }

      return options
    },
    {
      initialValue: [], // 初始值为空数组
    },
  )

  // 创建代理列表的 memo，过滤隐藏的和主要的代理
  const agents = createMemo(() => {
    const agents = sync.data.agent
    return agents
      .filter((agent) => !agent.hidden && agent.mode !== "primary") // 过滤隐藏和主要代理
      .map(
        (agent): AutocompleteOption => ({
          display: "@" + agent.name, // 显示 @ 前缀
          onSelect: () => {
            // 选中时插入代理部分
            insertPart(agent.name, {
              type: "agent",
              name: agent.name,
              source: {
                start: 0,
                end: 0,
                value: "",
              },
            })
          },
        }),
      )
  })

  // 获取当前会话
  const session = createMemo(() => (props.sessionID ? sync.session.get(props.sessionID) : undefined))

  // 创建命令列表的 memo，包含全局命令和会话相关命令
  const commands = createMemo((): AutocompleteOption[] => {
    const results: AutocompleteOption[] = []
    const s = session()

    // 添加 MCP 命令
    for (const command of sync.data.command) {
      results.push({
        display: "/" + command.name + (command.mcp ? " (MCP)" : ""), // MCP 命令添加标记
        description: command.description,
        onSelect: () => {
          const newText = "/" + command.name + " "
          const cursor = props.input().logicalCursor
          // 替换当前输入为命令
          props.input().deleteRange(0, 0, cursor.row, cursor.col)
          props.input().insertText(newText)
          props.input().cursorOffset = Bun.stringWidth(newText)
        },
      })
    }

    // 如果有会话，添加会话相关命令
    if (s) {
      results.push(
        {
          display: "/undo",
          description: "undo the last message", // 撤销最后一条消息
          onSelect: () => {
            command.trigger("session.undo")
          },
        },
        {
          display: "/redo",
          description: "redo the last message", // 重做最后一条消息
          onSelect: () => command.trigger("session.redo"),
        },
        {
          display: "/compact",
          aliases: ["/summarize"],
          description: "compact the session", // 压缩会话
          onSelect: () => command.trigger("session.compact"),
        },
        {
          display: "/unshare",
          disabled: !s.share, // 只有已分享的会话才能取消分享
          description: "unshare a session", // 取消分享会话
          onSelect: () => command.trigger("session.unshare"),
        },
        {
          display: "/rename",
          description: "rename session", // 重命名会话
          onSelect: () => command.trigger("session.rename"),
        },
        {
          display: "/copy",
          description: "copy session transcript to clipboard", // 复制会话记录到剪贴板
          onSelect: () => command.trigger("session.copy"),
        },
        {
          display: "/export",
          description: "export session transcript to file", // 导出会话记录到文件
          onSelect: () => command.trigger("session.export"),
        },
        {
          display: "/timeline",
          description: "jump to message", // 跳转到消息
          onSelect: () => command.trigger("session.timeline"),
        },
        {
          display: "/fork",
          description: "fork from message", // 从消息分叉
          onSelect: () => command.trigger("session.fork"),
        },
        {
          display: "/thinking",
          description: "toggle thinking visibility", // 切换思考过程可见性
          onSelect: () => command.trigger("session.toggle.thinking"),
        },
      )
      // 如果分享功能未禁用，添加分享命令
      if (sync.data.config.share !== "disabled") {
        results.push({
          display: "/share",
          disabled: !!s.share?.url, // 已分享的会话不能再分享
          description: "share a session", // 分享会话
          onSelect: () => command.trigger("session.share"),
        })
      }
    }

    // 添加全局命令
    results.push(
      {
        display: "/new",
        aliases: ["/clear"],
        description: "create a new session", // 创建新会话
        onSelect: () => command.trigger("session.new"),
      },
      {
        display: "/models",
        description: "list models", // 列出模型
        onSelect: () => command.trigger("model.list"),
      },
      {
        display: "/agents",
        description: "list agents", // 列出代理
        onSelect: () => command.trigger("agent.list"),
      },
      {
        display: "/session",
        aliases: ["/resume", "/continue"],
        description: "list sessions", // 列出会话
        onSelect: () => command.trigger("session.list"),
      },
      {
        display: "/status",
        description: "show status", // 显示状态
        onSelect: () => command.trigger("opencode.status"),
      },
      {
        display: "/mcp",
        description: "toggle MCPs", // 切换 MCP
        onSelect: () => command.trigger("mcp.list"),
      },
      {
        display: "/theme",
        description: "toggle theme", // 切换主题
        onSelect: () => command.trigger("theme.switch"),
      },
      {
        display: "/editor",
        description: "open editor", // 打开编辑器
        onSelect: () => command.trigger("prompt.editor", "prompt"),
      },
      {
        display: "/connect",
        description: "connect to a provider", // 连接到提供商
        onSelect: () => command.trigger("provider.connect"),
      },
      {
        display: "/help",
        description: "show help", // 显示帮助
        onSelect: () => command.trigger("help.show"),
      },
      {
        display: "/commands",
        description: "show all commands", // 显示所有命令
        onSelect: () => command.show(),
      },
      {
        display: "/exit",
        aliases: ["/quit", "/q"],
        description: "exit the app", // 退出应用
        onSelect: () => command.trigger("app.exit"),
      },
    )

    // 计算最大显示长度，并对齐所有选项
    const max = firstBy(results, [(x) => x.display.length, "desc"])?.display.length
    if (!max) return results
    return results.map((item) => ({
      ...item,
      display: item.display.padEnd(max + 2), // 右侧填充空格以对齐
    }))
  })

  // 创建选项列表的 memo，根据当前模式过滤和排序选项
  const options = createMemo((prev: AutocompleteOption[] | undefined) => {
    const filesValue = files()
    const agentsValue = agents()
    const commandsValue = commands()

    // 根据可见性模式混合选项：@ 模式显示代理和文件，/ 模式显示命令
    const mixed: AutocompleteOption[] = (
      store.visible === "@" ? [...agentsValue, ...(filesValue || [])] : [...commandsValue]
    ).filter((x) => x.disabled !== true) // 过滤禁用的选项

    const currentFilter = filter()

    // 如果没有过滤条件，返回所有选项
    if (!currentFilter) {
      return mixed
    }

    // 如果文件正在加载且存在之前的选项，返回之前的选项
    if (files.loading && prev && prev.length > 0) {
      return prev
    }

    // 使用模糊搜索过滤和排序选项
    const result = fuzzysort.go(removeLineRange(currentFilter), mixed, {
      // 在显示文本、描述和别名中搜索
      keys: [(obj) => removeLineRange(obj.display.trimEnd()), "description", (obj) => obj.aliases?.join(" ") ?? ""],
      limit: 10, // 最多返回 10 个结果
      scoreFn: (objResults) => {
        const displayResult = objResults[0]
        // 如果显示文本以触发字符和过滤条件开头，提高分数
        if (displayResult && displayResult.target.startsWith(store.visible + currentFilter)) {
          return objResults.score * 2
        }
        return objResults.score
      },
    })

    // 返回排序后的选项对象
    return result.map((arr) => arr.obj)
  })

  // 监听过滤条件变化，重置选中索引
  createEffect(() => {
    filter()
    setStore("selected", 0)
  })

  // 在选项列表中移动选中项
  function move(direction: -1 | 1) {
    if (!store.visible) return
    if (!options().length) return
    let next = store.selected + direction
    // 循环选择：到顶部时跳到底部，到底部时跳到顶部
    if (next < 0) next = options().length - 1
    if (next >= options().length) next = 0
    moveTo(next)
  }

  // 移动到指定索引的选项，并确保在视口中可见
  function moveTo(next: number) {
    setStore("selected", next)
    if (!scroll) return
    const viewportHeight = Math.min(height(), options().length)
    const scrollBottom = scroll.scrollTop + viewportHeight
    // 如果选中项在视口上方，向上滚动
    if (next < scroll.scrollTop) {
      scroll.scrollBy(next - scroll.scrollTop)
    } else if (next + 1 > scrollBottom) {
      // 如果选中项在视口下方，向下滚动
      scroll.scrollBy(next + 1 - scrollBottom)
    }
  }

  // 选中当前选项并执行回调
  function select() {
    const selected = options()[store.selected]
    if (!selected) return
    hide() // 隐藏自动补全框
    selected.onSelect?.() // 执行选中回调
  }

  // 显示自动补全框
  function show(mode: "@" | "/") {
    command.keybinds(false) // 禁用命令快捷键
    setStore({
      visible: mode,
      index: props.input().cursorOffset, // 记录触发字符的位置
    })
  }

  // 隐藏自动补全框
  function hide() {
    const text = props.input().plainText
    // 如果是命令模式且命令未完成，清除命令
    if (store.visible === "/" && !text.endsWith(" ") && text.startsWith("/")) {
      const cursor = props.input().logicalCursor
      props.input().deleteRange(0, 0, cursor.row, cursor.col)
      // 立即同步提示词 store，因为 onContentChange 是异步的
      props.setPrompt((draft) => {
        draft.input = props.input().plainText
      })
    }
    command.keybinds(true) // 启用命令快捷键
    setStore("visible", false)
  }

  // 组件挂载时，注册键盘事件处理和输入事件处理
  onMount(() => {
    props.ref({
      get visible() {
        return store.visible // 返回当前可见性状态
      },
      onInput(value) {
        // 输入事件处理
        if (store.visible) {
          if (
            // 在触发字符之前输入了文本
            props.input().cursorOffset <= store.index ||
            // 触发字符和光标之间有空格
            props.input().getTextRange(store.index, props.input().cursorOffset).match(/\s/) ||
            // "/<command>" 不是唯一内容
            (store.visible === "/" && value.match(/^\S+\s+\S+\s*$/))
          ) {
            hide() // 隐藏自动补全框
            return
          }
        }
      },
      onKeyDown(e: KeyEvent) {
        // 键盘事件处理
        if (store.visible) {
          // 自动补全框可见时的键盘处理
          const name = e.name?.toLowerCase()
          const ctrlOnly = e.ctrl && !e.meta && !e.shift // 仅按下 Ctrl 键
          const isNavUp = name === "up" || (ctrlOnly && name === "p") // 向上导航
          const isNavDown = name === "down" || (ctrlOnly && name === "n") // 向下导航

          if (isNavUp) {
            move(-1) // 向上移动选中项
            e.preventDefault()
            return
          }
          if (isNavDown) {
            move(1) // 向下移动选中项
            e.preventDefault()
            return
          }
          if (name === "escape") {
            hide() // 按 ESC 键隐藏自动补全框
            e.preventDefault()
            return
          }
          if (name === "return" || name === "tab") {
            select() // 按 Enter 或 Tab 键选中当前选项
            e.preventDefault()
            return
          }
        }
        // 自动补全框不可见时的键盘处理
        if (!store.visible) {
          // 输入 @ 触发文件/代理补全
          if (e.name === "@") {
            const cursorOffset = props.input().cursorOffset
            const charBeforeCursor =
              cursorOffset === 0 ? undefined : props.input().getTextRange(cursorOffset - 1, cursorOffset)
            // 只有在行首或前面是空格时才触发
            const canTrigger = charBeforeCursor === undefined || charBeforeCursor === "" || /\s/.test(charBeforeCursor)
            if (canTrigger) show("@")
          }

          // 在行首输入 / 触发命令补全
          if (e.name === "/") {
            if (props.input().cursorOffset === 0) show("/")
          }
        }
      },
    })
  })

  // 计算自动补全框的高度
  const height = createMemo(() => {
    if (options().length) return Math.min(10, options().length) // 最多显示 10 行
    return 1 // 默认高度为 1
  })

  let scroll: ScrollBoxRenderable // 滚动框组件引用

  return (
    <box
      visible={store.visible !== false}
      position="absolute"
      top={position().y - height()}
      left={position().x}
      width={position().width}
      zIndex={100}
      {...SplitBorder}
      borderColor={theme.border}
    >
      <scrollbox
        ref={(r: ScrollBoxRenderable) => (scroll = r)}
        backgroundColor={theme.backgroundMenu}
        height={height()}
        scrollbarOptions={{ visible: false }}
      >
        <For
          each={options()}
          fallback={
            <box paddingLeft={1} paddingRight={1}>
              <text fg={theme.textMuted}>No matching items</text>
            </box>
          }
        >
          {(option, index) => (
            <box
              paddingLeft={1}
              paddingRight={1}
              backgroundColor={index() === store.selected ? theme.primary : undefined}
              flexDirection="row"
            >
              <text fg={index() === store.selected ? selectedForeground(theme) : theme.text} flexShrink={0}>
                {option.display}
              </text>
              <Show when={option.description}>
                <text fg={index() === store.selected ? selectedForeground(theme) : theme.textMuted} wrapMode="none">
                  {option.description}
                </text>
              </Show>
            </box>
          )}
        </For>
      </scrollbox>
    </box>
  )
}
