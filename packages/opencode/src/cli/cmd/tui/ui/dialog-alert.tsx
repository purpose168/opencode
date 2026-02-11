import { TextAttributes } from "@opentui/core" // 导入文本属性类型，用于设置文本样式（如粗体）
import { useKeyboard } from "@opentui/solid" // 导入键盘事件钩子，用于处理键盘输入
import { useTheme } from "../context/theme" // 导入主题上下文钩子，用于获取颜色和样式配置
import { useDialog, type DialogContext } from "./dialog" // 导入对话框上下文钩子和类型，用于管理对话框的显示和替换

/**
 * DialogAlertProps 对话框警告组件属性类型定义
 *
 * 属性说明：
 * - title: 对话框标题文本
 * - message: 对话框消息内容
 * - onConfirm: 可选的确认回调函数，用户点击确定或按回车键时调用
 */
export type DialogAlertProps = {
  title: string // 对话框标题文本
  message: string // 对话框消息内容
  onConfirm?: () => void // 可选的确认回调函数
}

/**
 * DialogAlert 对话框警告组件
 *
 * 功能说明：
 * - 显示一个简单的确认对话框，包含标题、消息和确定按钮
 * - 支持键盘操作（回车键确认，ESC 键关闭）
 * - 支持鼠标点击确定按钮确认
 * - 自动关闭对话框并调用确认回调
 *
 * 使用场景：
 * - 需要用户确认操作时（如删除文件、退出应用等）
 * - 显示重要提示信息时
 * - 需要用户明确响应时
 *
 * 组件特性：
 * - 使用 useKeyboard 监听键盘事件（回车键确认）
 * - 使用 useDialog 管理对话框的显示和关闭
 * - 使用 useTheme 获取主题颜色配置
 * - 支持鼠标点击确定按钮
 * - 自动关闭对话框
 *
 * 参数说明：
 * - props: DialogAlertProps 类型，包含 title、message 和可选的 onConfirm 回调
 *
 * 返回值：
 * - 返回一个对话框布局组件，显示标题、消息和确定按钮
 */
export function DialogAlert(props: DialogAlertProps) {
  const dialog = useDialog() // 获取对话框上下文，用于控制对话框的显示和关闭
  const { theme } = useTheme() // 获取主题配置对象，用于设置颜色和样式

  // 监听键盘事件，处理回车键确认
  useKeyboard((evt) => {
    if (evt.name === "return") {
      // 如果按下回车键
      props.onConfirm?.() // 调用确认回调函数（如果存在）
      dialog.clear() // 清除对话框，关闭对话框
    }
  })

  // 返回对话框布局组件
  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      {" "}
      // 对话框主容器：左右内边距为 2，子元素间距为 1{/* 标题栏：显示标题和 ESC 关闭提示 */}
      <box flexDirection="row" justifyContent="space-between">
        {" "}
        // 标题栏容器：水平排列，两端对齐
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          {" "}
          // 标题文本：粗体样式，使用主题文本颜色
          {props.title} {/* 显示标题 */}
        </text>
        <text fg={theme.textMuted}>esc</text> {/* ESC 关闭提示：使用静音色 */}
      </box>
      {/* 消息区域：显示对话框消息 */}
      <box paddingBottom={1}>
        {" "}
        // 消息容器：底部内边距为 1<text fg={theme.textMuted}>{props.message}</text> {/* 消息文本：使用静音色 */}
      </box>
      {/* 按钮区域：显示确定按钮 */}
      <box flexDirection="row" justifyContent="flex-end" paddingBottom={1}>
        {" "}
        // 按钮容器：水平排列，右对齐，底部内边距为 1
        <box
          paddingLeft={3} // 按钮左内边距为 3
          paddingRight={3} // 按钮右内边距为 3
          backgroundColor={theme.primary} // 按钮背景色：使用主题主色
          onMouseUp={() => {
            // 鼠标释放事件处理
            props.onConfirm?.() // 调用确认回调函数（如果存在）
            dialog.clear() // 清除对话框，关闭对话框
          }}
        >
          <text fg={theme.selectedListItemText}>确定</text> {/* 确定按钮文本：使用主题选中列表文本颜色 */}
        </box>
      </box>
    </box>
  )
}

/**
 * DialogAlert.show 静态方法：显示对话框警告
 *
 * 功能说明：
 * - 创建并显示一个对话框警告
 * - 返回一个 Promise，在用户确认或关闭对话框时 resolve
 * - 自动处理对话框的替换和清理
 *
 * 使用场景：
 * - 需要显示确认对话框并等待用户响应时
 * - 需要在用户确认后执行后续操作时
 *
 * 参数说明：
 * - dialog: DialogContext 类型，对话框上下文对象
 * - title: string 类型，对话框标题
 * - message: string 类型，对话框消息
 *
 * 返回值：
 * - 返回一个 Promise<void>，在用户确认或关闭对话框时 resolve
 */
DialogAlert.show = (dialog: DialogContext, title: string, message: string) => {
  return new Promise<void>((resolve) => {
    // 创建一个 Promise
    dialog.replace(
      // 替换当前对话框为新的警告对话框
      () => <DialogAlert title={title} message={message} onConfirm={() => resolve()} />, // 创建对话框组件，确认时 resolve Promise
      () => resolve(), // 对话框关闭时也 resolve Promise
    )
  })
}
