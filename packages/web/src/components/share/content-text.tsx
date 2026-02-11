import style from "./content-text.module.css"
import { createSignal } from "solid-js"
import { createOverflow } from "./common"
import { CopyButton } from "./copy-button"

// 文本内容组件属性接口
interface Props {
  text: string
  expand?: boolean
  compact?: boolean
}
// 文本内容组件
export function ContentText(props: Props) {
  const [expanded, setExpanded] = createSignal(false)
  const overflow = createOverflow()

  return (
    <div
      class={style.root}
      data-expanded={expanded() || props.expand === true ? true : undefined}
      data-compact={props.compact === true ? true : undefined}
    >
      <pre data-slot="text" ref={overflow.ref}>
        {props.text}
      </pre>
      {((!props.expand && overflow.status) || expanded()) && (
        <button
          type="button"
          data-component="text-button"
          data-slot="expand-button"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded() ? "收起" : "展开更多"}
        </button>
      )}
      <CopyButton text={props.text} />
    </div>
  )
}
