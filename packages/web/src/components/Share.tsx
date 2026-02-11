/**
 * 分享组件
 *
 * 用于显示和分享 OpenCode 会话的组件，包括消息展示、状态管理和滚动控制
 */
import { DateTime } from "luxon"
import type { Session } from "opencode/session/index"
import type { Message } from "opencode/session/message"
import type { MessageV2 } from "opencode/session/message-v2"
import { For, Show, Suspense, SuspenseList, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { createStore, reconcile, unwrap } from "solid-js/store"
import { IconArrowDown } from "./icons"
import { IconOpencode } from "./icons/custom"
import styles from "./share.module.css"
import { Part, ProviderIcon } from "./share/part"

/**
 * 带部分的消息类型
 */
type MessageWithParts = MessageV2.Info & { parts: MessageV2.Part[] }

/**
 * 连接状态类型
 */
type Status = "disconnected" | "connecting" | "connected" | "error" | "reconnecting"

/**
 * 滚动到指定锚点
 *
 * @param id - 锚点 ID
 */
function scrollToAnchor(id: string) {
  const el = document.getElementById(id)
  if (!el) return

  el.scrollIntoView({ behavior: "smooth" })
}

/**
 * 获取状态文本
 *
 * @param status - 状态数组，包含状态类型和可选的错误消息
 * @returns 状态文本
 */
function getStatusText(status: [Status, string?]): string {
  switch (status[0]) {
    case "connected":
      return "已连接，等待消息..."
    case "connecting":
      return "连接中..."
    case "disconnected":
      return "已断开连接"
    case "reconnecting":
      return "重新连接中..."
    case "error":
      return status[1] || "错误"
    default:
      return "未知"
  }
}

/**
 * 分享组件
 *
 * @param props - 组件属性
 * @param props.id - 会话 ID
 * @param props.api - API URL
 * @param props.info - 会话信息
 */
export default function Share(props: { id: string; api: string; info: Session.Info }) {
  let lastScrollY = 0 // 上次滚动位置
  let hasScrolledToAnchor = false // 是否已滚动到锚点
  let scrollTimeout: number | undefined // 滚动超时计时器
  let scrollSentinel: HTMLElement | undefined // 滚动哨兵元素
  let scrollObserver: IntersectionObserver | undefined // 滚动观察者

  const params = new URLSearchParams(window.location.search)
  const debug = params.get("debug") === "true" // 是否开启调试模式

  // 滚动按钮状态
  const [showScrollButton, setShowScrollButton] = createSignal(false)
  const [isButtonHovered, setIsButtonHovered] = createSignal(false)
  const [isNearBottom, setIsNearBottom] = createSignal(false) // 是否接近页面底部

  // 会话状态存储
  const [store, setStore] = createStore<{
    info?: Session.Info
    messages: Record<string, MessageWithParts>
  }>({
    info: {
      id: props.id,
      title: props.info.title,
      version: props.info.version,
      time: {
        created: props.info.time.created,
        updated: props.info.time.updated,
      },
    },
    messages: {},
  })

  // 排序后的消息列表
  const messages = createMemo(() => Object.values(store.messages).toSorted((a, b) => a.id?.localeCompare(b.id)))

  // 连接状态
  const [connectionStatus, setConnectionStatus] = createSignal<[Status, string?]>(["disconnected", "已断开连接"])

  // 调试：打印 store 内容
  createEffect(() => {
    console.log(unwrap(store))
  })

  // 组件挂载时的操作
  onMount(() => {
    const apiUrl = props.api

    if (!props.id) {
      setConnectionStatus(["error", "未找到 ID"])
      return
    }

    if (!apiUrl) {
      console.error("环境变量中未找到 API URL")
      setConnectionStatus(["error", "未找到 API URL"])
      return
    }

    let reconnectTimer: number | undefined
    let socket: WebSocket | null = null

    // 创建和设置 WebSocket 连接，支持自动重连
    const setupWebSocket = () => {
      // 关闭现有的连接
      if (socket) {
        socket.close()
      }

      setConnectionStatus(["connecting"])

      // 始终使用安全的 WebSocket 协议 (wss)
      const wsBaseUrl = apiUrl.replace(/^https?:\/\//, "wss://")
      const wsUrl = `${wsBaseUrl}/share_poll?id=${props.id}`
      console.log("连接到 WebSocket URL:", wsUrl)

      // 创建 WebSocket 连接
      socket = new WebSocket(wsUrl)

      // 处理连接打开
      socket.onopen = () => {
        setConnectionStatus(["connected"])
        console.log("WebSocket 连接已建立")
      }

      // 处理接收消息
      socket.onmessage = (event) => {
        console.log("收到 WebSocket 消息")
        try {
          const d = JSON.parse(event.data)
          const [root, type, ...splits] = d.key.split("/")
          if (root !== "session") return
          if (type === "info") {
            setStore("info", reconcile(d.content))
            return
          }
          if (type === "message") {
            const [, messageID] = splits
            if ("metadata" in d.content) {
              d.content = fromV1(d.content)
            }
            d.content.parts = d.content.parts ?? store.messages[messageID]?.parts ?? []
            setStore("messages", messageID, reconcile(d.content))
          }
          if (type === "part") {
            setStore("messages", d.content.messageID, "parts", (arr) => {
              const index = arr.findIndex((x) => x.id === d.content.id)
              if (index === -1) arr.push(d.content)
              if (index > -1) arr[index] = d.content
              return [...arr]
            })
          }
        } catch (error) {
          console.error("解析 WebSocket 消息时出错:", error)
        }
      }

      // 处理错误
      socket.onerror = (error) => {
        console.error("WebSocket 错误:", error)
        setConnectionStatus(["error", "连接失败"])
      }

      // 处理连接关闭和重连
      socket.onclose = (event) => {
        console.log(`WebSocket 已关闭: ${event.code} ${event.reason}`)
        setConnectionStatus(["reconnecting"])

        // 2 秒后尝试重连
        clearTimeout(reconnectTimer)
        reconnectTimer = window.setTimeout(setupWebSocket, 2000) as unknown as number
      }
    }

    // 初始连接
    setupWebSocket()

    // 组件卸载时清理
    onCleanup(() => {
      console.log("清理 WebSocket 连接")
      if (socket) {
        socket.close()
      }
      clearTimeout(reconnectTimer)
    })
  })

  /**
   * 检查是否需要显示滚动按钮
   */
  function checkScrollNeed() {
    const currentScrollY = window.scrollY
    const isScrollingDown = currentScrollY > lastScrollY
    const scrolled = currentScrollY > 200 // 滚动 200px 后显示

    // 仅当向下滚动、滚动足够距离且不在底部附近时显示
    const shouldShow = isScrollingDown && scrolled && !isNearBottom()

    // 更新上次滚动位置
    lastScrollY = currentScrollY

    if (shouldShow) {
      setShowScrollButton(true)
      // 清除现有的超时
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }
      // 无滚动 1.5 秒后隐藏按钮（除非悬停）
      scrollTimeout = window.setTimeout(() => {
        if (!isButtonHovered()) {
          setShowScrollButton(false)
        }
      }, 1500)
    } else if (!isButtonHovered()) {
      // 仅当未悬停时隐藏（防止用户准备点击时消失）
      setShowScrollButton(false)
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }
    }
  }

  // 滚动相关的挂载操作
  onMount(() => {
    lastScrollY = window.scrollY // 初始化滚动位置

    // 创建哨兵元素
    const sentinel = document.createElement("div")
    sentinel.style.height = "1px"
    sentinel.style.position = "absolute"
    sentinel.style.bottom = "100px"
    sentinel.style.width = "100%"
    sentinel.style.pointerEvents = "none"
    document.body.appendChild(sentinel)

    // 创建交叉观察器
    const observer = new IntersectionObserver((entries) => {
      setIsNearBottom(entries[0].isIntersecting)
    })
    observer.observe(sentinel)

    // 存储引用以便清理
    scrollSentinel = sentinel
    scrollObserver = observer

    checkScrollNeed()
    window.addEventListener("scroll", checkScrollNeed)
    window.addEventListener("resize", checkScrollNeed)
  })

  // 滚动相关的清理操作
  onCleanup(() => {
    window.removeEventListener("scroll", checkScrollNeed)
    window.removeEventListener("resize", checkScrollNeed)

    // 清理观察器和哨兵元素
    if (scrollObserver) {
      scrollObserver.disconnect()
    }
    if (scrollSentinel) {
      document.body.removeChild(scrollSentinel)
    }

    if (scrollTimeout) {
      clearTimeout(scrollTimeout)
    }
  })

  /**
   * 会话数据计算属性
   *
   * 从 store 中提取和汇总会话数据，包括创建时间、完成时间、消息、模型、成本和令牌使用情况
   */
  const data = createMemo(() => {
    const result = {
      rootDir: undefined as string | undefined,
      created: undefined as number | undefined,
      completed: undefined as number | undefined,
      messages: [] as MessageWithParts[],
      models: {} as Record<string, string[]>,
      cost: 0,
      tokens: {
        input: 0,
        output: 0,
        reasoning: 0,
      },
    }

    if (!store.info) return result

    result.created = store.info.time.created

    const msgs = messages()
    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i]

      result.messages.push(msg)

      if (msg.role === "assistant") {
        result.cost += msg.cost
        result.tokens.input += msg.tokens.input
        result.tokens.output += msg.tokens.output
        result.tokens.reasoning += msg.tokens.reasoning

        result.models[`${msg.providerID} ${msg.modelID}`] = [msg.providerID, msg.modelID]

        if (msg.path.root) {
          result.rootDir = msg.path.root
        }

        if (msg.time.completed) {
          result.completed = msg.time.completed
        }
      }
    }
    return result
  })

  return (
    <Show when={store.info}>
      <main classList={{ [styles.root]: true, "not-content": true }}>
        <div data-component="header">
          <h1 data-component="header-title">{store.info?.title}</h1>
          <div data-component="header-details">
            <ul data-component="header-stats">
              <li title="opencode version" data-slot="item">
                <div data-slot="icon" title="opencode">
                  <IconOpencode width={16} height={16} />
                </div>
                <Show when={store.info?.version} fallback="v0.0.1">
                  <span>v{store.info?.version}</span>
                </Show>
              </li>
              {Object.values(data().models).length > 0 ? (
                <For each={Object.values(data().models)}>
                  {([provider, model]) => (
                    <li data-slot="item">
                      <div data-slot="icon" title={provider}>
                        <ProviderIcon model={model} />
                      </div>
                      <span data-slot="model">{model}</span>
                    </li>
                  )}
                </For>
              ) : (
                <li>
                  <span data-element-label>模型</span>
                  <span data-placeholder>&mdash;</span>
                </li>
              )}
            </ul>
            <div
              data-component="header-time"
              title={DateTime.fromMillis(data().created || 0).toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS)}
            >
              {DateTime.fromMillis(data().created || 0).toLocaleString(DateTime.DATETIME_MED)}
            </div>
          </div>
        </div>

        <div>
          <Show when={data().messages.length > 0} fallback={<p>等待消息...</p>}>
            <div class={styles.parts}>
              <SuspenseList revealOrder="forwards">
                <For each={data().messages}>
                  {(msg, msgIndex) => {
                    const filteredParts = createMemo(() =>
                      msg.parts.filter((x, index) => {
                        if (x.type === "step-start" && index > 0) return false
                        if (x.type === "snapshot") return false
                        if (x.type === "patch") return false
                        if (x.type === "step-finish") return false
                        if (x.type === "text" && x.synthetic === true) return false
                        if (x.type === "tool" && x.tool === "todoread") return false
                        if (x.type === "text" && !x.text) return false
                        if (x.type === "tool" && (x.state.status === "pending" || x.state.status === "running"))
                          return false
                        return true
                      }),
                    )

                    return (
                      <Suspense>
                        <For each={filteredParts()}>
                          {(part, partIndex) => {
                            const last = createMemo(
                              () =>
                                data().messages.length === msgIndex() + 1 && filteredParts().length === partIndex() + 1,
                            )

                            onMount(() => {
                              const hash = window.location.hash.slice(1)
                              // Wait till all parts are loaded
                              if (
                                hash !== "" &&
                                !hasScrolledToAnchor &&
                                filteredParts().length === partIndex() + 1 &&
                                data().messages.length === msgIndex() + 1
                              ) {
                                hasScrolledToAnchor = true
                                scrollToAnchor(hash)
                              }
                            })

                            return <Part last={last()} part={part} index={partIndex()} message={msg} />
                          }}
                        </For>
                      </Suspense>
                    )
                  }}
                </For>
              </SuspenseList>
              <div data-section="part" data-part-type="summary">
                <div data-section="decoration">
                  <span data-status={connectionStatus()[0]}></span>
                </div>
                <div data-section="content">
                  <p data-section="copy">{getStatusText(connectionStatus())}</p>
                  <ul data-section="stats">
                    <li>
                      <span data-element-label>成本</span>
                      {data().cost !== undefined ? (
                        <span>${data().cost.toFixed(2)}</span>
                      ) : (
                        <span data-placeholder>&mdash;</span>
                      )}
                    </li>
                    <li>
                      <span data-element-label>输入令牌</span>
                      {data().tokens.input ? <span>{data().tokens.input}</span> : <span data-placeholder>&mdash;</span>}
                    </li>
                    <li>
                      <span data-element-label>输出令牌</span>
                      {data().tokens.output ? (
                        <span>{data().tokens.output}</span>
                      ) : (
                        <span data-placeholder>&mdash;</span>
                      )}
                    </li>
                    <li>
                      <span data-element-label>推理令牌</span>
                      {data().tokens.reasoning ? (
                        <span>{data().tokens.reasoning}</span>
                      ) : (
                        <span data-placeholder>&mdash;</span>
                      )}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </Show>
        </div>

        <Show when={debug}>
          <div style={{ margin: "2rem 0" }}>
            <div
              style={{
                border: "1px solid #ccc",
                padding: "1rem",
                "overflow-y": "auto",
              }}
            >
              <Show when={data().messages.length > 0} fallback={<p>等待消息...</p>}>
                <ul style={{ "list-style-type": "none", padding: 0 }}>
                  <For each={data().messages}>
                    {(msg) => (
                      <li
                        style={{
                          padding: "0.75rem",
                          margin: "0.75rem 0",
                          "box-shadow": "0 1px 3px rgba(0,0,0,0.1)",
                        }}
                      >
                        <div>
                          <strong>Key:</strong> {msg.id}
                        </div>
                        <pre>{JSON.stringify(msg, null, 2)}</pre>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </div>
          </div>
        </Show>

        <Show when={showScrollButton()}>
          <button
            type="button"
            class={styles["scroll-button"]}
            onClick={() => document.body.scrollIntoView({ behavior: "smooth", block: "end" })}
            onMouseEnter={() => {
              setIsButtonHovered(true)
              if (scrollTimeout) {
                clearTimeout(scrollTimeout)
              }
            }}
            onMouseLeave={() => {
              setIsButtonHovered(false)
              if (showScrollButton()) {
                scrollTimeout = window.setTimeout(() => {
                  if (!isButtonHovered()) {
                    setShowScrollButton(false)
                  }
                }, 3000)
              }
            }}
            title="滚动到底部"
            aria-label="滚动到底部"
          >
            <IconArrowDown width={20} height={20} />
          </button>
        </Show>
      </main>
    </Show>
  )
}

