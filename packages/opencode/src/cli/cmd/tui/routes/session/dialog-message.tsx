import type { PromptInfo } from "@tui/component/prompt/history" // 导入提示信息类型定义，包含输入文本和文件部分
import { useRoute } from "@tui/context/route" // 导入路由上下文钩子，用于页面导航
import { useSDK } from "@tui/context/sdk" // 导入 SDK 上下文钩子，用于访问 API 客户端
import { useSync } from "@tui/context/sync" // 导入同步上下文钩子，用于访问全局同步状态管理器
import { DialogSelect } from "@tui/ui/dialog-select" // 导入对话框选择组件
import { Clipboard } from "@tui/util/clipboard" // 导入剪贴板工具，用于复制文本到系统剪贴板
import { createMemo } from "solid-js" // 导入 Solid.js 核心函数：createMemo 用于创建派生值

/**
 * 消息操作对话框组件
 *
 * 功能说明：
 * 1. 显示指定消息的操作选项列表
 * 2. 支持三种主要操作：回退、复制、分支
 * 3. 回退操作：撤销消息及其相关的文件更改，并恢复提示内容
 * 4. 复制操作：将消息的文本内容复制到系统剪贴板
 * 5. 分支操作：从当前消息创建新的会话分支
 *
 * 使用场景：
 * - 用户想要撤销某个消息及其后续的所有更改
 * - 用户想要复制消息的文本内容到剪贴板
 * - 用户想要从某个消息点创建新的对话分支
 *
 * 组件特性：
 * - 使用 createMemo 自动追踪消息数据变化
 * - 支持异步操作（复制、分支）
 * - 可选的提示恢复功能（通过 setPrompt 回调）
 * - 自动构建初始提示信息（包含文本和文件部分）
 *
 * @param props - 组件属性对象
 * @param props.messageID - 要操作的消息的唯一标识符
 * @param props.sessionID - 当前会话的唯一标识符
 * @param props.setPrompt - 可选的回调函数，用于设置提示内容（回退操作时使用）
 * @returns 返回一个对话框选择组件，显示消息操作选项列表
 */
