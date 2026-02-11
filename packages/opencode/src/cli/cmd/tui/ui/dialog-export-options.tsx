import { TextareaRenderable, TextAttributes } from "@opentui/core" // 导入文本区域渲染接口和文本属性类型
import { useKeyboard } from "@opentui/solid" // 导入键盘事件钩子，用于处理键盘输入
import { onMount, Show } from "solid-js" // 导入 Solid.js 核心函数：生命周期钩子、条件渲染、JSX 类型
import { createStore } from "solid-js/store" // 导入 store 创建函数，用于管理本地状态
import { useTheme } from "../context/theme" // 导入主题上下文钩子，用于获取颜色和样式配置
import { useDialog, type DialogContext } from "./dialog" // 导入对话框上下文钩子和类型，用于管理对话框的显示和替换

/**
 * DialogExportOptionsProps 导出选项对话框组件属性类型定义
 *
 * 属性说明：
 * - defaultFilename: 默认文件名
 * - defaultThinking: 默认是否包含思考过程
 * - defaultToolDetails: 默认是否包含工具详情
 * - defaultAssistantMetadata: 默认是否包含助手元数据
 * - defaultOpenWithoutSaving: 默认是否不保存直接打开
 * - onConfirm: 可选的确认回调函数，传递导出选项对象
 * - onCancel: 可选的取消回调函数
 */
export type DialogExportOptionsProps = {
  defaultFilename: string // 默认文件名
  defaultThinking: boolean // 默认是否包含思考过程
  defaultToolDetails: boolean // 默认是否包含工具详情
  defaultAssistantMetadata: boolean // 默认是否包含助手元数据
  defaultOpenWithoutSaving: boolean // 默认是否不保存直接打开
  onConfirm?: (options: {
    // 可选的确认回调函数
    filename: string // 文件名
    thinking: boolean // 是否包含思考过程
    toolDetails: boolean // 是否包含工具详情
    assistantMetadata: boolean // 是否包含助手元数据
    openWithoutSaving: boolean // 是否不保存直接打开
  }) => void
  onCancel?: () => void // 可选的取消回调函数
}

/**
 * DialogExportOptions 导出选项对话框组件
 *
 * 功能说明：
 * - 显示导出选项对话框，包含文件名输入框和多个选项复选框
 * - 支持键盘操作（Tab 键切换焦点，空格键切换选项，回车键确认，ESC 键取消）
 * - 支持鼠标点击选项切换状态
 * - 自动聚焦到文件名输入框
 * - 根据当前焦点显示不同的操作提示
 *
 * 使用场景：
 * - 用户需要导出会话记录时
 * - 用户需要配置导出选项时（如文件名、是否包含思考过程等）
 *
 * 组件特性：
 * - 使用 createStore 管理选项状态和当前焦点
 * - 使用 useKeyboard 监听键盘事件（Tab 切换焦点，空格切换选项，回车确认）
 * - 使用 useDialog 管理对话框的显示和关闭
 * - 使用 useTheme 获取主题颜色配置
 * - 使用 Show 组件根据焦点显示不同的提示
 * - 使用 onMount 自动聚焦到文件名输入框
 * - 支持鼠标点击选项
 *
 * 参数说明：
 * - props: DialogExportOptionsProps 类型，包含默认值和回调函数
 *
 * 返回值：
 * - 返回一个对话框布局组件，显示文件名输入框和选项复选框
 */
