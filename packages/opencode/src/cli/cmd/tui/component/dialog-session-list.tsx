import { useDialog } from "@tui/ui/dialog" // 对话框上下文，用于控制对话框的显示和隐藏
import { DialogSelect } from "@tui/ui/dialog-select" // 选择对话框组件
import { useRoute } from "@tui/context/route" // 路由上下文，用于导航管理
import { useSync } from "@tui/context/sync" // 同步上下文，用于管理与服务器的数据同步
import { createEffect, createMemo, createSignal, onMount, Show } from "solid-js" // Solid.js 核心函数：副作用、派生值、响应式信号、挂载钩子、条件渲染
import { Locale } from "@/util/locale" // 本地化工具，用于格式化时间等
import { Keybind } from "@/util/keybind" // 快捷键工具
import { useTheme } from "../context/theme" // 主题上下文，用于获取主题颜色
import { useSDK } from "../context/sdk" // SDK 上下文，用于访问 SDK 客户端
import { DialogSessionRename } from "./dialog-session-rename" // 会话重命名对话框组件
import { useKV } from "../context/kv" // 键值存储上下文，用于存储用户偏好设置
import "opentui-spinner/solid" // 加载动画组件

// 会话列表对话框组件
export function DialogSessionList() {
  const dialog = useDialog() // 获取对话框上下文
  const sync = useSync() // 获取同步上下文
  const { theme } = useTheme() // 获取主题配置
  const route = useRoute() // 获取路由上下文
  const sdk = useSDK() // 获取 SDK 上下文
  const kv = useKV() // 获取键值存储上下文

  const [toDelete, setToDelete] = createSignal<string>() // 创建待删除会话 ID 的信号

  const deleteKeybind = "ctrl+d" // 删除快捷键

  // 创建当前会话 ID 的 memo
  const currentSessionID = createMemo(() => (route.data.type === "session" ? route.data.sessionID : undefined))

  // 加载动画的帧序列
  const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

  // 创建会话选项列表的 memo
  const options = createMemo(() => {
    const today = new Date().toDateString() // 获取今天的日期字符串
    return sync.data.session // 获取所有会话
      .filter((x) => x.parentID === undefined) // 过滤出根会话（没有父会话的会话）
      .toSorted((a, b) => b.time.updated - a.time.updated) // 按更新时间降序排序
      .map((x) => {
        // 映射为对话框选项格式
        const date = new Date(x.time.updated) // 获取更新日期
        let category = date.toDateString() // 默认分类为日期
        if (category === today) {
          // 如果是今天，分类为 "Today"
          category = "Today"
        }
        const isDeleting = toDelete() === x.id // 判断是否正在删除该会话
        const status = sync.data.session_status?.[x.id] // 获取会话状态
        const isWorking = status?.type === "busy" // 判断会话是否正在工作
        return {
          title: isDeleting ? `Press ${deleteKeybind} again to confirm` : x.title, // 如果正在删除，显示确认提示
          bg: isDeleting ? theme.error : undefined, // 如果正在删除，使用错误背景色
          value: x.id, // 会话 ID 作为选项值
          category, // 分类（日期或 "Today"）
          footer: Locale.time(x.time.updated), // 显示更新时间
          gutter: isWorking ? ( // 如果会话正在工作，显示加载动画
            <Show when={kv.get("animations_enabled", true)} fallback={<text fg={theme.textMuted}>[⋯]</text>}>
              <spinner frames={spinnerFrames} interval={80} color={theme.primary} />
            </Show>
          ) : undefined,
        }
      })
      .slice(0, 150) // 最多显示 150 个会话
  })

  // 副作用：打印会话数量
  createEffect(() => {
    console.log("session count", sync.data.session.length)
  })

  // 组件挂载时设置对话框大小为 large
  onMount(() => {
    dialog.setSize("large")
  })

  // 返回对话框选择组件
  return (
    <DialogSelect
      title="Sessions" // 对话框标题
      options={options()} // 会话选项列表
      current={currentSessionID()} // 当前选中的会话 ID
      onMove={() => {
        // 移动选项时清除删除状态
        setToDelete(undefined)
      }}
      onSelect={(option) => {
        // 选中会话时的回调
        route.navigate({
          // 导航到会话
          type: "session",
          sessionID: option.value,
        })
        dialog.clear() // 清除对话框
      }}
      keybind={[
        // 快捷键配置
        {
          keybind: Keybind.parse(deleteKeybind)[0], // Ctrl+D 快捷键
          title: "delete", // 快捷键标题
          onTrigger: async (option) => {
            // 触发回调
            if (toDelete() === option.value) {
              // 如果已经标记为删除，确认删除
              sdk.client.session.delete({
                // 调用删除会话 API
                sessionID: option.value,
              })
              setToDelete(undefined) // 清除删除状态
              return
            }
            setToDelete(option.value) // 否则标记为待删除
          },
        },
        {
          keybind: Keybind.parse("ctrl+r")[0], // Ctrl+R 快捷键
          title: "rename", // 快捷键标题
          onTrigger: async (option) => {
            // 触发回调
            dialog.replace(() => <DialogSessionRename session={option.value} />) // 替换为重命名对话框
          },
        },
      ]}
    />
  )
}
