/**
 * Worker 池上下文
 * 用于管理和提供 Worker 池实例，支持不同的差异比较风格
 */
import type { WorkerPoolManager } from "@pierre/diffs/worker"
import { createSimpleContext } from "./helper"

/**
 * Worker 池类型
 * 包含不同风格的 Worker 池管理器
 */
export type WorkerPools = {
  /** 统一风格的 Worker 池管理器 */
  unified: WorkerPoolManager | undefined
  /** 分割风格的 Worker 池管理器 */
  split: WorkerPoolManager | undefined
}

/**
 * Worker 池上下文
 * 提供 Worker 池实例的共享功能
 */
const ctx = createSimpleContext<WorkerPools, { pools: WorkerPools }>({
  /** 上下文名称 */
  name: "WorkerPool",
  /** 初始化函数，返回提供的 Worker 池实例 */
  init: (props) => props.pools,
})

/**
 * Worker 池提供者组件
 * 用于在组件树中提供 Worker 池实例
 */
export const WorkerPoolProvider = ctx.provider

/**
 * 使用 Worker 池的钩子
 * 根据差异比较风格返回对应的 Worker 池管理器
 * @param diffStyle 差异比较风格：unified（统一）、split（分割）或 undefined
 * @returns 对应的 Worker 池管理器
 */
export function useWorkerPool(diffStyle: "unified" | "split" | undefined) {
  const pools = ctx.use()
  if (diffStyle === "split") return pools.split
  return pools.unified
}
