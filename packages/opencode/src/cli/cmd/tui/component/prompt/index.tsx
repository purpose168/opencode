import { BoxRenderable, TextareaRenderable, MouseEvent, PasteEvent, t, dim, fg, type KeyBinding } from "@opentui/core" // TUI 核心组件和工具函数
import { createEffect, createMemo, type JSX, onMount, createSignal, onCleanup, Show, Switch, Match } from "solid-js" // Solid.js 响应式 API
import "opentui-spinner/solid" // 加载动画组件
import { useLocal } from "@tui/context/local" // 本地配置上下文
import { useTheme } from "@tui/context/theme" // 主题上下文
import { EmptyBorder } from "@tui/component/border" // 空边框组件
import { useSDK } from "@tui/context/sdk" // SDK 上下文，用于调用后端 API
import { useRoute } from "@tui/context/route" // 路由上下文
import { useSync } from "@tui/context/sync" // 同步上下文，用于获取实时数据
import { Identifier } from "@/id/id" // 唯一标识符生成器
import { createStore, produce } from "solid-js/store" // Solid.js 状态管理
import { useKeybind } from "@tui/context/keybind" // 快捷键上下文
import { Keybind } from "@/util/keybind" // 快捷键工具
import { usePromptHistory, type PromptInfo } from "./history" // 提示词历史记录
import { usePromptStash } from "./stash" // 提示词暂存功能
import { DialogStash } from "../dialog-stash" // 暂存对话框
import { type AutocompleteRef, Autocomplete } from "./autocomplete" // 自动补全组件
import { useCommandDialog } from "../dialog-command" // 命令对话框上下文
import { useRenderer } from "@opentui/solid" // 渲染器上下文
import { Editor } from "@tui/util/editor" // 编辑器工具
import { useExit } from "../../context/exit" // 退出上下文
import { Clipboard } from "../../util/clipboard" // 剪贴板工具
import type { FilePart } from "@opencode-ai/sdk/v2" // SDK 文件部分类型
import { TuiEvent } from "../../event" // TUI 事件定义
import { iife } from "@/util/iife" // 立即执行函数工具
import { Locale } from "@/util/locale" // 本地化工具
import { createColors, createFrames } from "../../ui/spinner.ts" // 加载动画配置
import { useDialog } from "@tui/ui/dialog" // 对话框上下文
import { DialogProvider as DialogProviderConnect } from "../dialog-provider" // 提供商连接对话框
import { DialogAlert } from "../../ui/dialog-alert" // 警告对话框
import { useToast } from "../../ui/toast" // 提示消息上下文
import { useKV } from "../../context/kv" // 键值存储上下文

export type PromptProps = {
  sessionID?: string // 会话 ID，可选
  visible?: boolean // 是否可见，默认为 true
  disabled?: boolean // 是否禁用，禁用后无法输入
  onSubmit?: () => void // 提交回调函数
  ref?: (ref: PromptRef) => void // 组件引用，用于父组件调用方法
  hint?: JSX.Element // 提示信息元素
  showPlaceholder?: boolean // 是否显示占位符
}

export type PromptRef = {
  focused: boolean // 是否聚焦
  current: PromptInfo // 当前提示词信息
  set(prompt: PromptInfo): void // 设置提示词
  reset(): void // 重置提示词
  blur(): void // 失去焦点
  focus(): void // 获得焦点
  submit(): void // 提交提示词
}

const PLACEHOLDERS = ["修复代码库中的 TODO", "这个项目使用的技术栈是什么？", "修复失败的测试"] // 占位符文本列表

const TEXTAREA_ACTIONS = [
  "submit", // 提交
  "newline", // 新行
  "move-left", // 左移
  "move-right", // 右移
  "move-up", // 上移
  "move-down", // 下移
  "select-left", // 向左选择
  "select-right", // 向右选择
  "select-up", // 向上选择
  "select-down", // 向下选择
  "line-home", // 行首
  "line-end", // 行尾
  "select-line-home", // 选择到行首
  "select-line-end", // 选择到行尾
  "visual-line-home", // 可视行首
  "visual-line-end", // 可视行尾
  "select-visual-line-home", // 选择到可视行首
  "select-visual-line-end", // 选择到可视行尾
  "buffer-home", // 缓冲区开头
  "buffer-end", // 缓冲区结尾
  "select-buffer-home", // 选择到缓冲区开头
  "select-buffer-end", // 选择到缓冲区结尾
  "delete-line", // 删除行
  "delete-to-line-end", // 删除到行尾
  "delete-to-line-start", // 删除到行首
  "backspace", // 退格
  "delete", // 删除
  "undo", // 撤销
  "redo", // 重做
  "word-forward", // 前进一个词
  "word-backward", // 后退一个词
  "select-word-forward", // 选择下一个词
  "select-word-backward", // 选择上一个词
  "delete-word-forward", // 删除下一个词
  "delete-word-backward", // 删除上一个词
] as const // 文本区域支持的操作列表

