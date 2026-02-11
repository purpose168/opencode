/**
 * Markdown 组件
 * 用于渲染 Markdown 文本为 HTML
 */
import { useMarked } from "../context/marked"
import { ComponentProps, createResource, splitProps } from "solid-js"

/**
 * Markdown 组件
 * 使用 marked 库解析 Markdown 文本并渲染为 HTML
 */
export function Markdown(
  props: ComponentProps<"div"> & {
    /** Markdown 文本内容 */
    text: string
    /** 自定义 CSS 类名 */
    class?: string
    /** 自定义 CSS 类名对象 */
    classList?: Record<string, boolean>
  },
) {
  // 分离本地属性和其他属性
  const [local, others] = splitProps(props, ["text", "class", "classList"])
  // 获取 Markdown 解析器
  const marked = useMarked()
  // 创建资源来异步解析 Markdown 文本
  const [html] = createResource(
    () => local.text,
    async (markdown) => {
      return marked.parse(markdown)
    },
  )
  return (
    <div
      data-component="markdown"
      classList={{
        ...(local.classList ?? {}),
        [local.class ?? ""]: !!local.class,
      }}
      innerHTML={html()}
      {...others}
    />
  )
}
