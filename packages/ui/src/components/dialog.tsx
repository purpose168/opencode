import { Dialog as Kobalte } from "@kobalte/core/dialog"
import { ComponentProps, JSXElement, Match, ParentProps, Show, Switch } from "solid-js"
import { IconButton } from "./icon-button"

/**
 * 对话框组件属性
 * 扩展自 ParentProps 类型
 */
export interface DialogProps extends ParentProps {
  /** 对话框标题 */
  title?: JSXElement
  /** 对话框描述 */
  description?: JSXElement
  /** 对话框操作按钮或其他JSX元素 */
  action?: JSXElement
  /** CSS 类名 */
  class?: ComponentProps<"div">["class"]
  /** CSS 类名列表 */
  classList?: ComponentProps<"div">["classList"]
}

/**
 * 对话框组件
 * 基于 Kobalte Dialog 实现的对话框组件
 */
export function Dialog(props: DialogProps) {
  return (
    <div data-component="dialog">
      <div data-slot="dialog-container">
        <Kobalte.Content
          data-slot="dialog-content"
          classList={{
            ...(props.classList ?? {}),
            [props.class ?? ""]: !!props.class,
          }}
          onOpenAutoFocus={(e) => {
            const target = e.currentTarget as HTMLElement | null
            const autofocusEl = target?.querySelector("[autofocus]") as HTMLElement | null
            if (autofocusEl) {
              e.preventDefault()
              autofocusEl.focus()
            }
          }}
        >
          {/* 对话框头部（标题和操作按钮） */}
          <Show when={props.title || props.action}>
            <div data-slot="dialog-header">
              {/* 对话框标题 */}
              <Show when={props.title}>
                <Kobalte.Title data-slot="dialog-title">{props.title}</Kobalte.Title>
              </Show>
              {/* 操作按钮或关闭按钮 */}
              <Switch>
                <Match when={props.action}>{props.action}</Match>
                <Match when={true}>
                  <Kobalte.CloseButton data-slot="dialog-close-button" as={IconButton} icon="close" variant="ghost" />
                </Match>
              </Switch>
            </div>
          </Show>
          {/* 对话框描述 */}
          <Show when={props.description}>
            <Kobalte.Description data-slot="dialog-description">{props.description}</Kobalte.Description>
          </Show>
          {/* 对话框主体内容 */}
          <div data-slot="dialog-body">{props.children}</div>
        </Kobalte.Content>
      </div>
    </div>
  )
}
