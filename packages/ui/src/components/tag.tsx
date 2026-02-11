/**
 * 标签组件
 * 用于显示标签样式的文本元素
 */
import { type ComponentProps, splitProps } from "solid-js"

/**
 * 标签组件属性接口
 */
export interface TagProps extends ComponentProps<"span"> {
  /** 标签尺寸 */
  size?: "normal" | "large"
}

/**
 * 标签组件
 * 提供标签样式的文本显示
 */
export function Tag(props: TagProps) {
  // 分离本地属性和其他属性
  const [split, rest] = splitProps(props, ["size", "class", "classList", "children"])
  
  return (
    <span
      {...rest}
      data-component="tag"
      data-size={split.size || "normal"}
      classList={{
        ...(split.classList ?? {}),
        [split.class ?? ""]: !!split.class,
      }}
    >
      {split.children}
    </span>
  )
}
