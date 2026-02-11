/**
 * 打字机效果组件
 * 用于模拟打字机效果，逐字显示文本
 */
import { createEffect, onCleanup, Show, type ValidComponent } from "solid-js"
import { createStore } from "solid-js/store"
import { Dynamic } from "solid-js/web"

/**
 * 打字机效果组件
 * 模拟打字机逐字输入的动画效果
 * @param props 组件属性
 * @param props.text 要显示的文本
 * @param props.class 自定义 CSS 类名
 * @param props.as 渲染的 HTML 标签
 */
export const Typewriter = <T extends ValidComponent = "p">(props: { 
  /** 要显示的文本 */
  text?: string; 
  /** 自定义 CSS 类名 */
  class?: string; 
  /** 渲染的 HTML 标签 */
  as?: T 
}) => {
  // 创建状态存储
  const [store, setStore] = createStore({
    /** 是否正在打字 */
    typing: false,
    /** 已显示的文本 */
    displayed: "",
    /** 是否显示光标 */
    cursor: true,
  })

  // 当文本变化时重新执行打字效果
  createEffect(() => {
    const text = props.text
    if (!text) return

    let i = 0
    const timeouts: ReturnType<typeof setTimeout>[] = []
    
    // 重置状态
    setStore("typing", true)
    setStore("displayed", "")
    setStore("cursor", true)

    /**
     * 获取打字延迟时间
     * 模拟人类打字速度的随机性
     */
    const getTypingDelay = () => {
      const random = Math.random()
      if (random < 0.05) return 150 + Math.random() * 100
      if (random < 0.15) return 80 + Math.random() * 60
      return 30 + Math.random() * 50
    }

    /**
     * 打字函数
     * 逐字显示文本
     */
    const type = () => {
      if (i < text.length) {
        // 显示到当前字符
        setStore("displayed", text.slice(0, i + 1))
        i++
        // 递归调用，继续打字
        timeouts.push(setTimeout(type, getTypingDelay()))
      } else {
        // 打字完成
        setStore("typing", false)
        // 2秒后隐藏光标
        timeouts.push(setTimeout(() => setStore("cursor", false), 2000))
      }
    }

    // 200毫秒后开始打字
    timeouts.push(setTimeout(type, 200))

    // 组件清理时清除所有定时器
    onCleanup(() => {
      for (const timeout of timeouts) clearTimeout(timeout)
    })
  })

  return (
    <Dynamic component={props.as || "p"} class={props.class}>
      {store.displayed}
      <Show when={store.cursor}>
        <span classList={{ "blinking-cursor": !store.typing }}>│</span>
      </Show>
    </Dynamic>
  )
}
