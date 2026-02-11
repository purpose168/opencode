/**
 * 单选按钮组组件
 * 用于显示一组单选按钮，支持自定义选项和标签
 */
import { SegmentedControl as Kobalte } from "@kobalte/core/segmented-control"
import { For, splitProps } from "solid-js"
import type { ComponentProps, JSX } from "solid-js"

/**
 * 单选按钮组组件属性
 * @template T - 选项的类型
 */
export type RadioGroupProps<T> = Omit<
  ComponentProps<typeof Kobalte>,
  "value" | "defaultValue" | "onChange" | "children"
> & {
  /** 选项数组 */
  options: T[]
  /** 当前选中的选项 */
  current?: T
  /** 默认选中的选项 */
  defaultValue?: T
  /** 获取选项值的函数 */
  value?: (x: T) => string
  /** 获取选项标签的函数 */
  label?: (x: T) => JSX.Element | string
  /** 选项选择回调函数 */
  onSelect?: (value: T | undefined) => void
  /** 自定义 CSS 类名 */
  class?: ComponentProps<"div">["class"]
  /** 自定义 CSS 类名对象 */
  classList?: ComponentProps<"div">["classList"]
  /** 组件大小 */
  size?: "small" | "medium"
}

/**
 * 单选按钮组组件
 * 显示一组单选按钮，支持自定义选项和标签
 * @template T - 选项的类型
 */
export function RadioGroup<T>(props: RadioGroupProps<T>) {
  // 分离本地属性和其他属性
  const [local, others] = splitProps(props, [
    "class",
    "classList",
    "options",
    "current",
    "defaultValue",
    "value",
    "label",
    "onSelect",
    "size",
  ])

  /**
   * 获取选项的值
   * @param item - 选项
   * @returns 选项的值
   */
  const getValue = (item: T): string => {
    if (local.value) return local.value(item)
    return String(item)
  }

  /**
   * 获取选项的标签
   * @param item - 选项
   * @returns 选项的标签
   */
  const getLabel = (item: T): JSX.Element | string => {
    if (local.label) return local.label(item)
    return String(item)
  }

  /**
   * 根据值查找选项
   * @param v - 值
   * @returns 对应的选项
   */
  const findOption = (v: string): T | undefined => {
    return local.options.find((opt) => getValue(opt) === v)
  }

  return (
    <Kobalte
      {...others}
      data-component="radio-group"
      data-size={local.size ?? "medium"}
      classList={{
        ...(local.classList ?? {}),
        [local.class ?? ""]: !!local.class,
      }}
      value={local.current ? getValue(local.current) : undefined}
      defaultValue={local.defaultValue ? getValue(local.defaultValue) : undefined}
      onChange={(v) => local.onSelect?.(findOption(v))}
    >
      <div role="presentation" data-slot="radio-group-wrapper">
        <Kobalte.Indicator data-slot="radio-group-indicator" />
        <div role="presentation" data-slot="radio-group-items">
          <For each={local.options}>
            {(option) => (
              <Kobalte.Item value={getValue(option)} data-slot="radio-group-item">
                <Kobalte.ItemInput data-slot="radio-group-item-input" />
                <Kobalte.ItemLabel data-slot="radio-group-item-label">{getLabel(option)}</Kobalte.ItemLabel>
              </Kobalte.Item>
            )}
          </For>
        </div>
      </div>
    </Kobalte>
  )
}
