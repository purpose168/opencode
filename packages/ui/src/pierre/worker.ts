/**
 * Pierre 差异比较的 Worker 池管理
 * 
 * 该文件定义了 Worker 池的创建和管理逻辑，用于在后台处理代码差异比较任务
 * 使用 Worker 线程可以提高差异比较的性能，避免阻塞主线程
 */
import { WorkerPoolManager } from "@pierre/diffs/worker"
import ShikiWorkerUrl from "@pierre/diffs/worker/worker.js?worker&url"

/**
 * Worker 池样式类型
 * 
 * @typedef {'unified' | 'split'}
 * - unified: 统一视图样式
 * - split: 分割视图样式
 */
export type WorkerPoolStyle = "unified" | "split"

/**
 * 创建 Worker 实例的工厂函数
 * 
 * @returns Worker 实例
 */
export function workerFactory(): Worker {
  return new Worker(ShikiWorkerUrl, { type: "module" })
}

/**
 * 创建 Worker 池
 * 
 * @param lineDiffType - 行差异类型："none" 表示无差异，"word-alt" 表示单词级差异
 * @returns WorkerPoolManager 实例
 */
function createPool(lineDiffType: "none" | "word-alt") {
  const pool = new WorkerPoolManager(
    {
      workerFactory,
      // poolSize 默认值为 8。更多的 worker 意味着更多的并行处理能力，但
      // 也会占用更多内存。过多的 worker 实际上可能会减慢处理速度。
      // 注意：对于 OpenCode 来说，2 个可能更好，因为 8 个可能有点过度，
      // 尤其是因为 Safari 的 worker 启动时间明显较慢
      poolSize: 2,
    },
    {
      theme: "OpenCode", // 主题名称
      lineDiffType, // 行差异类型
    },
  )

  pool.initialize() // 初始化 worker 池
  return pool
}

// 统一视图的 worker 池
let unified: WorkerPoolManager | undefined
// 分割视图的 worker 池
let split: WorkerPoolManager | undefined

/**
 * 获取指定样式的 Worker 池
 * 
 * @param style - Worker 池样式
 * @returns WorkerPoolManager 实例或 undefined（在非浏览器环境中）
 */
export function getWorkerPool(style: WorkerPoolStyle | undefined): WorkerPoolManager | undefined {
  if (typeof window === "undefined") return // 在非浏览器环境中返回 undefined

  if (style === "split") {
    if (!split) split = createPool("word-alt") // 如果 split 池不存在，则创建
    return split
  }

  if (!unified) unified = createPool("none") // 如果 unified 池不存在，则创建
  return unified
}

/**
 * 获取所有 Worker 池
 * 
 * @returns 包含 unified 和 split 两种样式的 worker 池对象
 */
export function getWorkerPools() {
  return {
    unified: getWorkerPool("unified"),
    split: getWorkerPool("split"),
  }
}
