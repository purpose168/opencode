/**
 * 选择器组件
 * 用于从选项列表中选择一个值，支持分组和自定义渲染
 */
import { Select as Kobalte } from "@kobalte/core/select"
import { createMemo, splitProps, type ComponentProps, type JSX } from "solid-js"
import { pipe, groupBy, entries, map } from "remeda"
import { Button, ButtonProps } from "./button"
import { Icon } from "./icon"

/**
 * 选择器组件属性接口
 * @template T - 选项的类型
 */
export type SelectProps<T> = Omit<ComponentProps<typeof Kobalte<T>>, "value" | "onSelect" | "children"> & {
  /** 占位符文本 */
  placeholder?: string
  /** 选项数组 */
  options: T[]
  /** 当前选中的选项 */
  current?: T
  /** 获取选项值的函数 */
  value?: (x: T) => string
  /** 获取选项标签的函数 */
  label?: (x: T) => string
  /** 分组函数 */
  groupBy?: (x: T) => string
  /** 选择回调函数 */
  onSelect?: (value: T | undefined) => void
  /** 自定义 CSS 类名 */
  class?: ComponentProps<"div">["class"]
  /** 自定义 CSS 类名对象 */
  classList?: ComponentProps<"div">["classList"]
  /** 自定义选项渲染函数 */
  children?: (item: T | undefined) => JSX.Element
}

/**
 * 选择器组件
 * 从选项列表中选择一个值，支持分组和自定义渲染
 * @template T - 选项的类型
 */
export function Select<T>(props: SelectProps<T> & ButtonProps) {
  // 分离本地属性和其他属性
  const [local, others] = splitProps(props, [
    "class",
    "classList",
    "placeholder",
    "options",
    "current",
    "value",
    "label",
    "groupBy",
    "onSelect",
    "children",
  ])
  
  /**
   * 分组后的选项
   */
  const grouped = createMemo(() => {
    const result = pipe(
      local.options,
      // 按分组函数分组
      groupBy((x) => (local.groupBy ? local.groupBy(x) : "")),
      // 将分组转换为条目
      entries(),
      // 映射为 { category, options } 格式
      map(([k, v]) => ({ category: k, options: v })),
    )
    return result
  })

  return (
    // @ts-ignore
    <Kobalte<T, { category: string; options: T[] }>
      {...others}
      data-component="select"
      placement="bottom-start"
      value={local.current}
      options={grouped()}
      optionValue={(x) => (local.value ? local.value(x) : (x as string))}
      optionTextValue={(x) => (local.label ? local.label(x) : (x as string))}
      optionGroupChildren="options"
      placeholder={local.placeholder}
      sectionComponent={(local) => (
        <Kobalte.Section data-slot="select-section">{local.section.rawValue.category}</Kobalte.Section>
      )}
      itemComponent={(itemProps) => (
        <Kobalte.Item
          data-slot="select-select-item"
          classList={{
            ...(local.classList ?? {}),
            [local.class ?? ""]: !!local.class,
          }}
          {...itemProps}
        >
          <Kobalte.ItemLabel data-slot="select-select-item-label">
            {local.children
              ? local.children(itemProps.item.rawValue)
              : local.label
                ? local.label(itemProps.item.rawValue)
                : (itemProps.item.rawValue as string)}
          </Kobalte.ItemLabel>
          <Kobalte.ItemIndicator data-slot="select-select-item-indicator">
            <Icon name="check-small" size="small" />
          </Kobalte.ItemIndicator>
        </Kobalte.Item>
      )}
      onChange={(v) => {
        local.onSelect?.(v ?? undefined)
      }}
    >
      <Kobalte.Trigger
        disabled={props.disabled}
        data-slot="select-select-trigger"
        as={Button}
        size={props.size}
        variant={props.variant}
        classList={{
          ...(local.classList ?? {}),
          [local.class ?? ""]: !!local.class,
        }}
      >
        <Kobalte.Value<T> data-slot="select-select-trigger-value">
          {(state) => {
            const selected = state.selectedOption() ?? local.current
            if (!selected) return local.placeholder || ""
            if (local.label) return local.label(selected)
            return selected as string
          }}
        </Kobalte.Value>
        <Kobalte.Icon data-slot="select-select-trigger-icon">
          <Icon name="chevron-down" size="small" />
        </Kobalte.Icon>
      </Kobalte.Trigger>
      <Kobalte.Portal>
        <Kobalte.Content
          classList={{
            ...(local.classList ?? {}),
            [local.class ?? ""]: !!local.class,
          }}
          data-component="select-content"
        >
          <Kobalte.Listbox data-slot="select-select-content-list" />
        </Kobalte.Content>
      </Kobalte.Portal>
    </Kobalte>
  )
}
