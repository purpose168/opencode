/**
 * 会话回合组件
 * 用于显示单个用户消息及其对应的助手响应，支持不同的显示模式和状态
 */
import {
  AssistantMessage,
  Message as MessageType,
  Part as PartType,
  type PermissionRequest,
  TextPart,
  ToolPart,
} from "@opencode-ai/sdk/v2/client"
import { Binary } from "@opencode-ai/util/binary"
import { checksum } from "@opencode-ai/util/encode"
import { getDirectory, getFilename } from "@opencode-ai/util/path"
import { createResizeObserver } from "@solid-primitives/resize-observer"
import { DateTime, DurationUnit, Interval } from "luxon"
import { createEffect, createMemo, For, Match, on, onCleanup, ParentProps, Show, Switch } from "solid-js"
import { createStore } from "solid-js/store"
import { Dynamic } from "solid-js/web"
import { useData } from "../context"
import { useDiffComponent } from "../context/diff"
import { createAutoScroll } from "../hooks"
import { Accordion } from "./accordion"
import { Button } from "./button"
import { Card } from "./card"
import { DiffChanges } from "./diff-changes"
import { FileIcon } from "./file-icon"
import { Icon } from "./icon"
import { Markdown } from "./markdown"
import { Message, Part } from "./message-part"
import { Spinner } from "./spinner"
import { StickyAccordionHeader } from "./sticky-accordion-header"
import { Typewriter } from "./typewriter"

/**
 * 从部件计算状态文本
 * @param part - 消息部件
 * @returns 状态文本
 */
function computeStatusFromPart(part: PartType | undefined): string | undefined {
  if (!part) return undefined

  if (part.type === "tool") {
    switch (part.tool) {
      case "task":
        return "委托工作"
      case "todowrite":
      case "todoread":
        return "规划下一步"
      case "read":
        return "收集上下文"
      case "list":
      case "grep":
      case "glob":
        return "搜索代码库"
      case "webfetch":
        return "搜索网络"
      case "edit":
      case "write":
        return "进行编辑"
      case "bash":
        return "运行命令"
      default:
        return undefined
    }
  }
  if (part.type === "reasoning") {
    const text = part.text ?? ""
    const match = text.trimStart().match(/^\*\*(.+?)\*\*/)
    if (match) return `思考中 · ${match[1].trim()}`
    return "思考中"
  }
  if (part.type === "text") {
    return "整理思路"
  }
  return undefined
}

/**
 * 比较两个数组是否相同
 * @param a - 第一个数组
 * @param b - 第二个数组
 * @returns 是否相同
 */
function same<T>(a: readonly T[], b: readonly T[]) {
  if (a === b) return true
  if (a.length !== b.length) return false
  return a.every((x, i) => x === b[i])
}

/**
 * 助手消息项组件
 * 显示助手消息的部件
 */
function AssistantMessageItem(props: {
  /** 助手消息 */
  message: AssistantMessage
  /** 响应部件ID */
  responsePartId: string | undefined
  /** 是否隐藏响应部件 */
  hideResponsePart: boolean
  /** 是否隐藏推理部件 */
  hideReasoning: boolean
}) {
  const data = useData()
  const emptyParts: PartType[] = []
  /** 消息部件 */
  const msgParts = createMemo(() => data.store.part[props.message.id] ?? emptyParts)
  /** 最后一个文本部件 */
  const lastTextPart = createMemo(() => {
    const parts = msgParts()
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i]
      if (part?.type === "text") return part as TextPart
    }
    return undefined
  })

  /** 过滤后的部件 */
  const filteredParts = createMemo(() => {
    let parts = msgParts()

    if (props.hideReasoning) {
      parts = parts.filter((part) => part?.type !== "reasoning")
    }

    if (!props.hideResponsePart) return parts

    const responsePartId = props.responsePartId
    if (!responsePartId) return parts
    if (responsePartId !== lastTextPart()?.id) return parts

    return parts.filter((part) => part?.id !== responsePartId)
  })

  return <Message message={props.message} parts={filteredParts()} />
}

/**
 * 会话回合组件
 * 显示单个用户消息及其对应的助手响应
 */
