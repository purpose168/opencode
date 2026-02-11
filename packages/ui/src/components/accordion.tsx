import { Accordion as Kobalte } from "@kobalte/core/accordion"
import { splitProps } from "solid-js"
import type { ComponentProps, ParentProps } from "solid-js"

/**
 * 手风琴组件属性接口
 * 扩展了 Kobalte Accordion 组件的属性
 */
export interface AccordionProps extends ComponentProps<typeof Kobalte> {}

/**
 * 手风琴项目属性接口
 * 扩展了 Kobalte Accordion.Item 组件的属性
 */
export interface AccordionItemProps extends ComponentProps<typeof Kobalte.Item> {}

/**
 * 手风琴标题属性接口
 * 扩展了 Kobalte Accordion.Header 组件的属性
 */
export interface AccordionHeaderProps extends ComponentProps<typeof Kobalte.Header> {}

/**
 * 手风琴触发器属性接口
 * 扩展了 Kobalte Accordion.Trigger 组件的属性
 */
export interface AccordionTriggerProps extends ComponentProps<typeof Kobalte.Trigger> {}

/**
 * 手风琴内容属性接口
 * 扩展了 Kobalte Accordion.Content 组件的属性
 */
export interface AccordionContentProps extends ComponentProps<typeof Kobalte.Content> {}

/**
 * 手风琴根组件
 * 手风琴组件的容器，管理多个手风琴项目
 * 
 * @param props 手风琴属性
 * @returns 渲染的手风琴根组件
 */
function AccordionRoot(props: AccordionProps) {
  // 分离属性，将 class 和 classList 与其他属性分开
  const [split, rest] = splitProps(props, ["class", "classList"])
  return (
    <Kobalte
      {...rest}
      data-component="accordion"
      classList={{
        ...(split.classList ?? {}),
        [split.class ?? ""]: !!split.class,
      }}
    />
  )
}

/**
 * 手风琴项目组件
 * 表示手风琴中的单个项目
 * 
 * @param props 手风琴项目属性
 * @returns 渲染的手风琴项目组件
 */
function AccordionItem(props: AccordionItemProps) {
  // 分离属性，将 class 和 classList 与其他属性分开
  const [split, rest] = splitProps(props, ["class", "classList"])
  return (
    <Kobalte.Item
      {...rest}
      data-slot="accordion-item"
      classList={{
        ...(split.classList ?? {}),
        [split.class ?? ""]: !!split.class,
      }}
    />
  )
}

/**
 * 手风琴标题组件
 * 手风琴项目的标题部分
 * 
 * @param props 手风琴标题属性
 * @returns 渲染的手风琴标题组件
 */
function AccordionHeader(props: ParentProps<AccordionHeaderProps>) {
  // 分离属性，将 class、classList 和 children 与其他属性分开
  const [split, rest] = splitProps(props, ["class", "classList", "children"])
  return (
    <Kobalte.Header
      {...rest}
      data-slot="accordion-header"
      classList={{
        ...(split.classList ?? {}),
        [split.class ?? ""]: !!split.class,
      }}
    >
      {split.children}
    </Kobalte.Header>
  )
}

/**
 * 手风琴触发器组件
 * 点击时展开或折叠手风琴内容
 * 
 * @param props 手风琴触发器属性
 * @returns 渲染的手风琴触发器组件
 */
function AccordionTrigger(props: ParentProps<AccordionTriggerProps>) {
  // 分离属性，将 class、classList 和 children 与其他属性分开
  const [split, rest] = splitProps(props, ["class", "classList", "children"])
  return (
    <Kobalte.Trigger
      {...rest}
      data-slot="accordion-trigger"
      classList={{
        ...(split.classList ?? {}),
        [split.class ?? ""]: !!split.class,
      }}
    >
      {split.children}
    </Kobalte.Trigger>
  )
}

/**
 * 手风琴内容组件
 * 手风琴展开时显示的内容
 * 
 * @param props 手风琴内容属性
 * @returns 渲染的手风琴内容组件
 */
function AccordionContent(props: ParentProps<AccordionContentProps>) {
  // 分离属性，将 class、classList 和 children 与其他属性分开
  const [split, rest] = splitProps(props, ["class", "classList", "children"])
  return (
    <Kobalte.Content
      {...rest}
      data-slot="accordion-content"
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
 * 手风琴组件
 * 一个完整的手风琴组件，包含根组件、项目、标题、触发器和内容组件
 */
export const Accordion = Object.assign(AccordionRoot, {
  Item: AccordionItem,      // 手风琴项目组件
  Header: AccordionHeader,  // 手风琴标题组件
  Trigger: AccordionTrigger, // 手风琴触发器组件
  Content: AccordionContent, // 手风琴内容组件
})
