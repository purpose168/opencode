/**
 * 自动滚动钩子
 * 用于创建具有自动滚动功能的组件，支持用户交互检测和内容变化时的自动滚动
 */
import { createEffect, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { createResizeObserver } from "@solid-primitives/resize-observer"

/**
 * 自动滚动选项接口
 */
export interface AutoScrollOptions {
  /**
   * 检查是否正在工作的函数
   * @returns 是否正在工作
   */
  working: () => boolean
  /**
   * 用户交互时的回调函数
   */
  onUserInteracted?: () => void
}

/**
 * 创建自动滚动功能
 * @param options 自动滚动选项
 * @returns 自动滚动控制对象
 */
export function createAutoScroll(options: AutoScrollOptions) {
  /** 滚动容器引用 */
  let scrollRef: HTMLElement | undefined
  /** 状态存储 */
  const [store, setStore] = createStore({
    /** 内容容器引用 */
    contentRef: undefined as HTMLElement | undefined,
    /** 用户是否手动滚动过 */
    userScrolled: false,
  })

  /** 上次滚动位置 */
  let lastScrollTop = 0
  /** 是否正在自动滚动 */
  let isAutoScrolling = false
  /** 自动滚动超时计时器 */
  let autoScrollTimeout: ReturnType<typeof setTimeout> | undefined
  /** 是否鼠标按下 */
  let isMouseDown = false
  /** 清理事件监听器的函数 */
  let cleanupListeners: (() => void) | undefined
  /** 是否有计划的滚动 */
  let scheduledScroll = false
  /** 是否强制滚动 */
  let scheduledForce = false

  /**
   * 计算距离底部的距离
   * @returns 距离底部的像素数
   */
  function distanceFromBottom() {
    if (!scrollRef) return 0
    return scrollRef.scrollHeight - scrollRef.clientHeight - scrollRef.scrollTop
  }

  /**
   * 开始自动滚动
   * 设置自动滚动状态并启动超时计时器
   */
  function startAutoScroll() {
    isAutoScrolling = true
    if (autoScrollTimeout) clearTimeout(autoScrollTimeout)
    autoScrollTimeout = setTimeout(() => {
      isAutoScrolling = false
    }, 1000)
  }

  /**
   * 立即滚动到底部
   * 只有在用户未手动滚动且正在工作时才执行
   */
  function scrollToBottomNow() {
    if (!scrollRef || store.userScrolled || !options.working()) return

    const distance = distanceFromBottom()
    if (distance < 2) return

    const behavior = distance > 96 ? "auto" : "smooth"
    startAutoScroll()
    scrollRef.scrollTo({
      top: scrollRef.scrollHeight,
      behavior,
    })
  }

  /**
   * 强制立即滚动到底部
   * 忽略用户滚动状态
   */
  function forceScrollToBottomNow() {
    if (!scrollRef) return

    if (store.userScrolled) setStore("userScrolled", false)

    const distance = distanceFromBottom()
    if (distance < 2) return

    startAutoScroll()
    scrollRef.scrollTo({
      top: scrollRef.scrollHeight,
      behavior: "auto",
    })
  }

  /**
   * 计划滚动到底部
   * 使用 requestAnimationFrame 优化滚动性能
   * @param force 是否强制滚动
   */
  function scheduleScrollToBottom(force = false) {
    if (typeof requestAnimationFrame === "undefined") {
      if (force) {
        forceScrollToBottomNow()
        return
      }
      scrollToBottomNow()
      return
    }

    if (force) scheduledForce = true
    if (scheduledScroll) return

    scheduledScroll = true
    requestAnimationFrame(() => {
      scheduledScroll = false

      const shouldForce = scheduledForce
      scheduledForce = false

      if (shouldForce) {
        forceScrollToBottomNow()
        return
      }

      scrollToBottomNow()
    })
  }

  /**
   * 滚动到底部
   */
  function scrollToBottom() {
    scheduleScrollToBottom(false)
  }

  /**
   * 强制滚动到底部
   */
  function forceScrollToBottom() {
    scheduleScrollToBottom(true)
  }

  /**
   * 处理滚动事件
   * 检测用户滚动行为
   */
  function handleScroll() {
    if (!scrollRef) return

    const { scrollTop, scrollHeight, clientHeight } = scrollRef
    const atBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 10

    if (isAutoScrolling) {
      if (atBottom) {
        isAutoScrolling = false
        if (autoScrollTimeout) clearTimeout(autoScrollTimeout)
      }
      lastScrollTop = scrollTop
      return
    }

    if (atBottom) {
      if (store.userScrolled) {
        setStore("userScrolled", false)
      }
      lastScrollTop = scrollTop
      return
    }

    const delta = scrollTop - lastScrollTop
    if (delta < 0) {
      if (isMouseDown && !store.userScrolled && options.working()) {
        setStore("userScrolled", true)
        options.onUserInteracted?.()
      }
    }

    lastScrollTop = scrollTop
  }

  /**
   * 处理用户交互
   * 标记用户已交互并触发回调
   */
  function handleInteraction() {
    if (options.working()) {
      setStore("userScrolled", true)
      options.onUserInteracted?.()
    }
  }

  /**
   * 处理鼠标滚轮事件
   * 检测向上滚动行为
   * @param e 滚轮事件
   */
  function handleWheel(e: WheelEvent) {
    if (e.deltaY < 0 && !store.userScrolled && options.working()) {
      setStore("userScrolled", true)
      options.onUserInteracted?.()
    }
  }

  /**
   * 处理触摸开始事件
   * 标记用户已交互
   */
  function handleTouchStart() {
    if (!store.userScrolled && options.working()) {
      setStore("userScrolled", true)
      options.onUserInteracted?.()
    }
  }

  /**
   * 处理键盘按下事件
   * 检测向上导航键
   * @param e 键盘事件
   */
  function handleKeyDown(e: KeyboardEvent) {
    if (["ArrowUp", "PageUp", "Home"].includes(e.key)) {
      if (!store.userScrolled && options.working()) {
        setStore("userScrolled", true)
        options.onUserInteracted?.()
      }
    }
  }

  /**
   * 处理鼠标按下事件
   * 设置鼠标按下状态并添加鼠标释放事件监听器
   */
  function handleMouseDown() {
    isMouseDown = true
    window.addEventListener("mouseup", handleMouseUp)
  }

  /**
   * 处理鼠标释放事件
   * 重置鼠标按下状态并移除事件监听器
   */
  function handleMouseUp() {
    isMouseDown = false
    window.removeEventListener("mouseup", handleMouseUp)
  }

  // 工作完成时重置用户滚动状态
  createEffect(() => {
    if (!options.working()) {
      setStore("userScrolled", false)
    }
  })

  // 确保在大量 DOM 更新期间保持固定在底部
  createEffect(() => {
    const el = store.contentRef
    if (!el) return

    const observer = new MutationObserver(() => {
      if (store.userScrolled) return
      if (!options.working()) return
      scheduleScrollToBottom(false)
    })
    observer.observe(el, { childList: true, subtree: true, characterData: true })
    onCleanup(() => observer.disconnect())
  })

  // 处理内容大小变化
  createResizeObserver(
    () => store.contentRef,
    () => {
      if (options.working() && !store.userScrolled) {
        scrollToBottom()
      }
    },
  )

  // 清理函数
  onCleanup(() => {
    if (autoScrollTimeout) clearTimeout(autoScrollTimeout)
    if (cleanupListeners) cleanupListeners()
  })

  return {
    /**
     * 设置滚动容器引用
     * @param el 滚动容器元素
     */
    scrollRef: (el: HTMLElement | undefined) => {
      if (cleanupListeners) {
        cleanupListeners()
        cleanupListeners = undefined
      }

      scrollRef = el
      if (el) {
        lastScrollTop = el.scrollTop
        el.style.overflowAnchor = "none"

        el.addEventListener("wheel", handleWheel, { passive: true })
        el.addEventListener("touchstart", handleTouchStart, { passive: true })
        el.addEventListener("keydown", handleKeyDown)
        el.addEventListener("mousedown", handleMouseDown)

        cleanupListeners = () => {
          el.removeEventListener("wheel", handleWheel)
          el.removeEventListener("touchstart", handleTouchStart)
          el.removeEventListener("keydown", handleKeyDown)
          el.removeEventListener("mousedown", handleMouseDown)
          window.removeEventListener("mouseup", handleMouseUp)
        }
      }
    },
    /**
     * 设置内容容器引用
     * @param el 内容容器元素
     */
    contentRef: (el: HTMLElement | undefined) => setStore("contentRef", el),
    /** 处理滚动事件的函数 */
    handleScroll,
    /** 处理用户交互的函数 */
    handleInteraction,
    /** 滚动到底部的函数 */
    scrollToBottom,
    /** 强制滚动到底部的函数 */
    forceScrollToBottom,
    /**
     * 检查用户是否已滚动的函数
     * @returns 用户是否已滚动
     */
    userScrolled: () => store.userScrolled,
  }
}
