/**
 * 对话框上下文
 * 用于管理应用中的对话框显示和隐藏
 */
import { Dialog as Kobalte } from "@kobalte/core/dialog"
import {
  createContext,
  createSignal,
  getOwner,
  Owner,
  ParentProps,
  runWithOwner,
  Show,
  useContext,
  type JSX,
} from "solid-js"

/**
 * 对话框元素类型
 * 一个返回 JSX.Element 的函数
 */
type DialogElement = () => JSX.Element

/**
 * 对话框上下文
 */
const Context = createContext<ReturnType<typeof init>>()

/**
 * 初始化对话框上下文
 * @returns 对话框上下文对象
 */
function init() {
  // 活动对话框状态
  const [active, setActive] = createSignal<
    | {
        /** 对话框唯一标识 */
        id: string
        /** 对话框元素 */
        element: DialogElement
        /** 关闭回调函数 */
        onClose?: () => void
        /** 所有者实例 */
        owner: Owner
      }
    | undefined
  >()

  const result = {
    /**
     * 获取当前活动的对话框
     */
    get active() {
      return active()
    },
    /**
     * 关闭当前活动的对话框
     */
    close() {
      active()?.onClose?.()
      setActive(undefined)
    },
    /**
     * 显示对话框
     * @param element 对话框元素
     * @param owner 所有者实例
     * @param onClose 关闭回调函数
     */
    show(element: DialogElement, owner: Owner, onClose?: () => void) {
      // 先关闭当前活动的对话框
      active()?.onClose?.()
      // 生成唯一标识
      const id = Math.random().toString(36).slice(2)
      // 设置新的活动对话框
      setActive({
        id,
        element: () =>
          runWithOwner(owner, () => (
            <Show when={active()?.id === id}>
              <Kobalte
                modal
                open={true}
                onOpenChange={(open) => {
                  if (!open) {
                    result.close()
                  }
                }}
              >
                <Kobalte.Portal>
                  <Kobalte.Overlay data-component="dialog-overlay" />
                  {element()}
                </Kobalte.Portal>
              </Kobalte>
            </Show>
          )),
        onClose,
        owner,
      })
    },
  }

  return result
}

/**
 * 对话框提供者组件
 * 用于在组件树中提供对话框上下文
 */
export function DialogProvider(props: ParentProps) {
  const ctx = init()
  return (
    <Context.Provider value={ctx}>
      {props.children}
      <div data-component="dialog-stack">{ctx.active?.element?.()}</div>
    </Context.Provider>
  )
}

/**
 * 使用对话框上下文的钩子
 * @returns 对话框操作对象
 */
export function useDialog() {
  const ctx = useContext(Context)
  const owner = getOwner()
  if (!owner) {
    throw new Error("useDialog 必须在 DialogProvider 内使用")
  }
  if (!ctx) {
    throw new Error("useDialog 必须在 DialogProvider 内使用")
  }
  return {
    /**
     * 获取当前活动的对话框
     */
    get active() {
      return ctx.active
    },
    /**
     * 显示对话框
     * @param element 对话框元素
     * @param onClose 关闭回调函数
     */
    show(element: DialogElement, onClose?: () => void) {
      ctx.show(element, owner, onClose)
    },
    /**
     * 关闭当前活动的对话框
     */
    close() {
      ctx.close()
    },
  }
}
