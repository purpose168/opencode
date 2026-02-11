import {
  APICallError,
  type LanguageModelV2,
  type LanguageModelV2CallWarning,
  type LanguageModelV2Content,
  type LanguageModelV2FinishReason,
  type LanguageModelV2ProviderDefinedTool,
  type LanguageModelV2StreamPart,
  type LanguageModelV2Usage,
  type SharedV2ProviderMetadata,
} from "@ai-sdk/provider"
import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonResponseHandler,
  generateId,
  parseProviderOptions,
  type ParseResult,
  postJsonToApi,
} from "@ai-sdk/provider-utils"
import { z } from "zod/v4"
import { convertToOpenAIResponsesInput } from "./convert-to-openai-responses-input"
import { mapOpenAIResponseFinishReason } from "./map-openai-responses-finish-reason"
import type { OpenAIConfig } from "./openai-config"
import { openaiFailedResponseHandler } from "./openai-error"
import type { OpenAIResponsesIncludeOptions, OpenAIResponsesIncludeValue } from "./openai-responses-api-types"
import { prepareResponsesTools } from "./openai-responses-prepare-tools"
import type { OpenAIResponsesModelId } from "./openai-responses-settings"
import { codeInterpreterInputSchema, codeInterpreterOutputSchema } from "./tool/code-interpreter"
import { fileSearchOutputSchema } from "./tool/file-search"
import { imageGenerationOutputSchema } from "./tool/image-generation"
import { localShellInputSchema } from "./tool/local-shell"

// Web搜索调用项Schema定义
const webSearchCallItem = z.object({
  type: z.literal("web_search_call"), // 类型:web_search_call
  id: z.string(), // 调用ID
  status: z.string(), // 状态
  action: z // 操作
    .discriminatedUnion("type", [
      z.object({
        type: z.literal("search"), // 类型:search(搜索)
        query: z.string().nullish(), // 查询字符串(可选)
      }),
      z.object({
        type: z.literal("open_page"), // 类型:open_page(打开页面)
        url: z.string(), // URL
      }),
      z.object({
        type: z.literal("find"), // 类型:find(查找)
        url: z.string(), // URL
        pattern: z.string(), // 模式
      }),
    ])
    .nullish(), // 可选
})

// 文件搜索调用项Schema定义
const fileSearchCallItem = z.object({
  type: z.literal("file_search_call"), // 类型:file_search_call
  id: z.string(), // 调用ID
  queries: z.array(z.string()), // 查询数组
  results: z // 结果数组
    .array(
      z.object({
        attributes: z.record(z.string(), z.unknown()), // 属性
        file_id: z.string(), // 文件ID
        filename: z.string(), // 文件名
        score: z.number(), // 分数
        text: z.string(), // 文本
      }),
    )
    .nullish(), // 可选
})

// 代码解释器调用项Schema定义
const codeInterpreterCallItem = z.object({
  type: z.literal("code_interpreter_call"), // 类型:code_interpreter_call
  id: z.string(), // 调用ID
  code: z.string().nullable(), // 代码(可为null)
  container_id: z.string(), // 容器ID
  outputs: z // 输出数组
    .array(
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("logs"), logs: z.string() }), // 日志类型
        z.object({ type: z.literal("image"), url: z.string() }), // 图像类型
      ]),
    )
    .nullable(), // 可为null
})

// 本地Shell调用项Schema定义
const localShellCallItem = z.object({
  type: z.literal("local_shell_call"), // 类型:local_shell_call
  id: z.string(), // 调用ID
  call_id: z.string(), // 调用ID
  action: z.object({
    // 操作
    type: z.literal("exec"), // 类型:exec(执行)
    command: z.array(z.string()), // 命令数组
    timeout_ms: z.number().optional(), // 超时时间(毫秒,可选)
    user: z.string().optional(), // 用户(可选)
    working_directory: z.string().optional(), // 工作目录(可选)
    env: z.record(z.string(), z.string()).optional(), // 环境变量(可选)
  }),
})

// 图像生成调用项Schema定义
const imageGenerationCallItem = z.object({
  type: z.literal("image_generation_call"), // 类型:image_generation_call
  id: z.string(), // 调用ID
  result: z.string(), // 结果
})

/**
 * `top_logprobs`请求体参数可以设置为0到20之间的整数
 * 指定在每个令牌位置返回的最可能的令牌数量,每个令牌具有关联的对数概率
 *
 * @see https://platform.openai.com/docs/api-reference/responses/create#responses_create-top_logprobs
 */
const TOP_LOGPROBS_MAX = 20 // 最大的对数概率数量

// 对数概率Schema定义
const LOGPROBS_SCHEMA = z.array(
  z.object({
    token: z.string(), // 令牌
    logprob: z.number(), // 对数概率
    top_logprobs: z.array(
      // 前N个对数概率
      z.object({
        token: z.string(), // 令牌
        logprob: z.number(), // 对数概率
      }),
    ),
  }),
)

