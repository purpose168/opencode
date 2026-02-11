import { ConfigMarkdown } from "@/config/markdown" // 导入Markdown配置模块
import { Config } from "../config/config" // 导入配置模块
import { MCP } from "../mcp" // 导入MCP模块
import { Provider } from "../provider/provider" // 导入提供者模块
import { UI } from "./ui" // 导入UI工具

// 格式化错误信息
export function FormatError(input: unknown) {
  if (MCP.Failed.isInstance(input)) return `MCP服务器"${input.data.name}"失败。注意,OpenCode暂不支持MCP认证。`
  if (Provider.ModelNotFoundError.isInstance(input)) {
    const { providerID, modelID, suggestions } = input.data
    return [
      `未找到模型: ${providerID}/${modelID}`,
      ...(Array.isArray(suggestions) && suggestions.length ? ["您是指: " + suggestions.join(", ")] : []),
      `尝试: \`opencode models\` 列出可用模型`,
      `或检查您的配置文件(opencode.json)中的提供者/模型名称`,
    ].join("\n")
  }
  if (Provider.InitError.isInstance(input)) {
    return `初始化提供者"${input.data.providerID}"失败。请检查凭据和配置。`
  }
  if (Config.JsonError.isInstance(input)) {
    return `配置文件${input.data.path}不是有效的JSON(C)` + (input.data.message ? `: ${input.data.message}` : "")
  }
  if (Config.ConfigDirectoryTypoError.isInstance(input)) {
    return `目录"${input.data.dir}"在${input.data.path}中无效。请将目录重命名为"${input.data.suggestion}"或删除它。这是一个常见的拼写错误。`
  }
  if (ConfigMarkdown.FrontmatterError.isInstance(input)) {
    return `解析${input.data.path}中的前置元数据失败:\n${input.data.message}`
  }
  if (Config.InvalidError.isInstance(input))
    return [
      `配置无效${input.data.path && input.data.path !== "config" ? ` (位于 ${input.data.path})` : ""}` +
        (input.data.message ? `: ${input.data.message}` : ""),
      ...(input.data.issues?.map((issue) => "↳ " + issue.message + " " + issue.path.join(".")) ?? []),
    ].join("\n")

  if (UI.CancelledError.isInstance(input)) return ""
}

// 格式化未知错误
export function FormatUnknownError(input: unknown): string {
  if (input instanceof Error) {
    return input.stack ?? `${input.name}: ${input.message}` // 返回堆栈信息或错误名称和消息
  }

  if (typeof input === "object" && input !== null) {
    try {
      const json = JSON.stringify(input, null, 2) // 尝试序列化为JSON
      if (json && json !== "{}") return json
    } catch {}
  }

  return String(input) // 转换为字符串返回
}
