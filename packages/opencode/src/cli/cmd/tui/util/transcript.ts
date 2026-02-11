import { Locale } from "@/util/locale" // 导入本地化工具，用于文本处理
import type { AssistantMessage, Part, UserMessage } from "@opencode-ai/sdk/v2" // 导入消息类型定义，包括助手消息、消息部分和用户消息

/**
 * TranscriptOptions 会话记录选项接口定义
 *
 * 属性说明：
 * - thinking: 是否包含思考过程（reasoning 部分）
 * - toolDetails: 是否包含工具详情（输入、输出、错误）
 * - assistantMetadata: 是否包含助手元数据（代理名称、模型 ID、耗时）
 */
export type TranscriptOptions = {
  // 会话记录选项类型
  thinking: boolean // 是否包含思考过程
  toolDetails: boolean // 是否包含工具详情
  assistantMetadata: boolean // 是否包含助手元数据
}

/**
 * SessionInfo 会话信息接口定义
 *
 * 属性说明：
 * - id: 会话唯一标识符
 * - title: 会话标题
 * - time: 会话时间信息，包含创建时间和更新时间
 */
export type SessionInfo = {
  // 会话信息类型
  id: string // 会话唯一标识符
  title: string // 会话标题
  time: {
    // 会话时间信息
    created: number // 创建时间（时间戳）
    updated: number // 更新时间（时间戳）
  }
}

/**
 * MessageWithParts 带有部分的消息接口定义
 *
 * 属性说明：
 * - info: 消息信息（用户消息或助手消息）
 * - parts: 消息部分数组（包含文本、思考过程、工具调用等）
 */
export type MessageWithParts = {
  // 带有部分的消息类型
  info: UserMessage | AssistantMessage // 消息信息（用户消息或助手消息）
  parts: Part[] // 消息部分数组
}

/**
 * formatTranscript 格式化会话记录
 *
 * 功能说明：
 * - 将会话信息和消息列表格式化为 Markdown 格式的会话记录
 * - 包含会话标题、会话 ID、创建时间、更新时间
 * - 每条消息之间用分隔线分隔
 * - 根据选项决定是否包含思考过程、工具详情和助手元数据
 *
 * 使用场景：
 * - 需要导出会话记录为 Markdown 文件时
 * - 需要生成会话的可读文本格式时
 * - 需要保存会话记录到文件时
 *
 * 参数说明：
 * - session: 会话信息对象，包含 ID、标题和时间
 * - messages: 消息列表，每条消息包含消息信息和消息部分
 * - options: 会话记录选项，控制是否包含思考过程、工具详情和助手元数据
 *
 * 返回值：
 * - 返回格式化后的 Markdown 格式会话记录字符串
 */
export function formatTranscript(
  session: SessionInfo, // 会话信息对象
  messages: MessageWithParts[], // 消息列表
  options: TranscriptOptions, // 会话记录选项
): string {
  // 返回格式化后的 Markdown 字符串
  let transcript = `# ${session.title}\n\n` // 会话标题（一级标题）
  transcript += `**Session ID:** ${session.id}\n` // 会话 ID
  transcript += `**Created:** ${new Date(session.time.created).toLocaleString()}\n` // 创建时间（本地化字符串）
  transcript += `**Updated:** ${new Date(session.time.updated).toLocaleString()}\n\n` // 更新时间（本地化字符串）
  transcript += `---\n\n` // 分隔线

  for (const msg of messages) {
    // 遍历所有消息
    transcript += formatMessage(msg.info, msg.parts, options) // 格式化每条消息
    transcript += `---\n\n` // 消息之间的分隔线
  }

  return transcript // 返回格式化后的会话记录
}

/**
 * formatMessage 格式化单条消息
 *
 * 功能说明：
 * - 根据消息角色（用户或助手）格式化消息头部
 * - 格式化消息的所有部分（文本、思考过程、工具调用等）
 * - 根据选项决定是否包含思考过程和工具详情
 *
 * 使用场景：
 * - 需要格式化单条消息时
 * - 需要生成消息的可读文本格式时
 * - 需要导出消息为 Markdown 格式时
 *
 * 参数说明：
 * - msg: 消息对象（用户消息或助手消息）
 * - parts: 消息部分数组
 * - options: 会话记录选项，控制是否包含思考过程、工具详情和助手元数据
 *
 * 返回值：
 * - 返回格式化后的 Markdown 格式消息字符串
 */