// OpenAI Responses语言模型类,实现LanguageModelV2接口
export class OpenAIResponsesLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2" // 规范版本

  readonly modelId: OpenAIResponsesModelId // 模型ID

  private readonly config: OpenAIConfig // 配置

  // 构造函数,初始化模型ID和配置
  constructor(modelId: OpenAIResponsesModelId, config: OpenAIConfig) {
    this.modelId = modelId
    this.config = config
  }

  // 支持的URL类型
  readonly supportedUrls: Record<string, RegExp[]> = {
    "image/*": [/^https?:\/\/.*$/], // 图像类型支持HTTP/HTTPS
    "application/pdf": [/^https?:\/\/.*$/], // PDF类型支持HTTP/HTTPS
  }

  // 获取提供者名称
  get provider(): string {
    return this.config.provider
  }

  // 获取API调用参数的私有方法
  private async getArgs({
    maxOutputTokens, // 最大输出令牌数
    temperature, // 温度参数
    stopSequences, // 停止序列
    topP, // Top-P参数
    topK, // Top-K参数
    presencePenalty, // 存在惩罚
    frequencyPenalty, // 频率惩罚
    seed, // 随机种子
    prompt, // 提示内容
    providerOptions, // 提供者选项
    tools, // 工具列表
    toolChoice, // 工具选择
    responseFormat, // 响应格式
  }: Parameters<LanguageModelV2["doGenerate"]>[0]) {
    const warnings: LanguageModelV2CallWarning[] = [] // 警告数组
    const modelConfig = getResponsesModelConfig(this.modelId) // 获取模型配置

    if (topK != null) {
      warnings.push({ type: "unsupported-setting", setting: "topK" })
    }

    if (seed != null) {
      warnings.push({ type: "unsupported-setting", setting: "seed" })
    }

    if (presencePenalty != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "presencePenalty",
      })
    }

    if (frequencyPenalty != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "frequencyPenalty",
      })
    }

    if (stopSequences != null) {
      warnings.push({ type: "unsupported-setting", setting: "stopSequences" })
    }

    // 解析提供者选项
    const openaiOptions = await parseProviderOptions({
      provider: "openai",
      providerOptions,
      schema: openaiResponsesProviderOptionsSchema,
    })

    // 转换为OpenAI Responses输入格式
    const { input, warnings: inputWarnings } = await convertToOpenAIResponsesInput({
      prompt,
      systemMessageMode: modelConfig.systemMessageMode,
      fileIdPrefixes: this.config.fileIdPrefixes,
      store: openaiOptions?.store ?? true,
      hasLocalShellTool: hasOpenAITool("openai.local_shell"),
    })

    warnings.push(...inputWarnings) // 合并输入警告

    const strictJsonSchema = openaiOptions?.strictJsonSchema ?? false // 严格JSON Schema模式

    let include: OpenAIResponsesIncludeOptions = openaiOptions?.include // 包含选项

    // 添加包含选项的辅助函数
    function addInclude(key: OpenAIResponsesIncludeValue) {
      include = include != null ? [...include, key] : [key]
    }

    // 检查是否存在指定OpenAI工具的辅助函数
    function hasOpenAITool(id: string) {
      return tools?.find((tool) => tool.type === "provider-defined" && tool.id === id) != null
    }

    // 当请求logprobs时,自动包含它们:
    const topLogprobs =
      typeof openaiOptions?.logprobs === "number"
        ? openaiOptions?.logprobs
        : openaiOptions?.logprobs === true
          ? TOP_LOGPROBS_MAX
          : undefined

    if (topLogprobs) {
      addInclude("message.output_text.logprobs")
    }

    // 当存在Web搜索工具时,自动包含源:
    const webSearchToolName = (
      tools?.find(
        (tool) =>
          tool.type === "provider-defined" &&
          (tool.id === "openai.web_search" || tool.id === "openai.web_search_preview"),
      ) as LanguageModelV2ProviderDefinedTool | undefined
    )?.name

    if (webSearchToolName) {
      addInclude("web_search_call.action.sources")
    }

    // 当存在代码解释器工具时,自动包含输出:
    if (hasOpenAITool("openai.code_interpreter")) {
      addInclude("code_interpreter_call.outputs")
    }

    // 构建基础参数
    const baseArgs = {
      model: this.modelId, // 模型ID
      input, // 输入
      temperature, // 温度
      top_p: topP, // Top-P
      max_output_tokens: maxOutputTokens, // 最大输出令牌数

      // 响应格式和文本详细程度
      ...((responseFormat?.type === "json" || openaiOptions?.textVerbosity) && {
        text: {
          ...(responseFormat?.type === "json" && {
            format:
              responseFormat.schema != null
                ? {
                    type: "json_schema", // JSON Schema类型
                    strict: strictJsonSchema, // 严格模式
                    name: responseFormat.name ?? "response", // 名称
                    description: responseFormat.description, // 描述
                    schema: responseFormat.schema, // Schema
                  }
                : { type: "json_object" }, // JSON对象类型
          }),
          ...(openaiOptions?.textVerbosity && {
            verbosity: openaiOptions.textVerbosity, // 文本详细程度
          }),
        },
      }),

      // 提供者选项:
      max_tool_calls: openaiOptions?.maxToolCalls,
      metadata: openaiOptions?.metadata,
      parallel_tool_calls: openaiOptions?.parallelToolCalls,
      previous_response_id: openaiOptions?.previousResponseId,
      store: openaiOptions?.store,
      user: openaiOptions?.user,
      instructions: openaiOptions?.instructions,
      service_tier: openaiOptions?.serviceTier,
      include,
      prompt_cache_key: openaiOptions?.promptCacheKey,
      safety_identifier: openaiOptions?.safetyIdentifier,
      top_logprobs: topLogprobs,

      // 模型特定设置:
      ...(modelConfig.isReasoningModel &&
        (openaiOptions?.reasoningEffort != null || openaiOptions?.reasoningSummary != null) && {
          reasoning: {
            ...(openaiOptions?.reasoningEffort != null && {
              effort: openaiOptions.reasoningEffort,
            }),
            ...(openaiOptions?.reasoningSummary != null && {
              summary: openaiOptions.reasoningSummary,
            }),
          },
        }),
      ...(modelConfig.requiredAutoTruncation && {
        truncation: "auto",
      }),
    }

    if (modelConfig.isReasoningModel) {
      // 移除推理模型的不支持设置
      // 参见 https://platform.openai.com/docs/guides/reasoning#limitations
      if (baseArgs.temperature != null) {
        baseArgs.temperature = undefined
        warnings.push({
          type: "unsupported-setting",
          setting: "temperature",
          details: "temperature参数不支持推理模型",
        })
      }

      if (baseArgs.top_p != null) {
        baseArgs.top_p = undefined
        warnings.push({
          type: "unsupported-setting",
          setting: "topP",
          details: "topP参数不支持推理模型",
        })
      }
    } else {
      if (openaiOptions?.reasoningEffort != null) {
        warnings.push({
          type: "unsupported-setting",
          setting: "reasoningEffort",
          details: "reasoningEffort参数不支持非推理模型",
        })
      }

      if (openaiOptions?.reasoningSummary != null) {
        warnings.push({
          type: "unsupported-setting",
          setting: "reasoningSummary",
          details: "reasoningSummary参数不支持非推理模型",
        })
      }
    }

    // 验证flex处理支持
    if (openaiOptions?.serviceTier === "flex" && !modelConfig.supportsFlexProcessing) {
      warnings.push({
        type: "unsupported-setting",
        setting: "serviceTier",
        details: "flex处理仅适用于o3、o4-mini和gpt-5模型",
      })
      // 如果不支持,从参数中删除
      delete (baseArgs as any).service_tier
    }

    // 验证priority处理支持
    if (openaiOptions?.serviceTier === "priority" && !modelConfig.supportsPriorityProcessing) {
      warnings.push({
        type: "unsupported-setting",
        setting: "serviceTier",
        details:
          "priority处理仅适用于支持的模型(gpt-4、gpt-5、gpt-5-mini、o3、o4-mini)并需要Enterprise访问权限。gpt-5-nano不支持",
      })
      // 如果不支持,从参数中删除
      delete (baseArgs as any).service_tier
    }

    // 准备响应工具
    const {
      tools: openaiTools, // OpenAI工具
      toolChoice: openaiToolChoice, // OpenAI工具选择
      toolWarnings, // 工具警告
    } = prepareResponsesTools({
      tools,
      toolChoice,
      strictJsonSchema,
    })

    // 返回参数和警告
    return {
      webSearchToolName,
      args: {
        ...baseArgs,
        tools: openaiTools,
        tool_choice: openaiToolChoice,
      },
      warnings: [...warnings, ...toolWarnings],
    }
  }

  // 执行生成操作的方法
  async doGenerate(
    options: Parameters<LanguageModelV2["doGenerate"]>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV2["doGenerate"]>>> {
    const { args: body, warnings, webSearchToolName } = await this.getArgs(options) // 获取参数
    const url = this.config.url({
      // 构建URL
      path: "/responses",
      modelId: this.modelId,
    })

    // 发送POST请求到API
    const {
      responseHeaders, // 响应头
      value: response, // 响应值
      rawValue: rawResponse, // 原始响应
    } = await postJsonToApi({
      url,
      headers: combineHeaders(this.config.headers(), options.headers), // 合并请求头
      body, // 请求体
      failedResponseHandler: openaiFailedResponseHandler, // 失败响应处理器
      successfulResponseHandler: createJsonResponseHandler(
        // 成功响应处理器
        z.object({
          id: z.string(), // 响应ID
          created_at: z.number(), // 创建时间
          error: z // 错误信息
            .object({
              code: z.string(), // 错误代码
              message: z.string(), // 错误消息
            })
            .nullish(),
          model: z.string(), // 模型名称
          output: z.array(
            // 输出数组
            z.discriminatedUnion("type", [
              z.object({
                type: z.literal("message"), // 类型:message
                role: z.literal("assistant"), // 角色:assistant
                id: z.string(), // ID
                content: z.array(
                  // 内容数组
                  z.object({
                    type: z.literal("output_text"), // 类型:output_text
                    text: z.string(), // 文本
                    logprobs: LOGPROBS_SCHEMA.nullish(), // 对数概率
                    annotations: z.array(
                      // 注解数组
                      z.discriminatedUnion("type", [
                        z.object({
                          type: z.literal("url_citation"), // 类型:url_citation
                          start_index: z.number(), // 开始索引
                          end_index: z.number(), // 结束索引
                          url: z.string(), // URL
                          title: z.string(), // 标题
                        }),
                        z.object({
                          type: z.literal("file_citation"), // 类型:file_citation
                          file_id: z.string(), // 文件ID
                          filename: z.string().nullish(), // 文件名
                          index: z.number().nullish(), // 索引
                          start_index: z.number().nullish(),
                          end_index: z.number().nullish(),
                          quote: z.string().nullish(),
                        }),
                        z.object({
                          type: z.literal("container_file_citation"),
                        }),
                      ]),
                    ),
                  }),
                ),
              }),
              webSearchCallItem,
              fileSearchCallItem,
              codeInterpreterCallItem,
              imageGenerationCallItem,
              localShellCallItem,
              z.object({
                type: z.literal("function_call"),
                call_id: z.string(),
                name: z.string(),
                arguments: z.string(),
                id: z.string(),
              }),
              z.object({
                type: z.literal("computer_call"),
                id: z.string(),
                status: z.string().optional(),
              }),
              z.object({
                type: z.literal("reasoning"),
                id: z.string(),
                encrypted_content: z.string().nullish(),
                summary: z.array(
                  z.object({
                    type: z.literal("summary_text"),
                    text: z.string(),
                  }),
                ),
              }),
            ]),
          ),
          service_tier: z.string().nullish(),
          incomplete_details: z.object({ reason: z.string() }).nullish(),
          usage: usageSchema,
        }),
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    })

    if (response.error) {
      throw new APICallError({
        message: response.error.message,
        url,
        requestBodyValues: body,
        statusCode: 400,
        responseHeaders,
        responseBody: rawResponse as string,
        isRetryable: false,
      })
    }

    const content: Array<LanguageModelV2Content> = []
    const logprobs: Array<z.infer<typeof LOGPROBS_SCHEMA>> = []

    // 检查是否存在客户端工具调用的标志(非OpenAI执行)
    let hasFunctionCall = false

    // 将响应内容映射到内容数组
    for (const part of response.output) {
      switch (part.type) {
        case "reasoning": {
          // 当没有摘要部分时,我们需要添加一个空的推理部分:
          if (part.summary.length === 0) {
            part.summary.push({ type: "summary_text", text: "" })
          }

          for (const summary of part.summary) {
            content.push({
              type: "reasoning" as const,
              text: summary.text,
              providerMetadata: {
                openai: {
                  itemId: part.id,
                  reasoningEncryptedContent: part.encrypted_content ?? null,
                },
              },
            })
          }
          break
        }

        case "image_generation_call": {
          content.push({
            type: "tool-call",
            toolCallId: part.id,
            toolName: "image_generation",
            input: "{}",
            providerExecuted: true,
          })

          content.push({
            type: "tool-result",
            toolCallId: part.id,
            toolName: "image_generation",
            result: {
              result: part.result,
            } satisfies z.infer<typeof imageGenerationOutputSchema>,
            providerExecuted: true,
          })

          break
        }

        case "local_shell_call": {
          content.push({
            type: "tool-call",
            toolCallId: part.call_id,
            toolName: "local_shell",
            input: JSON.stringify({ action: part.action } satisfies z.infer<typeof localShellInputSchema>),
            providerMetadata: {
              openai: {
                itemId: part.id,
              },
            },
          })

          break
        }

        case "message": {
          for (const contentPart of part.content) {
            if (options.providerOptions?.openai?.logprobs && contentPart.logprobs) {
              logprobs.push(contentPart.logprobs)
            }

            content.push({
              type: "text",
              text: contentPart.text,
              providerMetadata: {
                openai: {
                  itemId: part.id,
                },
              },
            })

            for (const annotation of contentPart.annotations) {
              if (annotation.type === "url_citation") {
                content.push({
                  type: "source",
                  sourceType: "url",
                  id: this.config.generateId?.() ?? generateId(),
                  url: annotation.url,
                  title: annotation.title,
                })
              } else if (annotation.type === "file_citation") {
                content.push({
                  type: "source",
                  sourceType: "document",
                  id: this.config.generateId?.() ?? generateId(),
                  mediaType: "text/plain",
                  title: annotation.quote ?? annotation.filename ?? "Document",
                  filename: annotation.filename ?? annotation.file_id,
                })
              }
            }
          }

          break
        }

        case "function_call": {
          hasFunctionCall = true

          content.push({
            type: "tool-call",
            toolCallId: part.call_id,
            toolName: part.name,
            input: part.arguments,
            providerMetadata: {
              openai: {
                itemId: part.id,
              },
            },
          })
          break
        }

        case "web_search_call": {
          content.push({
            type: "tool-call",
            toolCallId: part.id,
            toolName: webSearchToolName ?? "web_search",
            input: JSON.stringify({ action: part.action }),
            providerExecuted: true,
          })

          content.push({
            type: "tool-result",
            toolCallId: part.id,
            toolName: webSearchToolName ?? "web_search",
            result: { status: part.status },
            providerExecuted: true,
          })

          break
        }

        case "computer_call": {
          content.push({
            type: "tool-call",
            toolCallId: part.id,
            toolName: "computer_use",
            input: "",
            providerExecuted: true,
          })

          content.push({
            type: "tool-result",
            toolCallId: part.id,
            toolName: "computer_use",
            result: {
              type: "computer_use_tool_result",
              status: part.status || "completed",
            },
            providerExecuted: true,
          })
          break
        }

        case "file_search_call": {
          content.push({
            type: "tool-call",
            toolCallId: part.id,
            toolName: "file_search",
            input: "{}",
            providerExecuted: true,
          })

          content.push({
            type: "tool-result",
            toolCallId: part.id,
            toolName: "file_search",
            result: {
              queries: part.queries,
              results:
                part.results?.map((result) => ({
                  attributes: result.attributes,
                  fileId: result.file_id,
                  filename: result.filename,
                  score: result.score,
                  text: result.text,
                })) ?? null,
            } satisfies z.infer<typeof fileSearchOutputSchema>,
            providerExecuted: true,
          })
          break
        }

        case "code_interpreter_call": {
          content.push({
            type: "tool-call",
            toolCallId: part.id,
            toolName: "code_interpreter",
            input: JSON.stringify({
              code: part.code,
              containerId: part.container_id,
            } satisfies z.infer<typeof codeInterpreterInputSchema>),
            providerExecuted: true,
          })

          content.push({
            type: "tool-result",
            toolCallId: part.id,
            toolName: "code_interpreter",
            result: {
              outputs: part.outputs,
            } satisfies z.infer<typeof codeInterpreterOutputSchema>,
            providerExecuted: true,
          })
          break
        }
      }
    }

    const providerMetadata: SharedV2ProviderMetadata = {
      openai: { responseId: response.id },
    }

    if (logprobs.length > 0) {
      providerMetadata.openai.logprobs = logprobs
    }

    if (typeof response.service_tier === "string") {
      providerMetadata.openai.serviceTier = response.service_tier
    }

    return {
      content,
      finishReason: mapOpenAIResponseFinishReason({
        finishReason: response.incomplete_details?.reason,
        hasFunctionCall,
      }),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        reasoningTokens: response.usage.output_tokens_details?.reasoning_tokens ?? undefined,
        cachedInputTokens: response.usage.input_tokens_details?.cached_tokens ?? undefined,
      },
      request: { body },
      response: {
        id: response.id,
        timestamp: new Date(response.created_at * 1000),
        modelId: response.model,
        headers: responseHeaders,
        body: rawResponse,
      },
      providerMetadata,
      warnings,
    }
  }

  // 执行流式生成操作的方法
  async doStream(
    options: Parameters<LanguageModelV2["doStream"]>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV2["doStream"]>>> {
    const { args: body, warnings, webSearchToolName } = await this.getArgs(options) // 获取参数

    // 发送POST请求到API(流式)
    const { responseHeaders, value: response } = await postJsonToApi({
      url: this.config.url({
        // 构建URL
        path: "/responses",
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers(), options.headers), // 合并请求头
      body: {
        // 请求体
        ...body,
        stream: true, // 启用流式传输
      },
      failedResponseHandler: openaiFailedResponseHandler, // 失败响应处理器
      successfulResponseHandler: createEventSourceResponseHandler(openaiResponsesChunkSchema), // 成功响应处理器(事件流)
      abortSignal: options.abortSignal, // 中止信号
      fetch: this.config.fetch, // fetch函数
    })

    const self = this

    let finishReason: LanguageModelV2FinishReason = "unknown" // 完成原因
    const usage: LanguageModelV2Usage = {
      // 使用情况
      inputTokens: undefined,
      outputTokens: undefined,
      totalTokens: undefined,
    }
    const logprobs: Array<z.infer<typeof LOGPROBS_SCHEMA>> = [] // 对数概率数组
    let responseId: string | null = null // 响应ID
    const ongoingToolCalls: Record<
      // 进行中的工具调用
      number,
      | {
          toolName: string // 工具名称
          toolCallId: string // 工具调用ID
          codeInterpreter?: {
            // 代码解释器
            containerId: string // 容器ID
          }
        }
      | undefined
    > = {}

    // 检查是否存在客户端工具调用的标志(非OpenAI执行)
    let hasFunctionCall = false

    // 活跃的推理部分
    const activeReasoning: Record<
      string,
      {
        encryptedContent?: string | null // 加密内容
        summaryParts: number[] // 摘要部分索引数组
      }
    > = {}

    // 跟踪当前助手消息的稳定文本部分ID
    // Copilot可能会在文本增量之间更改item_id;规范化为一个ID
    let currentTextId: string | null = null

    let serviceTier: string | undefined // 服务层

    // 返回流式响应
    return {
      stream: response.pipeThrough(
        // 通过转换流处理响应
        new TransformStream<ParseResult<z.infer<typeof openaiResponsesChunkSchema>>, LanguageModelV2StreamPart>({
          start(controller) {
            // 开始处理
            controller.enqueue({ type: "stream-start", warnings })
          },

          transform(chunk, controller) {
            // 转换每个块
            if (options.includeRawChunks) {
              controller.enqueue({ type: "raw", rawValue: chunk.rawValue })
            }

            // 处理失败的块解析/验证:
            if (!chunk.success) {
              finishReason = "error"
              controller.enqueue({ type: "error", error: chunk.error })
              return
            }

            const value = chunk.value // 获取块值

            // 处理响应输出项添加块
            if (isResponseOutputItemAddedChunk(value)) {
              if (value.item.type === "function_call") {
                // 函数调用
                ongoingToolCalls[value.output_index] = {
                  toolName: value.item.name,
                  toolCallId: value.item.call_id,
                }

                controller.enqueue({
                  type: "tool-input-start",
                  id: value.item.call_id,
                  toolName: value.item.name,
                })
              } else if (value.item.type === "web_search_call") {
                ongoingToolCalls[value.output_index] = {
                  toolName: webSearchToolName ?? "web_search",
                  toolCallId: value.item.id,
                }

                controller.enqueue({
                  type: "tool-input-start",
                  id: value.item.id,
                  toolName: webSearchToolName ?? "web_search",
                })
              } else if (value.item.type === "computer_call") {
                ongoingToolCalls[value.output_index] = {
                  toolName: "computer_use",
                  toolCallId: value.item.id,
                }

                controller.enqueue({
                  type: "tool-input-start",
                  id: value.item.id,
                  toolName: "computer_use",
                })
              } else if (value.item.type === "code_interpreter_call") {
                ongoingToolCalls[value.output_index] = {
                  toolName: "code_interpreter",
                  toolCallId: value.item.id,
                  codeInterpreter: {
                    containerId: value.item.container_id,
                  },
                }

                controller.enqueue({
                  type: "tool-input-start",
                  id: value.item.id,
                  toolName: "code_interpreter",
                })

                controller.enqueue({
                  type: "tool-input-delta",
                  id: value.item.id,
                  delta: `{"containerId":"${value.item.container_id}","code":"`,
                })
              } else if (value.item.type === "file_search_call") {
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: value.item.id,
                  toolName: "file_search",
                  input: "{}",
                  providerExecuted: true,
                })
              } else if (value.item.type === "image_generation_call") {
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: value.item.id,
                  toolName: "image_generation",
                  input: "{}",
                  providerExecuted: true,
                })
              } else if (value.item.type === "message") {
                // 为此助手消息启动一个稳定的文本部分
                currentTextId = value.item.id
                controller.enqueue({
                  type: "text-start",
                  id: value.item.id,
                  providerMetadata: {
                    openai: {
                      itemId: value.item.id,
                    },
                  },
                })
              } else if (isResponseOutputItemAddedReasoningChunk(value)) {
                activeReasoning[value.item.id] = {
                  encryptedContent: value.item.encrypted_content,
                  summaryParts: [0],
                }

                controller.enqueue({
                  type: "reasoning-start",
                  id: `${value.item.id}:0`,
                  providerMetadata: {
                    openai: {
                      itemId: value.item.id,
                      reasoningEncryptedContent: value.item.encrypted_content ?? null,
                    },
                  },
                })
              }
            } else if (isResponseOutputItemDoneChunk(value)) {
              if (value.item.type === "function_call") {
                ongoingToolCalls[value.output_index] = undefined
                hasFunctionCall = true

                controller.enqueue({
                  type: "tool-input-end",
                  id: value.item.call_id,
                })

                controller.enqueue({
                  type: "tool-call",
                  toolCallId: value.item.call_id,
                  toolName: value.item.name,
                  input: value.item.arguments,
                  providerMetadata: {
                    openai: {
                      itemId: value.item.id,
                    },
                  },
                })
              } else if (value.item.type === "web_search_call") {
                ongoingToolCalls[value.output_index] = undefined

                controller.enqueue({
                  type: "tool-input-end",
                  id: value.item.id,
                })

                controller.enqueue({
                  type: "tool-call",
                  toolCallId: value.item.id,
                  toolName: "web_search",
                  input: JSON.stringify({ action: value.item.action }),
                  providerExecuted: true,
                })

                controller.enqueue({
                  type: "tool-result",
                  toolCallId: value.item.id,
                  toolName: "web_search",
                  result: { status: value.item.status },
                  providerExecuted: true,
                })
              } else if (value.item.type === "computer_call") {
                ongoingToolCalls[value.output_index] = undefined

                controller.enqueue({
                  type: "tool-input-end",
                  id: value.item.id,
                })

                controller.enqueue({
                  type: "tool-call",
                  toolCallId: value.item.id,
                  toolName: "computer_use",
                  input: "",
                  providerExecuted: true,
                })

                controller.enqueue({
                  type: "tool-result",
                  toolCallId: value.item.id,
                  toolName: "computer_use",
                  result: {
                    type: "computer_use_tool_result",
                    status: value.item.status || "completed",
                  },
                  providerExecuted: true,
                })
              } else if (value.item.type === "file_search_call") {
                ongoingToolCalls[value.output_index] = undefined

                controller.enqueue({
                  type: "tool-result",
                  toolCallId: value.item.id,
                  toolName: "file_search",
                  result: {
                    queries: value.item.queries,
                    results:
                      value.item.results?.map((result) => ({
                        attributes: result.attributes,
                        fileId: result.file_id,
                        filename: result.filename,
                        score: result.score,
                        text: result.text,
                      })) ?? null,
                  } satisfies z.infer<typeof fileSearchOutputSchema>,
                  providerExecuted: true,
                })
              } else if (value.item.type === "code_interpreter_call") {
                ongoingToolCalls[value.output_index] = undefined

                controller.enqueue({
                  type: "tool-result",
                  toolCallId: value.item.id,
                  toolName: "code_interpreter",
                  result: {
                    outputs: value.item.outputs,
                  } satisfies z.infer<typeof codeInterpreterOutputSchema>,
                  providerExecuted: true,
                })
              } else if (value.item.type === "image_generation_call") {
                controller.enqueue({
                  type: "tool-result",
                  toolCallId: value.item.id,
                  toolName: "image_generation",
                  result: {
                    result: value.item.result,
                  } satisfies z.infer<typeof imageGenerationOutputSchema>,
                  providerExecuted: true,
                })
              } else if (value.item.type === "local_shell_call") {
                ongoingToolCalls[value.output_index] = undefined

                controller.enqueue({
                  type: "tool-call",
                  toolCallId: value.item.call_id,
                  toolName: "local_shell",
                  input: JSON.stringify({
                    action: {
                      type: "exec",
                      command: value.item.action.command,
                      timeoutMs: value.item.action.timeout_ms,
                      user: value.item.action.user,
                      workingDirectory: value.item.action.working_directory,
                      env: value.item.action.env,
                    },
                  } satisfies z.infer<typeof localShellInputSchema>),
                  providerMetadata: {
                    openai: { itemId: value.item.id },
                  },
                })
              } else if (value.item.type === "message") {
                if (currentTextId) {
                  controller.enqueue({
                    type: "text-end",
                    id: currentTextId,
                  })
                  currentTextId = null
                }
              } else if (isResponseOutputItemDoneReasoningChunk(value)) {
                const activeReasoningPart = activeReasoning[value.item.id]
                if (activeReasoningPart) {
                  for (const summaryIndex of activeReasoningPart.summaryParts) {
                    controller.enqueue({
                      type: "reasoning-end",
                      id: `${value.item.id}:${summaryIndex}`,
                      providerMetadata: {
                        openai: {
                          itemId: value.item.id,
                          reasoningEncryptedContent: value.item.encrypted_content ?? null,
                        },
                      },
                    })
                  }
                }
                delete activeReasoning[value.item.id]
              }
            } else if (isResponseFunctionCallArgumentsDeltaChunk(value)) {
              const toolCall = ongoingToolCalls[value.output_index]

              if (toolCall != null) {
                controller.enqueue({
                  type: "tool-input-delta",
                  id: toolCall.toolCallId,
                  delta: value.delta,
                })
              }
            } else if (isResponseImageGenerationCallPartialImageChunk(value)) {
              controller.enqueue({
                type: "tool-result",
                toolCallId: value.item_id,
                toolName: "image_generation",
                result: {
                  result: value.partial_image_b64,
                } satisfies z.infer<typeof imageGenerationOutputSchema>,
                providerExecuted: true,
              })
            } else if (isResponseCodeInterpreterCallCodeDeltaChunk(value)) {
              const toolCall = ongoingToolCalls[value.output_index]

              if (toolCall != null) {
                controller.enqueue({
                  type: "tool-input-delta",
                  id: toolCall.toolCallId,
                  // The delta is code, which is embedding in a JSON string.
                  // To escape it, we use JSON.stringify and slice to remove the outer quotes.
                  delta: JSON.stringify(value.delta).slice(1, -1),
                })
              }
            } else if (isResponseCodeInterpreterCallCodeDoneChunk(value)) {
              const toolCall = ongoingToolCalls[value.output_index]

              if (toolCall != null) {
                controller.enqueue({
                  type: "tool-input-delta",
                  id: toolCall.toolCallId,
                  delta: '"}',
                })

                controller.enqueue({
                  type: "tool-input-end",
                  id: toolCall.toolCallId,
                })

                // 在输入结束后立即发送工具调用:
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: toolCall.toolCallId,
                  toolName: "code_interpreter",
                  input: JSON.stringify({
                    code: value.code,
                    containerId: toolCall.codeInterpreter!.containerId,
                  } satisfies z.infer<typeof codeInterpreterInputSchema>),
                  providerExecuted: true,
                })
              }
            } else if (isResponseCreatedChunk(value)) {
              responseId = value.response.id
              controller.enqueue({
                type: "response-metadata",
                id: value.response.id,
                timestamp: new Date(value.response.created_at * 1000),
                modelId: value.response.model,
              })
            } else if (isTextDeltaChunk(value)) {
              // 确保text-start存在,并将增量规范化为稳定的ID
              if (!currentTextId) {
                currentTextId = value.item_id
                controller.enqueue({
                  type: "text-start",
                  id: currentTextId,
                  providerMetadata: {
                    openai: { itemId: value.item_id },
                  },
                })
              }

              controller.enqueue({
                type: "text-delta",
                id: currentTextId,
                delta: value.delta,
              })

              if (options.providerOptions?.openai?.logprobs && value.logprobs) {
                logprobs.push(value.logprobs)
              }
            } else if (isResponseReasoningSummaryPartAddedChunk(value)) {
              // 第一个推理开始在isResponseOutputItemAddedReasoningChunk中推送
              if (value.summary_index > 0) {
                activeReasoning[value.item_id]?.summaryParts.push(value.summary_index)

                controller.enqueue({
                  type: "reasoning-start",
                  id: `${value.item_id}:${value.summary_index}`,
                  providerMetadata: {
                    openai: {
                      itemId: value.item_id,
                      reasoningEncryptedContent: activeReasoning[value.item_id]?.encryptedContent ?? null,
                    },
                  },
                })
              }
            } else if (isResponseReasoningSummaryTextDeltaChunk(value)) {
              controller.enqueue({
                type: "reasoning-delta",
                id: `${value.item_id}:${value.summary_index}`,
                delta: value.delta,
                providerMetadata: {
                  openai: {
                    itemId: value.item_id,
                  },
                },
              })
            } else if (isResponseFinishedChunk(value)) {
              finishReason = mapOpenAIResponseFinishReason({
                finishReason: value.response.incomplete_details?.reason,
                hasFunctionCall,
              })
              usage.inputTokens = value.response.usage.input_tokens
              usage.outputTokens = value.response.usage.output_tokens
              usage.totalTokens = value.response.usage.input_tokens + value.response.usage.output_tokens
              usage.reasoningTokens = value.response.usage.output_tokens_details?.reasoning_tokens ?? undefined
              usage.cachedInputTokens = value.response.usage.input_tokens_details?.cached_tokens ?? undefined
              if (typeof value.response.service_tier === "string") {
                serviceTier = value.response.service_tier
              }
            } else if (isResponseAnnotationAddedChunk(value)) {
              if (value.annotation.type === "url_citation") {
                controller.enqueue({
                  type: "source",
                  sourceType: "url",
                  id: self.config.generateId?.() ?? generateId(),
                  url: value.annotation.url,
                  title: value.annotation.title,
                })
              } else if (value.annotation.type === "file_citation") {
                controller.enqueue({
                  type: "source",
                  sourceType: "document",
                  id: self.config.generateId?.() ?? generateId(),
                  mediaType: "text/plain",
                  title: value.annotation.quote ?? value.annotation.filename ?? "Document",
                  filename: value.annotation.filename ?? value.annotation.file_id,
                })
              }
            } else if (isErrorChunk(value)) {
              controller.enqueue({ type: "error", error: value })
            }
          },

          flush(controller) {
            // 关闭任何悬空的文本部分
            if (currentTextId) {
              controller.enqueue({ type: "text-end", id: currentTextId })
              currentTextId = null
            }

            const providerMetadata: SharedV2ProviderMetadata = {
              openai: {
                responseId,
              },
            }

            if (logprobs.length > 0) {
              providerMetadata.openai.logprobs = logprobs
            }

            if (serviceTier !== undefined) {
              providerMetadata.openai.serviceTier = serviceTier
            }

            controller.enqueue({
              type: "finish",
              finishReason,
              usage,
              providerMetadata,
            })
          },
        }),
      ),
      request: { body },
      response: { headers: responseHeaders },
    }
  }
}

