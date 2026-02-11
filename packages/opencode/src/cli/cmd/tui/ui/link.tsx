import type { RGBA } from "@opentui/core" // 导入 RGBA 颜色类型，用于定义文本颜色
import open from "open" // 导入 open 库，用于在默认浏览器中打开 URL
import type { JSX } from "solid-js" // 导入 JSX 类型，用于定义子元素的类型

/**
 * LinkProps 链接组件属性接口定义
 *
 * 属性说明：
 * - href: 链接的目标 URL 地址
 * - children: 可选的子元素或字符串，用于自定义链接显示文本，如果未提供则使用 href 作为显示文本
 * - fg: 可选的文本颜色，使用 RGBA 格式
 */
export interface LinkProps {
  href: string // 链接的目标 URL 地址
  children?: JSX.Element | string // 可选的子元素或字符串，用于自定义链接显示文本
  fg?: RGBA // 可选的文本颜色，使用 RGBA 格式
}

/**
 * Link 链接组件
 *
 * 功能说明：
 * - 渲染可点击的超链接文本
 * - 点击链接文本时在默认浏览器中打开 URL
 * - 支持自定义链接显示文本，如果未提供则使用 URL 作为显示文本
 * - 支持自定义文本颜色
 *
 * 使用场景：
 * - 需要在 TUI 界面中显示可点击的链接时
 * - 需要引导用户访问外部资源（如文档、网站等）时
 * - 需要在终端界面中提供跳转到网页的功能时
 *
 * 组件特性：
 * - 使用 open 库在默认浏览器中打开 URL
 * - 支持鼠标点击事件（onMouseUp）
 * - 支持自定义文本颜色
 * - 自动处理打开 URL 失败的情况（静默忽略错误）
 *
 * 参数说明：
 * - props: LinkProps 类型，包含 href、可选的 children 和 fg
 *
 * 返回值：
 * - 返回一个文本组件，显示可点击的链接文本
 */
export function Link(props: LinkProps) {
  const displayText = props.children ?? props.href // 确定显示文本：如果提供了 children 则使用 children，否则使用 href

  // 返回文本组件，渲染可点击的链接
  return (
    <text
      fg={props.fg} // 设置文本颜色（如果提供了 fg 属性）
      onMouseUp={() => {
        // 鼠标释放事件处理
        open(props.href).catch(() => {}) // 在默认浏览器中打开 URL，如果失败则静默忽略错误
      }}
    >
      {displayText} {/* 显示链接文本 */}
    </text>
  )
}
