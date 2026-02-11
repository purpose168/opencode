import z from "zod"
import DESCRIPTION from "./batch.txt"
import { Tool } from "./tool"

// 禁止在批次中使用的工具集合
const DISALLOWED = new Set(["batch"])
// 从建议中过滤掉的工具集合
const FILTERED_FROM_SUGGESTIONS = new Set(["invalid", "patch", ...DISALLOWED])

// 定义批次工具，用于并行执行多个工具调用
export const BatchTool = Tool.define("batch", async () => {
  return {
    description: DESCRIPTION,
    parameters: z.object({
      tool_calls: z
        .array(
          z.object({
            tool: z.string().describe("要执行的工具名称"),
            parameters: z.object({}).loose().describe("工具的参数"),
          }),
        )
        .min(1, "至少提供一个工具调用")
        .describe("要并行执行的工具调用数组"),
    }),
    formatValidationError(error) {
      const formattedErrors = error.issues
        .map((issue) => {
          const path = issue.path.length > 0 ? issue.path.join(".") : "root"
          return `  - ${path}: ${issue.message}`
        })
        .join("\n")

      return `工具'batch'的参数无效：\n${formattedErrors}\n\n期望的载荷格式：\n  [{"tool": "tool_name", "parameters": {...}}, {...}]`
    },
    async execute(params, ctx) {
      const { Session } = await import("../session")
      const { Identifier } = await import("../id/id")

      // 限制最多执行10个工具调用，超过的将被丢弃
      const toolCalls = params.tool_calls.slice(0, 10)
      const discardedCalls = params.tool_calls.slice(10)

      // 获取可用工具并创建工具映射
      const { ToolRegistry } = await import("./registry")
      const availableTools = await ToolRegistry.tools("")
      const toolMap = new Map(availableTools.map((t) => [t.id, t]))

      // 执行单个工具调用的异步函数
      const executeCall = async (call: (typeof toolCalls)[0]) => {
        const callStartTime = Date.now()
        const partID = Identifier.ascending("part")

        try {
          // 检查工具是否被禁止在批次中使用
          if (DISALLOWED.has(call.tool)) {
            throw new Error(`工具 '${call.tool}' 不允许在批次中使用。禁止的工具：${Array.from(DISALLOWED).join(", ")}`)
          }

          // 查找工具
          const tool = toolMap.get(call.tool)
          if (!tool) {
            const availableToolsList = Array.from(toolMap.keys()).filter((name) => !FILTERED_FROM_SUGGESTIONS.has(name))
            throw new Error(
              `工具 '${call.tool}' 不在注册表中。外部工具（MCP、环境）无法批量执行 - 请直接调用它们。可用工具：${availableToolsList.join(", ")}`,
            )
          }
          const validatedParams = tool.parameters.parse(call.parameters)

          // 更新会话部分状态为运行中
          await Session.updatePart({
            id: partID,
            messageID: ctx.messageID,
            sessionID: ctx.sessionID,
            type: "tool",
            tool: call.tool,
            callID: partID,
            state: {
              status: "running",
              input: call.parameters,
              time: {
                start: callStartTime,
              },
            },
          })

          // 执行工具
          const result = await tool.execute(validatedParams, { ...ctx, callID: partID })

          // 更新会话部分状态为已完成
          await Session.updatePart({
            id: partID,
            messageID: ctx.messageID,
            sessionID: ctx.sessionID,
            type: "tool",
            tool: call.tool,
            callID: partID,
            state: {
              status: "completed",
              input: call.parameters,
              output: result.output,
              title: result.title,
              metadata: result.metadata,
              attachments: result.attachments,
              time: {
                start: callStartTime,
                end: Date.now(),
              },
            },
          })

          return { success: true as const, tool: call.tool, result }
        } catch (error) {
          // 更新会话部分状态为错误
          await Session.updatePart({
            id: partID,
            messageID: ctx.messageID,
            sessionID: ctx.sessionID,
            type: "tool",
            tool: call.tool,
            callID: partID,
            state: {
              status: "error",
              input: call.parameters,
              error: error instanceof Error ? error.message : String(error),
              time: {
                start: callStartTime,
                end: Date.now(),
              },
            },
          })

          return { success: false as const, tool: call.tool, error }
        }
      }

      // 并行执行所有工具调用
      const results = await Promise.all(toolCalls.map((call) => executeCall(call)))

      // 将丢弃的调用添加为错误
      const now = Date.now()
      for (const call of discardedCalls) {
        const partID = Identifier.ascending("part")
        await Session.updatePart({
          id: partID,
          messageID: ctx.messageID,
          sessionID: ctx.sessionID,
          type: "tool",
          tool: call.tool,
          callID: partID,
          state: {
            status: "error",
            input: call.parameters,
            error: "批次中最多允许10个工具",
            time: { start: now, end: now },
          },
        })
        results.push({
          success: false as const,
          tool: call.tool,
          error: new Error("批次中最多允许10个工具"),
        })
      }

      // 统计成功和失败的调用数量
      const successfulCalls = results.filter((r) => r.success).length
      const failedCalls = results.length - successfulCalls

      // 生成输出消息
      const outputMessage =
        failedCalls > 0
          ? `成功执行了 ${successfulCalls}/${results.length} 个工具。${failedCalls} 个失败。`
          : `所有 ${successfulCalls} 个工具执行成功。\n\n在您的下一个回复中继续使用批次工具以获得最佳性能！`

      return {
        title: `批次执行（${successfulCalls}/${results.length} 成功）`,
        output: outputMessage,
        attachments: results.filter((result) => result.success).flatMap((r) => r.result.attachments ?? []),
        metadata: {
          totalCalls: results.length,
          successful: successfulCalls,
          failed: failedCalls,
          tools: params.tool_calls.map((c) => c.tool),
          details: results.map((r) => ({ tool: r.tool, success: r.success })),
        },
      }
    },
  }
})
