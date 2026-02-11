import {
  type LanguageModelV2CallWarning,
  type LanguageModelV2Prompt,
  type LanguageModelV2ToolCallPart,
  UnsupportedFunctionalityError,
} from "@ai-sdk/provider"
import { convertToBase64, parseProviderOptions } from "@ai-sdk/provider-utils"
import { z } from "zod/v4"
import type { OpenAIResponsesInput, OpenAIResponsesReasoning } from "./openai-responses-api-types"
import { localShellInputSchema, localShellOutputSchema } from "./tool/local-shell"

/**
 * 根据给定前缀检查字符串是否为文件ID
 * 如果prefixes未定义则返回false(禁用文件ID检测)
 */
function isFileId(data: string, prefixes?: readonly string[]): boolean {
  if (!prefixes) return false
  return prefixes.some((prefix) => data.startsWith(prefix))
}

/**
 * 转换为OpenAI Responses输入格式
 * 将LanguageModelV2Prompt转换为OpenAI Responses API输入格式
 */
export async function convertToOpenAIResponsesInput({
  prompt, // 提示内容
  systemMessageMode, // 系统消息模式
  fileIdPrefixes, // 文件ID前缀
  store, // 是否存储
  hasLocalShellTool = false, // 是否具有本地Shell工具
}: {
  prompt: LanguageModelV2Prompt // 语言模型V2提示
  systemMessageMode: "system" | "developer" | "remove" // 系统消息模式:system、developer或remove
  fileIdPrefixes?: readonly string[] // 文件ID前缀(可选)
  store: boolean // 是否存储
  hasLocalShellTool?: boolean // 是否具有本地Shell工具(可选)
}): Promise<{
  input: OpenAIResponsesInput // OpenAI Responses输入
  warnings: Array<LanguageModelV2CallWarning> // 警告数组
}> {
  const input: OpenAIResponsesInput = [] // 输入数组
  const warnings: Array<LanguageModelV2CallWarning> = [] // 警告数组

  // 遍历提示中的每个消息
  for (const { role, content } of prompt) {
    switch (role) {
      case "system": {
        // 系统消息
        switch (systemMessageMode) {
          case "system": {
            // 使用system角色
            input.push({ role: "system", content })
            break
          }
          case "developer": {
            // 使用developer角色
            input.push({ role: "developer", content })
            break
          }
          case "remove": {
            // 移除系统消息
            warnings.push({
              type: "other",
              message: "系统消息对此模型被移除", // 系统消息对此模型被移除
            })
            break
          }
          default: {
            // 不支持的系统消息模式
            const _exhaustiveCheck: never = systemMessageMode
            throw new Error(`不支持的系统消息模式:${_exhaustiveCheck}`) // 不支持的系统消息模式
          }
        }
        break
      }

      case "user": {
        // 用户消息
        input.push({
          role: "user",
          content: content.map((part, index) => {
            // 遍历用户消息的每个部分
            switch (part.type) {
              case "text": {
                // 文本类型
                return { type: "input_text", text: part.text }
              }
              case "file": {
                // 文件类型
                if (part.mediaType.startsWith("image/")) {
                  // 图像文件
                  const mediaType = part.mediaType === "image/*" ? "image/jpeg" : part.mediaType // 处理通配符媒体类型

                  return {
                    type: "input_image",
                    ...(part.data instanceof URL // 处理URL数据
                      ? { image_url: part.data.toString() }
                      : typeof part.data === "string" && isFileId(part.data, fileIdPrefixes) // 处理文件ID
                        ? { file_id: part.data }
                        : {
                            // 处理Base64数据
                            image_url: `data:${mediaType};base64,${convertToBase64(part.data)}`,
                          }),
                    detail: part.providerOptions?.openai?.imageDetail, // 图像细节级别
                  }
                } else if (part.mediaType === "application/pdf") {
                  // PDF文件
                  if (part.data instanceof URL) {
                    // 处理URL数据
                    return {
                      type: "input_file",
                      file_url: part.data.toString(),
                    }
                  }
                  return {
                    type: "input_file",
                    ...(typeof part.data === "string" && isFileId(part.data, fileIdPrefixes) // 处理文件ID
                      ? { file_id: part.data }
                      : {
                          // 处理Base64数据
                          filename: part.filename ?? `part-${index}.pdf`, // 使用默认文件名
                          file_data: `data:application/pdf;base64,${convertToBase64(part.data)}`,
                        }),
                  }
                } else {
                  // 不支持的媒体类型
                  throw new UnsupportedFunctionalityError({
                    functionality: `文件部分媒体类型 ${part.mediaType}`, // 文件部分媒体类型
                  })
                }
              }
            }
          }),
        })

        break
      }

      case "assistant": {
        // 助手消息
        const reasoningMessages: Record<string, OpenAIResponsesReasoning> = {} // 推理消息记录
        const toolCallParts: Record<string, LanguageModelV2ToolCallPart> = {} // 工具调用部分记录

        // 遍历助手消息的每个部分
        for (const part of content) {
          switch (part.type) {
            case "text": {
              // 文本类型
              input.push({
                role: "assistant",
                content: [{ type: "output_text", text: part.text }],
                id: (part.providerOptions?.openai?.itemId as string) ?? undefined, // 项目ID
              })
              break
            }
            case "tool-call": {
              // 工具调用类型
              toolCallParts[part.toolCallId] = part // 存储工具调用部分

              if (part.providerExecuted) {
                // 如果工具已由提供者执行
                break
              }

              if (hasLocalShellTool && part.toolName === "local_shell") {
                // 处理本地Shell工具
                const parsedInput = localShellInputSchema.parse(part.input) // 解析输入
                input.push({
                  type: "local_shell_call",
                  call_id: part.toolCallId,
                  id: (part.providerOptions?.openai?.itemId as string) ?? undefined,
                  action: {
                    type: "exec",
                    command: parsedInput.action.command,
                    timeout_ms: parsedInput.action.timeoutMs,
                    user: parsedInput.action.user,
                    working_directory: parsedInput.action.workingDirectory,
                    env: parsedInput.action.env,
                  },
                })

                break
              }

              // 处理普通函数调用
              input.push({
                type: "function_call",
                call_id: part.toolCallId,
                name: part.toolName,
                arguments: JSON.stringify(part.input), // 将输入转换为JSON字符串
                id: (part.providerOptions?.openai?.itemId as string) ?? undefined,
              })
              break
            }

            // 助手工具结果部分来自提供者执行的工具:
            case "tool-result": {
              // 工具结果类型
              if (store) {
                // 如果启用了存储
                // 使用项目引用来引用内置工具的工具结果
                input.push({ type: "item_reference", id: part.toolCallId })
              } else {
                // 如果未启用存储
                warnings.push({
                  type: "other",
                  message: `当store为false时,OpenAI工具${part.toolName}的结果不会发送到API`, // 当store为false时,OpenAI工具的结果不会发送到API
                })
              }

              break
            }

            case "reasoning": {
              // 推理类型
              const providerOptions = await parseProviderOptions({
                // 解析提供者选项
                provider: "openai",
                providerOptions: part.providerOptions,
                schema: openaiResponsesReasoningProviderOptionsSchema,
              })

              const reasoningId = providerOptions?.itemId // 推理ID

              if (reasoningId != null) {
                // 如果存在推理ID
                const reasoningMessage = reasoningMessages[reasoningId] // 获取推理消息

                if (store) {
                  // 如果启用了存储
                  if (reasoningMessage === undefined) {
                    // 如果推理消息不存在
                    // 使用项目引用来引用推理(单个引用)
                    input.push({ type: "item_reference", id: reasoningId })

                    // 存储未使用的推理消息以标记ID为已使用
                    reasoningMessages[reasoningId] = {
                      type: "reasoning",
                      id: reasoningId,
                      summary: [],
                    }
                  }
                } else {
                  // 如果未启用存储
                  const summaryParts: Array<{
                    // 摘要部分数组
                    type: "summary_text"
                    text: string
                  }> = []

                  if (part.text.length > 0) {
                    // 如果推理文本不为空
                    summaryParts.push({
                      type: "summary_text",
                      text: part.text,
                    })
                  } else if (reasoningMessage !== undefined) {
                    // 如果推理消息已存在但文本为空
                    warnings.push({
                      type: "other",
                      message: `无法将空推理部分附加到现有推理序列。跳过推理部分:${JSON.stringify(part)}`, // 无法将空推理部分附加到现有推理序列。跳过推理部分
                    })
                  }

                  if (reasoningMessage === undefined) {
                    // 如果推理消息不存在
                    reasoningMessages[reasoningId] = {
                      type: "reasoning",
                      id: reasoningId,
                      encrypted_content: providerOptions?.reasoningEncryptedContent, // 加密内容
                      summary: summaryParts,
                    }
                    input.push(reasoningMessages[reasoningId])
                  } else {
                    // 如果推理消息已存在
                    reasoningMessage.summary.push(...summaryParts) // 追加摘要部分
                  }
                }
              } else {
                // 如果不存在推理ID
                warnings.push({
                  type: "other",
                  message: `不支持非OpenAI推理部分。跳过推理部分:${JSON.stringify(part)}`, // 不支持非OpenAI推理部分。跳过推理部分
                })
              }
              break
            }
          }
        }

        break
      }

      case "tool": {
        // 工具消息
        // 遍历工具消息的每个部分
        for (const part of content) {
          const output = part.output // 获取输出

          if (hasLocalShellTool && part.toolName === "local_shell" && output.type === "json") {
            // 处理本地Shell工具输出
            input.push({
              type: "local_shell_call_output",
              call_id: part.toolCallId,
              output: localShellOutputSchema.parse(output.value).output,
            })
            break
          }

          let contentValue: string // 内容值
          switch (output.type) {
            case "text": // 文本类型
            case "error-text": // 错误文本类型
              contentValue = output.value
              break
            case "content": // 内容类型
            case "json": // JSON类型
            case "error-json": // 错误JSON类型
              contentValue = JSON.stringify(output.value) // 转换为JSON字符串
              break
          }

          // 处理普通函数调用输出
          input.push({
            type: "function_call_output",
            call_id: part.toolCallId,
            output: contentValue,
          })
        }

        break
      }

      default: {
        // 不支持的角色
        const _exhaustiveCheck: never = role
        throw new Error(`不支持的角色:${_exhaustiveCheck}`) // 不支持的角色
      }
    }
  }

  return { input, warnings } // 返回输入和警告
}

// OpenAI Responses推理提供者选项Schema
const openaiResponsesReasoningProviderOptionsSchema = z.object({
  itemId: z.string().nullish(), // 项目ID(可为null)
  reasoningEncryptedContent: z.string().nullish(), // 推理加密内容(可为null)
})

// OpenAI Responses推理提供者选项类型
export type OpenAIResponsesReasoningProviderOptions = z.infer<typeof openaiResponsesReasoningProviderOptionsSchema>
