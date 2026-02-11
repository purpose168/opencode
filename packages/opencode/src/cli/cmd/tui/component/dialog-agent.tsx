import { createMemo } from "solid-js" // Solid.js 响应式 API，用于创建派生值
import { useLocal } from "@tui/context/local" // 本地配置上下文，用于获取和设置本地状态
import { DialogSelect } from "@tui/ui/dialog-select" // 选择对话框组件
import { useDialog } from "@tui/ui/dialog" // 对话框上下文，用于控制对话框的显示和隐藏

export function DialogAgent() {
  const local = useLocal() // 获取本地配置上下文
  const dialog = useDialog() // 获取对话框上下文

  // 创建智能体选项列表的 memo
  const options = createMemo(() =>
    local.agent.list().map((item) => {
      return {
        value: item.name, // 智能体名称作为值
        title: item.name, // 智能体名称作为标题
        description: item.native ? "native" : item.description, // 如果是原生智能体则显示 "native"，否则显示描述
      }
    }),
  )

  return (
    <DialogSelect
      title="Select agent" // 对话框标题
      current={local.agent.current().name} // 当前选中的智能体名称
      options={options()} // 智能体选项列表
      onSelect={(option) => {
        // 选中智能体时的回调
        local.agent.set(option.value) // 设置选中的智能体
        dialog.clear() // 关闭对话框
      }}
    />
  )
}
