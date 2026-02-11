/**
 * 调整大小手柄组件
 * 用于实现可调整大小的界面元素
 */
import { splitProps, type JSX } from "solid-js"

/**
 * 调整大小手柄组件属性接口
 */
export interface ResizeHandleProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "onResize"> {
  /** 调整方向：水平或垂直 */
  direction: "horizontal" | "vertical"
  /** 当前大小 */
  size: number
  /** 最小大小 */
  min: number
  /** 最大大小 */
  max: number
  /** 大小变化回调函数 */
  onResize: (size: number) => void
  /** 折叠回调函数 */
  onCollapse?: () => void
  /** 折叠阈值 */
  collapseThreshold?: number
}

/**
 * 调整大小手柄组件
 * 用于实现可调整大小的界面元素
 */
export function ResizeHandle(props: ResizeHandleProps) {
  // 分离本地属性和其他属性
  const [local, rest] = splitProps(props, [
    "direction",
    "size",
    "min",
    "max",
    "onResize",
    "onCollapse",
    "collapseThreshold",
    "class",
    "classList",
  ])

  /**
   * 处理鼠标按下事件
   * @param e - 鼠标事件
   */
  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault()
    // 获取初始位置
    const start = local.direction === "horizontal" ? e.clientX : e.clientY
    // 获取初始大小
    const startSize = local.size
    // 当前大小
    let current = startSize

    // 禁用用户选择和页面滚动
    document.body.style.userSelect = "none"
    document.body.style.overflow = "hidden"

    /**
     * 处理鼠标移动事件
     * @param moveEvent - 鼠标事件
     */
    const onMouseMove = (moveEvent: MouseEvent) => {
      // 获取当前位置
      const pos = local.direction === "horizontal" ? moveEvent.clientX : moveEvent.clientY
      // 计算位置变化
      const delta = local.direction === "vertical" ? start - pos : pos - start
      // 计算新大小
      current = startSize + delta
      // 限制大小在最小和最大值之间
      const clamped = Math.min(local.max, Math.max(local.min, current))
      // 调用大小变化回调
      local.onResize(clamped)
    }

    /**
     * 处理鼠标释放事件
     */
    const onMouseUp = () => {
      // 恢复用户选择和页面滚动
      document.body.style.userSelect = ""
      document.body.style.overflow = ""
      // 移除事件监听器
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)

      // 检查是否需要折叠
      const threshold = local.collapseThreshold ?? 0
      if (local.onCollapse && threshold > 0 && current < threshold) {
        local.onCollapse()
      }
    }

    // 添加事件监听器
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }

  return (
    <div
      {...rest}
      data-component="resize-handle"
      data-direction={local.direction}
      classList={{
        ...(local.classList ?? {}),
        [local.class ?? ""]: !!local.class,
      }}
      onMouseDown={handleMouseDown}
    />
  )
}
