/**
 * 上下文辅助工具
 * 提供创建简单上下文的工具函数
 */
import { createContext, createMemo, Show, useContext, type Accessor, type ParentProps } from "solid-js"

/**
 * 创建简单上下文
 * 用于快速创建带有提供者和钩子的上下文
 * @param input 输入参数
 * @param input.name 上下文名称
 * @param input.init 初始化函数，返回上下文值
 * @returns 包含提供者组件和使用钩子的对象
 */
export function createSimpleContext<T, Props extends Record<string, any>>(input: {
  /** 上下文名称 */
  name: string
  /** 初始化函数，返回上下文值 */
  init: ((input: Props) => T) | (() => T)
}) {
  // 创建上下文
  const ctx = createContext<T>()

  return {
    /**
     * 上下文提供者组件
     * @param props 组件属性
     * @returns 提供者组件
     */
    provider: (props: ParentProps<Props>) => {
      // 初始化上下文值
      const init = input.init(props)
      // 检查上下文值是否准备就绪
      // 在 memo 中访问 init.ready 以使其对 getter 属性具有反应性
      const isReady = createMemo(() => {
        // @ts-expect-error
        const ready = init.ready as Accessor<boolean> | boolean | undefined
        return ready === undefined || (typeof ready === "function" ? ready() : ready)
      })
      return (
        <Show when={isReady()}>
          <ctx.Provider value={init}>{props.children}</ctx.Provider>
        </Show>
      )
    },
    /**
     * 使用上下文的钩子
     * @returns 上下文值
     * @throws 如果在上下文提供者之外使用，则抛出错误
     */
    use() {
      const value = useContext(ctx)
      if (!value) throw new Error(`${input.name} 上下文必须在上下文提供者内使用`)
      return value
    },
  }
}
