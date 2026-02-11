import { Locale } from "@/util/locale" // 导入本地化工具，用于时间格式化等功能
import type { TextPart } from "@opencode-ai/sdk/v2" // 导入文本消息部分的类型定义
import type { PromptInfo } from "@tui/component/prompt/history" // 导入提示信息类型定义，包含输入文本和文件部分
import { useRoute } from "@tui/context/route" // 导入路由上下文钩子，用于页面导航
import { useSDK } from "@tui/context/sdk" // 导入 SDK 上下文钩子，用于访问 API 客户端
import { useSync } from "@tui/context/sync" // 导入同步上下文钩子，用于访问全局同步状态管理器
import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select" // 导入对话框选择组件及其选项类型定义
import { createMemo, onMount } from "solid-js" // 导入 Solid.js 核心函数：createMemo 用于创建派生值，onMount 用于组件挂载时的生命周期钩子
import { useDialog } from "../../ui/dialog" // 导入对话框上下文钩子，用于控制对话框的显示和行为

/**
 * 从时间线创建分支对话框组件
 *
 * 功能说明：
 * 1. 显示当前会话中的所有用户消息列表
 * 2. 允许用户选择一个消息作为分支点
 * 3. 创建新的会话分支，继承选中的消息及其上下文
 * 4. 自动导航到新创建的会话，并填充初始提示内容
 *
 * 使用场景：
 * - 用户想要从对话历史的某个点重新开始对话
 * - 需要基于之前的对话创建新的变体或尝试不同的方向
 * - 保存有价值的对话分支以便后续独立发展
 *
 * 组件特性：
 * - 使用 createMemo 自动追踪消息数据变化并更新选项列表
 * - 使用 onMount 在组件挂载时设置对话框尺寸
 * - 支持键盘导航（onMove 回调）
 * - 自动过滤非用户消息和合成消息
 * - 保留原始消息的文本内容和文件引用
 *
 * @param props - 组件属性对象
 * @param props.sessionID - 当前会话的唯一标识符，用于获取会话消息列表
 * @param props.onMove - 当用户使用键盘导航移动选项时的回调函数，接收选中的消息 ID
 * @returns 返回一个对话框选择组件，显示可分支的消息列表
 */
