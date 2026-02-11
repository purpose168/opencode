import z from "zod" // 数据验证库
import type { Agent } from "../agent/agent" // Agent类型
import type { PermissionNext } from "../permission/next" // 权限请求类型
import type { MessageV2 } from "../session/message-v2" // 消息V2类型

export namespace Tool {
  interface Metadata {
    [key: string]: any // 元数据键值对
  }

  export interface InitContext {
    agent?: Agent.Info // 可选的Agent信息
  }

  export type Context<M extends Metadata = Metadata> = {
    sessionID: string // 会话ID
    messageID: string // 消息ID
    agent: string // 代理名称
    abort: AbortSignal // 中止信号
    callID?: string // 调用ID（可选）
    extra?: { [key: string]: any } // 额外数据（可选）
    metadata(input: { title?: string; metadata?: M }): void // 设置元数据
    ask(input: Omit<PermissionNext.Request, "id" | "sessionID" | "tool">): Promise<void> // 请求权限
  }
  export interface Info<Parameters extends z.ZodType = z.ZodType, M extends Metadata = Metadata> {
    id: string // 工具ID
    init: (ctx?: InitContext) => Promise<{
      description: string // 工具描述
      parameters: Parameters // 参数schema
      execute(
        args: z.infer<Parameters>, // 参数类型
        ctx: Context, // 上下文
      ): Promise<{
        title: string // 标题
        metadata: M // 元数据
        output: string // 输出内容
        attachments?: MessageV2.FilePart[] // 附件（可选）
      }>
      formatValidationError?(error: z.ZodError): string // 格式化验证错误（可选）
    }>
  }

  export type InferParameters<T extends Info> = T extends Info<infer P> ? z.infer<P> : never // 推断参数类型
  export type InferMetadata<T extends Info> = T extends Info<any, infer M> ? M : never // 推断元数据类型

  // 定义工具
  export function define<Parameters extends z.ZodType, Result extends Metadata>(
    id: string,
    init: Info<Parameters, Result>["init"] | Awaited<ReturnType<Info<Parameters, Result>["init"]>>,
  ): Info<Parameters, Result> {
    return {
      id,
      init: async (ctx) => {
        const toolInfo = init instanceof Function ? await init(ctx) : init // 获取工具信息
        const execute = toolInfo.execute
        toolInfo.execute = (args, ctx) => {
          try {
            toolInfo.parameters.parse(args) // 验证参数
          } catch (error) {
            if (error instanceof z.ZodError && toolInfo.formatValidationError) {
              throw new Error(toolInfo.formatValidationError(error), { cause: error })
            }
            throw new Error(`${id} 工具使用了无效的参数：${error}。\n请重写输入以满足预期的schema。`, { cause: error })
          }
          return execute(args, ctx)
        }
        return toolInfo
      },
    }
  }
}
