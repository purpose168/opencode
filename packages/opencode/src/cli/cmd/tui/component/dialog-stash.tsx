import { useDialog } from "@tui/ui/dialog" // 对话框上下文，用于控制对话框的显示和隐藏
import { DialogSelect } from "@tui/ui/dialog-select" // 选择对话框组件
import { createMemo, createSignal } from "solid-js" // Solid.js 核心函数：创建派生值、响应式信号
import { Locale } from "@/util/locale" // 本地化工具，用于格式化时间等
import { Keybind } from "@/util/keybind" // 快捷键工具
import { useTheme } from "../context/theme" // 主题上下文，用于获取主题颜色
import { usePromptStash, type StashEntry } from "./prompt/stash" // 提示词暂存上下文和类型定义

// 计算相对时间的函数
function getRelativeTime(timestamp: number): string {
  const now = Date.now() // 获取当前时间
  const diff = now - timestamp // 计算时间差
  const seconds = Math.floor(diff / 1000) // 转换为秒
  const minutes = Math.floor(seconds / 60) // 转换为分钟
  const hours = Math.floor(minutes / 60) // 转换为小时
  const days = Math.floor(hours / 24) // 转换为天

  // 根据时间差返回不同的相对时间格式
  if (seconds < 60) return "just now" // 少于 1 分钟
  if (minutes < 60) return `${minutes}m ago` // 少于 1 小时
  if (hours < 24) return `${hours}h ago` // 少于 1 天
  if (days < 7) return `${days}d ago` // 少于 7 天
  return Locale.datetime(timestamp) // 超过 7 天，显示完整日期时间
}

// 获取暂存预览的函数
function getStashPreview(input: string, maxLength: number = 50): string {
  const firstLine = input.split("\n")[0].trim() // 获取第一行并去除首尾空格
  return Locale.truncate(firstLine, maxLength) // 截断到指定长度
}

// 暂存对话框组件
export function DialogStash(props: { onSelect: (entry: StashEntry) => void }) {
  const dialog = useDialog() // 获取对话框上下文
  const stash = usePromptStash() // 获取提示词暂存上下文
  const { theme } = useTheme() // 获取主题配置

  const [toDelete, setToDelete] = createSignal<number>() // 创建待删除索引的信号

  // 创建暂存选项列表的 memo
  const options = createMemo(() => {
    const entries = stash.list() // 获取所有暂存条目
    // Show most recent first（显示最近的条目）
    return entries
      .map((entry, index) => { // 映射为对话框选项格式
        const isDeleting = toDelete() === index // 判断是否正在删除该条目
        const lineCount = (entry.input.match(/\n/g)?.length ?? 0) + 1 // 计算行数
        return {
          title: isDeleting ? "Press ctrl+d again to confirm" : getStashPreview(entry.input), // 如果正在删除，显示确认提示
          bg: isDeleting ? theme.error : undefined, // 如果正在删除，使用错误背景色
          value: index, // 索引作为选项值
          description: getRelativeTime(entry.timestamp), // 显示相对时间
          footer: lineCount > 1 ? `~${lineCount} lines` : undefined, // 如果有多行，显示行数
        }
      })
      .toReversed() // 反转数组，使最新的条目显示在最前面
  })

  // 返回对话框选择组件
  return (
    <DialogSelect
      title="Stash" // 对话框标题
      options={options()} // 暂存选项列表
      onMove={() => { // 移动选项时清除删除状态
        setToDelete(undefined)
      }}
      onSelect={(option) => { // 选中暂存条目时的回调
        const entries = stash.list() // 获取所有暂存条目
        const entry = entries[option.value] // 获取选中的条目
        if (entry) { // 如果条目存在
          stash.remove(option.value) // 从暂存中移除该条目
          props.onSelect(entry) // 调用选中回调
        }
        dialog.clear() // 清除对话框
      }}
      keybind={[ // 快捷键配置
        {
          keybind: Keybind.parse("ctrl+d")[0], // Ctrl+D 快捷键
          title: "delete", // 快捷键标题
          onTrigger: (option) => { // 触发回调
            if (toDelete() === option.value) { // 如果已经标记为删除，确认删除
              stash.remove(option.value) // 从暂存中移除该条目
              setToDelete(undefined) // 清除删除状态
              return
            }
            setToDelete(option.value) // 否则标记为待删除
          },
        },
      ]}
    />
  )
}
