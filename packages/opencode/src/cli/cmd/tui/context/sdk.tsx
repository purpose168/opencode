import { createOpencodeClient, type Event } from "@opencode-ai/sdk/v2" // OpenCode AI SDK v2 版本客户端创建函数和事件类型定义
// - createOpencodeClient: 创建 OpenCode 客户端实例的工厂函数，用于建立与 OpenCode 服务的连接
// - type Event: 事件类型定义，描述了 SDK 中所有可能的事件类型，用于类型安全的 event handling

import { createSimpleContext } from "./helper" // 从 helper 模块导入创建简单上下文的方法，用于快速创建 Solid.js 上下文
// 这个方法封装了常见的上下文创建模式，减少样板代码，提高开发效率

import { createGlobalEmitter } from "@solid-primitives/event-bus" // Solid.js 原生事件总线库，用于创建全局事件发射器
// createGlobalEmitter 是一个工具函数，用于在组件树中创建可共享的事件发射器
// 支持事件的发布/订阅模式，使得不同组件之间可以松耦合地进行通信

import { batch, onCleanup, onMount } from "solid-js" // Solid.js 核心生命周期和工具函数
// - batch: 批量更新函数，将多个状态更新合并为一次渲染，避免中间状态导致的重复渲染
// - onCleanup: 清理函数，在组件卸载时执行，用于清理副作用和资源
// - onMount: 挂载函数，在组件首次渲染后执行，用于初始化逻辑

// 创建 SDK 上下文提供者
// 使用 createSimpleContext 工具函数快速创建一个 SDK 客户端管理上下文
// 这个上下文用于在整个应用组件树中共享 OpenCode SDK 客户端实例和事件系统
// 支持通过 WebSocket 流式接收服务器事件，并将其分发到各个订阅者
//
// 返回值包含两个主要部分：
// - use: 用于在子组件中获取 SDK 客户端和事件发射器的钩子函数
// - provider: 用于在父组件中提供 SDK 上下文的组件
export const { use: useSDK, provider: SDKProvider } = createSimpleContext({
  name: "SDK", // 上下文的名称，用于调试和错误提示，帮助开发者快速定位上下文相关问题
  init: (props: { url: string }) => {
    // 创建 AbortController 实例，用于控制异步操作的生命周期
    // 当组件卸载或需要停止 SDK 连接时，可以调用 abort() 方法取消所有挂起的请求
    const abort = new AbortController()

    // 创建 OpenCode SDK 客户端实例
    // 配置基础 URL 和取消信号，用于后续的 API 调用和事件订阅
    const sdk = createOpencodeClient({
      baseUrl: props.url, // OpenCode 服务器的基础 URL，通常是 WebSocket 地址
      signal: abort.signal, // 关联 AbortSignal，用于控制客户端请求的生命周期
    })

    // 创建全局事件发射器
    // 使用事件总线模式，将 SDK 事件分发给各个订阅者
    // 类型定义确保事件类型安全：每个事件类型对应一个特定的事件结构
    const emitter = createGlobalEmitter<{
      // 映射所有 SDK 事件类型到对应的事件结构
      // 使用 Extract 工具类型确保事件类型的正确性
      [key in Event["type"]]: Extract<Event, { type: key }>
    }>()

    // 在组件挂载时启动事件监听循环
    // 使用异步函数持续接收服务器推送的事件流
    onMount(async () => {
      // 无限循环，持续监听服务器事件
      // 循环会在 AbortController 被中止时自动退出
      while (true) {
        // 检查是否已收到中止信号，如果已中止则退出循环
        if (abort.signal.aborted) break

        // 订阅服务器事件流
        // 使用空对象作为订阅参数，订阅所有类型的事件
        const events = await sdk.event.subscribe(
          {},
          {
            signal: abort.signal, // 传递取消信号，允许外部中止订阅
          },
        )

        // 声明事件队列和相关变量
        let queue: Event[] = [] // 待处理的事件队列
        let timer: Timer | undefined // 批处理定时器
        let last = 0 // 上次批处理的时间戳

        // 定义刷新函数，将队列中的事件批量发射
        const flush = () => {
          // 如果队列为空，直接返回
          if (queue.length === 0) return

          // 获取当前所有待处理事件
          const events = queue
          queue = [] // 清空队列
          timer = undefined // 清除定时器引用
          last = Date.now() // 记录本次批处理的时间戳

          // 使用 batch 批量更新，确保所有状态更新触发一次渲染
          // 优化性能，避免每个事件单独触发重新渲染
          batch(() => {
            // 遍历所有事件，根据事件类型发射到对应的订阅者
            for (const event of events) {
              emitter.emit(event.type, event)
            }
          })
        }

        // 异步遍历事件流，持续接收服务器推送的事件
        for await (const event of events.stream) {
          // 将新事件添加到队列
          queue.push(event)

          // 计算距离上次批处理经过的时间
          const elapsed = Date.now() - last

          // 如果已经在等待定时器，继续等待（避免重复定时器）
          if (timer) continue

          // 性能优化：如果最近刚批处理过（16ms 内），则延迟批处理
          // 这样可以将多个快速到达的事件合并为一次渲染
          // 否则立即处理，避免增加延迟
          if (elapsed < 16) {
            // 设置 16ms 延迟的定时器，期待更多事件到来
            timer = setTimeout(flush, 16)
            continue
          }

          // 如果已经超过 16ms，立即处理事件
          flush()
        }

        // 循环结束后，清空剩余的事件
        // 确保没有遗漏任何待处理的事件
        if (timer) clearTimeout(timer) // 清除可能的定时器
        if (queue.length > 0) {
          // 如果还有剩余事件，最后批处理一次
          flush()
        }
      }
    })

    // 组件卸载时的清理函数
    // 取消所有挂起的请求和事件订阅
    onCleanup(() => {
      abort.abort() // 中止 AbortController，触发所有关联的请求取消
    })

    // 返回 SDK 上下文包含的所有对象
    return {
      client: sdk, // OpenCode SDK 客户端实例，用于调用各种 API
      event: emitter, // 事件发射器，用于订阅和发布 SDK 事件
      url: props.url, // 服务器连接 URL，可能用于重连或其他用途
    }
  },
})
