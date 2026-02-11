import { Button as Kobalte } from "@kobalte/core/button"
import { type ComponentProps, Show, splitProps } from "solid-js"
import { Icon, IconProps } from "./icon"

/**
 * 按钮组件属性接口
 * 扩展了Kobalte Button组件的属性，并添加了一些自定义属性
 */
export interface ButtonProps
  extends ComponentProps<typeof Kobalte>,
    Pick<ComponentProps<"button">, "class" | "classList" | "children"> {
  /** 按钮大小：小、正常、大 */
  size?: "small" | "normal" | "large"
  /** 按钮变体：主要、次要、幽灵 */
  variant?: "primary" | "secondary" | "ghost"
  /** 图标名称 */
  icon?: IconProps["name"]
}

/**
 * 按钮组件
 * 一个功能完整的按钮组件，支持不同大小、变体和图标
 * 
 * @param props 按钮属性
 * @returns 渲染的按钮组件
 */
export function Button(props: ButtonProps) {
  // 分离属性，将自定义属性与其他属性分开
  const [split, rest] = splitProps(props, ["variant", "size", "icon", "class", "classList"])
  return (
    <Kobalte
      {...rest}
      data-component="button"
      data-size={split.size || "normal"} // 默认大小为正常
      data-variant={split.variant || "secondary"} // 默认变体为次要
      data-icon={split.icon}
      classList={{
        ...(split.classList ?? {}),
        [split.class ?? ""]: !!split.class,
      }}
    >
      {/* 显示图标（如果提供） */}
      <Show when={split.icon}>
        <Icon name={split.icon!} size="small" />
      </Show>
      {/* 显示子内容 */}
      {props.children}
    </Kobalte>
  )
}
