/**
 * 消息导航组件
 * 用于显示和选择用户消息，支持正常和紧凑两种尺寸模式
 */
import { UserMessage } from "@opencode-ai/sdk/v2"
import { ComponentProps, For, Match, Show, splitProps, Switch } from "solid-js"
import { DiffChanges } from "./diff-changes"
import { Tooltip } from "@kobalte/core/tooltip"

/**
 * 消息导航组件
 * 显示消息列表，支持选择消息和两种尺寸模式
 */
export function MessageNav(
  props: ComponentProps<"ul"> & {
    /** 用户消息列表 */
    messages: UserMessage[]
    /** 当前选中的消息 */
    current?: UserMessage
    /** 导航尺寸模式 */
    size: "normal" | "compact"
    /** 消息选择回调函数 */
    onMessageSelect: (message: UserMessage) => void
  },
) {
  // 分离本地属性和其他属性
  const [local, others] = splitProps(props, ["messages", "current", "size", "onMessageSelect"])

  /**
   * 生成导航内容
   */
  const content = () => (
    <ul role="list" data-component="message-nav" data-size={local.size} {...others}>
      <For each={local.messages}>
        {(message) => {
          /**
           * 处理消息点击事件
           */
          const handleClick = () => local.onMessageSelect(message)

          return (
            <li data-slot="message-nav-item">
              <Switch>
                {/* 紧凑模式渲染 */}
                <Match when={local.size === "compact"}>
                  <div data-slot="message-nav-tick-button" data-active={message.id === local.current?.id || undefined}>
                    <div data-slot="message-nav-tick-line" />
                  </div>
                </Match>
                {/* 正常模式渲染 */}
                <Match when={local.size === "normal"}>
                  <button data-slot="message-nav-message-button" onClick={handleClick}>
                    {/* 显示差异变化条 */}
                    <DiffChanges changes={message.summary?.diffs ?? []} variant="bars" />
                    <div
                      data-slot="message-nav-title-preview"
                      data-active={message.id === local.current?.id || undefined}
                    >
                      {/* 显示消息标题或默认文本 */}
                      <Show when={message.summary?.title} fallback="New message">
                        {message.summary?.title}
                      </Show>
                    </div>
                  </button>
                </Match>
              </Switch>
            </li>
          )
        }}
      </For>
    </ul>
  )

  return (
    <Switch>
      {/* 紧凑模式：带 tooltip 显示完整导航 */}
      <Match when={local.size === "compact"}>
        <Tooltip openDelay={0} closeDelay={300} placement="right-start" gutter={-40} shift={-10} overlap>
          <Tooltip.Trigger as="div">{content()}</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content data-slot="message-nav-tooltip">
              <div data-slot="message-nav-tooltip-content">
                <MessageNav {...props} size="normal" class="" />
              </div>
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip>
      </Match>
      {/* 正常模式：直接显示完整导航 */}
      <Match when={local.size === "normal"}>{content()}</Match>
    </Switch>
  )
}
