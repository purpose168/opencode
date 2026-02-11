/**
 * 粘性手风琴头部组件
 * 用于显示手风琴组件的粘性头部
 */
import { Accordion } from "./accordion"
import { ParentProps } from "solid-js"

/**
 * 粘性手风琴头部组件属性接口
 */
interface StickyAccordionHeaderProps {
  /** 自定义 CSS 类名 */
  class?: string
  /** 自定义 CSS 类名对象 */
  classList?: Record<string, boolean | undefined>
}

/**
 * 粘性手风琴头部组件
 * 显示手风琴组件的粘性头部
 */
export function StickyAccordionHeader(
  props: ParentProps<StickyAccordionHeaderProps>,
) {
  return (
    <Accordion.Header
      data-component="sticky-accordion-header"
      classList={{
        ...(props.classList ?? {}),
        [props.class ?? ""]: !!props.class,
      }}
    >
      {props.children}
    </Accordion.Header>
  )
}