const usageSchema = z.object({
  input_tokens: z.number(),
  input_tokens_details: z.object({ cached_tokens: z.number().nullish() }).nullish(),
  output_tokens: z.number(),
  output_tokens_details: z.object({ reasoning_tokens: z.number().nullish() }).nullish(),
})

const textDeltaChunkSchema = z.object({
  type: z.literal("response.output_text.delta"),
  item_id: z.string(),
  delta: z.string(),
  logprobs: LOGPROBS_SCHEMA.nullish(),
})

const errorChunkSchema = z.object({
  type: z.literal("error"),
  code: z.string(),
  message: z.string(),
  param: z.string().nullish(),
  sequence_number: z.number(),
})

const responseFinishedChunkSchema = z.object({
  type: z.enum(["response.completed", "response.incomplete"]),
  response: z.object({
    incomplete_details: z.object({ reason: z.string() }).nullish(),
    usage: usageSchema,
    service_tier: z.string().nullish(),
  }),
})

const responseCreatedChunkSchema = z.object({
  type: z.literal("response.created"),
  response: z.object({
    id: z.string(),
    created_at: z.number(),
    model: z.string(),
    service_tier: z.string().nullish(),
  }),
})

const responseOutputItemAddedSchema = z.object({
  type: z.literal("response.output_item.added"),
  output_index: z.number(),
  item: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("message"),
      id: z.string(),
    }),
    z.object({
      type: z.literal("reasoning"),
      id: z.string(),
      encrypted_content: z.string().nullish(),
    }),
    z.object({
      type: z.literal("function_call"),
      id: z.string(),
      call_id: z.string(),
      name: z.string(),
      arguments: z.string(),
    }),
    z.object({
      type: z.literal("web_search_call"),
      id: z.string(),
      status: z.string(),
      action: z
        .object({
          type: z.literal("search"),
          query: z.string().optional(),
        })
        .nullish(),
    }),
    z.object({
      type: z.literal("computer_call"),
      id: z.string(),
      status: z.string(),
    }),
    z.object({
      type: z.literal("file_search_call"),
      id: z.string(),
    }),
    z.object({
      type: z.literal("image_generation_call"),
      id: z.string(),
    }),
    z.object({
      type: z.literal("code_interpreter_call"),
      id: z.string(),
      container_id: z.string(),
      code: z.string().nullable(),
      outputs: z
        .array(
          z.discriminatedUnion("type", [
            z.object({ type: z.literal("logs"), logs: z.string() }),
            z.object({ type: z.literal("image"), url: z.string() }),
          ]),
        )
        .nullable(),
      status: z.string(),
    }),
  ]),
})

