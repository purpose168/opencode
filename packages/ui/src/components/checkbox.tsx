import { Checkbox as Kobalte } from "@kobalte/core/checkbox"
import { Show, splitProps } from "solid-js"
import type { ComponentProps, JSX, ParentProps } from "solid-js"

/**
 * 复选框组件属性
 * 扩展自 Kobalte Checkbox 组件的属性
 */
export interface CheckboxProps extends ParentProps<ComponentProps<typeof Kobalte>> {
  /** 是否隐藏标签 */
  hideLabel?: boolean
  /** 复选框描述信息 */
  description?: string
  /** 自定义图标 */
  icon?: JSX.Element
}

/**
 * 复选框组件
 * 基于 Kobalte Checkbox 实现的基础复选框组件
 */
export function Checkbox(props: CheckboxProps) {
  // 分离本地属性和传递给 Kobalte 的属性
  const [local, others] = splitProps(props, ["children", "class", "label", "hideLabel", "description", "icon"])
  
  return (
    <Kobalte {...others} data-component="checkbox">
      {/* 原生输入框 */}
      <Kobalte.Input data-slot="checkbox-checkbox-input" />
      {/* 复选框控制区域 */}
      <Kobalte.Control data-slot="checkbox-checkbox-control">
        {/* 复选框指示器 */}
        <Kobalte.Indicator data-slot="checkbox-checkbox-indicator">
          {/* 使用自定义图标或默认图标 */}
          {local.icon || (
            <svg viewBox="0 0 12 12" fill="none" width="10" height="10" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M3 7.17905L5.02703 8.85135L9 3.5"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="square"
              />
            </svg>
          )}
        </Kobalte.Indicator>
      </Kobalte.Control>
      {/* 复选框内容区域 */}
      <div data-slot="checkbox-checkbox-content">
        {/* 标签内容（如果有） */}
        <Show when={props.children}>
          <Kobalte.Label data-slot="checkbox-checkbox-label" classList={{ "sr-only": local.hideLabel }}>
            {props.children}
          </Kobalte.Label>
        </Show>
        {/* 描述信息（如果有） */}
        <Show when={local.description}>
          <Kobalte.Description data-slot="checkbox-checkbox-description">{local.description}</Kobalte.Description>
        </Show>
        {/* 错误信息 */}
        <Kobalte.ErrorMessage data-slot="checkbox-checkbox-error" />
      </div>
    </Kobalte>
  )
}