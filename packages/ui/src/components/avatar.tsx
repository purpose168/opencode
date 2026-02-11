import { type ComponentProps, splitProps, Show } from "solid-js"

/**
 * 头像组件属性接口
 * 扩展了 div 元素的属性
 */
export interface AvatarProps extends ComponentProps<"div"> {
  fallback: string      // 头像加载失败时显示的文本
  src?: string          // 头像图片的 URL
  background?: string   // 头像背景颜色
  foreground?: string   // 头像前景颜色（文本颜色）
  size?: "small" | "normal" | "large"  // 头像大小
}

/**
 * 头像组件
 * 显示用户头像，支持图片加载失败时的回退显示
 * 
 * @param props 头像组件属性
 * @returns 渲染的头像组件
 */
export function Avatar(props: AvatarProps) {
  // 分离属性，将自定义属性与其他属性分开
  const [split, rest] = splitProps(props, [
    "fallback",
    "src",
    "background",
    "foreground",
    "size",
    "class",
    "classList",
    "style",
  ])
  
  // 提取 src 属性，方便测试回退显示
  const src = split.src 
  
  return (
    <div
      {...rest}
      data-component="avatar"
      data-size={split.size || "normal"}
      data-has-image={src ? "" : undefined}
      classList={{
        ...(split.classList ?? {}),
        [split.class ?? ""]: !!split.class,
      }}
      style={{
        ...(typeof split.style === "object" ? split.style : {}),
        ...(!src && split.background ? { "--avatar-bg": split.background } : {}),
        ...(!src && split.foreground ? { "--avatar-fg": split.foreground } : {}),
      }}
    >
      <Show when={src} fallback={split.fallback?.[0]}>
        {(src) => <img src={src()} draggable={false} class="size-full object-cover" />}
      </Show>
    </div>
  )
}
