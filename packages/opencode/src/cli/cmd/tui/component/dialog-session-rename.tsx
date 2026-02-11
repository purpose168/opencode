import { DialogPrompt } from "@tui/ui/dialog-prompt" // 提示对话框组件
import { useDialog } from "@tui/ui/dialog" // 对话框上下文，用于控制对话框的显示和隐藏
import { useSync } from "@tui/context/sync" // 同步上下文，用于管理与服务器的数据同步
import { createMemo } from "solid-js" // Solid.js 核心函数：创建派生值
import { useSDK } from "../context/sdk" // SDK 上下文，用于访问 SDK 客户端

// 会话重命名对话框组件的属性接口
interface DialogSessionRenameProps {
  session: string // 会话 ID
}

// 会话重命名对话框组件
export function DialogSessionRename(props: DialogSessionRenameProps) {
  const dialog = useDialog() // 获取对话框上下文
  const sync = useSync() // 获取同步上下文
  const sdk = useSDK() // 获取 SDK 上下文
  const session = createMemo(() => sync.session.get(props.session)) // 创建会话信息的 memo

  // 返回提示对话框组件
  return (
    <DialogPrompt
      title="Rename Session" // 对话框标题
      value={session()?.title} // 输入框的初始值为当前会话标题
      onConfirm={(value) => {
        // 确认回调
        sdk.client.session.update({
          // 调用更新会话 API
          sessionID: props.session,
          title: value,
        })
        dialog.clear() // 清除对话框
      }}
      onCancel={() => dialog.clear()} // 取消回调：清除对话框
    />
  )
}
