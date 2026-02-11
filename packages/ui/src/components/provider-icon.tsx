/**
 * 提供者图标组件
 * 用于显示不同服务提供者的图标
 */
import type { Component, JSX } from "solid-js"
import { splitProps } from "solid-js"
import sprite from "./provider-icons/sprite.svg"
import type { IconName } from "./provider-icons/types"

/**
 * 提供者图标组件属性
 */
export type ProviderIconProps = JSX.SVGElementTags["svg"] & {
  /** 图标ID */
  id: IconName
}

/**
 * 提供者图标组件
 * 显示指定ID的提供者图标
 */
export const ProviderIcon: Component<ProviderIconProps> = (props) => {
  // 分离本地属性和其他属性
  const [local, rest] = splitProps(props, ["id", "class", "classList"])
  return (
    <svg
      data-component="provider-icon"
      {...rest}
      classList={{
        ...(local.classList ?? {}),
        [local.class ?? ""]: !!local.class,
      }}
    >
      {/* 使用SVG精灵图显示图标 */}
      <use href={`${sprite}#${local.id}`} />
    </svg>
  )
}
