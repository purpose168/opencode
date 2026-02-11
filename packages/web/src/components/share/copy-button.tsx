import { createSignal } from "solid-js"
import { IconClipboard, IconCheckCircle } from "../icons"
import styles from "./copy-button.module.css"

// 复制按钮组件属性接口
interface CopyButtonProps {
  text: string
}

// 复制按钮组件
export function CopyButton(props: CopyButtonProps) {
  const [copied, setCopied] = createSignal(false)

  // 处理复制点击事件
  function handleCopyClick() {
    if (props.text) {
      navigator.clipboard.writeText(props.text).catch((err) => console.error("复制失败", err))

      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div data-component="copy-button" class={styles.root}>
      <button type="button" onClick={handleCopyClick} data-copied={copied() ? true : undefined}>
        {copied() ? <IconCheckCircle width={16} height={16} /> : <IconClipboard width={16} height={16} />}
      </button>
    </div>
  )
}
