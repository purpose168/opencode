import { TextAttributes } from "@opentui/core" // OpenTUI 核心库，提供文本属性枚举，用于设置文本样式（如粗体、斜体等）
import { useTheme } from "@tui/context/theme" // 主题上下文，用于访问当前主题的颜色配置（如文字色、背景色等）
import { For } from "solid-js" // Solid.js 核心函数，用于遍历渲染数组数据

// Logo 左侧部分的 ASCII 艺术字符数组
// 这是一个装饰性的 ASCII 字符画，用于显示 OpenCode 的品牌标识左侧部分
// 每个字符串代表一行字符，使用空格字符填充以保持对齐
const LOGO_LEFT = [
  `                   `, // 第一行：左侧空白区域，用于右对齐
  `█▀▀█ █▀▀█ █▀▀█ █▀▀▄`, // 第二行：ASCII 字符画 - OpenCode 的 "O" 字符
  `█░░█ █░░█ █▀▀▀ █░░█`, // 第三行：ASCII 字符画 - 字母 "C" 字符
  `▀▀▀▀ █▀▀▀ ▀▀▀▀ ▀  ▀`, // 第四行：ASCII 字符画 - 字母 "de" 字符
]

// Logo 右侧部分的 ASCII 艺术字符数组
// 这是装饰性的 ASCII 字符画，用于显示 OpenCode 的品牌标识右侧部分
// 右侧部分通常显示 "OpenCode" 文本的一部分，使用不同的字符样式
const LOGO_RIGHT = [
  `             ▄     `, // 第一行：顶部装饰线，带有下划线字符
  `█▀▀▀ █▀▀█ █▀▀█ █▀▀█`, // 第二行：ASCII 字符画 - "Open" 文本
  `█░░░ █░░█ █░░█ █▀▀▀`, // 第三行：ASCII 字符画 - "Code" 文本
  `▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀`, // 第四行：底部装饰线，使用方块字符
]

/**
 * Logo 组件
 * 在终端界面中显示 OpenCode 的品牌标识（ASCII 艺术字符画）
 * Logo 由左右两部分组成，使用不同的颜色和样式来增强视觉效果
 * 左侧部分使用较暗的颜色（textMuted），右侧部分使用主文字颜色并加粗
 */
export function Logo() {
  const { theme } = useTheme() // 获取当前主题的颜色配置

  // 返回包含 Logo ASCII 艺术字符的盒子组件
  return (
    <box>
      {/* 使用 For 组件遍历渲染 Logo 的每一行 */}
      <For each={LOGO_LEFT}>
        {/* 渲染每一行：包含左侧和右侧两部分 */}
        {(line, index) => (
          // 使用水平方向（row）的盒子布局，左右部分之间间隔 1 个字符
          <box flexDirection="row" gap={1}>
            {/* 左侧部分：使用主题的次要文字颜色，不可选择 */}
            <text fg={theme.textMuted} selectable={false}>
              {line}
            </text>
            {/* 右侧部分：使用主题的主要文字颜色，加粗显示，不可选择 */}
            <text fg={theme.text} attributes={TextAttributes.BOLD} selectable={false}>
              {LOGO_RIGHT[index()]}
            </text>
          </box>
        )}
      </For>
    </box>
  )
}
