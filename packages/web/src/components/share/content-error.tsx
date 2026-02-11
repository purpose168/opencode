import style from "./content-error.module.css"
import { type JSX, createSignal } from "solid-js"
import { createOverflow } from "./common"

// 错误内容组件属性接口
interface Props extends JSX.HTMLAttributes<HTMLDivElement> {
  expand?: boolean
}
// 错误内容组件
export function ContentError(props: Props) {
  const [expanded, setExpanded] = createSignal(false)
  const overflow = createOverflow()

  return (
    <div class={style.root} data-expanded={expanded() || props.expand === true ? true : undefined}>
      <div data-section="content" ref={overflow.ref}>
        {props.children}
      </div>
      {((!props.expand && overflow.status) || expanded()) && (
        <button type="button" data-element-button-text onClick={() => setExpanded((e) => !e)}>
          {expanded() ? "收起" : "展开更多"}
        </button>
      )}
    </div>
  )
}
