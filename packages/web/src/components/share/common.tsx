import { createSignal, onCleanup, splitProps } from "solid-js"
import type { JSX } from "solid-js/jsx-runtime"
import { IconCheckCircle, IconHashtag } from "../icons"

// 锚点图标组件接口
interface AnchorProps extends JSX.HTMLAttributes<HTMLDivElement> {
  id: string
}
// 锚点图标组件
export function AnchorIcon(props: AnchorProps) {
  const [local, rest] = splitProps(props, ["id", "children"])
  const [copied, setCopied] = createSignal(false)

  return (
    <div {...rest} data-element-anchor title="链接到此消息" data-status={copied() ? "copied" : ""}>
      <a
        href={`#${local.id}`}
        onClick={(e) => {
          e.preventDefault()

          const anchor = e.currentTarget
          const hash = anchor.getAttribute("href") || ""
          const { origin, pathname, search } = window.location

          navigator.clipboard
            .writeText(`${origin}${pathname}${search}${hash}`)
            .catch((err) => console.error("复制失败", err))

          setCopied(true)
          setTimeout(() => setCopied(false), 3000)
        }}
      >
        {local.children}
        <IconHashtag width={18} height={18} />
        <IconCheckCircle width={18} height={18} />
      </a>
      <span data-element-tooltip>已复制！</span>
    </div>
  )
}

// 创建溢出检测函数
export function createOverflow() {
  const [overflow, setOverflow] = createSignal(false)
  return {
    get status() {
      return overflow()
    },
    ref(el: HTMLElement) {
      const ro = new ResizeObserver(() => {
        if (el.scrollHeight > el.clientHeight + 1) {
          setOverflow(true)
        }
        return
      })
      ro.observe(el)

      onCleanup(() => {
        ro.disconnect()
      })
    },
  }
}

// 格式化持续时间
export function formatDuration(ms: number): string {
  const ONE_SECOND = 1000
  const ONE_MINUTE = 60 * ONE_SECOND

  if (ms >= ONE_MINUTE) {
    const minutes = Math.floor(ms / ONE_MINUTE)
    return minutes === 1 ? `1分钟` : `${minutes}分钟`
  }

  if (ms >= ONE_SECOND) {
    const seconds = Math.floor(ms / ONE_SECOND)
    return `${seconds}秒`
  }

  return `${ms}毫秒`
}
