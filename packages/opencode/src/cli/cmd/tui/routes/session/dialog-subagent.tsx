import { useRoute } from "@tui/context/route" // 导入路由上下文钩子，用于页面导航
import { DialogSelect } from "@tui/ui/dialog-select" // 导入对话框选择组件，用于显示操作选项列表

/**
 * 子智能体操作对话框组件
 *
 * 功能说明：
 * 1. 显示子智能体的操作选项列表
 * 2. 支持打开子智能体会话的操作
 * 3. 导航到子智能体的会话页面
 *
 * 使用场景：
 * - 用户想要查看子智能体的详细会话内容
 * - 用户想要与子智能体进行交互
 * - 从主会话中跳转到子智能体的独立会话页面
 *
 * 组件特性：
 * - 简洁的单选项对话框设计
 * - 支持路由导航功能
 * - 自动关闭对话框并跳转到目标会话
 *
 * @param props - 组件属性对象
 * @param props.sessionID - 子智能体会话的唯一标识符
 * @returns 返回一个对话框选择组件，显示子智能体操作选项列表
 */
export function DialogSubagent(props: { sessionID: string }) {
  const route = useRoute() // 获取路由上下文实例，用于页面导航

  // 返回对话框选择组件，显示子智能体操作选项列表
  return (
    <DialogSelect
      title="Subagent Actions" // 对话框标题，显示为 "Subagent Actions"
      options={[
        // 选项列表，包含一个主要操作：打开子智能体会话
        {
          // 选项：打开子智能体会话
          title: "Open", // 选项标题，显示为 "Open"
          value: "subagent.view", // 选项值，用于标识查看子智能体操作
          description: "the subagent's session", // 选项描述，说明此操作会打开子智能体的会话
          onSelect: (dialog) => {
            // 选中选项时的回调函数
            // 第一步：导航到子智能体的会话页面
            route.navigate({
              // 调用路由导航方法
              type: "session", // 路由类型，"session" 表示会话页面
              sessionID: props.sessionID, // 子智能体会话的唯一标识符
            })
            // 说明：
            //   route.navigate：路由导航方法，用于切换到指定页面
            //   参数说明：
            //     type：路由类型，"session" 表示会话页面
            //     sessionID：目标会话 ID，即子智能体的会话 ID
            //   效果：
            //     - 关闭当前对话框
            //     - 切换到子智能体的会话页面
            //     - 显示子智能体的完整对话历史
            //     - 用户可以查看子智能体的所有消息和交互

            // 第二步：清除对话框，关闭操作界面
            dialog.clear() // 调用对话框的 clear 方法，关闭对话框
            // 说明：
            //   dialog.clear：清除对话框，关闭选择界面
            //   作用：在导航到子智能体会话后，确保对话框被正确关闭
          },
        },
      ]}
    />
  )
}
