import { useTheme } from "../context/theme" // 主题上下文钩子，用于访问当前主题的颜色配置（如警告色、文字色等）
  // useTheme 是 TUI 框架提供的上下文钩子，用于在组件中获取当前激活的主题样式
  // 主题包含颜色配置，如 primary（主色）、secondary（次要色）、warning（警告色）、text（文字色）、textMuted（次要文字色）等

// 待办事项组件的属性接口定义
// 用于描述单个待办事项的显示状态和内容
export interface TodoItemProps {
  status: string // 待办事项的状态标识
    // 可能的取值：
    // - "completed": 已完成状态
    // - "in_progress": 进行中状态
    // - 其他值: 待办/默认状态
  content: string // 待办事项的文本内容
    // 显示待办事项的具体描述文字
}

// 待办事项列表项组件
// 用于在终端界面的待办事项列表中渲染单个待办事项
// 支持不同的状态显示（已完成、进行中、待办）和相应的颜色样式
export function TodoItem(props: TodoItemProps) {
  const { theme } = useTheme() // 获取当前主题的颜色配置

  // 返回待办事项的渲染结构
  return (
    // 使用水平方向布局的盒子组件
    // flexDirection="row" 指定子元素从左到右排列
    // gap={0} 设置子元素之间的间距为 0
    <box flexDirection="row" gap={0}>
      {/* 状态符号显示区域 */}
      {/* 使用 flexShrink={0} 防止状态符号被压缩，确保宽度固定 */}
      <text
        flexShrink={0} // 禁止收缩，保持固定宽度
        style={{ // 根据待办事项状态设置文字颜色
          fg: props.status === "in_progress" 
            ? theme.warning // 进行中状态使用警告色（通常是黄色/橙色）
            : theme.textMuted // 其他状态使用次要文字色（较暗的颜色）
        }}
      >
        {/* 根据状态显示不同的状态符号 */}
        [
          {props.status === "completed" 
            ? "✓" // 已完成状态显示勾选符号
            : props.status === "in_progress" 
              ? "•" // 进行中状态显示圆点符号
              : " " // 待办状态显示空格
          }
        ]{" "} {/* 在状态符号后面添加一个空格作为分隔 */}
      </text>

      {/* 待办事项内容显示区域 */}
      {/* 使用 flexGrow={1} 自动填充剩余空间 */}
      <text
        flexGrow={1} // 自动扩展以填满可用空间
        wrapMode="word" // 换行模式为按单词换行，保持单词完整性
        style={{ // 根据待办事项状态设置文字颜色
          fg: props.status === "in_progress" 
            ? theme.warning // 进行中状态使用警告色
            : theme.textMuted // 其他状态使用次要文字色
        }}
      >
        {/* 显示待办事项的具体内容文字 */}
        {props.content}
      </text>
    </box>
  )
}