export function DialogExportOptions(props: DialogExportOptionsProps) {
  const dialog = useDialog() // 获取对话框上下文，用于控制对话框的显示和关闭
  const { theme } = useTheme() // 获取主题配置对象，用于设置颜色和样式
  let textarea: TextareaRenderable // 定义文本区域引用变量

  // 创建本地状态存储，管理选项状态和当前焦点
  const [store, setStore] = createStore({
    thinking: props.defaultThinking, // 是否包含思考过程
    toolDetails: props.defaultToolDetails, // 是否包含工具详情
    assistantMetadata: props.defaultAssistantMetadata, // 是否包含助手元数据
    openWithoutSaving: props.defaultOpenWithoutSaving, // 是否不保存直接打开
    active: "filename" as "filename" | "thinking" | "toolDetails" | "assistantMetadata" | "openWithoutSaving", // 当前焦点，默认为文件名
  })

  // 监听键盘事件，处理焦点切换、选项切换和确认
  useKeyboard((evt) => {
    if (evt.name === "return") {
      // 如果按下回车键
      props.onConfirm?.({
        // 调用确认回调，传递当前选项
        filename: textarea.plainText, // 文件名（从文本区域获取）
        thinking: store.thinking, // 是否包含思考过程
        toolDetails: store.toolDetails, // 是否包含工具详情
        assistantMetadata: store.assistantMetadata, // 是否包含助手元数据
        openWithoutSaving: store.openWithoutSaving, // 是否不保存直接打开
      })
    }

    if (evt.name === "tab") {
      // 如果按下 Tab 键
      // 定义选项顺序
      const order: Array<"filename" | "thinking" | "toolDetails" | "assistantMetadata" | "openWithoutSaving"> = [
        "filename", // 文件名
        "thinking", // 思考过程
        "toolDetails", // 工具详情
        "assistantMetadata", // 助手元数据
        "openWithoutSaving", // 不保存直接打开
      ]
      const currentIndex = order.indexOf(store.active) // 获取当前焦点的索引
      const nextIndex = (currentIndex + 1) % order.length // 计算下一个焦点的索引（循环）
      setStore("active", order[nextIndex]) // 设置焦点到下一个选项
      evt.preventDefault() // 阻止默认行为（防止 Tab 键切换焦点）
    }

    if (evt.name === "space") {
      // 如果按下空格键
      // 切换当前焦点选项的状态
      if (store.active === "thinking") setStore("thinking", !store.thinking) // 切换思考过程选项
      if (store.active === "toolDetails") setStore("toolDetails", !store.toolDetails) // 切换工具详情选项
      if (store.active === "assistantMetadata") setStore("assistantMetadata", !store.assistantMetadata) // 切换助手元数据选项
      if (store.active === "openWithoutSaving") setStore("openWithoutSaving", !store.openWithoutSaving) // 切换不保存直接打开选项
      evt.preventDefault() // 阻止默认行为（防止空格键输入空格）
    }
  })

  // 组件挂载时的初始化逻辑
  onMount(() => {
    dialog.setSize("medium") // 设置对话框尺寸为中等
    setTimeout(() => {
      // 延迟执行，确保 DOM 已更新
      textarea.focus() // 聚焦到文本区域
    }, 1)
    textarea.gotoLineEnd() // 移动光标到行尾
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
          // 标题文本：粗体样式，使用主题文本颜色 Export Options // 显示标题：导出选项
        </text>
        <text fg={theme.textMuted}>esc</text> {/* ESC 取消提示：使用静音色 */}
      </box>
      {/* 文件名输入区域 */}
      <box gap={1}>
        {" "}
        // 文件名容器：子元素间距为 1
        <box>
          {" "}
          // 文件名标签容器
          <text fg={theme.text}>Filename:</text> {/* 文件名标签：使用主题文本颜色 */}
        </box>
        <textarea
          onSubmit={() => {
            // 提交事件处理
            props.onConfirm?.({
              // 调用确认回调，传递当前选项
              filename: textarea.plainText, // 文件名（从文本区域获取）
              thinking: store.thinking, // 是否包含思考过程
              toolDetails: store.toolDetails, // 是否包含工具详情
              assistantMetadata: store.assistantMetadata, // 是否包含助手元数据
              openWithoutSaving: store.openWithoutSaving, // 是否不保存直接打开
            })
          }}
          height={3} // 文本区域高度为 3 行
          keyBindings={[{ name: "return", action: "submit" }]} // 键盘绑定：回车键提交
          ref={(val: TextareaRenderable) => (textarea = val)} // 设置文本区域引用
          initialValue={props.defaultFilename} // 初始值为默认文件名
          placeholder="Enter filename" // 占位符文本
          textColor={theme.text} // 文本颜色：使用主题文本颜色
          focusedTextColor={theme.text} // 聚焦时文本颜色：使用主题文本颜色
          cursorColor={theme.text} // 光标颜色：使用主题文本颜色
        />
      </box>
      {/* 选项复选框区域 */}
      <box flexDirection="column">
        {" "}
        // 选项容器：垂直排列
        {/* 思考过程选项 */}
        <box
          flexDirection="row" // 水平排列
          gap={2} // 子元素间距为 2
          paddingLeft={1} // 左内边距为 1
          backgroundColor={store.active === "thinking" ? theme.backgroundElement : undefined} // 背景色：当前焦点时使用主题背景元素色
          onMouseUp={() => setStore("active", "thinking")} // 鼠标释放时设置焦点到思考过程选项
        >
          <text fg={store.active === "thinking" ? theme.primary : theme.textMuted}>
            {" "}
            {/* 复选框文本颜色：当前焦点时使用主题主色，否则使用静音色 */}
            {store.thinking ? "[x]" : "[ ]"} {/* 复选框状态：选中显示 [x]，未选中显示 [ ] */}
          </text>
          <text fg={store.active === "thinking" ? theme.primary : theme.text}>
            {" "}
            {/* 选项文本颜色：当前焦点时使用主题主色，否则使用主题文本颜色 */}
            Include thinking {/* 选项文本：包含思考过程 */}
          </text>
        </box>
        {/* 工具详情选项 */}
        <box
          flexDirection="row" // 水平排列
          gap={2} // 子元素间距为 2
          paddingLeft={1} // 左内边距为 1
          backgroundColor={store.active === "toolDetails" ? theme.backgroundElement : undefined} // 背景色：当前焦点时使用主题背景元素色
          onMouseUp={() => setStore("active", "toolDetails")} // 鼠标释放时设置焦点到工具详情选项
        >
          <text fg={store.active === "toolDetails" ? theme.primary : theme.textMuted}>
            {" "}
            {/* 复选框文本颜色：当前焦点时使用主题主色，否则使用静音色 */}
            {store.toolDetails ? "[x]" : "[ ]"} {/* 复选框状态：选中显示 [x]，未选中显示 [ ] */}
          </text>
          <text fg={store.active === "toolDetails" ? theme.primary : theme.text}>
            {" "}
            {/* 选项文本颜色：当前焦点时使用主题主色，否则使用主题文本颜色 */}
            Include tool details {/* 选项文本：包含工具详情 */}
          </text>
        </box>
        {/* 助手元数据选项 */}
        <box
          flexDirection="row" // 水平排列
          gap={2} // 子元素间距为 2
          paddingLeft={1} // 左内边距为 1
          backgroundColor={store.active === "assistantMetadata" ? theme.backgroundElement : undefined} // 背景色：当前焦点时使用主题背景元素色
          onMouseUp={() => setStore("active", "assistantMetadata")} // 鼠标释放时设置焦点到助手元数据选项
        >
          <text fg={store.active === "assistantMetadata" ? theme.primary : theme.textMuted}>
            {" "}
            {/* 复选框文本颜色：当前焦点时使用主题主色，否则使用静音色 */}
            {store.assistantMetadata ? "[x]" : "[ ]"} {/* 复选框状态：选中显示 [x]，未选中显示 [ ] */}
          </text>
          <text fg={store.active === "assistantMetadata" ? theme.primary : theme.text}>
            {" "}
            {/* 选项文本颜色：当前焦点时使用主题主色，否则使用主题文本颜色 */}
            Include assistant metadata {/* 选项文本：包含助手元数据 */}
          </text>
        </box>
        {/* 不保存直接打开选项 */}
        <box
          flexDirection="row" // 水平排列
          gap={2} // 子元素间距为 2
          paddingLeft={1} // 左内边距为 1
          backgroundColor={store.active === "openWithoutSaving" ? theme.backgroundElement : undefined} // 背景色：当前焦点时使用主题背景元素色
          onMouseUp={() => setStore("active", "openWithoutSaving")} // 鼠标释放时设置焦点到不保存直接打开选项
        >
          <text fg={store.active === "openWithoutSaving" ? theme.primary : theme.textMuted}>
            {" "}
            {/* 复选框文本颜色：当前焦点时使用主题主色，否则使用静音色 */}
            {store.openWithoutSaving ? "[x]" : "[ ]"} {/* 复选框状态：选中显示 [x]，未选中显示 [ ] */}
          </text>
          <text fg={store.active === "openWithoutSaving" ? theme.primary : theme.text}>
            {" "}
            {/* 选项文本颜色：当前焦点时使用主题主色，否则使用主题文本颜色 */}
            Open without saving {/* 选项文本：不保存直接打开 */}
          </text>
        </box>
      </box>
      {/* 操作提示：选项焦点时显示 */}
      <Show when={store.active !== "filename"}>
        {" "}
        {/* 只在焦点不在文件名时显示 */}
        <text fg={theme.textMuted} paddingBottom={1}>
          {" "}
          {/* 提示文本：使用静音色，底部内边距为 1 */}
          Press <span style={{ fg: theme.text }}>space</span> to toggle, <span style={{ fg: theme.text }}>return</span>{" "}
          {/* 按空格键切换，按回车键确认 */}
          to confirm {/* 确认 */}
        </text>
      </Show>
      {/* 操作提示：文件名焦点时显示 */}
      <Show when={store.active === "filename"}>
        {" "}
        {/* 只在焦点在文件名时显示 */}
        <text fg={theme.textMuted} paddingBottom={1}>
          {" "}
          {/* 提示文本：使用静音色，底部内边距为 1 */}
          Press <span style={{ fg: theme.text }}>return</span> to confirm, <span style={{ fg: theme.text }}>tab</span>{" "}
          {/* 按回车键确认，按 Tab 键 */}
          for options {/* 切换到选项 */}
        </text>
      </Show>
    </box>
  )
}

/**
 * DialogExportOptions.show 静态方法：显示导出选项对话框
 *
 * 功能说明：
 * - 创建并显示一个导出选项对话框
 * - 返回一个 Promise，用户确认时 resolve 导出选项对象，取消或关闭对话框时 resolve(null)
 * - 自动处理对话框的替换和清理
 *
 * 使用场景：
 * - 需要显示导出选项对话框并等待用户响应时
 * - 需要在用户确认后使用导出选项执行导出操作时
 *
 * 参数说明：
 * - dialog: DialogContext 类型，对话框上下文对象
 * - defaultFilename: string 类型，默认文件名
 * - defaultThinking: boolean 类型，默认是否包含思考过程
 * - defaultToolDetails: boolean 类型，默认是否包含工具详情
 * - defaultAssistantMetadata: boolean 类型，默认是否包含助手元数据
 * - defaultOpenWithoutSaving: boolean 类型，默认是否不保存直接打开
 *
 * 返回值：
 * - 返回一个 Promise，用户确认时 resolve 导出选项对象，取消或关闭对话框时 resolve(null)
 */
DialogExportOptions.show = (
  dialog: DialogContext, // 对话框上下文对象
  defaultFilename: string, // 默认文件名
  defaultThinking: boolean, // 默认是否包含思考过程
  defaultToolDetails: boolean, // 默认是否包含工具详情
  defaultAssistantMetadata: boolean, // 默认是否包含助手元数据
  defaultOpenWithoutSaving: boolean, // 默认是否不保存直接打开
) => {
  return new Promise<{
    // 创建一个 Promise，返回导出选项对象或 null
    filename: string // 文件名
    thinking: boolean // 是否包含思考过程
    toolDetails: boolean // 是否包含工具详情
    assistantMetadata: boolean // 是否包含助手元数据
    openWithoutSaving: boolean // 是否不保存直接打开
  } | null>((resolve) => {
    // resolve 类型为导出选项对象或 null
    dialog.replace(
      // 替换当前对话框为新的导出选项对话框
      () => (
        <DialogExportOptions
          defaultFilename={defaultFilename} // 设置默认文件名
          defaultThinking={defaultThinking} // 设置默认是否包含思考过程
          defaultToolDetails={defaultToolDetails} // 设置默认是否包含工具详情
          defaultAssistantMetadata={defaultAssistantMetadata} // 设置默认是否包含助手元数据
          defaultOpenWithoutSaving={defaultOpenWithoutSaving} // 设置默认是否不保存直接打开
          onConfirm={(options) => resolve(options)} // 用户确认时 resolve 导出选项对象
          onCancel={() => resolve(null)} // 用户取消时 resolve(null)
        />
      ),
      () => resolve(null), // 对话框关闭时也 resolve(null)
    )
  })
}
