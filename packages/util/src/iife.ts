/**
 * 立即执行函数表达式工具
 * 
 * 提供立即执行函数的工具函数
 */

/**
 * 立即执行函数表达式（IIFE）
 * 
 * @template T - 函数返回类型
 * @param fn - 要立即执行的函数
 * @returns 函数执行的结果
 */
export function iife<T>(fn: () => T) {
  return fn() // 立即执行函数并返回结果
}