export function formatMessage(msg: UserMessage | AssistantMessage, parts: Part[], options: TranscriptOptions): string {
  // 返回格式化后的 Markdown 字符串
  let result = "" // 初始化结果字符串

  if (msg.role === "user") {
    // 如果是用户消息
    result += `## User\n\n` // 用户消息头部（二级标题）
  } else {
    // 如果是助手消息
    result += formatAssistantHeader(msg, options.assistantMetadata) // 格式化助手消息头部
  }

  for (const part of parts) {
    // 遍历所有消息部分
    result += formatPart(part, options) // 格式化每个消息部分
  }

  return result // 返回格式化后的消息
}

/**
 * formatAssistantHeader 格式化助手消息头部
 *
 * 功能说明：
 * - 格式化助手消息的头部信息
 * - 包含代理名称、模型 ID 和耗时（如果包含元数据）
 * - 如果不包含元数据，只显示简单的 "Assistant" 标题
 *
 * 使用场景：
 * - 需要格式化助手消息头部时
 * - 需要显示助手代理信息时
 * - 需要显示模型 ID 和耗时信息时
 *
 * 参数说明：
 * - msg: 助手消息对象
 * - includeMetadata: 是否包含元数据（代理名称、模型 ID、耗时）
 *
 * 返回值：
 * - 返回格式化后的 Markdown 格式助手消息头部字符串
 */
export function formatAssistantHeader(msg: AssistantMessage, includeMetadata: boolean): string {
  // 返回格式化后的 Markdown 字符串
  if (!includeMetadata) {
    // 如果不包含元数据
    return `## Assistant\n\n` // 简单的助手消息头部（二级标题）
  }

  const duration =
    msg.time.completed && msg.time.created // 如果有完成时间和创建时间
      ? ((msg.time.completed - msg.time.created) / 1000).toFixed(1) + "s" // 计算耗时（秒，保留一位小数）
      : "" // 否则耗时为空字符串

  return `## Assistant (${Locale.titlecase(msg.agent)} · ${msg.modelID}${duration ? ` · ${duration}` : ""})\n\n` // 助手消息头部，包含代理名称、模型 ID 和耗时
}

/**
 * formatPart 格式化消息部分
 *
 * 功能说明：
 * - 根据部分类型格式化不同的消息内容
 * - 文本部分：直接输出文本内容（非合成内容）
 * - 思考过程部分：如果启用思考过程选项，则输出思考内容
 * - 工具调用部分：如果启用工具详情选项，则输出工具名称、输入、输出和错误
 * - 其他部分：返回空字符串
 *
 * 使用场景：
 * - 需要格式化消息的不同部分时
 * - 需要生成消息内容的可读文本格式时
 * - 需要导出消息部分为 Markdown 格式时
 *
 * 参数说明：
 * - part: 消息部分对象（文本、思考过程、工具调用等）
 * - options: 会话记录选项，控制是否包含思考过程和工具详情
 *
 * 返回值：
 * - 返回格式化后的 Markdown 格式消息部分字符串
 */
export function formatPart(part: Part, options: TranscriptOptions): string {
  // 返回格式化后的 Markdown 字符串
  if (part.type === "text" && !part.synthetic) {
    // 如果是文本部分且不是合成内容
    return `${part.text}\n\n` // 直接输出文本内容
  }

  if (part.type === "reasoning") {
    // 如果是思考过程部分
    if (options.thinking) {
      // 如果启用思考过程选项
      return `_Thinking:_\n\n${part.text}\n\n` // 输出思考过程（斜体）
    }
    return "" // 否则返回空字符串
  }

  if (part.type === "tool") {
    // 如果是工具调用部分
    let result = `\`\`\`\nTool: ${part.tool}\n` // 工具名称（代码块）
    if (options.toolDetails && part.state.input) {
      // 如果启用工具详情选项且有输入
      result += `\n**Input:**\n\`\`\`json\n${JSON.stringify(part.state.input, null, 2)}\n\`\`\`` // 输入（JSON 代码块，缩进 2 空格）
    }
    if (options.toolDetails && part.state.status === "completed" && part.state.output) {
      // 如果启用工具详情选项且状态为完成且有输出
      result += `\n**Output:**\n\`\`\`\n${part.state.output}\n\`\`\`` // 输出（代码块）
    }
    if (options.toolDetails && part.state.status === "error" && part.state.error) {
      // 如果启用工具详情选项且状态为错误且有错误信息
      result += `\n**Error:**\n\`\`\`\n${part.state.error}\n\`\`\`` // 错误（代码块）
    }
    result += `\n\`\`\`\n\n` // 结束代码块
    return result // 返回格式化后的工具调用部分
  }

  return "" // 其他类型返回空字符串
}
