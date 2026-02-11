import { Locale } from "@/util/locale" // 导入本地化工具，用于文本格式化
import { TextAttributes } from "@opentui/core" // 导入文本属性类型，用于设置文本样式（如粗体）
import { useKeyboard } from "@opentui/solid" // 导入键盘事件钩子，用于处理键盘输入
import { For } from "solid-js" // 导入 For 组件，用于遍历数组渲染列表
import { createStore } from "solid-js/store" // 导入 store 创建函数，用于管理本地状态
import { useTheme } from "../context/theme" // 导入主题上下文钩子，用于获取颜色和样式配置
import { useDialog, type DialogContext } from "./dialog" // 导入对话框上下文钩子和类型，用于管理对话框的显示和替换

/**
 * DialogConfirmProps 对话框确认组件属性类型定义
 *
 * 属性说明：
 * - title: 对话框标题文本
 * - message: 对话框消息内容
 * - onConfirm: 可选的确认回调函数，用户点击确认按钮或按回车键且当前选中确认按钮时调用
 * - onCancel: 可选的取消回调函数，用户点击取消按钮或按回车键且当前选中取消按钮时调用
 */
export type DialogConfirmProps = {
  title: string // 对话框标题文本
  message: string // 对话框消息内容
  onConfirm?: () => void // 可选的确认回调函数
  onCancel?: () => void // 可选的取消回调函数
}

/**
 * DialogConfirm 对话框确认组件
 *
 * 功能说明：
 * - 显示一个确认对话框，包含标题、消息和确认/取消按钮
 * - 支持键盘操作（左右方向键切换按钮，回车键确认，ESC 键取消）
 * - 支持鼠标点击按钮确认或取消
 * - 自动关闭对话框并调用相应的回调函数
 * - 当前选中的按钮会高亮显示
 *
 * 使用场景：
 * - 需要用户确认或取消操作时（如删除文件、保存更改等）
 * - 需要用户在两个选项之间做出选择时
 * - 需要用户明确响应时
 *
 * 组件特性：
 * - 使用 createStore 管理当前选中的按钮状态
 * - 使用 useKeyboard 监听键盘事件（左右方向键切换，回车键确认）
 * - 使用 useDialog 管理对话框的显示和关闭
 * - 使用 useTheme 获取主题颜色配置
 * - 使用 For 组件遍历渲染按钮列表
 * - 支持鼠标点击按钮
 * - 自动关闭对话框
 *
 * 参数说明：
 * - props: DialogConfirmProps 类型，包含 title、message 和可选的 onConfirm/onCancel 回调
 *
 * 返回值：
 * - 返回一个对话框布局组件，显示标题、消息和确认/取消按钮
 */
export function DialogConfirm(props: DialogConfirmProps) {
  const dialog = useDialog() // 获取对话框上下文，用于控制对话框的显示和关闭
  const { theme } = useTheme() // 获取主题配置对象，用于设置颜色和样式

  // 创建本地状态存储，管理当前选中的按钮
  const [store, setStore] = createStore({
    active: "confirm" as "confirm" | "cancel", // 当前选中的按钮，默认为确认按钮
  })

  // 监听键盘事件，处理按钮切换和确认
  useKeyboard((evt) => {
    if (evt.name === "return") {
      // 如果按下回车键
      if (store.active === "confirm") props.onConfirm?.() // 如果当前选中确认按钮，调用确认回调
      if (store.active === "cancel") props.onCancel?.() // 如果当前选中取消按钮，调用取消回调
      dialog.clear() // 清除对话框，关闭对话框
    }

    if (evt.name === "left" || evt.name === "right") {
      // 如果按下左或右方向键
      setStore("active", store.active === "confirm" ? "cancel" : "confirm") // 切换当前选中的按钮
    }
  })

  // 返回对话框布局组件
  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      {" "}
      // 对话框主容器：左右内边距为 2，子元素间距为 1{/* 标题栏：显示标题和 ESC 取消提示 */}
      <box flexDirection="row" justifyContent="space-between">
        {" "}
        // 标题栏容器：水平排列，两端对齐
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          {" "}
          // 标题文本：粗体样式，使用主题文本颜色
          {props.title} {/* 显示标题 */}
        </text>
        <text fg={theme.textMuted}>esc</text> {/* ESC 取消提示：使用静音色 */}
      </box>
      {/* 消息区域：显示对话框消息 */}
      <box paddingBottom={1}>
        {" "}
        // 消息容器：底部内边距为 1<text fg={theme.textMuted}>{props.message}</text> {/* 消息文本：使用静音色 */}
      </box>
      {/* 按钮区域：显示取消和确认按钮 */}
      <box flexDirection="row" justifyContent="flex-end" paddingBottom={1}>
        {" "}
        // 按钮容器：水平排列，右对齐，底部内边距为 1
        <For each={["cancel", "confirm"]}>
          {(key) => (
            <box
              paddingLeft={1} // 按钮左内边距为 1
              paddingRight={1} // 按钮右内边距为 1
              backgroundColor={key === store.active ? theme.primary : undefined} // 按钮背景色：当前选中按钮使用主题主色，否则无背景色
              onMouseUp={(evt) => {
                // 鼠标释放事件处理
                if (key === "confirm") props.onConfirm?.() // 如果点击确认按钮，调用确认回调
                if (key === "cancel") props.onCancel?.() // 如果点击取消按钮，调用取消回调
                dialog.clear() // 清除对话框，关闭对话框
              }}
            >
              <text fg={key === store.active ? theme.selectedListItemText : theme.textMuted}>
                {" "}
                {/* 按钮文本颜色：当前选中按钮使用主题选中列表文本颜色，否则使用静音色 */}
                {Locale.titlecase(key)} {/* 显示按钮文本（首字母大写） */}
              </text>
            </box>
          )}
        </For>
      </box>
    </box>
  )
}

/**
 * DialogConfirm.show 静态方法：显示对话框确认
 *
 * 功能说明：
 * - 创建并显示一个确认对话框
 * - 返回一个 Promise<boolean>，用户确认时 resolve(true)，取消或关闭对话框时 resolve(false)
 * - 自动处理对话框的替换和清理
 *
 * 使用场景：
 * - 需要显示确认对话框并等待用户响应时
 * - 需要在用户确认或取消后执行不同的后续操作时
 *
 * 参数说明：
 * - dialog: DialogContext 类型，对话框上下文对象
 * - title: string 类型，对话框标题
 * - message: string 类型，对话框消息
 *
 * 返回值：
 * - 返回一个 Promise<boolean>，用户确认时 resolve(true)，取消或关闭对话框时 resolve(false)
 */
DialogConfirm.show = (dialog: DialogContext, title: string, message: string) => {
  return new Promise<boolean>((resolve) => {
    // 创建一个 Promise，返回布尔值
    dialog.replace(
      // 替换当前对话框为新的确认对话框
      () => (
        <DialogConfirm
          title={title} // 设置对话框标题
          message={message} // 设置对话框消息
          onConfirm={() => resolve(true)} // 用户确认时 resolve(true)
          onCancel={() => resolve(false)} // 用户取消时 resolve(false)
        />
      ),
      () => resolve(false), // 对话框关闭时也 resolve(false)
    )
  })
}
