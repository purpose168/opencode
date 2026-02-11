/**
 * 代码组件上下文
 * 用于在组件树中共享代码渲染组件
 */
import type { ValidComponent } from "solid-js"
import { createSimpleContext } from "./helper"

/**
 * 代码组件上下文
 * 提供代码渲染组件的共享功能
 */
const ctx = createSimpleContext<ValidComponent, { component: ValidComponent }>({
  /** 上下文名称 */
  name: "CodeComponent",
  /** 初始化函数，返回提供的组件 */
  init: (props) => props.component,
})

/**
 * 代码组件提供者
 * 用于在组件树中提供代码渲染组件
 */
export const CodeComponentProvider = ctx.provider

/**
 * 使用代码组件的钩子
 * 用于在子组件中获取代码渲染组件
 */
export const useCodeComponent = ctx.use
