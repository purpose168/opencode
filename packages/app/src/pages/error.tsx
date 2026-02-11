import { TextField } from "@opencode-ai/ui/text-field"
import { Logo } from "@opencode-ai/ui/logo"
import { Button } from "@opencode-ai/ui/button"
import { Component, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { usePlatform } from "@/context/platform"
import { Icon } from "@opencode-ai/ui/icon"

export type InitError = {
  name: string
  data: Record<string, unknown>
}

function isInitError(error: unknown): error is InitError {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    "data" in error &&
    typeof (error as InitError).data === "object"
  )
}

function safeJson(value: unknown): string {
  const seen = new WeakSet<object>()
  const json = JSON.stringify(
    value,
    (_key, val) => {
      if (typeof val === "bigint") return val.toString()
      if (typeof val === "object" && val) {
        if (seen.has(val)) return "[Circular]"
        seen.add(val)
      }
      return val
    },
    2,
  )
  return json ?? String(value)
}

function formatInitError(error: InitError): string {
  const data = error.data
  switch (error.name) {
    case "MCPFailed":
      return `MCP 服务器 "${data.name}" 失败。注意，OpenCode 尚未支持 MCP 认证。`
    case "ProviderAuthError": {
      const providerID = typeof data.providerID === "string" ? data.providerID : "unknown"
      const message = typeof data.message === "string" ? data.message : safeJson(data.message)
      return `提供者认证失败 (${providerID}): ${message}`
    }
    case "APIError": {
      const message = typeof data.message === "string" ? data.message : "API 错误"
      const lines: string[] = [message]

      if (typeof data.statusCode === "number") {
        lines.push(`状态: ${data.statusCode}`)
      }

      if (typeof data.isRetryable === "boolean") {
        lines.push(`可重试: ${data.isRetryable}`)
      }

      if (typeof data.responseBody === "string" && data.responseBody) {
        lines.push(`响应体:\n${data.responseBody}`)
      }

      return lines.join("\n")
    }
    case "ProviderModelNotFoundError": {
      const { providerID, modelID, suggestions } = data as {
        providerID: string
        modelID: string
        suggestions?: string[]
      }
      return [
        `模型未找到: ${providerID}/${modelID}`,
        ...(Array.isArray(suggestions) && suggestions.length ? ["您是指: " + suggestions.join(", ")] : []),
        `检查您的配置 (opencode.json) 提供者/模型名称`,
      ].join("\n")
    }
    case "ProviderInitError": {
      const providerID = typeof data.providerID === "string" ? data.providerID : "unknown"
      return `初始化提供者 "${providerID}" 失败。检查凭据和配置。`
    }
    case "ConfigJsonError": {
      const message = typeof data.message === "string" ? data.message : ""
      return `位于 ${data.path} 的配置文件不是有效的 JSON(C)` + (message ? `: ${message}` : "")
    }
    case "ConfigDirectoryTypoError":
      return `位于 ${data.path} 中的目录 "${data.dir}" 无效。将目录重命名为 "${data.suggestion}" 或删除它。这是一个常见的拼写错误。`
    case "ConfigFrontmatterError":
      return `解析 ${data.path} 中的前置内容失败:\n${data.message}`
    case "ConfigInvalidError": {
      const issues = Array.isArray(data.issues)
        ? data.issues.map(
            (issue: { message: string; path: string[] }) => "↳ " + issue.message + " " + issue.path.join("."),
          )
        : []
      const message = typeof data.message === "string" ? data.message : ""
      return [`位于 ${data.path} 的配置文件无效` + (message ? `: ${message}` : ""), ...issues].join("\n")
    }
    case "UnknownError":
      return typeof data.message === "string" ? data.message : safeJson(data)
    default:
      if (typeof data.message === "string") return data.message
      return safeJson(data)
  }
}

