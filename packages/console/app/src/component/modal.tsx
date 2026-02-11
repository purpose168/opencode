import { JSX, Show } from "solid-js"
import "./modal.css"

/**
 * 模态框组件属性接口
 */
interface ModalProps {
  open: boolean         // 是否打开
  onClose: () => void   // 关闭回调
  title?: string        // 标题（可选）
  children: JSX.Element  // 内容
}

/**
 * 模态框组件
 */
export function Modal(props: ModalProps) {
  return (
    <Show when={props.open}>
      <div data-component="modal" data-slot="overlay" onClick={props.onClose}>
        <div data-slot="content" onClick={(e) => e.stopPropagation()}>
          <Show when={props.title}>
            <h2 data-slot="title">{props.title}</h2>
          </Show>
          {props.children}
        </div>
      </div>
    </Show>
  )
}
