import { type ComponentProps, splitProps } from "solid-js"

/**
 * 卡片组件属性接口
 * 扩展了 div 元素的属性
 */
export interface CardProps extends ComponentProps<"div"> {
  variant?: "normal" | "error" | "warning" | "success" | "info"  // 卡片变体
}

/**
 * 卡片组件
 * 一个通用的卡片容器组件，支持不同的变体样式
 * 
 * @param props 卡片组件属性
 * @returns 渲染的卡片组件
 */
export function Card(props: CardProps) {
  // 分离属性，将自定义属性与其他属性分开
  const [split, rest] = splitProps(props, ["variant", "class", "classList"])
  
  return (
    <div
      {...rest}
      data-component="card"
      data-variant={split.variant || "normal"}  // 默认变体为 normal
      classList={{
        ...(split.classList ?? {}),
        [split.class ?? ""]: !!split.class,
      }}
    >
      {props.children}
    </div>
  )
}