export function SessionTurn(
  props: ParentProps<{
    /** 会话ID */
    sessionID: string
    /** 消息ID */
    messageID: string
    /** 最后一个用户消息ID */
    lastUserMessageID?: string
    /** 步骤是否展开 */
    stepsExpanded?: boolean
    /** 步骤展开切换回调函数 */
    onStepsExpandedToggle?: () => void
    /** 用户交互回调函数 */
    onUserInteracted?: () => void
    /** 自定义类名 */
    classes?: {
      root?: string
      content?: string
      container?: string
    }
  }>,
) {
  const data = useData()
  const diffComponent = useDiffComponent()

  const emptyMessages: MessageType[] = []
  const emptyParts: PartType[] = []
  const emptyAssistant: AssistantMessage[] = []
  const emptyPermissions: PermissionRequest[] = []
  const emptyPermissionParts: { part: ToolPart; message: AssistantMessage }[] = []
  const idle = { type: "idle" as const }

  /** 所有消息 */
  const allMessages = createMemo(() => data.store.message[props.sessionID] ?? emptyMessages)

  /** 消息索引 */
  const messageIndex = createMemo(() => {
    const messages = allMessages()
    const result = Binary.search(messages, props.messageID, (m) => m.id)
    if (!result.found) return -1

    const msg = messages[result.index]
    if (msg.role !== "user") return -1

    return result.index
  })

  /** 消息 */
  const message = createMemo(() => {
    const index = messageIndex()
    if (index < 0) return undefined

    const msg = allMessages()[index]
    if (!msg || msg.role !== "user") return undefined

    return msg
  })

  /** 最后一个用户消息ID */
  const lastUserMessageID = createMemo(() => {
    if (props.lastUserMessageID) return props.lastUserMessageID

    const messages = allMessages()
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg?.role === "user") return msg.id
    }
    return undefined
  })

  /** 是否是最后一个用户消息 */
  const isLastUserMessage = createMemo(() => props.messageID === lastUserMessageID())

  /** 消息部件 */
  const parts = createMemo(() => {
    const msg = message()
    if (!msg) return emptyParts
    return data.store.part[msg.id] ?? emptyParts
  })

  /** 助手消息 */
  const assistantMessages = createMemo(
    () => {
      const msg = message()
      if (!msg) return emptyAssistant

      const messages = allMessages()
      const index = messageIndex()
      if (index < 0) return emptyAssistant

      const result: AssistantMessage[] = []
      for (let i = index + 1; i < messages.length; i++) {
        const item = messages[i]
        if (!item) continue
        if (item.role === "user") break
        if (item.role === "assistant" && item.parentID === msg.id) result.push(item as AssistantMessage)
      }
      return result
    },
    emptyAssistant,
    { equals: same },
  )

  /** 最后一个助手消息 */
  const lastAssistantMessage = createMemo(() => assistantMessages().at(-1))

  /** 错误信息 */
  const error = createMemo(() => assistantMessages().find((m) => m.error)?.error)

  /** 最后一个文本部件 */
  const lastTextPart = createMemo(() => {
    const msgs = assistantMessages()
    for (let mi = msgs.length - 1; mi >= 0; mi--) {
      const msgParts = data.store.part[msgs[mi].id] ?? emptyParts
      for (let pi = msgParts.length - 1; pi >= 0; pi--) {
        const part = msgParts[pi]
        if (part?.type === "text") return part as TextPart
      }
    }
    return undefined
  })

  /** 是否有步骤 */
  const hasSteps = createMemo(() => {
    for (const m of assistantMessages()) {
      const msgParts = data.store.part[m.id]
      if (!msgParts) continue
      for (const p of msgParts) {
        if (p?.type === "tool") return true
      }
    }
    return false
  })

  /** 权限请求 */
  const permissions = createMemo(() => data.store.permission?.[props.sessionID] ?? emptyPermissions)
  /** 权限请求数量 */
  const permissionCount = createMemo(() => permissions().length)
  /** 下一个权限请求 */
  const nextPermission = createMemo(() => permissions()[0])

  /** 权限部件 */
  const permissionParts = createMemo(() => {
    if (props.stepsExpanded) return emptyPermissionParts

    const next = nextPermission()
    if (!next || !next.tool) return emptyPermissionParts

    const message = assistantMessages().findLast((m) => m.id === next.tool!.messageID)
    if (!message) return emptyPermissionParts

    const parts = data.store.part[message.id] ?? emptyParts
    for (const part of parts) {
      if (part?.type !== "tool") continue
      const tool = part as ToolPart
      if (tool.callID === next.tool?.callID) return [{ part: tool, message }]
    }

    return emptyPermissionParts
  })

  /** Shell模式部件 */
  const shellModePart = createMemo(() => {
    const p = parts()
    if (!p.every((part) => part?.type === "text" && part?.synthetic)) return

    const msgs = assistantMessages()
    if (msgs.length !== 1) return

    const msgParts = data.store.part[msgs[0].id] ?? emptyParts
    if (msgParts.length !== 1) return

    const assistantPart = msgParts[0]
    if (assistantPart?.type === "tool" && assistantPart.tool === "bash") return assistantPart
  })

  /** 是否是Shell模式 */
  const isShellMode = createMemo(() => !!shellModePart())

  /** 原始状态 */
  const rawStatus = createMemo(() => {
    const msgs = assistantMessages()
    let last: PartType | undefined
    let currentTask: ToolPart | undefined

    for (let mi = msgs.length - 1; mi >= 0; mi--) {
      const msgParts = data.store.part[msgs[mi].id] ?? emptyParts
      for (let pi = msgParts.length - 1; pi >= 0; pi--) {
        const part = msgParts[pi]
        if (!part) continue
        if (!last) last = part

        if (
          part.type === "tool" &&
          part.tool === "task" &&
          part.state &&
          "metadata" in part.state &&
          part.state.metadata?.sessionId &&
          part.state.status === "running"
        ) {
          currentTask = part as ToolPart
          break
        }
      }
      if (currentTask) break
    }

    const taskSessionId =
      currentTask?.state && "metadata" in currentTask.state
        ? (currentTask.state.metadata?.sessionId as string | undefined)
        : undefined

    if (taskSessionId) {
      const taskMessages = data.store.message[taskSessionId] ?? emptyMessages
      for (let mi = taskMessages.length - 1; mi >= 0; mi--) {
        const msg = taskMessages[mi]
        if (!msg || msg.role !== "assistant") continue

        const msgParts = data.store.part[msg.id] ?? emptyParts
        for (let pi = msgParts.length - 1; pi >= 0; pi--) {
          const part = msgParts[pi]
          if (part) return computeStatusFromPart(part)
        }
      }
    }

    return computeStatusFromPart(last)
  })

  /** 状态 */
  const status = createMemo(() => data.store.session_status[props.sessionID] ?? idle)
  /** 是否正在工作 */
  const working = createMemo(() => status().type !== "idle" && isLastUserMessage())
  /** 重试信息 */
  const retry = createMemo(() => {
    const s = status()
    if (s.type !== "retry") return
    return s
  })

  /** 响应文本 */
  const response = createMemo(() => lastTextPart()?.text)
  /** 响应部件ID */
  const responsePartId = createMemo(() => lastTextPart()?.id)
  /** 是否有差异 */
  const hasDiffs = createMemo(() => message()?.summary?.diffs?.length)
  /** 是否隐藏响应部件 */
  const hideResponsePart = createMemo(() => !working() && !!responsePartId())

  /**
   * 计算持续时间
   * @returns 持续时间文本
   */
  function duration() {
    const msg = message()
    if (!msg) return ""
    const completed = lastAssistantMessage()?.time.completed
    const from = DateTime.fromMillis(msg.time.created)
    const to = completed ? DateTime.fromMillis(completed) : DateTime.now()
    const interval = Interval.fromDateTimes(from, to)
    const unit: DurationUnit[] = interval.length("seconds") > 60 ? ["minutes", "seconds"] : ["seconds"]

    return interval.toDuration(unit).normalize().toHuman({
      notation: "compact",
      unitDisplay: "narrow",
      compactDisplay: "short",
      showZeros: false,
    })
  }

  /** 自动滚动 */
  const autoScroll = createAutoScroll({
    working,
    onUserInteracted: props.onUserInteracted,
  })

  /** 状态存储 */
  const [store, setStore] = createStore({
    stickyTitleRef: undefined as HTMLDivElement | undefined,
    stickyTriggerRef: undefined as HTMLDivElement | undefined,
    stickyHeaderHeight: 0,
    retrySeconds: 0,
    status: rawStatus(),
    duration: duration(),
  })

  /** 监听重试状态 */
  createEffect(() => {
    const r = retry()
    if (!r) {
      setStore("retrySeconds", 0)
      return
    }
    const updateSeconds = () => {
      const next = r.next
      if (next) setStore("retrySeconds", Math.max(0, Math.round((next - Date.now()) / 1000)))
    }
    updateSeconds()
    const timer = setInterval(updateSeconds, 1000)
    onCleanup(() => clearInterval(timer))
  })

  /** 监听粘性标题大小变化 */
  createResizeObserver(
    () => store.stickyTitleRef,
    ({ height }) => {
      const triggerHeight = store.stickyTriggerRef?.offsetHeight ?? 0
      setStore("stickyHeaderHeight", height + triggerHeight + 8)
    },
  )

  /** 监听粘性触发器大小变化 */
  createResizeObserver(
    () => store.stickyTriggerRef,
    ({ height }) => {
      const titleHeight = store.stickyTitleRef?.offsetHeight ?? 0
      setStore("stickyHeaderHeight", titleHeight + height + 8)
    },
  )

  /** 监听持续时间变化 */
  createEffect(() => {
    const timer = setInterval(() => {
      setStore("duration", duration())
    }, 1000)
    onCleanup(() => clearInterval(timer))
  })

  /** 监听权限数量变化 */
  createEffect(
    on(permissionCount, (count, prev) => {
      if (!count) return
      if (prev !== undefined && count <= prev) return
      autoScroll.forceScrollToBottom()
    }),
  )

  /** 监听状态变化 */
  let lastStatusChange = Date.now()
  let statusTimeout: number | undefined
  createEffect(() => {
    const newStatus = rawStatus()
    if (newStatus === store.status || !newStatus) return

    const timeSinceLastChange = Date.now() - lastStatusChange
    if (timeSinceLastChange >= 2500) {
      setStore("status", newStatus)
      lastStatusChange = Date.now()
      if (statusTimeout) {
        clearTimeout(statusTimeout)
        statusTimeout = undefined
      }
    } else {
      if (statusTimeout) clearTimeout(statusTimeout)
      statusTimeout = setTimeout(() => {
        setStore("status", rawStatus())
        lastStatusChange = Date.now()
        statusTimeout = undefined
      }, 2500 - timeSinceLastChange) as unknown as number
    }
  })

  return (
    <div data-component="session-turn" class={props.classes?.root}>
      <div
        ref={autoScroll.scrollRef}
        onScroll={autoScroll.handleScroll}
        data-slot="session-turn-content"
        class={props.classes?.content}
      >
        <div onClick={autoScroll.handleInteraction}>
          <Show when={message()}>
            {(msg) => (
              <div
                ref={autoScroll.contentRef}
                data-message={msg().id}
                data-slot="session-turn-message-container"
                class={props.classes?.container}
                style={{ "--sticky-header-height": `${store.stickyHeaderHeight}px` }}
              >
                <Switch>
                  <Match when={isShellMode()}>
                    <Part part={shellModePart()!} message={msg()} defaultOpen />
                  </Match>
                  <Match when={true}>
                    {/* 标题（粘性） */}
                    <div ref={(el) => setStore("stickyTitleRef", el)} data-slot="session-turn-sticky-title">
                      <div data-slot="session-turn-message-header">
                        <div data-slot="session-turn-message-title">
                          <Switch>
                            <Match when={working()}>
                              <Typewriter as="h1" text={msg().summary?.title} data-slot="session-turn-typewriter" />
                            </Match>
                            <Match when={true}>
                              <h1>{msg().summary?.title}</h1>
                            </Match>
                          </Switch>
                        </div>
                      </div>
                    </div>
                    {/* 用户消息 */}
                    <div data-slot="session-turn-message-content">
                      <Message message={msg()} parts={parts()} />
                    </div>
                    {/* 触发器（粘性） */}
                    <Show when={working() || hasSteps()}>
                      <div ref={(el) => setStore("stickyTriggerRef", el)} data-slot="session-turn-response-trigger">
                        <Button
                          data-expandable={assistantMessages().length > 0}
                          data-slot="session-turn-collapsible-trigger-content"
                          variant="ghost"
                          size="small"
                          onClick={props.onStepsExpandedToggle ?? (() => {})}
                        >
                          <Show when={working()}>
                            <Spinner />
                          </Show>
                          <Switch>
                            <Match when={retry()}>
                              <span data-slot="session-turn-retry-message">
                                {(() => {
                                  const r = retry()
                                  if (!r) return ""
                                  return r.message.length > 60 ? r.message.slice(0, 60) + "..." : r.message
                                })()}
                              </span>
                              <span data-slot="session-turn-retry-seconds">
                                · 正在重试 {store.retrySeconds > 0 ? `${store.retrySeconds}秒后 ` : ""}
                              </span>
                              <span data-slot="session-turn-retry-attempt">(第{retry()?.attempt}次尝试)</span>
                            </Match>
                            <Match when={working()}>{store.status ?? "考虑下一步"}</Match>
                            <Match when={props.stepsExpanded}>隐藏步骤</Match>
                            <Match when={!props.stepsExpanded}>显示步骤</Match>
                          </Switch>
                          <span>·</span>
                          <span>{store.duration}</span>
                          <Show when={assistantMessages().length > 0}>
                            <Icon name="chevron-grabber-vertical" size="small" />
                          </Show>
                        </Button>
                      </div>
                    </Show>
                    {/* 响应 */}
                    <Show when={props.stepsExpanded && assistantMessages().length > 0}>
                      <div data-slot="session-turn-collapsible-content-inner">
                        <For each={assistantMessages()}>
                          {(assistantMessage) => (
                            <AssistantMessageItem
                              message={assistantMessage}
                              responsePartId={responsePartId()}
                              hideResponsePart={hideResponsePart()}
                              hideReasoning={!working()}
                            />
                          )}
                        </For>
                        <Show when={error()}>
                          <Card variant="error" class="error-card">
                            {error()?.data?.message as string}
                          </Card>
                        </Show>
                      </div>
                    </Show>
                    <Show when={!props.stepsExpanded && permissionParts().length > 0}>
                      <div data-slot="session-turn-permission-parts">
                        <For each={permissionParts()}>
                          {({ part, message }) => <Part part={part} message={message} />}
                        </For>
                      </div>
                    </Show>
                    {/* 响应 */}
                    <Show when={!working() && (response() || hasDiffs())}>
                      <div data-slot="session-turn-summary-section">
                        <div data-slot="session-turn-summary-header">
                          <h2 data-slot="session-turn-summary-title">Response</h2>
                          <Markdown data-slot="session-turn-markdown" data-diffs={hasDiffs()} text={response() ?? ""} />
                        </div>
                        <Accordion data-slot="session-turn-accordion" multiple>
                          <For each={msg().summary?.diffs ?? []}>
                            {(diff) => (
                              <Accordion.Item value={diff.file}>
                                <StickyAccordionHeader>
                                  <Accordion.Trigger>
                                    <div data-slot="session-turn-accordion-trigger-content">
                                      <div data-slot="session-turn-file-info">
                                        <FileIcon
                                          node={{ path: diff.file, type: "file" }}
                                          data-slot="session-turn-file-icon"
                                        />
                                        <div data-slot="session-turn-file-path">
                                          <Show when={diff.file.includes("/")}>
                                            <span data-slot="session-turn-directory">
                                              {getDirectory(diff.file)}&lrm;
                                            </span>
                                          </Show>
                                          <span data-slot="session-turn-filename">{getFilename(diff.file)}</span>
                                        </div>
                                      </div>
                                      <div data-slot="session-turn-accordion-actions">
                                        <DiffChanges changes={diff} />
                                        <Icon name="chevron-grabber-vertical" size="small" />
                                      </div>
                                    </div>
                                  </Accordion.Trigger>
                                </StickyAccordionHeader>
                                <Accordion.Content data-slot="session-turn-accordion-content">
                                  <Dynamic
                                    component={diffComponent}
                                    before={{
                                      name: diff.file!,
                                      contents: diff.before!,
                                      cacheKey: checksum(diff.before!),
                                    }}
                                    after={{
                                      name: diff.file!,
                                      contents: diff.after!,
                                      cacheKey: checksum(diff.after!),
                                    }}
                                  />
                                </Accordion.Content>
                              </Accordion.Item>
                            )}
                          </For>
                        </Accordion>
                      </div>
                    </Show>
                    <Show when={error() && !props.stepsExpanded}>
                      <Card variant="error" class="error-card">
                        {error()?.data?.message as string}
                      </Card>
                    </Show>
                  </Match>
                </Switch>
              </div>
            )}
          </Show>
          {props.children}
        </div>
      </div>
    </div>
  )
}