const responseOutputItemDoneSchema = z.object({
  type: z.literal("response.output_item.done"),
  output_index: z.number(),
  item: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("message"),
      id: z.string(),
    }),
    z.object({
      type: z.literal("reasoning"),
      id: z.string(),
      encrypted_content: z.string().nullish(),
    }),
    z.object({
      type: z.literal("function_call"),
      id: z.string(),
      call_id: z.string(),
      name: z.string(),
      arguments: z.string(),
      status: z.literal("completed"),
    }),
    codeInterpreterCallItem,
    imageGenerationCallItem,
    webSearchCallItem,
    fileSearchCallItem,
    localShellCallItem,
    z.object({
      type: z.literal("computer_call"),
      id: z.string(),
      status: z.literal("completed"),
    }),
  ]),
})

const responseFunctionCallArgumentsDeltaSchema = z.object({
  type: z.literal("response.function_call_arguments.delta"),
  item_id: z.string(),
  output_index: z.number(),
  delta: z.string(),
})

const responseImageGenerationCallPartialImageSchema = z.object({
  type: z.literal("response.image_generation_call.partial_image"),
  item_id: z.string(),
  output_index: z.number(),
  partial_image_b64: z.string(),
})

const responseCodeInterpreterCallCodeDeltaSchema = z.object({
  type: z.literal("response.code_interpreter_call_code.delta"),
  item_id: z.string(),
  output_index: z.number(),
  delta: z.string(),
})