/**
 * 将 V1 版本的消息转换为 V2 版本
 *
 * @param v1 - V1 版本的消息
 * @returns V2 版本的消息，包含 parts 数组
 */
export function fromV1(v1: Message.Info): MessageWithParts {
  if (v1.role === "assistant") {
    return {
      id: v1.id,
      sessionID: v1.metadata.sessionID,
      role: "assistant",
      time: {
        created: v1.metadata.time.created,
        completed: v1.metadata.time.completed,
      },
      cost: v1.metadata.assistant!.cost,
      path: v1.metadata.assistant!.path,
      summary: v1.metadata.assistant!.summary,
      tokens: v1.metadata.assistant!.tokens ?? {
        input: 0,
        output: 0,
        cache: {
          read: 0,
          write: 0,
        },
        reasoning: 0,
      },
      modelID: v1.metadata.assistant!.modelID,
      providerID: v1.metadata.assistant!.providerID,
      mode: "build",
      system: v1.metadata.assistant!.system,
      error: v1.metadata.error,
      parts: v1.parts.flatMap((part, index): MessageV2.Part[] => {
        const base = {
          id: index.toString(),
          messageID: v1.id,
          sessionID: v1.metadata.sessionID,
        }
        if (part.type === "text") {
          return [
            {
              ...base,
              type: "text",
              text: part.text,
            },
          ]
        }
        if (part.type === "step-start") {
          return [
            {
              ...base,
              type: "step-start",
            },
          ]
        }
        if (part.type === "tool-invocation") {
          return [
            {
              ...base,
              type: "tool",
              callID: part.toolInvocation.toolCallId,
              tool: part.toolInvocation.toolName,
              state: (() => {
                if (part.toolInvocation.state === "partial-call") {
                  return {
                    status: "pending",
                  }
                }

                const { title, time, ...metadata } = v1.metadata.tool[part.toolInvocation.toolCallId]
                if (part.toolInvocation.state === "call") {
                  return {
                    status: "running",
                    input: part.toolInvocation.args,
                    time: {
                      start: time.start,
                    },
                  }
                }

                if (part.toolInvocation.state === "result") {
                  return {
                    status: "completed",
                    input: part.toolInvocation.args,
                    output: part.toolInvocation.result,
                    title,
                    time,
                    metadata,
                  }
                }
                throw new Error("未知的工具调用状态")
              })(),
            },
          ]
        }
        return []
      }),
    }
  }

  if (v1.role === "user") {
    return {
      id: v1.id,
      sessionID: v1.metadata.sessionID,
      role: "user",
      time: {
        created: v1.metadata.time.created,
      },
      parts: v1.parts.flatMap((part, index): MessageV2.Part[] => {
        const base = {
          id: index.toString(),
          messageID: v1.id,
          sessionID: v1.metadata.sessionID,
        }
        if (part.type === "text") {
          return [
            {
              ...base,
              type: "text",
              text: part.text,
            },
          ]
        }
        if (part.type === "file") {
          return [
            {
              ...base,
              type: "file",
              mime: part.mediaType,
              filename: part.filename,
              url: part.url,
            },
          ]
        }
        return []
      }),
    }
  }

  throw new Error("未知的消息类型")
}
