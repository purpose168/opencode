import { JSX, Show, createEffect, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { IconChevron } from "./icon"
import "./dropdown.css"

/**
 * 下拉菜单组件属性接口
 */
interface DropdownProps {
  trigger: JSX.Element | string     // 触发元素或文本
  children: JSX.Element              // 下拉内容
  open?: boolean                     // 是否默认打开
  onOpenChange?: (open: boolean) => void // 打开状态变化回调
  align?: "left" | "right"           // 对齐方式
  class?: string                     // 自定义类名
}

/**
 * 下拉菜单组件
 */
export function Dropdown(props: DropdownProps) {
  // 创建状态存储
  const [store, setStore] = createStore({
    isOpen: props.open ?? false, // 默认关闭状态
  })
  // 下拉菜单引用
  let dropdownRef: HTMLDivElement | undefined

  // 监听外部 open 属性变化
  createEffect(() => {
    if (props.open !== undefined) {
      setStore("isOpen", props.open)
    }
  })

  // 点击外部关闭下拉菜单
  createEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
        setStore("isOpen", false)
        props.onOpenChange?.(false)
      }
    }

    document.addEventListener("click", handleClickOutside)
    onCleanup(() => document.removeEventListener("click", handleClickOutside))
  })

  // 切换下拉菜单状态
  const toggle = () => {
    const newValue = !store.isOpen
    setStore("isOpen", newValue)
    props.onOpenChange?.(newValue)
  }

  return (
    <div data-component="dropdown" class={props.class} ref={dropdownRef}>
      <button data-slot="trigger" type="button" onClick={toggle}>
        {typeof props.trigger === "string" ? <span>{props.trigger}</span> : props.trigger}
        <IconChevron data-slot="chevron" />
      </button>

      <Show when={store.isOpen}>
        <div data-slot="dropdown" data-align={props.align ?? "left"}>
          {props.children}
        </div>
      </Show>
    </div>
  )
}

/**
 * 下拉菜单项属性接口
 */
interface DropdownItemProps {
  children: JSX.Element              // 菜单项内容
  selected?: boolean                 // 是否选中
  onClick?: () => void               // 点击回调
  type?: "button" | "submit" | "reset" // 按钮类型
}

/**
 * 下拉菜单项组件
 */
export function DropdownItem(props: DropdownItemProps) {
  return (
    <button
      data-slot="item"
      data-selected={props.selected ?? false}
      type={props.type ?? "button"}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}
