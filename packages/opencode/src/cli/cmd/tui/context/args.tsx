import { createSimpleContext } from "./helper" // 从 helper 模块导入创建简单上下文的方法，用于快速创建 React/ Solid.js 上下文

// 命令行参数接口定义
// 用于在应用启动时接收和处理通过命令行传递的各种配置参数
// 这些参数可以覆盖配置文件中的设置，或者提供一次性的执行选项
export interface Args {
  model?: string // 可选的模型参数，指定要使用的 AI 模型名称（如 "gpt-4"、"claude-3" 等）
  agent?: string // 可选的智能体参数，指定默认使用的智能体类型（如 "build"、"plan" 等）
  prompt?: string // 可选的提示参数，指定要执行的初始提示内容（可以是简单的提示文本或复杂的多轮对话）
  continue?: boolean // 可选的继续参数，设置为 true 时会从上一个会话继续执行（恢复之前的对话状态）
  sessionID?: string // 可选的会话 ID 参数，指定要继续的特定会话标识符（用于在多个会话之间切换）
}

// 创建_ARGS 上下文提供者
// 使用 createSimpleContext 工具函数快速创建一个简单的值上下文
// 这个上下文用于在整个应用组件树中共享命令行参数数据
//
// 返回值包含两个主要部分：
// - use: 用于在子组件中获取Args上下文值的钩子函数
// - provider: 用于在父组件中提供Args上下文值的组件
export const { use: useArgs, provider: ArgsProvider } = createSimpleContext({
  name: "Args", // 上下文的名称，用于调试和错误提示
  init: (props: Args) => props, // 初始化函数，将传入的属性直接作为上下文的初始值
})