function formatErrorChain(error: unknown, depth = 0, parentMessage?: string): string {
  if (!error) return "Unknown error"

  if (isInitError(error)) {
    const message = formatInitError(error)
    if (depth > 0 && parentMessage === message) return ""
    const indent = depth > 0 ? `\n${"─".repeat(40)}\nCaused by:\n` : ""
    return indent + `${error.name}\n${message}`
  }

  if (error instanceof Error) {
    const isDuplicate = depth > 0 && parentMessage === error.message
    const parts: string[] = []
    const indent = depth > 0 ? `\n${"─".repeat(40)}\nCaused by:\n` : ""

    const header = `${error.name}${error.message ? `: ${error.message}` : ""}`
    const stack = error.stack?.trim()

    if (stack) {
      const startsWithHeader = stack.startsWith(header)

      if (isDuplicate && startsWithHeader) {
        const trace = stack.split("\n").slice(1).join("\n").trim()
        if (trace) {
          parts.push(indent + trace)
        }
      }

      if (isDuplicate && !startsWithHeader) {
        parts.push(indent + stack)
      }

      if (!isDuplicate && startsWithHeader) {
        parts.push(indent + stack)
      }

      if (!isDuplicate && !startsWithHeader) {
        parts.push(indent + `${header}\n${stack}`)
      }
    }

    if (!stack && !isDuplicate) {
      parts.push(indent + header)
    }

    if (error.cause) {
      const causeResult = formatErrorChain(error.cause, depth + 1, error.message)
      if (causeResult) {
        parts.push(causeResult)
      }
    }

    return parts.join("\n\n")
  }

  if (typeof error === "string") {
    if (depth > 0 && parentMessage === error) return ""
    const indent = depth > 0 ? `\n${"─".repeat(40)}\nCaused by:\n` : ""
    return indent + error
  }

  const indent = depth > 0 ? `\n${"─".repeat(40)}\nCaused by:\n` : ""
  return indent + safeJson(error)
}

function formatError(error: unknown): string {
  return formatErrorChain(error, 0)
}

interface ErrorPageProps {
  error: unknown
}

export const ErrorPage: Component<ErrorPageProps> = (props) => {
  const platform = usePlatform()
  const [store, setStore] = createStore({
    checking: false,
    version: undefined as string | undefined,
  })

  async function checkForUpdates() {
    if (!platform.checkUpdate) return
    setStore("checking", true)
    const result = await platform.checkUpdate()
    setStore("checking", false)
    if (result.updateAvailable && result.version) setStore("version", result.version)
  }

  async function installUpdate() {
    if (!platform.update || !platform.restart) return
    await platform.update()
    await platform.restart()
  }

  return (
    <div class="relative flex-1 h-screen w-screen min-h-0 flex flex-col items-center justify-center bg-background-base font-sans">
      <div class="w-2/3 max-w-3xl flex flex-col items-center justify-center gap-8">
        <Logo class="w-58.5 opacity-12 shrink-0" />
        <div class="flex flex-col items-center gap-2 text-center">
          <h1 class="text-lg font-medium text-text-strong">出现了问题</h1>
          <p class="text-sm text-text-weak">加载应用程序时发生错误。</p>
        </div>
        <TextField
          value={formatError(props.error)}
          readOnly
          copyable
          multiline
          class="max-h-96 w-full font-mono text-xs no-scrollbar"
          label="错误详情"
          hideLabel
        />
        <div class="flex items-center gap-3">
          <Button size="large" onClick={platform.restart}>
            重启
          </Button>
          <Show when={platform.checkUpdate}>
            <Show
              when={store.version}
              fallback={
                <Button size="large" variant="ghost" onClick={checkForUpdates} disabled={store.checking}>
                  {store.checking ? "检查中..." : "检查更新"}
                </Button>
              }
            >
              <Button size="large" onClick={installUpdate}>
                更新到 {store.version}
              </Button>
            </Show>
          </Show>
        </div>
        <div class="flex flex-col items-center gap-2">
          <div class="flex items-center justify-center gap-1">
            请向 OpenCode 团队报告此错误
            <button
              type="button"
              class="flex items-center text-text-interactive-base gap-1"
              onClick={() => platform.openLink("https://opencode.ai/desktop-feedback")}
            >
              <div>在 Discord 上</div>
              <Icon name="discord" class="text-text-interactive-base" />
            </button>
          </div>
          <Show when={platform.version}>
            <p class="text-xs text-text-weak">版本: {platform.version}</p>
          </Show>
        </div>
      </div>
    </div>
  )
}