const responseCodeInterpreterCallCodeDoneSchema = z.object({
  type: z.literal("response.code_interpreter_call_code.done"),
  item_id: z.string(),
  output_index: z.number(),
  code: z.string(),
})

const responseAnnotationAddedSchema = z.object({
  type: z.literal("response.output_text.annotation.added"),
  annotation: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("url_citation"),
      url: z.string(),
      title: z.string(),
    }),
    z.object({
      type: z.literal("file_citation"),
      file_id: z.string(),
      filename: z.string().nullish(),
      index: z.number().nullish(),
      start_index: z.number().nullish(),
      end_index: z.number().nullish(),
      quote: z.string().nullish(),
    }),
  ]),
})

const responseReasoningSummaryPartAddedSchema = z.object({
  type: z.literal("response.reasoning_summary_part.added"),
  item_id: z.string(),
  summary_index: z.number(),
})

const responseReasoningSummaryTextDeltaSchema = z.object({
  type: z.literal("response.reasoning_summary_text.delta"),
  item_id: z.string(),
  summary_index: z.number(),
  delta: z.string(),
})

const openaiResponsesChunkSchema = z.union([
  textDeltaChunkSchema,
  responseFinishedChunkSchema,
  responseCreatedChunkSchema,
  responseOutputItemAddedSchema,
  responseOutputItemDoneSchema,
  responseFunctionCallArgumentsDeltaSchema,
  responseImageGenerationCallPartialImageSchema,
  responseCodeInterpreterCallCodeDeltaSchema,
  responseCodeInterpreterCallCodeDoneSchema,
  responseAnnotationAddedSchema,
  responseReasoningSummaryPartAddedSchema,
  responseReasoningSummaryTextDeltaSchema,
  errorChunkSchema,
  z.object({ type: z.string() }).loose(), // 未知块的回退处理
])

