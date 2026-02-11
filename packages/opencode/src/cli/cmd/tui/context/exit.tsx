import { FormatError, FormatUnknownError } from "@/cli/error" // 错误格式化工具函数，用于将错误对象转换为用户友好的错误消息
import { useRenderer } from "@opentui/solid" // OpenTUI Solid.js 集成库，提供渲染器相关功能，用于控制终端界面的渲染和销毁
import { createSimpleContext } from "./helper" // 从 helper 模块导入创建简单上下文的方法，用于快速创建 Solid.js 上下文

// 创建退出上下文提供者
// 使用 createSimpleContext 工具函数快速创建一个退出处理上下文
// 这个上下文用于在整个应用组件树中管理程序退出流程，包括清理资源和显示错误信息
//
// 返回值包含两个主要部分：
// - use: 用于在子组件中获取退出处理函数的钩子函数
// - provider: 用于在父组件中提供退出处理上下文的组件
export const { use: useExit, provider: ExitProvider } = createSimpleContext({
  name: "Exit", // 上下文的名称，用于调试和错误提示
  init: (input: { onExit?: () => Promise<void> }) => {
    // 获取渲染器实例，用于控制终端界面的渲染和销毁
    const renderer = useRenderer()

    // 返回一个异步的退出处理函数
    // 这个函数负责优雅地关闭应用程序，包括：
    // 1. 重置窗口标题
    // 2. 销毁渲染器
    // 3. 执行可选的退出回调
    // 4. 输出错误信息（如果有）
    // 5. 退出进程
    return async (reason?: any) => {
      // 在销毁渲染器之前重置窗口标题
      // 这样可以确保终端窗口标题在程序退出后恢复默认状态
      renderer.setTerminalTitle("")

      // 销毁渲染器，清理终端界面占用的资源
      renderer.destroy()

      // 执行可选的退出回调函数（如果有提供）
      // 使用可选链操作符确保只有在 onExit 存在时才调用
      await input.onExit?.()

      // 如果提供了退出原因（通常是错误信息），则格式化并输出到标准错误流
      if (reason) {
        // 尝试格式化错误消息，如果无法识别则使用通用错误格式化
        const formatted = FormatError(reason) ?? FormatUnknownError(reason)
        // 如果成功格式化，则将错误信息写入标准错误流
        if (formatted) {
          process.stderr.write(formatted + "\n")
        }
      }

      // 正常退出进程，返回状态码 0 表示成功结束
      process.exit(0)
    }
  },
})
