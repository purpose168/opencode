/**
 * 标签页组件
 * 用于创建可切换的标签页界面
 */
import { Tabs as Kobalte } from "@kobalte/core/tabs"
import { Show, splitProps, type JSX } from "solid-js"
import type { ComponentProps, ParentProps } from "solid-js"

/**
 * 标签页根组件属性接口
 */
export interface TabsProps extends ComponentProps<typeof Kobalte> {
  /** 标签页样式变体 */
  variant?: "normal" | "alt"
  /** 标签页方向 */
  orientation?: "horizontal" | "vertical"
}

/**
 * 标签页列表组件属性接口
 */
export interface TabsListProps extends ComponentProps<typeof Kobalte.List> {}

/**
 * 标签页触发器组件属性接口
 */
export interface TabsTriggerProps extends ComponentProps<typeof Kobalte.Trigger> {
  /** 自定义样式类 */
  classes?: {
    /** 按钮样式类 */
    button?: string
  }
  /** 是否隐藏关闭按钮 */
  hideCloseButton?: boolean
  /** 自定义关闭按钮 */
  closeButton?: JSX.Element
}

/**
 * 标签页内容组件属性接口
 */
export interface TabsContentProps extends ComponentProps<typeof Kobalte.Content> {}

/**
 * 标签页根组件
 * 提供标签页的基本结构和状态管理
 */
function TabsRoot(props: TabsProps) {
  // 分离本地属性和其他属性
  const [split, rest] = splitProps(props, ["class", "classList", "variant", "orientation"])
  
  return (
    <Kobalte
      {...rest}
      orientation={split.orientation}
      data-component="tabs"
      data-variant={split.variant || "normal"}
      data-orientation={split.orientation || "horizontal"}
      classList={{
        ...(split.classList ?? {}),
        [split.class ?? ""]: !!split.class,
      }}
    />
  )
}

/**
 * 标签页列表组件
 * 包含多个标签页触发器的容器
 */
function TabsList(props: TabsListProps) {
  // 分离本地属性和其他属性
  const [split, rest] = splitProps(props, ["class", "classList"])
  
  return (
    <Kobalte.List
      {...rest}
      data-slot="tabs-list"
      classList={{
        ...(split.classList ?? {}),
        [split.class ?? ""]: !!split.class,
      }}
    />
  )
}

/**
 * 标签页触发器组件
 * 用于切换标签页的按钮
 */
function TabsTrigger(props: ParentProps<TabsTriggerProps>) {
  // 分离本地属性和其他属性
  const [split, rest] = splitProps(props, [
    "class",
    "classList",
    "classes",
    "children",
    "closeButton",
    "hideCloseButton",
  ])
  
  return (
    <div
      data-slot="tabs-trigger-wrapper"
      classList={{
        ...(split.classList ?? {}),
        [split.class ?? ""]: !!split.class,
      }}
    >
      {/* 标签页触发器按钮 */}
      <Kobalte.Trigger
        {...rest}
        data-slot="tabs-trigger"
        classList={{ "group/tab": true, [split.classes?.button ?? ""]: split.classes?.button }}
      >
        {split.children}
      </Kobalte.Trigger>
      
      {/* 条件渲染关闭按钮 */}
      <Show when={split.closeButton}>
        {(closeButton) => (
          <div data-slot="tabs-trigger-close-button" data-hidden={split.hideCloseButton}>
            {closeButton()}
          </div>
        )}
      </Show>
    </div>
  )
}

/**
 * 标签页内容组件
 * 显示当前激活标签页的内容
 */
function TabsContent(props: ParentProps<TabsContentProps>) {
  // 分离本地属性和其他属性
  const [split, rest] = splitProps(props, ["class", "classList", "children"])
  
  return (
    <Kobalte.Content
      {...rest}
      data-slot="tabs-content"
      classList={{
        ...(split.classList ?? {}),
        [split.class ?? ""]: !!split.class,
      }}
    >
      {split.children}
    </Kobalte.Content>
  )
}

/**
 * 标签页组件集合
 * 包含根组件、列表、触发器和内容组件
 */
export const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
})
