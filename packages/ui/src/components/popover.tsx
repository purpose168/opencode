/**
 * 弹出框组件
 * 用于显示可点击触发的弹出内容，支持标题、描述和自定义内容
 */
import { Popover as Kobalte } from "@kobalte/core/popover"
import { ComponentProps, JSXElement, ParentProps, Show, splitProps } from "solid-js"
import { IconButton } from "./icon-button"

/**
 * 弹出框组件属性接口
 * 扩展了 Kobalte Popover 组件的属性
 */
export interface PopoverProps extends ParentProps, Omit<ComponentProps<typeof Kobalte>, "children"> {
  /** 触发弹出框的元素 */
  trigger: JSXElement
  /** 弹出框标题 */
  title?: JSXElement
  /** 弹出框描述 */
  description?: JSXElement
  /** 自定义 CSS 类名 */
  class?: ComponentProps<"div">["class"]
  /** 自定义 CSS 类名对象 */
  classList?: ComponentProps<"div">["classList"]
}

/**
 * 弹出框组件
 * 显示一个可点击触发的弹出内容，支持标题、描述和自定义内容
 */
export function Popover(props: PopoverProps) {
  // 分离本地属性和其他属性
  const [local, rest] = splitProps(props, ["trigger", "title", "description", "class", "classList", "children"])

  return (
    <Kobalte gutter={4} {...rest}>
      {/* 触发元素 */}
      <Kobalte.Trigger as="div" data-slot="popover-trigger">
        {local.trigger}
      </Kobalte.Trigger>
      {/* 弹出内容 */}
      <Kobalte.Portal>
        <Kobalte.Content
          data-component="popover-content"
          classList={{
            ...(local.classList ?? {}),
            [local.class ?? ""]: !!local.class,
          }}
        >
          {/* 标题部分 */}
          <Show when={local.title}>
            <div data-slot="popover-header">
              <Kobalte.Title data-slot="popover-title">{local.title}</Kobalte.Title>
              <Kobalte.CloseButton data-slot="popover-close-button" as={IconButton} icon="close" variant="ghost" />
            </div>
          </Show>
          {/* 描述部分 */}
          <Show when={local.description}>
            <Kobalte.Description data-slot="popover-description">{local.description}</Kobalte.Description>
          </Show>
          {/* 内容部分 */}
          <div data-slot="popover-body">{local.children}</div>
        </Kobalte.Content>
      </Kobalte.Portal>
    </Kobalte>
  )
}
