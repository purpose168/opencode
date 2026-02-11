import { createStore } from "solid-js/store" // Solid.js 状态管理：创建响应式 store，用于管理复杂的状态对象，支持嵌套属性的响应式更新
// createStore 是 Solid.js 提供的强大状态管理工具，与 createSignal 不同，它专门用于管理对象和嵌套数据结构
// 当 store 中的任何属性发生变化时，所有依赖该属性的组件都会自动重新渲染

import { createSimpleContext } from "./helper" // 从 helper 模块导入创建简单上下文的方法，用于快速创建 Solid.js 上下文
// 这个方法封装了常见的上下文创建模式，减少样板代码，提高开发效率

import type { PromptInfo } from "../component/prompt/history" // 从提示词历史组件导入提示信息类型定义
// PromptInfo 类型定义了提示词的元数据，包括提示词内容、时间戳等属性

// 首页路由类型定义
// 当用户处于主界面（首页）时的路由状态
export type HomeRoute = {
  type: "home" // 路由类型标识，固定为 "home" 表示首页路由
  initialPrompt?: PromptInfo // 可选的初始提示信息，用于从外部（如命令行参数）传入预定义的提示词
}

// 会话路由类型定义
// 当用户进入特定对话会话时的路由状态
export type SessionRoute = {
  type: "session" // 路由类型标识，固定为 "session" 表示会话路由
  sessionID: string // 会话的唯一标识符，用于区分不同的对话会话
  initialPrompt?: PromptInfo // 可选的初始提示信息，用于在进入会话时预填充提示词内容
}

// 路由类型联合
// 应用支持的所有路由类型的联合类型，可以是首页路由或会话路由
export type Route = HomeRoute | SessionRoute

// 创建路由上下文提供者
// 使用 createSimpleContext 工具函数快速创建一个路由管理上下文
// 这个上下文用于在整个应用组件树中管理当前的路由状态和导航功能
// 支持从环境变量读取初始路由配置，实现应用的路由恢复功能
//
// 返回值包含两个主要部分：
// - use: 用于在子组件中获取路由操作函数的钩子函数
// - provider: 用于在父组件中提供路由上下文的组件
export const { use: useRoute, provider: RouteProvider } = createSimpleContext({
  name: "Route", // 上下文的名称，用于调试和错误提示，帮助开发者快速定位上下文相关问题
  init: () => {
    // 创建路由存储的响应式 store
    // 优先从环境变量 OPENCODE_ROUTE 读取路由配置，如果没有设置则使用默认首页路由
    // 这种设计支持通过环境变量在应用启动时指定初始路由状态
    const [store, setStore] = createStore<Route>(
      // 检查是否存在 OPENCODE_ROUTE 环境变量
      process.env["OPENCODE_ROUTE"]
        ? // 如果存在环境变量，解析 JSON 字符串为路由对象
          JSON.parse(process.env["OPENCODE_ROUTE"])
        : // 如果不存在环境变量，使用默认首页路由
          {
            type: "home",
          },
    )

    // 返回路由管理的操作接口
    return {
      /**
       * 获取当前路由数据
       * 这是一个 getter 属性，用于获取当前活动的路由状态
       *
       * @returns 当前路由状态对象，可能是 HomeRoute 或 SessionRoute 类型
       */
      get data() {
        return store
      },

      /**
       * 导航到指定路由
       * 用于在应用内不同路由之间切换，更新路由状态
       *
       * @param route - 要导航到的目标路由对象，可以是 HomeRoute 或 SessionRoute 类型
       */
      navigate(route: Route) {
        // 输出导航日志，便于调试和追踪路由变化
        console.log("navigate", route)
        // 更新路由 store，切换到新的路由状态
        setStore(route)
      },
    }
  },
})

// 路由上下文类型定义
// 从 useRoute 钩子函数的返回类型中提取的上下文类型
// 用于在类型注解中引用路由上下文，确保类型安全
export type RouteContext = ReturnType<typeof useRoute>

/**
 * 提取特定类型的路由数据
 * 这是一个类型安全的路由数据访问工具函数
 * 用于获取指定类型（home 或 session）的路由数据
 *
 * @template T - 路由类型参数，限制为 Route["type"] 的子类型
 * @param type - 要提取的路由类型，'home' 或 'session'
 * @returns 指定类型的路由数据对象
 */
export function useRouteData<T extends Route["type"]>(type: T) {
  // 获取路由上下文
  const route = useRoute()
  // 使用 Extract 工具类型从 Route 联合类型中提取指定类型的路由数据
  // 并将 route.data 断言为该类型，确保类型安全
  return route.data as Extract<Route, { type: typeof type }>
}
