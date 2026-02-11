/**
 * 加载动画组件
 * 显示一个由多个方块组成的加载动画，支持自定义样式
 */
import { ComponentProps, For } from "solid-js"

/** 外部方块索引集合 */
const outerIndices = new Set([0, 1, 2, 3, 4, 7, 8, 11, 12, 13, 14, 15])

/** 方块数组 */
const squares = Array.from({ length: 16 }, (_, i) => ({
  /** 方块ID */
  id: i,
  /** 方块X坐标 */
  x: (i % 4) * 4,
  /** 方块Y坐标 */
  y: Math.floor(i / 4) * 4,
  /** 动画延迟时间（秒） */
  delay: Math.random() * 1.5,
  /** 动画持续时间（秒） */
  duration: 1 + Math.random() * 1,
  /** 是否为外部方块 */
  outer: outerIndices.has(i),
}))

/**
 * 加载动画组件属性接口
 */
export interface SpinnerProps {
  /** 自定义 CSS 类名 */
  class?: string
  /** 自定义 CSS 类名对象 */
  classList?: ComponentProps<"div">["classList"]
}

/**
 * 加载动画组件
 * 显示一个由多个方块组成的加载动画
 */
export function Spinner(props: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 15 15"
      data-component="spinner"
      classList={{
        ...(props.classList ?? {}),
        [props.class ?? ""]: !!props.class,
      }}
      fill="currentColor"
    >
      <For each={squares}>
        {(square) => (
          <rect
            x={square.x}
            y={square.y}
            width="3"
            height="3"
            rx="1"
            style={{
              animation: `${square.outer ? "pulse-opacity-dim" : "pulse-opacity"} ${square.duration}s ease-in-out infinite`,
              "animation-delay": `${square.delay}s`,
            }}
          />
        )}
      </For>
    </svg>
  )
}
