/**
 * 工具提示组件
 * 用于在鼠标悬停或聚焦时显示额外信息
 */
import { Tooltip as KobalteTooltip } from "@kobalte/core/tooltip"
import { children, createSignal, Match, onMount, splitProps, Switch, type JSX } from "solid-js"
import type { ComponentProps } from "solid-js"

/**
 * 工具提示组件属性接口
 */
export interface TooltipProps extends ComponentProps<typeof KobalteTooltip> {
  /** 工具提示内容 */
  value: JSX.Element
  /** 自定义 CSS 类名 */
  class?: string
  /** 是否禁用工具提示 */
  inactive?: boolean
}

/**
 * 快捷键工具提示属性接口
 */
export interface TooltipKeybindProps extends Omit<TooltipProps, "value"> {
  /** 快捷键描述文本 */
  title: string
  /** 快捷键组合 */
  keybind: string
}

/**
 * 快捷键工具提示组件
 * 用于显示带有快捷键信息的工具提示
 */
export function TooltipKeybind(props: TooltipKeybindProps) {
  const [local, others] = splitProps(props, ["title", "keybind"])
  return (
    <Tooltip
      {...others}
      value={
        <div data-slot="tooltip-keybind">
          <span>{local.title}</span>
          <span data-slot="tooltip-keybind-key">{local.keybind}</span>
        </div>
      }
    />
  )
}

/**
 * 工具提示组件
 * 提供鼠标悬停或聚焦时显示的提示信息
 */
export function Tooltip(props: TooltipProps) {
  // 工具提示打开状态
  const [open, setOpen] = createSignal(false)
  // 分离本地属性和其他属性
  const [local, others] = splitProps(props, ["children", "class", "inactive"])

  // 获取子元素
  const c = children(() => local.children)

  // 组件挂载时添加焦点事件监听器
  onMount(() => {
    const childElements = c()
    if (childElements instanceof HTMLElement) {
      // 为单个 HTMLElement 添加焦点和失焦事件
      childElements.addEventListener("focus", () => setOpen(true))
      childElements.addEventListener("blur", () => setOpen(false))
    } else if (Array.isArray(childElements)) {
      // 为多个 HTMLElement 添加焦点和失焦事件
      for (const child of childElements) {
        if (child instanceof HTMLElement) {
          child.addEventListener("focus", () => setOpen(true))
          child.addEventListener("blur", () => setOpen(false))
        }
      }
    }
  })

  return (
    <Switch>
      {/* 当禁用时直接显示子元素 */}
      <Match when={local.inactive}>{local.children}</Match>
      {/* 正常显示工具提示 */}
      <Match when={true}>
        <KobalteTooltip forceMount gutter={4} {...others} open={open()} onOpenChange={setOpen}>
          <KobalteTooltip.Trigger as={"div"} data-component="tooltip-trigger" class={local.class}>
            {c()}
          </KobalteTooltip.Trigger>
          <KobalteTooltip.Portal>
            <KobalteTooltip.Content data-component="tooltip" data-placement={props.placement}>
              {others.value}
              {/* <KobalteTooltip.Arrow data-slot="tooltip-arrow" /> */}
            </KobalteTooltip.Content>
          </KobalteTooltip.Portal>
        </KobalteTooltip>
      </Match>
    </Switch>
  )
}