// 将快捷键配置映射为文本区域可用的键绑定
function mapTextareaKeybindings(
  keybinds: Record<string, Keybind.Info[]>, // 快捷键配置对象
  action: (typeof TEXTAREA_ACTIONS)[number], // 操作名称
): KeyBinding[] {
  const configKey = `input_${action.replace(/-/g, "_")}` // 配置键名
  const bindings = keybinds[configKey] // 获取快捷键绑定
  if (!bindings) return []
  return bindings.map((binding) => ({
    name: binding.name,
    ctrl: binding.ctrl || undefined,
    meta: binding.meta || undefined,
    shift: binding.shift || undefined,
    super: binding.super || undefined,
    action,
  }))
}

export function Prompt(props: PromptProps) {
  let input: TextareaRenderable // 文本输入框组件引用
  let anchor: BoxRenderable // 锚点组件引用，用于定位自动补全框
  let autocomplete: AutocompleteRef // 自动补全组件引用

  const keybind = useKeybind() // 获取快捷键上下文
  const local = useLocal() // 获取本地配置上下文
  const sdk = useSDK() // 获取 SDK 上下文
  const route = useRoute() // 获取路由上下文
  const sync = useSync() // 获取同步上下文
  const dialog = useDialog() // 获取对话框上下文
  const toast = useToast() // 获取提示消息上下文
  // 获取会话状态，如果没有会话 ID 则返回空闲状态
  const status = createMemo(() => sync.data.session_status?.[props.sessionID ?? ""] ?? { type: "idle" })
  const history = usePromptHistory() // 获取提示词历史记录
  const stash = usePromptStash() // 获取提示词暂存功能
  const command = useCommandDialog() // 获取命令对话框上下文
  const renderer = useRenderer() // 获取渲染器上下文
  const { theme, syntax } = useTheme() // 获取主题和语法高亮配置
  const kv = useKV() // 获取键值存储上下文

  // 显示模型警告提示
  function promptModelWarning() {
    toast.show({
      variant: "warning",
      message: "连接提供商以发送提示词",
      duration: 3000,
    })
    // 如果没有提供商，显示连接对话框
    if (sync.data.provider.length === 0) {
      dialog.replace(() => <DialogProviderConnect />)
    }
  }

  // 计算文本区域的快捷键绑定
  const textareaKeybindings = createMemo(() => {
    const keybinds = keybind.all

    return [
      { name: "return", action: "submit" }, // Enter 键提交
      { name: "return", meta: true, action: "newline" }, // Cmd+Enter 换行
      ...TEXTAREA_ACTIONS.flatMap((action) => mapTextareaKeybindings(keybinds, action)), // 映射所有操作
    ] satisfies KeyBinding[]
  })

  // 获取各种扩展标记的样式 ID
  const fileStyleId = syntax().getStyleId("extmark.file")! // 文件部分样式
  const agentStyleId = syntax().getStyleId("extmark.agent")! // 代理部分样式
  const pasteStyleId = syntax().getStyleId("extmark.paste")! // 粘贴内容样式
  let promptPartTypeId: number // 提示词部分的类型 ID

  // 监听提示词追加事件，将文本插入到输入框
  sdk.event.on(TuiEvent.PromptAppend.type, (evt) => {
    input.insertText(evt.properties.text)
    setTimeout(() => {
      input.getLayoutNode().markDirty()
      input.gotoBufferEnd()
      renderer.requestRender()
    }, 0)
  })

  // 根据禁用状态设置光标颜色
  createEffect(() => {
    if (props.disabled) input.cursorColor = theme.backgroundElement
    if (!props.disabled) input.cursorColor = theme.text
  })

  // 获取最后一条用户消息
  const lastUserMessage = createMemo(() => {
    if (!props.sessionID) return undefined
    const messages = sync.data.message[props.sessionID]
    if (!messages) return undefined
    return messages.findLast((m) => m.role === "user")
  })

  // 创建状态 store，管理提示词的各种状态
  const [store, setStore] = createStore<{
    prompt: PromptInfo // 提示词信息
    mode: "normal" | "shell" // 输入模式
    extmarkToPartIndex: Map<number, number> // 扩展标记到部分索引的映射
    interrupt: number // 中断计数器
    placeholder: number // 占位符索引
  }>({
    placeholder: Math.floor(Math.random() * PLACEHOLDERS.length), // 随机选择一个占位符
    prompt: {
      input: "", // 输入文本
      parts: [], // 提示词部分（文件、代理、文本等）
    },
    mode: "normal", // 默认为普通模式
    extmarkToPartIndex: new Map(), // 初始化空映射
    interrupt: 0, // 初始化中断计数器
  })

  // 当会话改变时，从最后一条用户消息初始化代理/模型/变体
  let syncedSessionID: string | undefined // 记录已同步的会话 ID
  createEffect(() => {
    const sessionID = props.sessionID
    const msg = lastUserMessage()

    // 如果会话 ID 改变，同步配置
    if (sessionID !== syncedSessionID) {
      if (!sessionID || !msg) return

      syncedSessionID = sessionID

      // 只有当代理是主要代理（不是子代理）时才设置
      const isPrimaryAgent = local.agent.list().some((x) => x.name === msg.agent)
      if (msg.agent && isPrimaryAgent) {
        local.agent.set(msg.agent)
      }
      // 同步模型和变体
      if (msg.model) local.model.set(msg.model)
      if (msg.variant) local.model.variant.set(msg.variant)
    }
  })

  command.register(() => {
    return [
      {
        title: "清空提示词",
        value: "prompt.clear",
        category: "Prompt",
        disabled: true,
        onSelect: (dialog) => {
          input.extmarks.clear()
          input.clear()
          dialog.clear()
        },
      },
      {
        title: "提交提示词",
        value: "prompt.submit",
        disabled: true,
        keybind: "input_submit",
        category: "Prompt",
        onSelect: (dialog) => {
          if (!input.focused) return
          submit()
          dialog.clear()
        },
      },
      {
        title: "粘贴",
        value: "prompt.paste",
        disabled: true,
        keybind: "input_paste",
        category: "Prompt",
        onSelect: async () => {
          const content = await Clipboard.read()
          if (content?.mime.startsWith("image/")) {
            await pasteImage({
              filename: "clipboard",
              mime: content.mime,
              content: content.data,
            })
          }
        },
      },
      {
        title: "中断会话",
        value: "session.interrupt",
        keybind: "session_interrupt",
        disabled: status().type === "idle",
        category: "Session",
        onSelect: (dialog) => {
          if (autocomplete.visible) return
          if (!input.focused) return
          // TODO: this should be its own command
          if (store.mode === "shell") {
            setStore("mode", "normal")
            return
          }
          if (!props.sessionID) return

          setStore("interrupt", store.interrupt + 1)

          setTimeout(() => {
            setStore("interrupt", 0)
          }, 5000)

          if (store.interrupt >= 2) {
            sdk.client.session.abort({
              sessionID: props.sessionID,
            })
            setStore("interrupt", 0)
          }
          dialog.clear()
        },
      },
      {
        title: "打开编辑器",
        category: "Session",
        keybind: "editor_open",
        value: "prompt.editor",
        onSelect: async (dialog, trigger) => {
          dialog.clear()

          // replace summarized text parts with the actual text
          const text = store.prompt.parts
            .filter((p) => p.type === "text")
            .reduce((acc, p) => {
              if (!p.source) return acc
              return acc.replace(p.source.text.value, p.text)
            }, store.prompt.input)

          const nonTextParts = store.prompt.parts.filter((p) => p.type !== "text")

          const value = trigger === "prompt" ? "" : text
          const content = await Editor.open({ value, renderer })
          if (!content) return

          input.setText(content)

          // Update positions for nonTextParts based on their location in new content
          // Filter out parts whose virtual text was deleted
          // this handles a case where the user edits the text in the editor
          // such that the virtual text moves around or is deleted
          const updatedNonTextParts = nonTextParts
            .map((part) => {
              let virtualText = ""
              if (part.type === "file" && part.source?.text) {
                virtualText = part.source.text.value
              } else if (part.type === "agent" && part.source) {
                virtualText = part.source.value
              }

              if (!virtualText) return part

              const newStart = content.indexOf(virtualText)
              // if the virtual text is deleted, remove the part
              if (newStart === -1) return null

              const newEnd = newStart + virtualText.length

              if (part.type === "file" && part.source?.text) {
                return {
                  ...part,
                  source: {
                    ...part.source,
                    text: {
                      ...part.source.text,
                      start: newStart,
                      end: newEnd,
                    },
                  },
                }
              }

              if (part.type === "agent" && part.source) {
                return {
                  ...part,
                  source: {
                    ...part.source,
                    start: newStart,
                    end: newEnd,
                  },
                }
              }

              return part
            })
            .filter((part) => part !== null)

          setStore("prompt", {
            input: content,
            // keep only the non-text parts because the text parts were
            // already expanded inline
            parts: updatedNonTextParts,
          })
          restoreExtmarksFromParts(updatedNonTextParts)
          input.cursorOffset = Bun.stringWidth(content)
        },
      },
    ]
  })

  // 根据可见性设置焦点
  createEffect(() => {
    if (props.visible !== false) input?.focus() // 可见时获得焦点
    if (props.visible === false) input?.blur() // 不可见时失去焦点
  })

  // 组件挂载时注册提示词部分类型
  onMount(() => {
    promptPartTypeId = input.extmarks.registerType("prompt-part")
  })

  // 从部分列表恢复扩展标记
  function restoreExtmarksFromParts(parts: PromptInfo["parts"]) {
    input.extmarks.clear() // 清除所有扩展标记
    setStore("extmarkToPartIndex", new Map()) // 重置映射

    parts.forEach((part, partIndex) => {
      let start = 0
      let end = 0
      let virtualText = ""
      let styleId: number | undefined

      // 根据部分类型提取位置和虚拟文本
      if (part.type === "file" && part.source?.text) {
        start = part.source.text.start
        end = part.source.text.end
        virtualText = part.source.text.value
        styleId = fileStyleId
      } else if (part.type === "agent" && part.source) {
        start = part.source.start
        end = part.source.end
        virtualText = part.source.value
        styleId = agentStyleId
      } else if (part.type === "text" && part.source?.text) {
        start = part.source.text.start
        end = part.source.text.end
        virtualText = part.source.text.value
        styleId = pasteStyleId
      }

      // 如果有虚拟文本，创建扩展标记
      if (virtualText) {
        const extmarkId = input.extmarks.create({
          start,
          end,
          virtual: true,
          styleId,
          typeId: promptPartTypeId,
        })
        // 更新扩展标记到部分索引的映射
        setStore("extmarkToPartIndex", (map: Map<number, number>) => {
          const newMap = new Map(map)
          newMap.set(extmarkId, partIndex)
          return newMap
        })
      }
    })
  }

  // 同步扩展标记与提示词部分
  function syncExtmarksWithPromptParts() {
    const allExtmarks = input.extmarks.getAllForTypeId(promptPartTypeId)
    setStore(
      produce((draft) => {
        const newMap = new Map<number, number>()
        const newParts: typeof draft.prompt.parts = []

        // 遍历所有扩展标记，更新对应部分的位置
        for (const extmark of allExtmarks) {
          const partIndex = draft.extmarkToPartIndex.get(extmark.id)
          if (partIndex !== undefined) {
            const part = draft.prompt.parts[partIndex]
            if (part) {
              // 根据部分类型更新位置信息
              if (part.type === "agent" && part.source) {
                part.source.start = extmark.start
                part.source.end = extmark.end
              } else if (part.type === "file" && part.source?.text) {
                part.source.text.start = extmark.start
                part.source.text.end = extmark.end
              } else if (part.type === "text" && part.source?.text) {
                part.source.text.start = extmark.start
                part.source.text.end = extmark.end
              }
              newMap.set(extmark.id, newParts.length)
              newParts.push(part)
            }
          }
        }

        draft.extmarkToPartIndex = newMap
        draft.prompt.parts = newParts
      }),
    )
  }

  command.register(() => [
    {
      title: "暂存提示词",
      value: "prompt.stash",
      category: "Prompt",
      disabled: !store.prompt.input,
      onSelect: (dialog) => {
        if (!store.prompt.input) return
        stash.push({
          input: store.prompt.input,
          parts: store.prompt.parts,
        })
        input.extmarks.clear()
        input.clear()
        setStore("prompt", { input: "", parts: [] })
        setStore("extmarkToPartIndex", new Map())
        dialog.clear()
      },
    },
    {
      title: "恢复暂存",
      value: "prompt.stash.pop",
      category: "Prompt",
      disabled: stash.list().length === 0,
      onSelect: (dialog) => {
        const entry = stash.pop()
        if (entry) {
          input.setText(entry.input)
          setStore("prompt", { input: entry.input, parts: entry.parts })
          restoreExtmarksFromParts(entry.parts)
          input.gotoBufferEnd()
        }
        dialog.clear()
      },
    },
    {
      title: "暂存列表",
      value: "prompt.stash.list",
      category: "Prompt",
      disabled: stash.list().length === 0,
      onSelect: (dialog) => {
        dialog.replace(() => (
          <DialogStash
            onSelect={(entry) => {
              input.setText(entry.input)
              setStore("prompt", { input: entry.input, parts: entry.parts })
              restoreExtmarksFromParts(entry.parts)
              input.gotoBufferEnd()
            }}
          />
        ))
      },
    },
  ])

  props.ref?.({
    get focused() {
      return input.focused
    },
    get current() {
      return store.prompt
    },
    focus() {
      input.focus()
    },
    blur() {
      input.blur()
    },
    set(prompt) {
      input.setText(prompt.input)
      setStore("prompt", prompt)
      restoreExtmarksFromParts(prompt.parts)
      input.gotoBufferEnd()
    },
    reset() {
      input.clear()
      input.extmarks.clear()
      setStore("prompt", {
        input: "",
        parts: [],
      })
      setStore("extmarkToPartIndex", new Map())
    },
    submit() {
      submit()
    },
  })

  async function submit() {
    if (props.disabled) return
    if (autocomplete?.visible) return
    if (!store.prompt.input) return
    const trimmed = store.prompt.input.trim()
    if (trimmed === "exit" || trimmed === "quit" || trimmed === ":q") {
      exit()
      return
    }
    const selectedModel = local.model.current()
    if (!selectedModel) {
      promptModelWarning()
      return
    }
    const sessionID = props.sessionID
      ? props.sessionID
      : await (async () => {
          const sessionID = await sdk.client.session.create({}).then((x) => x.data!.id)
          return sessionID
        })()
    const messageID = Identifier.ascending("message")
    let inputText = store.prompt.input

    // Expand pasted text inline before submitting
    const allExtmarks = input.extmarks.getAllForTypeId(promptPartTypeId)
    const sortedExtmarks = allExtmarks.sort((a: { start: number }, b: { start: number }) => b.start - a.start)

    for (const extmark of sortedExtmarks) {
      const partIndex = store.extmarkToPartIndex.get(extmark.id)
      if (partIndex !== undefined) {
        const part = store.prompt.parts[partIndex]
        if (part?.type === "text" && part.text) {
          const before = inputText.slice(0, extmark.start)
          const after = inputText.slice(extmark.end)
          inputText = before + part.text + after
        }
      }
    }

    // Filter out text parts (pasted content) since they're now expanded inline
    const nonTextParts = store.prompt.parts.filter((part) => part.type !== "text")

    // Capture mode before it gets reset
    const currentMode = store.mode
    const variant = local.model.variant.current()

    if (store.mode === "shell") {
      sdk.client.session.shell({
        sessionID,
        agent: local.agent.current().name,
        model: {
          providerID: selectedModel.providerID,
          modelID: selectedModel.modelID,
        },
        command: inputText,
      })
      setStore("mode", "normal")
    } else if (
      inputText.startsWith("/") &&
      iife(() => {
        const command = inputText.split(" ")[0].slice(1)
        console.log(command)
        return sync.data.command.some((x) => x.name === command)
      })
    ) {
      let [command, ...args] = inputText.split(" ")
      sdk.client.session.command({
        sessionID,
        command: command.slice(1),
        arguments: args.join(" "),
        agent: local.agent.current().name,
        model: `${selectedModel.providerID}/${selectedModel.modelID}`,
        messageID,
        variant,
      })
    } else {
      sdk.client.session.prompt({
        sessionID,
        ...selectedModel,
        messageID,
        agent: local.agent.current().name,
        model: selectedModel,
        variant,
        parts: [
          {
            id: Identifier.ascending("part"),
            type: "text",
            text: inputText,
          },
          ...nonTextParts.map((x) => ({
            id: Identifier.ascending("part"),
            ...x,
          })),
        ],
      })
    }
    history.append({
      ...store.prompt,
      mode: currentMode,
    })
    input.extmarks.clear()
    setStore("prompt", {
      input: "",
      parts: [],
    })
    setStore("extmarkToPartIndex", new Map())
    props.onSubmit?.()

    // temporary hack to make sure the message is sent
    if (!props.sessionID)
      setTimeout(() => {
        route.navigate({
          type: "session",
          sessionID,
        })
      }, 50)
    input.clear()
  }
  const exit = useExit()

  function pasteText(text: string, virtualText: string) {
    const currentOffset = input.visualCursor.offset
    const extmarkStart = currentOffset
    const extmarkEnd = extmarkStart + virtualText.length

    input.insertText(virtualText + " ")

    const extmarkId = input.extmarks.create({
      start: extmarkStart,
      end: extmarkEnd,
      virtual: true,
      styleId: pasteStyleId,
      typeId: promptPartTypeId,
    })

    setStore(
      produce((draft) => {
        const partIndex = draft.prompt.parts.length
        draft.prompt.parts.push({
          type: "text" as const,
          text,
          source: {
            text: {
              start: extmarkStart,
              end: extmarkEnd,
              value: virtualText,
            },
          },
        })
        draft.extmarkToPartIndex.set(extmarkId, partIndex)
      }),
    )
  }

  async function pasteImage(file: { filename?: string; content: string; mime: string }) {
    const currentOffset = input.visualCursor.offset
    const extmarkStart = currentOffset
    const count = store.prompt.parts.filter((x) => x.type === "file").length
    const virtualText = `[Image ${count + 1}]`
    const extmarkEnd = extmarkStart + virtualText.length
    const textToInsert = virtualText + " "

    input.insertText(textToInsert)

    const extmarkId = input.extmarks.create({
      start: extmarkStart,
      end: extmarkEnd,
      virtual: true,
      styleId: pasteStyleId,
      typeId: promptPartTypeId,
    })

    const part: Omit<FilePart, "id" | "messageID" | "sessionID"> = {
      type: "file" as const,
      mime: file.mime,
      filename: file.filename,
      url: `data:${file.mime};base64,${file.content}`,
      source: {
        type: "file",
        path: file.filename ?? "",
        text: {
          start: extmarkStart,
          end: extmarkEnd,
          value: virtualText,
        },
      },
    }
    setStore(
      produce((draft) => {
        const partIndex = draft.prompt.parts.length
        draft.prompt.parts.push(part)
        draft.extmarkToPartIndex.set(extmarkId, partIndex)
      }),
    )
    return
  }

  const highlight = createMemo(() => {
    if (keybind.leader) return theme.border
    if (store.mode === "shell") return theme.primary
    return local.agent.color(local.agent.current().name)
  })

  const showVariant = createMemo(() => {
    const variants = local.model.variant.list()
    if (variants.length === 0) return false
    const current = local.model.variant.current()
    return !!current
  })

  const spinnerDef = createMemo(() => {
    const color = local.agent.color(local.agent.current().name)
    return {
      frames: createFrames({
        color,
        style: "blocks",
        inactiveFactor: 0.6,
        // enableFading: false,
        minAlpha: 0.3,
      }),
      color: createColors({
        color,
        style: "blocks",
        inactiveFactor: 0.6,
        // enableFading: false,
        minAlpha: 0.3,
      }),
    }
  })

  return (
    <>
      <Autocomplete
        sessionID={props.sessionID}
        ref={(r) => (autocomplete = r)}
        anchor={() => anchor}
        input={() => input}
        setPrompt={(cb) => {
          setStore("prompt", produce(cb))
        }}
        setExtmark={(partIndex, extmarkId) => {
          setStore("extmarkToPartIndex", (map: Map<number, number>) => {
            const newMap = new Map(map)
            newMap.set(extmarkId, partIndex)
            return newMap
          })
        }}
        value={store.prompt.input}
        fileStyleId={fileStyleId}
        agentStyleId={agentStyleId}
        promptPartTypeId={() => promptPartTypeId}
      />
      <box ref={(r) => (anchor = r)} visible={props.visible !== false}>
        <box
          border={["left"]}
          borderColor={highlight()}
          customBorderChars={{
            ...EmptyBorder,
            vertical: "┃",
            bottomLeft: "╹",
          }}
        >
          <box
            paddingLeft={2}
            paddingRight={1}
            paddingTop={1}
            flexShrink={0}
            backgroundColor={theme.backgroundElement}
            flexGrow={1}
          >
            <textarea
              placeholder={props.sessionID ? undefined : `输入任何内容... "${PLACEHOLDERS[store.placeholder]}"`}
              textColor={keybind.leader ? theme.textMuted : theme.text}
              focusedTextColor={keybind.leader ? theme.textMuted : theme.text}
              minHeight={1}
              maxHeight={6}
              onContentChange={() => {
                const value = input.plainText
                setStore("prompt", "input", value)
                autocomplete.onInput(value)
                syncExtmarksWithPromptParts()
              }}
              keyBindings={textareaKeybindings()}
              onKeyDown={async (e) => {
                if (props.disabled) {
                  e.preventDefault()
                  return
                }
                // Handle clipboard paste (Ctrl+V) - check for images first on Windows
                // This is needed because Windows terminal doesn't properly send image data
                // through bracketed paste, so we need to intercept the keypress and
                // directly read from clipboard before the terminal handles it
                if (keybind.match("input_paste", e)) {
                  const content = await Clipboard.read()
                  if (content?.mime.startsWith("image/")) {
                    e.preventDefault()
                    await pasteImage({
                      filename: "clipboard",
                      mime: content.mime,
                      content: content.data,
                    })
                    return
                  }
                  // If no image, let the default paste behavior continue
                }
                if (keybind.match("input_clear", e) && store.prompt.input !== "") {
                  input.clear()
                  input.extmarks.clear()
                  setStore("prompt", {
                    input: "",
                    parts: [],
                  })
                  setStore("extmarkToPartIndex", new Map())
                  return
                }
                if (keybind.match("app_exit", e)) {
                  if (store.prompt.input === "") {
                    await exit()
                    // Don't preventDefault - let textarea potentially handle the event
                    e.preventDefault()
                    return
                  }
                }
                if (e.name === "!" && input.visualCursor.offset === 0) {
                  setStore("mode", "shell")
                  e.preventDefault()
                  return
                }
                if (store.mode === "shell") {
                  if ((e.name === "backspace" && input.visualCursor.offset === 0) || e.name === "escape") {
                    setStore("mode", "normal")
                    e.preventDefault()
                    return
                  }
                }
                if (store.mode === "normal") autocomplete.onKeyDown(e)
                if (!autocomplete.visible) {
                  if (
                    (keybind.match("history_previous", e) && input.cursorOffset === 0) ||
                    (keybind.match("history_next", e) && input.cursorOffset === input.plainText.length)
                  ) {
                    const direction = keybind.match("history_previous", e) ? -1 : 1
                    const item = history.move(direction, input.plainText)

                    if (item) {
                      input.setText(item.input)
                      setStore("prompt", item)
                      setStore("mode", item.mode ?? "normal")
                      restoreExtmarksFromParts(item.parts)
                      e.preventDefault()
                      if (direction === -1) input.cursorOffset = 0
                      if (direction === 1) input.cursorOffset = input.plainText.length
                    }
                    return
                  }

                  if (keybind.match("history_previous", e) && input.visualCursor.visualRow === 0) input.cursorOffset = 0
                  if (keybind.match("history_next", e) && input.visualCursor.visualRow === input.height - 1)
                    input.cursorOffset = input.plainText.length
                }
              }}
              onSubmit={submit}
              onPaste={async (event: PasteEvent) => {
                if (props.disabled) {
                  event.preventDefault()
                  return
                }

                // Normalize line endings at the boundary
                // Windows ConPTY/Terminal often sends CR-only newlines in bracketed paste
                // Replace CRLF first, then any remaining CR
                const normalizedText = event.text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
                const pastedContent = normalizedText.trim()
                if (!pastedContent) {
                  command.trigger("prompt.paste")
                  return
                }

                // trim ' from the beginning and end of the pasted content. just
                // ' and nothing else
                const filepath = pastedContent.replace(/^'+|'+$/g, "").replace(/\\ /g, " ")
                const isUrl = /^(https?):\/\//.test(filepath)
                if (!isUrl) {
                  try {
                    const file = Bun.file(filepath)
                    // Handle SVG as raw text content, not as base64 image
                    if (file.type === "image/svg+xml") {
                      event.preventDefault()
                      const content = await file.text().catch(() => {})
                      if (content) {
                        pasteText(content, `[SVG: ${file.name ?? "image"}]`)
                        return
                      }
                    }
                    if (file.type.startsWith("image/")) {
                      event.preventDefault()
                      const content = await file
                        .arrayBuffer()
                        .then((buffer) => Buffer.from(buffer).toString("base64"))
                        .catch(() => {})
                      if (content) {
                        await pasteImage({
                          filename: file.name,
                          mime: file.type,
                          content,
                        })
                        return
                      }
                    }
                  } catch {}
                }

                const lineCount = (pastedContent.match(/\n/g)?.length ?? 0) + 1
                if (
                  (lineCount >= 3 || pastedContent.length > 150) &&
                  !sync.data.config.experimental?.disable_paste_summary
                ) {
                  event.preventDefault()
                  pasteText(pastedContent, `[Pasted ~${lineCount} lines]`)
                  return
                }

                // Force layout update and render for the pasted content
                setTimeout(() => {
                  input.getLayoutNode().markDirty()
                  input.gotoBufferEnd()
                  renderer.requestRender()
                }, 0)
              }}
              ref={(r: TextareaRenderable) => {
                input = r
                setTimeout(() => {
                  input.cursorColor = theme.text
                }, 0)
              }}
              onMouseDown={(r: MouseEvent) => r.target?.focus()}
              focusedBackgroundColor={theme.backgroundElement}
              cursorColor={theme.text}
              syntaxStyle={syntax()}
            />
            <box flexDirection="row" flexShrink={0} paddingTop={1} gap={1}>
              <text fg={highlight()}>
                {store.mode === "shell" ? "Shell" : Locale.titlecase(local.agent.current().name)}{" "}
              </text>
              <Show when={store.mode === "normal"}>
                <box flexDirection="row" gap={1}>
                  <text flexShrink={0} fg={keybind.leader ? theme.textMuted : theme.text}>
                    {local.model.parsed().model}
                  </text>
                  <text fg={theme.textMuted}>{local.model.parsed().provider}</text>
                  <Show when={showVariant()}>
                    <text fg={theme.textMuted}>·</text>
                    <text>
                      <span style={{ fg: theme.warning, bold: true }}>{local.model.variant.current()}</span>
                    </text>
                  </Show>
                </box>
              </Show>
            </box>
          </box>
        </box>
        <box
          height={1}
          border={["left"]}
          borderColor={highlight()}
          customBorderChars={{
            ...EmptyBorder,
            vertical: theme.backgroundElement.a !== 0 ? "╹" : " ",
          }}
        >
          <box
            height={1}
            border={["bottom"]}
            borderColor={theme.backgroundElement}
            customBorderChars={
              theme.backgroundElement.a !== 0
                ? {
                    ...EmptyBorder,
                    horizontal: "▀",
                  }
                : {
                    ...EmptyBorder,
                    horizontal: " ",
                  }
            }
          />
        </box>
        <box flexDirection="row" justifyContent="space-between">
          <Show when={status().type !== "idle"} fallback={<text />}>
            <box
              flexDirection="row"
              gap={1}
              flexGrow={1}
              justifyContent={status().type === "retry" ? "space-between" : "flex-start"}
            >
              <box flexShrink={0} flexDirection="row" gap={1}>
                <box marginLeft={1}>
                  <Show when={kv.get("animations_enabled", true)} fallback={<text fg={theme.textMuted}>[⋯]</text>}>
                    <spinner color={spinnerDef().color} frames={spinnerDef().frames} interval={40} />
                  </Show>
                </box>
                <box flexDirection="row" gap={1} flexShrink={0}>
                  {(() => {
                    const retry = createMemo(() => {
                      const s = status()
                      if (s.type !== "retry") return
                      return s
                    })
                    const message = createMemo(() => {
                      const r = retry()
                      if (!r) return
                      if (r.message.includes("exceeded your current quota") && r.message.includes("gemini"))
                        return "gemini is way too hot right now"
                      if (r.message.length > 80) return r.message.slice(0, 80) + "..."
                      return r.message
                    })
                    const isTruncated = createMemo(() => {
                      const r = retry()
                      if (!r) return false
                      return r.message.length > 120
                    })
                    const [seconds, setSeconds] = createSignal(0)
                    onMount(() => {
                      const timer = setInterval(() => {
                        const next = retry()?.next
                        if (next) setSeconds(Math.round((next - Date.now()) / 1000))
                      }, 1000)

                      onCleanup(() => {
                        clearInterval(timer)
                      })
                    })
                    const handleMessageClick = () => {
                      const r = retry()
                      if (!r) return
                      if (isTruncated()) {
                        DialogAlert.show(dialog, "Retry Error", r.message)
                      }
                    }

                    const retryText = () => {
                      const r = retry()
                      if (!r) return ""
                      const baseMessage = message()
                      const truncatedHint = isTruncated() ? " (click to expand)" : ""
                      const retryInfo = ` [retrying ${seconds() > 0 ? `in ${seconds()}s ` : ""}attempt #${r.attempt}]`
                      return baseMessage + truncatedHint + retryInfo
                    }

                    return (
                      <Show when={retry()}>
                        <box onMouseUp={handleMessageClick}>
                          <text fg={theme.error}>{retryText()}</text>
                        </box>
                      </Show>
                    )
                  })()}
                </box>
              </box>
              <text fg={store.interrupt > 0 ? theme.primary : theme.text}>
                esc{" "}
                <span style={{ fg: store.interrupt > 0 ? theme.primary : theme.textMuted }}>
                  {store.interrupt > 0 ? "again to interrupt" : "interrupt"}
                </span>
              </text>
            </box>
          </Show>
          <Show when={status().type !== "retry"}>
            <box gap={2} flexDirection="row">
              <Switch>
                <Match when={store.mode === "normal"}>
                  <text fg={theme.text}>
                    {keybind.print("agent_cycle")} <span style={{ fg: theme.textMuted }}>switch agent</span>
                  </text>
                  <text fg={theme.text}>
                    {keybind.print("command_list")} <span style={{ fg: theme.textMuted }}>commands</span>
                  </text>
                </Match>
                <Match when={store.mode === "shell"}>
                  <text fg={theme.text}>
                    esc <span style={{ fg: theme.textMuted }}>exit shell mode</span>
                  </text>
                </Match>
              </Switch>
            </box>
          </Show>
        </box>
      </box>
    </>
  )
}
