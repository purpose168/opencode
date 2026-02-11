import { Locale } from "@/util/locale" // 导入本地化工具，用于时间格式化等功能
import type { TextPart } from "@opencode-ai/sdk/v2" // 导入文本消息部分的类型定义
import { useSync } from "@tui/context/sync" // 导入同步上下文钩子，用于访问全局同步状态管理器
import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select" // 导入对话框选择组件及其选项类型定义
import { createMemo, onMount } from "solid-js" // 导入 Solid.js 核心函数：createMemo 用于创建派生值，onMount 用于组件挂载时的生命周期钩子
import type { PromptInfo } from "../../component/prompt/history" // 导入提示信息类型定义，包含输入文本和文件部分
import { useDialog } from "../../ui/dialog" // 导入对话框上下文钩子，用于控制对话框的显示和行为
import { DialogMessage } from "./dialog-message" // 导入消息操作对话框组件

/**
 * 时间线对话框组件
 *
 * 功能说明：
 * 1. 显示当前会话中的所有用户消息列表
 * 2. 允许用户选择一个消息查看详细操作
 * 3. 支持键盘导航（onMove 回调）
 * 4. 选中消息后显示消息操作对话框（回退、复制、分支等）
 *
 * 使用场景：
 * - 用户想要浏览会话中的所有用户消息
 * - 用户想要对某个消息执行特定操作（回退、复制、分支）
 * - 用户想要快速定位到某个消息点
 *
 * 组件特性：
 * - 使用 createMemo 自动追踪消息数据变化并更新选项列表
 * - 使用 onMount 在组件挂载时设置对话框尺寸
 * - 支持键盘导航（onMove 回调）
 * - 自动过滤非用户消息和合成消息
 * - 选中消息后替换为消息操作对话框
 * - 消息列表按时间倒序排列（最新消息在前）
 *
 * @param props - 组件属性对象
 * @param props.sessionID - 当前会话的唯一标识符，用于获取会话消息列表
 * @param props.onMove - 当用户使用键盘导航移动选项时的回调函数，接收选中的消息 ID
 * @param props.setPrompt - 可选的回调函数，用于设置提示内容（回退操作时使用）
 * @returns 返回一个对话框选择组件，显示会话时间线消息列表
 */
