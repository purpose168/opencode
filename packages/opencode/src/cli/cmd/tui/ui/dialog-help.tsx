import { TextAttributes } from "@opentui/core" // 导入文本属性类型，用于设置文本样式（如粗体）
import { useKeyboard } from "@opentui/solid" // 导入键盘事件钩子，用于处理键盘输入
import { useKeybind } from "@tui/context/keybind" // 导入快捷键上下文钩子，用于获取快捷键配置
import { useTheme } from "@tui/context/theme" // 导入主题上下文钩子，用于获取颜色和样式配置
import { useDialog } from "./dialog" // 导入对话框上下文钩子，用于管理对话框的显示和关闭

/**
 * DialogHelp 帮助对话框组件
 *
 * 功能说明：
 * - 显示一个简单的帮助对话框，包含帮助信息和操作提示
 * - 显示快捷键提示，告诉用户如何查看所有可用的操作和命令
 * - 支持键盘操作（回车键或 ESC 键关闭对话框）
 * - 支持鼠标点击确定按钮关闭对话框
 *
 * 使用场景：
 * - 用户需要查看帮助信息时
 * - 用户需要了解如何查看所有可用的操作和命令时
 * - 用户需要快速了解应用的基本操作时
 *
 * 组件特性：
 * - 使用 useKeyboard 监听键盘事件（回车键或 ESC 键关闭）
 * - 使用 useDialog 管理对话框的显示和关闭
 * - 使用 useTheme 获取主题颜色配置
 * - 使用 useKeybind 获取快捷键配置并显示快捷键提示
 * - 支持鼠标点击确定按钮
 * - 自动关闭对话框
 *
 * 返回值：
 * - 返回一个对话框布局组件，显示帮助信息和操作按钮
 */
export function DialogHelp() {
  const dialog = useDialog() // 获取对话框上下文，用于控制对话框的显示和关闭
  const { theme } = useTheme() // 获取主题配置对象，用于设置颜色和样式
  const keybind = useKeybind() // 获取快捷键配置对象，用于显示快捷键提示

  // 监听键盘事件，处理对话框关闭
  useKeyboard((evt) => {
    if (evt.name === "return" || evt.name === "escape") {
      // 如果按下回车键或 ESC 键
      dialog.clear() // 清除对话框，关闭对话框
    }
  })

  // 返回对话框布局组件
  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      {" "}
      // 对话框主容器：左右内边距为 2，子元素间距为 1{/* 标题栏：显示标题和关闭提示 */}
      <box flexDirection="row" justifyContent="space-between">
        {" "}
        // 标题栏容器：水平排列，两端对齐
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          {" "}
          // 标题文本：粗体样式，使用主题文本颜色 Help // 显示标题：帮助
        </text>
        <text fg={theme.textMuted}>esc/enter</text> {/* 关闭提示：使用静音色，显示 ESC 或回车键关闭 */}
      </box>
      {/* 帮助信息区域：显示快捷键提示 */}
      <box paddingBottom={1}>
        {" "}
        // 帮助信息容器：底部内边距为 1
        <text fg={theme.textMuted}>
          {" "}
          {/* 帮助文本：使用静音色 */}
          Press {keybind.print("command_list")} to see all available actions and commands in any context.{" "}
          {/* 显示快捷键提示：按快捷键查看所有可用的操作和命令 */}
        </text>
      </box>
      {/* 按钮区域：显示确定按钮 */}
      <box flexDirection="row" justifyContent="flex-end" paddingBottom={1}>
        {" "}
        // 按钮容器：水平排列，右对齐，底部内边距为 1
        <box
          paddingLeft={3} // 按钮左内边距为 3
          paddingRight={3} // 按钮右内边距为 3
          backgroundColor={theme.primary} // 按钮背景色：使用主题主色
          onMouseUp={() => dialog.clear()} // 鼠标释放事件处理：清除对话框，关闭对话框
        >
          <text fg={theme.selectedListItemText}>ok</text> {/* 确定按钮文本：使用主题选中列表文本颜色 */}
        </box>
      </box>
    </box>
  )
}
