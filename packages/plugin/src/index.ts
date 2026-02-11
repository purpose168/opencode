// 导入 SDK 相关类型定义
import type {
  Event,
  createOpencodeClient,
  Project,
  Model,
  Provider,
  Permission,
  UserMessage,
  Message,
  Part,
  Auth,
  Config,
} from "@opencode-ai/sdk"

// 导入 BunShell 类型定义
import type { BunShell } from "./shell"
// 导入 ToolDefinition 类型定义
import { type ToolDefinition } from "./tool"

// 导出 tool 相关内容
export * from "./tool"

// 定义提供者上下文类型
export type ProviderContext = {
  source: "env" | "config" | "custom" | "api"
  info: Provider
  options: Record<string, any>
}

// 定义插件输入类型
export type PluginInput = {
  client: ReturnType<typeof createOpencodeClient>
  project: Project
  directory: string
  worktree: string
  serverUrl: URL
  $: BunShell
}

// 定义插件类型
export type Plugin = (input: PluginInput) => Promise<Hooks>

// 定义认证钩子类型
export type AuthHook = {
  provider: string
  loader?: (auth: () => Promise<Auth>, provider: Provider) => Promise<Record<string, any>>
  methods: (
    | {
        type: "oauth"
        label: string
        prompts?: Array<
          | {
              type: "text"
              key: string
              message: string
              placeholder?: string
              validate?: (value: string) => string | undefined
              condition?: (inputs: Record<string, string>) => boolean
            }
          | {
              type: "select"
              key: string
              message: string
              options: Array<{
                label: string
                value: string
                hint?: string
              }>
              condition?: (inputs: Record<string, string>) => boolean
            }
        >
        authorize(inputs?: Record<string, string>): Promise<AuthOuathResult>
      }
    | {
        type: "api"
        label: string
        prompts?: Array<
          | {
              type: "text"
              key: string
              message: string
              placeholder?: string
              validate?: (value: string) => string | undefined
              condition?: (inputs: Record<string, string>) => boolean
            }
          | {
              type: "select"
              key: string
              message: string
              options: Array<{
                label: string
                value: string
                hint?: string
              }>
              condition?: (inputs: Record<string, string>) => boolean
            }
        >
        authorize?(inputs?: Record<string, string>): Promise<
          | {
              type: "success"
              key: string
              provider?: string
            }
          | {
              type: "failed"
            }
        >
      }
  )[]
}

// 定义 OAuth 认证结果类型
export type AuthOuathResult = { url: string; instructions: string } & (
  | {
      method: "auto"
      callback(): Promise<
        | ({
            type: "success"
            provider?: string
          } & (
            | {
                refresh: string
                access: string
                expires: number
              }
            | { key: string }
          ))
        | {
            type: "failed"
          }
      >
    }
  | {
      method: "code"
      callback(code: string): Promise<
        | ({
            type: "success"
            provider?: string
          } & (
            | {
                refresh: string
                access: string
                expires: number
              }
            | { key: string }
          ))
        | {
            type: "failed"
          }
      >
    }
)

// 定义钩子接口
export interface Hooks {
  // 事件钩子
  event?: (input: { event: Event }) => Promise<void>
  // 配置钩子
  config?: (input: Config) => Promise<void>
  // 工具定义
  tool?: {
    [key: string]: ToolDefinition
  }
  // 认证钩子
  auth?: AuthHook
  /**
   * 当接收到新消息时调用
   */
  "chat.message"?: (
    input: { sessionID: string; agent?: string; model?: { providerID: string; modelID: string }; messageID?: string },
    output: { message: UserMessage; parts: Part[] },
  ) => Promise<void>
  /**
   * 修改发送到 LLM 的参数
   */
  "chat.params"?: (
    input: { sessionID: string; agent: string; model: Model; provider: ProviderContext; message: UserMessage },
    output: { temperature: number; topP: number; topK: number; options: Record<string, any> },
  ) => Promise<void>
  // 权限询问钩子
  "permission.ask"?: (input: Permission, output: { status: "ask" | "deny" | "allow" }) => Promise<void>
  // 工具执行前钩子
  "tool.execute.before"?: (
    input: { tool: string; sessionID: string; callID: string },
    output: { args: any },
  ) => Promise<void>
  // 工具执行后钩子
  "tool.execute.after"?: (
    input: { tool: string; sessionID: string; callID: string },
    output: {
      title: string
      output: string
      metadata: any
    },
  ) => Promise<void>
  // 实验性：聊天消息转换钩子
  "experimental.chat.messages.transform"?: (
    input: {},
    output: {
      messages: {
        info: Message
        parts: Part[]
      }[]
    },
  ) => Promise<void>
  // 实验性：聊天系统提示词转换钩子
  "experimental.chat.system.transform"?: (
    input: {},
    output: {
      system: string[]
    },
  ) => Promise<void>
  /**
   * 在会话压缩开始之前调用。允许插件自定义压缩提示词。
   *
   * - `context`: 附加到默认提示词的额外上下文字符串
   * - `prompt`: 如果设置，则完全替换默认的压缩提示词
   */
  "experimental.session.compacting"?: (
    input: { sessionID: string },
    output: { context: string[]; prompt?: string },
  ) => Promise<void>
  // 实验性：文本补全钩子
  "experimental.text.complete"?: (
    input: { sessionID: string; messageID: string; partID: string },
    output: { text: string },
  ) => Promise<void>
}