export function DialogMessage(props: {
  messageID: string // 要操作的消息的唯一标识符
  sessionID: string // 当前会话的唯一标识符
  setPrompt?: (prompt: PromptInfo) => void // 可选的回调函数，用于设置提示内容（回退操作时使用）
}) {
  const sync = useSync() // 获取同步上下文实例，用于访问消息和消息部分的同步数据
  const sdk = useSDK() // 获取 SDK 上下文实例，用于调用 API 客户端
  const message = createMemo(() => sync.data.message[props.sessionID]?.find((x) => x.id === props.messageID)) // 创建派生值，自动获取指定消息对象
  // 说明：
  //   sync.data.message[props.sessionID]：获取指定会话的所有消息数组
  //   ?.find((x) => x.id === props.messageID)：在消息数组中查找 ID 匹配的消息
  //   createMemo：创建派生值，当会话消息数据变化时自动重新计算
  //   返回值：匹配的消息对象，如果未找到则返回 undefined
  const route = useRoute() // 获取路由上下文实例，用于页面导航

  // 返回对话框选择组件，显示消息操作选项列表
  return (
    <DialogSelect
      title="Message Actions" // 对话框标题，显示为 "Message Actions"
      options={[
        // 选项列表，包含三个主要操作：回退、复制、分支
        {
          // 选项 1：回退操作
          title: "Revert", // 选项标题，显示为 "Revert"
          value: "session.revert", // 选项值，用于标识回退操作
          description: "undo messages and file changes", // 选项描述，说明此操作会撤销消息和文件更改
          onSelect: (dialog) => {
            // 选中选项时的回调函数
            // 第一步：获取当前消息对象
            const msg = message() // 调用派生值函数获取消息对象
            if (!msg) return // 如果消息不存在，直接返回（防御性编程）

            // 第二步：调用 SDK API 执行回退操作
            sdk.client.session.revert({
              // 调用会话回退 API
              sessionID: props.sessionID, // 当前会话 ID
              messageID: msg.id, // 要回退到的消息 ID
            })
            // 说明：
            //   sdk.client.session.revert：SDK 提供的会话回退方法
            //   回退效果：
            //     - 撤销指定消息之后的所有消息
            //     - 撤销相关的文件更改
            //     - 恢复到指定消息的状态
            //   参数说明：
            //     sessionID：要回退的会话 ID
            //     messageID：回退的目标消息 ID，此消息及其之前的消息将被保留

            // 第三步：如果提供了 setPrompt 回调，则恢复提示内容
            if (props.setPrompt) {
              // 检查是否提供了 setPrompt 回调函数
              const parts = sync.data.part[msg.id] // 获取消息的所有部分（文本、文件等）
              const promptInfo = parts.reduce(
                // 使用 reduce 方法合并所有部分为提示信息
                (agg, part) => {
                  // 归约函数，处理每个消息部分
                  // 处理文本部分：累加非合成文本内容
                  if (part.type === "text") {
                    // 检查是否为文本类型
                    if (!part.synthetic) agg.input += part.text // 如果不是合成文本，则累加到输入内容
                  }
                  // 处理文件部分：添加到文件列表
                  if (part.type === "file") agg.parts.push(part) // 如果是文件类型，则添加到文件列表
                  return agg // 返回累加器，继续处理下一个部分
                },
                { input: "", parts: [] as PromptInfo["parts"] }, // 初始值：空输入和空文件列表
              )
              // promptInfo 结构：
              //   {
              //     input: string,    // 合并后的文本内容
              //     parts: FilePart[]  // 文件引用列表
              //   }
              props.setPrompt(promptInfo) // 调用回调函数，设置提示内容
              // 说明：
              //   setPrompt：父组件传入的回调函数，用于设置提示框的内容
              //   promptInfo：包含文本和文件的提示信息
              //   效果：将回退点的消息内容恢复到提示框中，用户可以基于此继续编辑
            }

            // 第四步：清除对话框，关闭操作界面
            dialog.clear() // 调用对话框的 clear 方法，关闭对话框
          },
        },
        {
          // 选项 2：复制操作
          title: "Copy", // 选项标题，显示为 "Copy"
          value: "message.copy", // 选项值，用于标识复制操作
          description: "message text to clipboard", // 选项描述，说明此操作会将消息文本复制到剪贴板
          onSelect: async (dialog) => {
            // 选中选项时的异步回调函数
            // 第一步：获取当前消息对象
            const msg = message() // 调用派生值函数获取消息对象
            if (!msg) return // 如果消息不存在，直接返回（防御性编程）

            // 第二步：提取消息的文本内容
            const parts = sync.data.part[msg.id] // 获取消息的所有部分
            const text = parts.reduce((agg, part) => {
              // 使用 reduce 方法合并所有文本部分
              if (part.type === "text" && !part.synthetic) {
                // 检查是否为非合成文本
                agg += part.text // 累加文本内容
              }
              return agg // 返回累加器，继续处理下一个部分
            }, "") // 初始值：空字符串
            // 说明：
            //   reduce：数组归约方法，将所有文本部分合并为一个字符串
            //   part.type === "text"：只处理文本类型的部分
            //   !part.synthetic：排除合成文本（如系统生成的提示）
            //   结果：消息的所有非合成文本内容，按顺序连接

            // 第三步：将文本复制到系统剪贴板
            await Clipboard.copy(text) // 调用剪贴板工具的 copy 方法，复制文本
            // 说明：
            //   Clipboard.copy：剪贴板工具的复制方法
            //   text：要复制的文本内容
            //   await：等待异步操作完成
            //   效果：将消息的文本内容复制到系统剪贴板，用户可以在其他应用中粘贴

            // 第四步：清除对话框，关闭操作界面
            dialog.clear() // 调用对话框的 clear 方法，关闭对话框
          },
        },
        {
          // 选项 3：分支操作
          title: "Fork", // 选项标题，显示为 "Fork"
          value: "session.fork", // 选项值，用于标识分支操作
          description: "create a new session", // 选项描述，说明此操作会创建新的会话
          onSelect: async (dialog) => {
            // 选中选项时的异步回调函数
            // 第一步：调用 SDK API 创建会话分支
            const result = await sdk.client.session.fork({
              // 调用会话分支 API
              sessionID: props.sessionID, // 原始会话 ID
              messageID: props.messageID, // 分支点的消息 ID
            })
            // 说明：
            //   sdk.client.session.fork：SDK 提供的创建会话分支方法
            //   参数说明：
            //     sessionID：要分支的原始会话 ID
            //     messageID：分支点的消息 ID，新会话将包含此消息及其之前的所有上下文
            //   await：等待异步操作完成
            //   result：API 响应对象，包含新创建的会话信息
            //   result.data!.id：新会话的唯一标识符（! 表示确定 data 存在）
            // 分支说明：
            //   新会话将继承原会话在指定消息之前的所有对话历史
            //   新会话可以独立发展，不影响原会话
            //   适用于尝试不同的对话方向或保存有价值的分支

            // 第二步：构建初始提示信息
            const initialPrompt = (() => {
              // 使用立即执行函数表达式（IIFE）构建初始提示
              const msg = message() // 获取当前消息对象
              if (!msg) return undefined // 如果消息不存在，返回 undefined
              const parts = sync.data.part[msg.id] // 获取消息的所有部分
              return parts.reduce(
                // 使用 reduce 方法合并所有部分为提示信息
                (agg, part) => {
                  // 归约函数，处理每个消息部分
                  // 处理文本部分：累加非合成文本内容
                  if (part.type === "text") {
                    // 检查是否为文本类型
                    if (!part.synthetic) agg.input += part.text // 如果不是合成文本，则累加到输入内容
                  }
                  // 处理文件部分：添加到文件列表
                  if (part.type === "file") agg.parts.push(part) // 如果是文件类型，则添加到文件列表
                  return agg // 返回累加器，继续处理下一个部分
                },
                { input: "", parts: [] as PromptInfo["parts"] }, // 初始值：空输入和空文件列表
              )
            })() // 立即执行函数表达式，获取 initialPrompt 值
            // initialPrompt 结构：
            //   {
            //     input: string,    // 合并后的文本内容
            //     parts: FilePart[]  // 文件引用列表
            //   }

            // 第三步：导航到新创建的会话，并传入初始提示
            route.navigate({
              // 调用路由导航方法
              sessionID: result.data!.id, // 新会话 ID
              type: "session", // 路由类型，"session" 表示会话页面
              initialPrompt, // 初始提示信息
            })
            // 说明：
            //   route.navigate：路由导航方法，用于切换到指定页面
            //   参数说明：
            //     sessionID：目标会话 ID
            //     type：路由类型，"session" 表示会话页面
            //     initialPrompt：初始提示信息，用于填充新会话的输入框
            //   效果：
            //     - 关闭当前对话框
            //     - 切换到新会话页面
            //     - 自动填充输入框，包含原始消息的文本和文件
            //     - 用户可以基于此内容继续对话

            // 第四步：清除对话框，关闭操作界面
            dialog.clear() // 调用对话框的 clear 方法，关闭对话框
          },
        },
      ]}
    />
  )
}
