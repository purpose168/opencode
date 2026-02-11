/**
 * 进度圆环组件
 * 用于显示圆形进度条，支持自定义大小、线条宽度和百分比
 */
import { type ComponentProps, createMemo, splitProps } from "solid-js"

/**
 * 进度圆环组件属性接口
 */
export interface ProgressCircleProps extends Pick<ComponentProps<"svg">, "class" | "classList"> {
  /** 进度百分比（0-100） */
  percentage: number
  /** 圆环大小（默认 16） */
  size?: number
  /** 圆环线条宽度（默认 3） */
  strokeWidth?: number
}

/**
 * 进度圆环组件
 * 显示一个圆形进度条，根据百分比值绘制进度
 */
export function ProgressCircle(props: ProgressCircleProps) {
  // 分离本地属性和其他属性
  const [split, rest] = splitProps(props, ["percentage", "size", "strokeWidth", "class", "classList"])

  /**
   * 获取圆环大小
   * @returns 圆环大小
   */
  const size = () => split.size || 16
  
  /**
   * 获取圆环线条宽度
   * @returns 圆环线条宽度
   */
  const strokeWidth = () => split.strokeWidth || 3

  // 视图框大小
  const viewBoxSize = 16
  // 圆心坐标
  const center = viewBoxSize / 2
  
  /**
   * 获取圆环半径
   * @returns 圆环半径
   */
  const radius = () => center - strokeWidth() / 2
  
  /**
   * 计算圆环周长
   */
  const circumference = createMemo(() => 2 * Math.PI * radius())

  /**
   * 计算进度条偏移量
   * @returns 偏移量值
   */
  const offset = createMemo(() => {
    // 确保百分比在 0-100 之间
    const clampedPercentage = Math.max(0, Math.min(100, split.percentage || 0))
    const progress = clampedPercentage / 100
    // 计算偏移量，用于显示进度
    return circumference() * (1 - progress)
  })

  return (
    <svg
      {...rest}
      width={size()}
      height={size()}
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      fill="none"
      data-component="progress-circle"
      classList={{
        ...(split.classList ?? {}),
        [split.class ?? ""]: !!split.class,
      }}
    >
      {/* 背景圆环 */}
      <circle
        cx={center}
        cy={center}
        r={radius()}
        data-slot="progress-circle-background"
        stroke-width={strokeWidth()}
      />
      {/* 进度圆环 */}
      <circle
        cx={center}
        cy={center}
        r={radius()}
        data-slot="progress-circle-progress"
        stroke-width={strokeWidth()}
        stroke-dasharray={circumference().toString()}
        stroke-dashoffset={offset()}
      />
    </svg>
  )
}
