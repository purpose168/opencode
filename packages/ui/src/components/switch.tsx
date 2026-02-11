/**
 * 开关组件
 * 用于在两种状态之间切换的UI组件
 */
import { Switch as Kobalte } from "@kobalte/core/switch"
import { Show, splitProps } from "solid-js"
import type { ComponentProps, ParentProps } from "solid-js"

/**
 * 开关组件属性接口
 */
export interface SwitchProps extends ParentProps<ComponentProps<typeof Kobalte>> {
  /** 是否隐藏标签（屏幕阅读器仍然可以访问） */
  hideLabel?: boolean
  /** 开关的描述文本 */
  description?: string
}

/**
 * 开关组件
 * 提供一个可在两种状态之间切换的UI控件
 */
export function Switch(props: SwitchProps) {
  // 分离本地属性和其他属性
  const [local, others] = splitProps(props, ["children", "class", "hideLabel", "description"])
  
  return (
    <Kobalte {...others} data-component="switch">
      {/* 隐藏的输入元素，用于表单提交 */}
      <Kobalte.Input data-slot="switch-input" />
      
      {/* 条件渲染标签 */}
      <Show when={local.children}>
        <Kobalte.Label data-slot="switch-label" classList={{ "sr-only": local.hideLabel }}>
          {local.children}
        </Kobalte.Label>
      </Show>
      
      {/* 条件渲染描述文本 */}
      <Show when={local.description}>
        <Kobalte.Description data-slot="switch-description">{local.description}</Kobalte.Description>
      </Show>
      
      {/* 错误信息显示 */}
      <Kobalte.ErrorMessage data-slot="switch-error" />
      
      {/* 开关控制区域 */}
      <Kobalte.Control data-slot="switch-control">
        {/* 开关滑块 */}
        <Kobalte.Thumb data-slot="switch-thumb" />
      </Kobalte.Control>
    </Kobalte>
  )
}