type ExtractByType<T, K extends T extends { type: infer U } ? U : never> = T extends { type: K } ? T : never

function isTextDeltaChunk(
  chunk: z.infer<typeof openaiResponsesChunkSchema>,
): chunk is z.infer<typeof textDeltaChunkSchema> {
  return chunk.type === "response.output_text.delta"
}

function isResponseOutputItemDoneChunk(
  chunk: z.infer<typeof openaiResponsesChunkSchema>,
): chunk is z.infer<typeof responseOutputItemDoneSchema> {
  return chunk.type === "response.output_item.done"
}

function isResponseOutputItemDoneReasoningChunk(chunk: z.infer<typeof openaiResponsesChunkSchema>): chunk is z.infer<
  typeof responseOutputItemDoneSchema
> & {
  item: ExtractByType<z.infer<typeof responseOutputItemDoneSchema>["item"], "reasoning">
} {
  return isResponseOutputItemDoneChunk(chunk) && chunk.item.type === "reasoning"
}

function isResponseFinishedChunk(
  chunk: z.infer<typeof openaiResponsesChunkSchema>,
): chunk is z.infer<typeof responseFinishedChunkSchema> {
  return chunk.type === "response.completed" || chunk.type === "response.incomplete"
}

function isResponseCreatedChunk(
  chunk: z.infer<typeof openaiResponsesChunkSchema>,
): chunk is z.infer<typeof responseCreatedChunkSchema> {
  return chunk.type === "response.created"
}

