import { Button as Kobalte } from "@kobalte/core/button"
import { type ComponentProps, splitProps } from "solid-js"
import { Icon, IconProps } from "./icon"

/**
 * 图标按钮属性接口
 * 扩展了 Kobalte 按钮属性，添加了图标相关的配置
 */
export interface IconButtonProps extends ComponentProps<typeof Kobalte> {
  /** 图标名称 */
  icon: IconProps["name"]
  /** 按钮尺寸：正常或大尺寸 */
  size?: "normal" | "large"
  /** 图标尺寸 */
  iconSize?: IconProps["size"]
  /** 按钮变体：主要、次要或幽灵 */
  variant?: "primary" | "secondary" | "ghost"
}

/**
 * 图标按钮组件
 * 带有图标的按钮，支持不同的变体和尺寸
 */
export function IconButton(props: ComponentProps<"button"> & IconButtonProps) {
  const [split, rest] = splitProps(props, ["variant", "size", "iconSize", "class", "classList"])
  return (
    <Kobalte
      {...rest}
      data-component="icon-button"
      data-size={split.size || "normal"}
      data-variant={split.variant || "secondary"}
      classList={{
        ...(split.classList ?? {}),
        [split.class ?? ""]: !!split.class,
      }}
    >
      <Icon name={props.icon} size={split.iconSize ?? (split.size === "large" ? "normal" : "small")} />
    </Kobalte>
  )
}
