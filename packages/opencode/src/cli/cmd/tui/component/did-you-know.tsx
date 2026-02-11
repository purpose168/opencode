import { useKeybind } from "@tui/context/keybind" // 快捷键上下文，用于获取快捷键绑定的显示文本
import { useTheme } from "@tui/context/theme" // 主题上下文，用于访问当前主题的颜色和样式配置
import { createMemo, createSignal, For } from "solid-js" // Solid.js 核心函数：创建派生值、创建信号、循环渲染
import { EmptyBorder } from "./border" // 空边框样式常量，用于自定义边框字符
import { TIPS } from "./tips" // 提示词数据，包含各种小提示内容

// 提示词部分的类型定义
type TipPart = {
  text: string // 部分文本内容
  highlight: boolean // 是否高亮显示
}

/**
 * 解析提示词字符串，将高亮标记转换为 TipPart 数组
 * 支持使用 {highlight}...{/highlight} 标签来高亮显示部分文本
 *
 * @param tip - 原始提示词字符串，包含可能的高亮标记
 * @returns 解析后的 TipPart 数组，每个部分包含文本内容和是否高亮
 */
function parseTip(tip: string): TipPart[] {
  const parts: TipPart[] = [] // 存储解析后的部分
  const regex = /\{highlight\}(.*?)\{\/highlight\}/g // 高亮标记的正则表达式
  let lastIndex = 0 // 上一次处理到的位置
  let match // 当前匹配结果

  // 遍历所有高亮标记匹配
  while ((match = regex.exec(tip)) !== null) {
    // 如果匹配位置在当前位置之后，将中间的非高亮文本作为一部分
    if (match.index > lastIndex) {
      parts.push({ text: tip.slice(lastIndex, match.index), highlight: false })
    }
    // 将高亮标记内的文本作为高亮部分
    parts.push({ text: match[1], highlight: true })
    lastIndex = regex.lastIndex // 更新当前位置
  }

  // 处理最后剩余的非高亮文本
  if (lastIndex < tip.length) {
    parts.push({ text: tip.slice(lastIndex), highlight: false })
  }

  return parts // 返回解析后的部分数组
}

// 创建当前提示词索引的信号，用于跟踪当前显示的提示词
const [tipIndex, setTipIndex] = createSignal(Math.floor(Math.random() * TIPS.length))

/**
 * 随机化提示词索引，显示新的随机提示词
 * 用于每次启动时或用户请求时切换到不同的提示词
 */
export function randomizeTip() {
  setTipIndex(Math.floor(Math.random() * TIPS.length))
}

// 提示词盒子宽度常量
const BOX_WIDTH = 42
// 提示词盒子标题
const TITLE = " 🅘 Did you know? "

/**
 * "Did You Know" 提示词组件
 * 在终端界面的右下角显示一个带有提示词的盒子
 * 支持高亮显示部分文本内容，并显示快捷键提示
 */
export function DidYouKnow() {
  const { theme } = useTheme() // 获取主题配置，用于设置颜色样式
  const keybind = useKeybind() // 获取快捷键配置

  // 创建提示词部分的派生值，当索引变化时自动重新解析
  const tipParts = createMemo(() => parseTip(TIPS[tipIndex()]))

  // 计算短横线数量的派生值，用于填充标题两侧
  const dashes = createMemo(() => {
    // 计算公式：╭─ + title + ─...─ + ╮ = BOX_WIDTH
    // 1 + 1 + title.length + dashes + 1 = BOX_WIDTH
    return Math.max(0, BOX_WIDTH - 2 - TITLE.length - 1)
  })

  // 返回提示词盒子组件
  return (
    // 绝对定位的盒子组件，位于底部右侧
    <box position="absolute" bottom={3} right={2} width={BOX_WIDTH}>
      {/* 标题行：包含左侧边框、标题文本、右侧边框 */}
      <text>
        <span style={{ fg: theme.border }}>╭─</span>
        <span style={{ fg: theme.text }}>{TITLE}</span>
        <span style={{ fg: theme.border }}>{"─".repeat(dashes())}╮</span>
      </text>
      {/* 主体盒子：包含提示词内容 */}
      <box
        border={["left", "right", "bottom"]} // 只显示左、右、底边框
        borderColor={theme.border} // 边框颜色使用主题的边框色
        customBorderChars={{
          // 使用自定义边框字符覆盖默认样式
          ...EmptyBorder, // 继承空边框的默认字符
          bottomLeft: "╰", // 左下角使用特殊字符
          bottomRight: "╯", // 右下角使用特殊字符
          horizontal: "─", // 水平边框使用横线字符
          vertical: "│", // 垂直边框使用竖线字符
        }}
      >
        {/* 内边距盒子，包含实际提示词文本 */}
        <box paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
          <text>
            {/* 遍历渲染提示词的每个部分，支持高亮显示 */}
            <For each={tipParts()}>
              {(part) => (
                // 根据部分是否高亮使用不同的前景色
                <span style={{ fg: part.highlight ? theme.text : theme.textMuted }}>{part.text}</span>
              )}
            </For>
          </text>
        </box>
      </box>
      {/* 底部快捷键提示行 */}
      <box flexDirection="row" justifyContent="flex-end">
        <text>
          {/* 显示切换提示词的快捷键 */}
          <span style={{ fg: theme.text }}>{keybind.print("tips_toggle")}</span>
          {/* 快捷键说明文本 */}
          <span style={{ fg: theme.textMuted }}> hide tips</span>
        </text>
      </box>
    </box>
  )
}