export function DialogForkFromTimeline(props: { sessionID: string; onMove: (messageID: string) => void }) {
  const sync = useSync() // 获取同步上下文实例，用于访问会话消息和消息部分的同步数据
  const dialog = useDialog() // 获取对话框上下文实例，用于控制对话框的尺寸和关闭行为
  const sdk = useSDK() // 获取 SDK 上下文实例，用于调用 API 创建会话分支
  const route = useRoute() // 获取路由上下文实例，用于导航到新创建的会话页面

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
      // 跳过非用户消息，只允许从用户消息创建分支
      if (message.role !== "user") continue
      // 说明：
      //   message.role：消息角色，可选值为 "user" 或 "assistant"
      //   continue：跳过当前循环，继续处理下一个消息
      // 原因：通常只需要从用户输入点创建分支，助手回复作为响应结果
      // 这样可以确保分支点有明确的用户意图和输入内容

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
      // 原因：没有文本内容的消息无法作为分支点，用户需要看到消息内容才能做出选择

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
        //   用途：在 onSelect 回调中，通过此 ID 获取消息详情并创建分支
        //   格式：通常是 UUID 或其他唯一字符串

        // 选项底部信息：显示消息创建时间
        footer: Locale.time(message.time.created),
        // 说明：
        //   message.time.created：消息创建的时间戳（毫秒）
        //   Locale.time()：本地化时间格式化函数，将时间戳转换为易读格式
        //   输出示例："2024-01-31 14:30"、"2小时前"、"刚刚" 等
        //   目的：帮助用户识别消息的时间顺序，选择合适的分支点

        // 选中选项时的回调函数：创建会话分支并导航
        onSelect: async (dialog) => {
          // 第一步：调用 SDK API 创建会话分支
          const forked = await sdk.client.session.fork({
            sessionID: props.sessionID, // 原始会话 ID
            messageID: message.id, // 分支点的消息 ID
          })
          // 说明：
          //   sdk.client.session.fork：SDK 提供的创建会话分支方法
          //   参数说明：
          //     sessionID：要分支的原始会话 ID
          //     messageID：分支点的消息 ID，新会话将包含此消息及其之前的所有上下文
          //   await：等待异步操作完成
          //   forked：API 响应对象，包含新创建的会话信息
          //   forked.data!.id：新会话的唯一标识符（! 表示确定 data 存在）
          // 分支说明：
          //   新会话将继承原会话在指定消息之前的所有对话历史
          //   新会话可以独立发展，不影响原会话
          //   适用于尝试不同的对话方向或保存有价值的分支

          // 第二步：收集原始消息的所有部分，用于构建初始提示
          const parts = sync.data.part[message.id] ?? []
          // 说明：
          //   sync.data.part[message.id]：获取分支点消息的所有部分
          //   ?? []：如果消息没有部分则返回空数组
          // 消息部分类型：
          //   - TextPart：文本内容
          //   - FilePart：文件引用
          //   - ImagePart：图片内容
          //   等等

          // 第三步：构建初始提示信息，包含文本输入和文件部分
          const initialPrompt = parts.reduce(
            (agg, part) => {
              // 处理文本部分：累加非合成文本内容
              if (part.type === "text") {
                if (!part.synthetic) agg.input += part.text
              }
              // 处理文件部分：添加到文件列表
              if (part.type === "file") agg.parts.push(part)
              // 说明：
              //   part.type：部分类型，可以是 "text"、"file"、"image" 等
              //   part.synthetic：是否为合成文本（如系统生成的提示）
              //   agg.input：累加的文本输入内容
              //   agg.parts：文件部分数组
              //   reduce：数组归约方法，将所有部分合并为一个提示对象
              return agg
            },
            { input: "", parts: [] as PromptInfo["parts"] }, // 初始值：空输入和空文件列表
          )
          // initialPrompt 结构：
          //   {
          //     input: string,    // 合并后的文本内容
          //     parts: FilePart[]  // 文件引用列表
          //   }

          // 第四步：导航到新创建的会话，并传入初始提示
          route.navigate({
            sessionID: forked.data!.id, // 新会话 ID
            type: "session", // 路由类型
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

          // 第五步：清除对话框，关闭选择界面
          dialog.clear()
          // 说明：
          //   dialog.clear：清除对话框，关闭选择界面
          //   作用：在导航到新会话后，关闭分支选择对话框
        },
      })
    }

    // 第六步：反转选项列表，使最新消息显示在最前面
    result.reverse()
    // 说明：
    //   reverse()：原地反转数组顺序
    //   原因：用户通常希望看到最新的消息，方便选择最近的分支点
    //   示例：
    //     反转前：[消息1(最早), 消息2, 消息3, 消息4(最新)]
    //     反转后：[消息4(最新), 消息3, 消息2, 消息1(最早)]

    // 返回选项列表
    return result
  })

  // 返回对话框选择组件
  return <DialogSelect onMove={(option) => props.onMove(option.value)} title="Fork from message" options={options()} />
  // 说明：
  //   DialogSelect：对话框选择组件，显示可选项列表
  //   参数说明：
  //     onMove：键盘导航时的回调函数
  //       - option：当前选中的选项对象
  //       - option.value：选项值（消息 ID）
  //       - props.onMove：调用父组件传入的回调，通知外部当前选中的消息 ID
  //     title：对话框标题，显示为 "Fork from message"
  //     options：选项列表，通过调用 options() 获取派生值
  //   功能：
  //     - 显示消息列表，每条消息显示标题、内容和时间
  //     - 支持键盘上下箭头导航
  //     - 支持回车键确认选择
  //     - 支持鼠标点击选择
  //   用户体验：
  //     - 用户可以使用键盘快速浏览和选择消息
  //     - onMove 回调允许外部组件实时响应导航变化
  //     - 选择后自动创建分支并跳转到新会话
}