function isResponseFunctionCallArgumentsDeltaChunk(
  chunk: z.infer<typeof openaiResponsesChunkSchema>,
): chunk is z.infer<typeof responseFunctionCallArgumentsDeltaSchema> {
  return chunk.type === "response.function_call_arguments.delta"
}
function isResponseImageGenerationCallPartialImageChunk(
  chunk: z.infer<typeof openaiResponsesChunkSchema>,
): chunk is z.infer<typeof responseImageGenerationCallPartialImageSchema> {
  return chunk.type === "response.image_generation_call.partial_image"
}

function isResponseCodeInterpreterCallCodeDeltaChunk(
  chunk: z.infer<typeof openaiResponsesChunkSchema>,
): chunk is z.infer<typeof responseCodeInterpreterCallCodeDeltaSchema> {
  return chunk.type === "response.code_interpreter_call_code.delta"
}

function isResponseCodeInterpreterCallCodeDoneChunk(
  chunk: z.infer<typeof openaiResponsesChunkSchema>,
): chunk is z.infer<typeof responseCodeInterpreterCallCodeDoneSchema> {
  return chunk.type === "response.code_interpreter_call_code.done"
}

function isResponseOutputItemAddedChunk(
  chunk: z.infer<typeof openaiResponsesChunkSchema>,
): chunk is z.infer<typeof responseOutputItemAddedSchema> {
  return chunk.type === "response.output_item.added"
}

