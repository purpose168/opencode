import { createSimpleContext } from "./helper" // 从 helper 模块导入创建简单上下文的方法，用于快速创建 Solid.js 上下文
// 这个方法封装了常见的上下文创建模式，减少样板代码，提高开发效率

import type { PromptRef } from "../component/prompt" // 从 prompt 组件导入提示词引用类型定义
// PromptRef 类型定义了提示词组件的引用接口，包含对提示词输入框的各种操作方法

// 创建提示词引用上下文提供者
// 使用 createSimpleContext 工具函数快速创建一个提示词组件引用管理上下文
// 这个上下文用于在整个应用组件树中共享对提示词组件的引用访问
// 使得任意位置的组件都可以获取或设置当前活动的提示词组件引用
//
// 返回值包含两个主要部分：
// - use: 用于在子组件中获取提示词引用操作函数的钩子函数
// - provider: 用于在父组件中提供提示词引用上下文的组件
export const { use: usePromptRef, provider: PromptRefProvider } = createSimpleContext({
  name: "PromptRef", // 上下文的名称，用于调试和错误提示，帮助开发者快速定位上下文相关问题
  init: () => {
    // 声明当前提示词引用变量
    // 初始值为 undefined，表示还没有任何提示词组件被注册
    // 这个变量会在运行时被更新，指向当前活动的提示词组件实例
    let current: PromptRef | undefined

    // 返回提示词引用管理的操作接口
    // 提供 getter 和 setter 方法来访问和修改当前提示词引用
    return {
      /**
       * 获取当前提示词组件引用
       * 这是一个 getter 属性，用于获取当前注册的提示词组件实例
       *
       * @returns 当前提示词组件的引用对象，如果未注册则返回 undefined
       */
      get current() {
        return current
      },

      /**
       * 设置当前提示词组件引用
       * 当提示词组件挂载或卸载时调用此方法来更新当前活动的引用
       *
       * @param ref - 要设置的提示词组件引用，可以是 PromptRef 对象或 undefined（用于清除引用）
       */
      set(ref: PromptRef | undefined) {
        current = ref
      },
    }
  },
})
