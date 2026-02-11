import { createContext, Show, useContext, type ParentProps } from "solid-js" // Solid.js 核心库导入
// - createContext：创建 React/Solid.js 上下文对象，用于在组件树中共享数据
// - Show：条件渲染组件，当条件为真时渲染子元素，为假时渲染备选内容（可省略）
// - useContext：获取上下文值的钩子函数，用于在子组件中访问上下文数据
// - type ParentProps：父组件属性类型定义，包含 children 属性用于传递子组件

/**
 * 创建简单上下文的高阶函数
 * 这是一个通用的上下文创建工具，用于快速创建具有提供者（Provider）和使用者（Hook）模式的上下文
 * 相比直接使用 createContext，这个函数封装了常见的上下文使用模式，减少样板代码
 *
 * @template T - 上下文值的类型，指定上下文管理的数据类型
 * @template Props - 上下文提供者组件的属性类型，定义初始化时需要的参数
 *
 * @param input - 配置对象，包含上下文的名称和初始化函数
 * @param input.name - 上下文的名称，用于错误提示和调试
 * @param input.init - 初始化函数，接收属性参数并返回上下文值，支持同步和异步两种模式
 *
 * @returns 返回一个包含 provider 组件和 use 钩子函数的对象
 */
export function createSimpleContext<T, Props extends Record<string, any>>(input: {
  name: string // 上下文的名称，用于错误提示和调试时标识上下文类型
  init: ((input: Props) => T) | (() => T) // 初始化函数，可以是同步或异步函数，用于创建上下文值
}) {
  // 使用 Solid.js 的 createContext 创建基础上下文对象
  // 这个上下文对象是类型化的，携带了上下文值的数据类型信息
  const ctx = createContext<T>()

  // 返回包含 provider 和 use 两个部分的对象
  return {
    /**
     * 上下文提供者组件
     * 用于在组件树中提供上下文值，包裹的子组件可以通过 use 钩子访问这些值
     *
     * @param props - 包含 children 和初始化属性的父组件属性
     * @returns 返回一个带有上下文提供者的条件渲染组件
     */
    provider: (props: ParentProps<Props>) => {
      // 调用初始化函数创建上下文值
      // 根据初始化函数的类型（同步或异步），可能返回 Promise 或直接值
      const init = input.init(props)

      // 返回条件渲染组件
      // 支持两种初始化模式：
      // 1. 如果 init 是对象且包含 ready 属性，则根据 ready 决定是否提供上下文
      // 2. 如果 init 不包含 ready 属性或 ready 为 true，则正常提供上下文

      return (
        <Show when={init.ready === undefined || init.ready === true}>
          <ctx.Provider value={init}>{props.children}</ctx.Provider>
        </Show>
      )
    },

    /**
     * 使用上下文的钩子函数
     * 在子组件中调用此函数获取上下文值，如果不在提供者内则抛出错误
     *
     * @returns 返回上下文值，类型为 T
     * @throws 如果在上下文提供者外使用，抛出包含上下文名称的错误
     */
    use() {
      // 使用 useContext 获取当前上下文中的值
      const value = useContext(ctx)

      // 检查是否获取到有效的上下文值
      if (!value) {
        // 如果没有找到上下文值，说明在提供者外使用了 use 钩子
        // 抛出错误提示开发者正确使用上下文
        throw new Error(`${input.name} context must be used within a context provider`)
      }

      // 返回上下文值
      return value
    },
  }
}
