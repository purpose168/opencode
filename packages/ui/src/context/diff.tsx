/**
 * 差异比较组件上下文
 * 用于在组件树中共享差异比较渲染组件
 */
import type { ValidComponent } from "solid-js"
import { createSimpleContext } from "./helper"

/**
 * 差异比较组件上下文
 * 提供差异比较渲染组件的共享功能
 */
const ctx = createSimpleContext<ValidComponent, { component: ValidComponent }>({
  /** 上下文名称 */
  name: "DiffComponent",
  /** 初始化函数，返回提供的组件 */
  init: (props) => props.component,
})

/**
 * 差异比较组件提供者
 * 用于在组件树中提供差异比较渲染组件
 */
export const DiffComponentProvider = ctx.provider

/**
 * 使用差异比较组件的钩子
 * 用于在子组件中获取差异比较渲染组件
 */
export const useDiffComponent = ctx.use
