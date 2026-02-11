/**
 * 会话消息轨道组件
 * 用于显示会话中的用户消息导航栏，支持正常和紧凑两种模式
 */
import { UserMessage } from "@opencode-ai/sdk/v2"
import { ComponentProps, Show, splitProps } from "solid-js"
import { MessageNav } from "./message-nav"
import "./session-message-rail.css"

/**
 * 会话消息轨道组件属性接口
 */
export interface SessionMessageRailProps extends ComponentProps<"div"> {
  /** 用户消息列表 */
  messages: UserMessage[]
  /** 当前选中的消息 */
  current?: UserMessage
  /** 是否使用宽模式 */
  wide?: boolean
  /** 消息选择回调函数 */
  onMessageSelect: (message: UserMessage) => void
}

/**
 * 会话消息轨道组件
 * 显示会话中的用户消息导航栏，支持正常和紧凑两种模式
 */
export function SessionMessageRail(props: SessionMessageRailProps) {
  // 分离本地属性和其他属性
  const [local, others] = splitProps(props, ["messages", "current", "wide", "onMessageSelect", "class", "classList"])

  return (
    // 当消息数量大于1时显示
    <Show when={(local.messages?.length ?? 0) > 1}>
      <div
        {...others}
        data-component="session-message-rail"
        data-wide={local.wide ? "" : undefined}
        classList={{
          ...(local.classList ?? {}),
          [local.class ?? ""]: !!local.class,
        }}
      >
        {/* 紧凑模式消息导航 */}
        <div data-slot="session-message-rail-compact">
          <MessageNav
            messages={local.messages}
            current={local.current}
            onMessageSelect={local.onMessageSelect}
            size="compact"
          />
        </div>
        {/* 全屏模式消息导航 */}
        <div data-slot="session-message-rail-full">
          <MessageNav
            messages={local.messages}
            current={local.current}
            onMessageSelect={local.onMessageSelect}
            size={local.wide ? "normal" : "compact"}
          />
        </div>
      </div>
    </Show>
  )
}