export function DialogTimeline(props: {
  sessionID: string // 当前会话的唯一标识符
  onMove: (messageID: string) => void // 当用户使用键盘导航移动选项时的回调函数，接收选中的消息 ID
  setPrompt?: (prompt: PromptInfo) => void // 可选的回调函数，用于设置提示内容（回退操作时使用）
}) {
  const sync = useSync() // 获取同步上下文实例，用于访问会话消息和消息部分的同步数据
  const dialog = useDialog() // 获取对话框上下文实例，用于控制对话框的尺寸和替换行为

  // 组件挂载时设置对话框尺寸为大尺寸，以便更好地显示消息列表
  onMount(() => {
    dialog.setSize("large") // 调用对话框上下文的 setSize 方法，将对话框设置为 "large" 尺寸
    // 说明：
    //   onMount：Solid.js 的生命周期钩子，在组件首次渲染到 DOM 后执行一次
    //   dialog.setSize：设置对话框的显示尺寸，可选值包括 "small"、"medium"、"large" 等
    //   "large"：大尺寸对话框，适合显示较长的消息列表和详细信息
    // 作用：确保对话框有足够的空间展示消息内容，提升用户体验
  })

  // 创建派生值，自动生成对话框选项列表
  // 当会话消息数据变化时，自动重新计算并更新选项列表
  const options = createMemo((): DialogSelectOption<string>[] => {
    // 第一步：获取当前会话的所有消息
    const messages = sync.data.message[props.sessionID] ?? []
    // 说明：
    //   sync.data.message：同步数据中的消息存储，键为会话 ID，值为消息数组
    //   props.sessionID：当前会话的唯一标识符
    //   ?? []：空值合并运算符，如果会话不存在则返回空数组
    // 消息数组结构：
    //   [{ id: string, role: "user" | "assistant", time: { created: number }, ... }, ...]
    // 每个消息包含：消息 ID、角色（用户/助手）、创建时间、内容部分引用等

    // 第二步：初始化选项结果数组
    const result = [] as DialogSelectOption<string>[]
    // 说明：
    //   DialogSelectOption<string>：选项类型，泛型参数 string 表示选项值为消息 ID
    //   as 类型断言：明确指定数组类型为对话框选项数组
    // 选项结构：
    //   {
    //     title: string,      // 选项标题，显示在对话框中
    //     value: string,      // 选项值，用于标识选中的消息
    //     footer: string,     // 选项底部信息，通常显示时间等元数据
    //     onSelect: Function  // 选中选项时的回调函数
    //   }

    // 第三步：遍历消息列表，为每个用户消息创建选项
    for (const message of messages) {
      // 跳过非用户消息，只显示用户消息
      if (message.role !== "user") continue
      // 说明：
      //   message.role：消息角色，可选值为 "user" 或 "assistant"
      //   continue：跳过当前循环，继续处理下一个消息
      // 原因：时间线对话框主要用于显示用户消息，方便用户选择要操作的消息
      // 助手消息通常是响应用户消息的结果，不需要单独显示在时间线中

      // 第四步：查找消息的文本部分
      const part = (sync.data.part[message.id] ?? []).find(
        (x) => x.type === "text" && !x.synthetic && !x.ignored,
      ) as TextPart
      // 说明：
      //   sync.data.part[message.id]：获取指定消息的所有部分（文本、文件等）
      //   ?? []：如果消息没有部分则返回空数组
      //   find()：查找满足条件的第一个部分
      //   条件说明：
      //     x.type === "text"：只查找文本类型的部分
      //     !x.synthetic：排除合成文本（如系统生成的提示）
      //     !x.ignored：排除被忽略的文本部分
      //   as TextPart：类型断言，确认为文本部分类型
      // 文本部分结构：
      //   { type: "text", text: string, synthetic: boolean, ignored: boolean, ... }

      // 如果没有找到有效的文本部分，跳过此消息
      if (!part) continue
      // 说明：
      //   !part：检查 part 是否为 undefined 或 null
      //   continue：跳过当前循环，继续处理下一个消息
      // 原因：没有文本内容的消息无法在时间线中显示，用户需要看到消息内容才能做出选择

      // 第五步：为有效消息创建对话框选项
      result.push({
        // 选项标题：显示消息文本内容，将换行符替换为空格以便单行显示
        title: part.text.replace(/\n/g, " "),
        // 说明：
        //   part.text：消息的原始文本内容
        //   replace(/\n/g, " ")：使用正则表达式将所有换行符替换为空格
        //   /\n/g：全局匹配换行符（g 标志表示全局替换）
        //   目的：使消息内容在单行中显示，避免对话框布局混乱
        // 示例："Hello\nWorld" → "Hello World"

        // 选项值：存储消息 ID，用于标识用户选择的消息
        value: message.id,
        // 说明：
        //   message.id：消息的唯一标识符
        //   用途：在 onSelect 回调中，通过此 ID 获取消息详情并显示操作对话框
        //   格式：通常是 UUID 或其他唯一字符串

        // 选项底部信息：显示消息创建时间
        footer: Locale.time(message.time.created),
        // 说明：
        //   message.time.created：消息创建的时间戳（毫秒）
        //   Locale.time()：本地化时间格式化函数，将时间戳转换为易读格式
        //   输出示例："2024-01-31 14:30"、"2小时前"、"刚刚" 等
        //   目的：帮助用户识别消息的时间顺序，选择合适的消息

        // 选中选项时的回调函数：显示消息操作对话框
        onSelect: (dialog) => {
          // 替换当前对话框为消息操作对话框
          dialog.replace(() => (
            <DialogMessage
              messageID={message.id} // 要操作的消息 ID
              sessionID={props.sessionID} // 当前会话 ID
              setPrompt={props.setPrompt} // 可选的提示设置回调
            />
          ))
          // 说明：
          //   dialog.replace：替换当前对话框为新的对话框
          //   参数：一个函数，返回要显示的新对话框组件
          //   DialogMessage：消息操作对话框组件，提供回退、复制、分支等操作
          //   参数说明：
          //     messageID：要操作的消息 ID
          //     sessionID：当前会话 ID
          //     setPrompt：可选的回调函数，用于设置提示内容（回退操作时使用）
          //   效果：
          //     - 关闭时间线对话框
          //     - 显示消息操作对话框
          //     - 用户可以选择对消息执行回退、复制或分支操作
        },
      })
    }

    // 第六步：反转选项列表，使最新消息显示在最前面
    result.reverse()
    // 说明：
    //   reverse()：原地反转数组顺序
    //   原因：用户通常希望看到最新的消息，方便快速定位
    //   示例：
    //     反转前：[消息1(最早), 消息2, 消息3, 消息4(最新)]
    //     反转后：[消息4(最新), 消息3, 消息2, 消息1(最早)]

    // 返回选项列表
    return result
  })

  // 返回对话框选择组件
  return <DialogSelect onMove={(option) => props.onMove(option.value)} title="Timeline" options={options()} />
  // 说明：
  //   DialogSelect：对话框选择组件，显示可选项列表
  //   参数说明：
  //     onMove：键盘导航时的回调函数
  //       - option：当前选中的选项对象
  //       - option.value：选项值（消息 ID）
  //       - props.onMove：调用父组件传入的回调，通知外部当前选中的消息 ID
  //     title：对话框标题，显示为 "Timeline"
  //     options：选项列表，通过调用 options() 获取派生值
  //   功能：
  //     - 显示消息列表，每条消息显示标题、内容和时间
  //     - 支持键盘上下箭头导航
  //     - 支持回车键确认选择
  //     - 支持鼠标点击选择
  //   用户体验：
  //     - 用户可以使用键盘快速浏览和选择消息
  //     - onMove 回调允许外部组件实时响应导航变化
  //     - 选择后显示消息操作对话框，提供更多操作选项
}
