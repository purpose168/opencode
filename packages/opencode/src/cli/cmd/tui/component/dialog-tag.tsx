import { createMemo, createResource } from "solid-js" // Solid.js 核心函数：创建派生值、创建资源
import { DialogSelect } from "@tui/ui/dialog-select" // 选择对话框组件
import { useDialog } from "@tui/ui/dialog" // 对话框上下文，用于控制对话框的显示和隐藏
import { useSDK } from "@tui/context/sdk" // SDK 上下文，用于访问 SDK 客户端
import { createStore } from "solid-js/store" // Solid.js 状态管理：创建 store

// 标签对话框组件的属性接口
interface DialogTagProps {
  onSelect?: (value: string) => void // 选中标签时的回调函数
}

// 标签对话框组件，用于选择标签
export function DialogTag(props: DialogTagProps) {
  const sdk = useSDK() // 获取 SDK 上下文
  const dialog = useDialog() // 获取对话框上下文

  // 创建 store 来管理过滤字符串
  const [store] = createStore({
    filter: "", // 过滤字符串
  })

  // 创建资源，从 SDK 获取文件列表
  const [files] = createResource(
    () => [store.filter], // 依赖项：过滤字符串
    async () => {
      // 调用 SDK 的文件查找 API
      const result = await sdk.client.find.files({
        query: store.filter,
      })
      if (result.error) return [] // 如果有错误，返回空数组
      const sliced = (result.data ?? []).slice(0, 5) // 限制返回最多 5 个文件
      return sliced
    },
  )

  // 创建对话框选项列表的 memo
  const options = createMemo(() =>
    (files() ?? []).map((file) => ({
      value: file, // 文件路径作为选项值
      title: file, // 文件路径作为选项标题
    })),
  )

  // 返回选择对话框组件
  return (
    <DialogSelect
      title="Autocomplete" // 对话框标题
      options={options()} // 对话框选项列表
      onSelect={(option) => {
        props.onSelect?.(option.value) // 调用选中回调
        dialog.clear() // 清除对话框
      }}
    />
  )
}
