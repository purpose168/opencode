// @ts-nocheck
import React from "react"
import { Font, Text as JEText, type TextProps } from "@jsx-email/all"
import { baseText } from "./styles"

/**
 * 文本组件
 * 基于 jsx-email 的 Text 组件，添加了基础样式
 */
export function Text(props: TextProps) {
  return <JEText {...props} style={{ ...baseText, ...props.style }} />
}

/**
 * 标题组件
 * 用于创建 HTML 的 title 元素
 */
export function Title({ children }: TitleProps) {
  return React.createElement("title", null, children)
}

/**
 * 链接组件
 * 用于创建 HTML 的 a 元素
 */
export function A({ children, ...props }: AProps) {
  return React.createElement("a", props, children)
}

/**
 *  span 组件
 * 用于创建 HTML 的 span 元素
 */
export function Span({ children, ...props }: SpanProps) {
  return React.createElement("span", props, children)
}

/**
 * 换行提示组件
 * 用于创建 HTML 的 wbr 元素，提示浏览器在适当位置换行
 */
export function Wbr({ children, ...props }: WbrProps) {
  return React.createElement("wbr", props, children)
}

/**
 * 字体加载组件
 * 用于加载和定义邮件中使用的字体
 */
export function Fonts({ assetsUrl }: { assetsUrl: string }) {
  return (
    <>
      {/* JetBrains Mono 常规字体 */}
      <Font
        fontFamily="JetBrains Mono"
        fallbackFontFamily="monospace"
        webFont={{
          url: `${assetsUrl}/JetBrainsMono-Regular.woff2`,
          format: "woff2",
        }}
        fontWeight="400"
        fontStyle="normal"
      />
      {/* JetBrains Mono 中等粗细字体 */}
      <Font
        fontFamily="JetBrains Mono"
        fallbackFontFamily="monospace"
        webFont={{
          url: `${assetsUrl}/JetBrainsMono-Medium.woff2`,
          format: "woff2",
        }}
        fontWeight="500"
        fontStyle="normal"
      />
      {/* Rubik 字体，支持多种字重 */}
      <Font
        fontFamily="Rubik"
        fallbackFontFamily={["Helvetica", "Arial", "sans-serif"]}
        webFont={{
          url: `${assetsUrl}/rubik-latin.woff2`,
          format: "woff2",
        }}
        fontWeight="400 500 600 700"
        fontStyle="normal"
      />
    </>
  )
}

/**
 * 字符串分割组件
 * 将长字符串按照指定长度分割，并在分割处添加换行提示
 */
export function SplitString({ text, split }: { text: string; split: number }) {
  const segments: JSX.Element[] = []
  for (let i = 0; i < text.length; i += split) {
    segments.push(<>{text.slice(i, i + split)}</>)
    if (i + split < text.length) {
      segments.push(<Wbr key={`${i}wbr`} />)
    }
  }
  return <>{segments}</>
}
