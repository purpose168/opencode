import { DialogSelect, type DialogSelectRef } from "../ui/dialog-select" // 选择对话框组件，用于显示主题列表供用户选择
import { useTheme } from "../context/theme" // 主题上下文，用于访问和修改当前主题设置
import { useDialog } from "../ui/dialog" // 对话框上下文，用于控制对话框的显示和隐藏
import { onCleanup, onMount } from "solid-js" // Solid.js 生命周期钩子：组件卸载清理、组件挂载

// 主题列表对话框组件，用于选择和预览可用主题
export function DialogThemeList() {
  const theme = useTheme() // 获取主题上下文

  // 创建主题选项列表
  const options = Object.keys(theme.all()) // 获取所有可用主题的键（主题名称）
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })) // 按字母顺序排序，忽略大小写差异
    .map((value) => ({
      // 将每个主题名称转换为选项对象
      title: value, // 显示标题
      value: value, // 选项值
    }))
  
  const dialog = useDialog() // 获取对话框上下文
  let confirmed = false // 标记用户是否确认选择
  let ref: DialogSelectRef<string> // 对话框组件的引用，用于访问过滤后的选项列表
  const initial = theme.selected // 记录初始选择的主题

  // 组件卸载时的清理函数
  onCleanup(() => {
    // 如果用户没有确认选择，则恢复初始主题
    if (!confirmed) theme.set(initial)
  })

  // 返回主题选择对话框组件
  return (
    <DialogSelect
      title="Themes" // 对话框标题
      options={options} // 可用主题选项列表
      current={initial} // 当前选中的主题
      // 当用户在列表中移动选择时，实时预览主题效果
      onMove={(opt) => {
        theme.set(opt.value) // 设置主题
      }}
      // 当用户确认选择时
      onSelect={(opt) => {
        theme.set(opt.value) // 应用选择的主题
        confirmed = true // 标记为已确认
        dialog.clear() // 清除对话框
      }}
      // 设置对话框组件引用
      ref={(r) => {
        ref = r // 保存组件引用
      }}
      // 处理过滤查询
      onFilter={(query) => {
        // 如果查询为空，恢复初始主题
        if (query.length === 0) {
          theme.set(initial)
          return
        }

        // 获取过滤后的第一个匹配项，并应用该主题
        const first = ref.filtered[0]
        if (first) theme.set(first.value)
      }}
    />
  )
}