function isResponseOutputItemAddedReasoningChunk(chunk: z.infer<typeof openaiResponsesChunkSchema>): chunk is z.infer<
  typeof responseOutputItemAddedSchema
> & {
  item: ExtractByType<z.infer<typeof responseOutputItemAddedSchema>["item"], "reasoning">
} {
  return isResponseOutputItemAddedChunk(chunk) && chunk.item.type === "reasoning"
}

function isResponseAnnotationAddedChunk(
  chunk: z.infer<typeof openaiResponsesChunkSchema>,
): chunk is z.infer<typeof responseAnnotationAddedSchema> {
  return chunk.type === "response.output_text.annotation.added"
}

function isResponseReasoningSummaryPartAddedChunk(
  chunk: z.infer<typeof openaiResponsesChunkSchema>,
): chunk is z.infer<typeof responseReasoningSummaryPartAddedSchema> {
  return chunk.type === "response.reasoning_summary_part.added"
}

function isResponseReasoningSummaryTextDeltaChunk(
  chunk: z.infer<typeof openaiResponsesChunkSchema>,
): chunk is z.infer<typeof responseReasoningSummaryTextDeltaSchema> {
  return chunk.type === "response.reasoning_summary_text.delta"
}

function isErrorChunk(chunk: z.infer<typeof openaiResponsesChunkSchema>): chunk is z.infer<typeof errorChunkSchema> {
  return chunk.type === "error"
}

type ResponsesModelConfig = {
  isReasoningModel: boolean
  systemMessageMode: "remove" | "system" | "developer"
  requiredAutoTruncation: boolean
  supportsFlexProcessing: boolean
  supportsPriorityProcessing: boolean
}

function getResponsesModelConfig(modelId: string): ResponsesModelConfig {
  const supportsFlexProcessing =
    modelId.startsWith("o3") ||
    modelId.startsWith("o4-mini") ||
    (modelId.startsWith("gpt-5") && !modelId.startsWith("gpt-5-chat"))
  const supportsPriorityProcessing =
    modelId.startsWith("gpt-4") ||
    modelId.startsWith("gpt-5-mini") ||
    (modelId.startsWith("gpt-5") && !modelId.startsWith("gpt-5-nano") && !modelId.startsWith("gpt-5-chat")) ||
    modelId.startsWith("o3") ||
    modelId.startsWith("o4-mini")
  const defaults = {
    requiredAutoTruncation: false,
    systemMessageMode: "system" as const,
    supportsFlexProcessing,
    supportsPriorityProcessing,
  }

  // gpt-5-chat模型是非推理模型
  if (modelId.startsWith("gpt-5-chat")) {
    return {
      ...defaults,
      isReasoningModel: false,
    }
  }

  // o系列推理模型:
  if (
    modelId.startsWith("o") ||
    modelId.startsWith("gpt-5") ||
    modelId.startsWith("codex-") ||
    modelId.startsWith("computer-use")
  ) {
    if (modelId.startsWith("o1-mini") || modelId.startsWith("o1-preview")) {
      return {
        ...defaults,
        isReasoningModel: true,
        systemMessageMode: "remove",
      }
    }

    return {
      ...defaults,
      isReasoningModel: true,
      systemMessageMode: "developer",
    }
  }

  // gpt模型:
  return {
    ...defaults,
    isReasoningModel: false,
  }
}

// TODO AI SDK 6: 在此处使用optional而不是nullish
const openaiResponsesProviderOptionsSchema = z.object({
  include: z
    .array(z.enum(["reasoning.encrypted_content", "file_search_call.results", "message.output_text.logprobs"]))
    .nullish(),
  instructions: z.string().nullish(),

  /**
   * 返回令牌的对数概率
   *
   * 设置为true将返回已生成的令牌的对数概率
   *
   * 设置为数字将返回已生成的前n个令牌的对数概率
   *
   * @see https://platform.openai.com/docs/api-reference/responses/create
   * @see https://cookbook.openai.com/examples/using_logprobs
   */
  logprobs: z.union([z.boolean(), z.number().min(1).max(TOP_LOGPROBS_MAX)]).optional(),

  /**
   * 响应中可以处理的内置工具调用总数
   * 此最大数量适用于所有内置工具调用,而不是每个单独的工具
   * 模型进一步尝试调用工具将被忽略
   */
  maxToolCalls: z.number().nullish(),

  metadata: z.any().nullish(),
  parallelToolCalls: z.boolean().nullish(),
  previousResponseId: z.string().nullish(),
  promptCacheKey: z.string().nullish(),
  reasoningEffort: z.string().nullish(),
  reasoningSummary: z.string().nullish(),
  safetyIdentifier: z.string().nullish(),
  serviceTier: z.enum(["auto", "flex", "priority"]).nullish(),
  store: z.boolean().nullish(),
  strictJsonSchema: z.boolean().nullish(),
  textVerbosity: z.enum(["low", "medium", "high"]).nullish(),
  user: z.string().nullish(),
})

export type OpenAIResponsesProviderOptions = z.infer<typeof openaiResponsesProviderOptionsSchema>
