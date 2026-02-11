import type { JSONSchema7 } from "@ai-sdk/provider"

/**
 * OpenAI Responses输入类型
 * 定义了OpenAI Responses API的输入格式,是一个输入项的数组
 */
export type OpenAIResponsesInput = Array<OpenAIResponsesInputItem>

/**
 * OpenAI Responses输入项类型
 * 定义了所有可能的输入项类型,包括各种消息、工具调用和引用
 */
export type OpenAIResponsesInputItem =
  | OpenAIResponsesSystemMessage // 系统消息
  | OpenAIResponsesUserMessage // 用户消息
  | OpenAIResponsesAssistantMessage // 助手消息
  | OpenAIResponsesFunctionCall // 函数调用
  | OpenAIResponsesFunctionCallOutput // 函数调用输出
  | OpenAIResponsesComputerCall // 计算机调用
  | OpenAIResponsesLocalShellCall // 本地Shell调用
  | OpenAIResponsesLocalShellCallOutput // 本地Shell调用输出
  | OpenAIResponsesReasoning // 推理
  | OpenAIResponsesItemReference // 项目引用

/**
 * OpenAI Responses包含值类型
 * 定义了可以包含在响应中的各种值类型
 */
export type OpenAIResponsesIncludeValue =
  | "web_search_call.action.sources" // Web搜索调用的操作源
  | "code_interpreter_call.outputs" // 代码解释器调用的输出
  | "computer_call_output.output.image_url" // 计算机调用输出的图像URL
  | "file_search_call.results" // 文件搜索调用的结果
  | "message.input_image.image_url" // 消息输入图像的URL
  | "message.output_text.logprobs" // 消息输出文本的对数概率
  | "reasoning.encrypted_content" // 推理的加密内容

/**
 * OpenAI Responses包含选项类型
 * 定义了包含选项的格式,可以是包含值数组、undefined或null
 */
export type OpenAIResponsesIncludeOptions = Array<OpenAIResponsesIncludeValue> | undefined | null

/**
 * OpenAI Responses系统消息类型
 * 定义了系统或开发者角色的消息格式
 */
export type OpenAIResponsesSystemMessage = {
  role: "system" | "developer" // 角色:system或developer
  content: string // 消息内容
}

/**
 * OpenAI Responses用户消息类型
 * 定义了用户角色的消息格式,支持文本、图像和文件等多种输入类型
 */
export type OpenAIResponsesUserMessage = {
  role: "user" // 角色:user
  content: Array<
    | { type: "input_text"; text: string } // 输入文本类型
    | { type: "input_image"; image_url: string } // 输入图像类型(URL)
    | { type: "input_image"; file_id: string } // 输入图像类型(文件ID)
    | { type: "input_file"; file_url: string } // 输入文件类型(URL)
    | { type: "input_file"; filename: string; file_data: string } // 输入文件类型(文件名和文件数据)
    | { type: "input_file"; file_id: string } // 输入文件类型(文件ID)
  >
}

/**
 * OpenAI Responses助手消息类型
 * 定义了助手角色的消息格式,包含输出文本和可选的项目ID
 */
export type OpenAIResponsesAssistantMessage = {
  role: "assistant" // 角色:assistant
  content: Array<{ type: "output_text"; text: string }> // 输出文本数组
  id?: string // 可选的项目ID
}

/**
 * OpenAI Responses函数调用类型
 * 定义了函数调用的格式,包含调用ID、函数名和参数
 */
export type OpenAIResponsesFunctionCall = {
  type: "function_call" // 类型:function_call
  call_id: string // 调用ID
  name: string // 函数名称
  arguments: string // 函数参数(JSON字符串格式)
  id?: string // 可选的项目ID
}

/**
 * OpenAI Responses函数调用输出类型
 * 定义了函数调用输出的格式,包含调用ID和输出结果
 */
export type OpenAIResponsesFunctionCallOutput = {
  type: "function_call_output" // 类型:function_call_output
  call_id: string // 调用ID
  output: string // 输出结果
}

/**
 * OpenAI Responses计算机调用类型
 * 定义了计算机调用的格式,包含项目ID和状态
 */
export type OpenAIResponsesComputerCall = {
  type: "computer_call" // 类型:computer_call
  id: string // 项目ID
  status?: string // 可选的状态
}

/**
 * OpenAI Responses本地Shell调用类型
 * 定义了本地Shell调用的格式,包含执行操作的详细信息
 */
export type OpenAIResponsesLocalShellCall = {
  type: "local_shell_call" // 类型:local_shell_call
  id: string // 项目ID
  call_id: string // 调用ID
  action: {
    // 执行操作
    type: "exec" // 操作类型:exec(执行)
    command: string[] // 命令数组
    timeout_ms?: number // 可选的超时时间(毫秒)
    user?: string // 可选的用户
    working_directory?: string // 可选的工作目录
    env?: Record<string, string> // 可选的环境变量
  }
}

/**
 * OpenAI Responses本地Shell调用输出类型
 * 定义了本地Shell调用输出的格式,包含调用ID和输出结果
 */
export type OpenAIResponsesLocalShellCallOutput = {
  type: "local_shell_call_output" // 类型:local_shell_call_output
  call_id: string // 调用ID
  output: string // 输出结果
}

/**
 * OpenAI Responses项目引用类型
 * 定义了项目引用的格式,用于引用之前创建的项目
 */
export type OpenAIResponsesItemReference = {
  type: "item_reference" // 类型:item_reference
  id: string // 项目ID
}

/**
 * 用于使用定义的比较操作将指定属性键与给定值进行比较的过滤器
 */
export type OpenAIResponsesFileSearchToolComparisonFilter = {
  /**
   * 要与值进行比较的键
   */
  key: string // 比较的属性键

  /**
   * 指定比较操作符:eq、ne、gt、gte、lt、lte
   */
  type: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" // 比较操作符:等于、不等于、大于、大于等于、小于、小于等于

  /**
   * 要与属性键进行比较的值,支持字符串、数字或布尔类型
   */
  value: string | number | boolean // 比较值:字符串、数字或布尔值
}

/**
 * 使用and或or组合多个过滤器
 */
export type OpenAIResponsesFileSearchToolCompoundFilter = {
  /**
   * 操作类型:and或or
   */
  type: "and" | "or" // 逻辑操作符:与、或

  /**
   * 要组合的过滤器数组,项目可以是ComparisonFilter或CompoundFilter
   */
  filters: Array<OpenAIResponsesFileSearchToolComparisonFilter | OpenAIResponsesFileSearchToolCompoundFilter> // 过滤器数组,可以是比较过滤器或复合过滤器
}

/**
 * OpenAI Responses工具类型
 * 定义了所有可用的工具类型,包括函数、Web搜索、代码解释器、文件搜索、图像生成和本地Shell
 */
export type OpenAIResponsesTool =
  | {
      type: "function" // 类型:function
      name: string // 函数名称
      description: string | undefined // 可选的函数描述
      parameters: JSONSchema7 // 参数Schema(JSON Schema格式)
      strict: boolean | undefined // 可选的严格模式标志
    }
  | {
      type: "web_search" // 类型:web_search
      filters: { allowed_domains: string[] | undefined } | undefined // 可选的过滤器,包含允许的域名列表
      search_context_size: "low" | "medium" | "high" | undefined // 可选的搜索上下文大小:低、中、高
      user_location: // 可选的用户位置信息
      | {
            type: "approximate" // 类型:approximate(近似)
            city?: string // 可选的城市
            country?: string // 可选的国家
            region?: string // 可选的地区
            timezone?: string // 可选的时区
          }
        | undefined
    }
  | {
      type: "web_search_preview" // 类型:web_search_preview
      search_context_size: "low" | "medium" | "high" | undefined // 可选的搜索上下文大小:低、中、高
      user_location: // 可选的用户位置信息
      | {
            type: "approximate" // 类型:approximate(近似)
            city?: string // 可选的城市
            country?: string // 可选的国家
            region?: string // 可选的地区
            timezone?: string // 可选的时区
          }
        | undefined
    }
  | {
      type: "code_interpreter" // 类型:code_interpreter
      container: string | { type: "auto"; file_ids: string[] | undefined } // 容器配置:字符串或自动配置
    }
  | {
      type: "file_search" // 类型:file_search
      vector_store_ids: string[] // 向量存储ID数组
      max_num_results: number | undefined // 可选的最大结果数
      ranking_options: { ranker?: string; score_threshold?: number } | undefined // 可选的排序选项,包含排序器和分数阈值
      filters: OpenAIResponsesFileSearchToolComparisonFilter | OpenAIResponsesFileSearchToolCompoundFilter | undefined // 可选的过滤器,可以是比较过滤器或复合过滤器
    }
  | {
      type: "image_generation" // 类型:image_generation
      background: "auto" | "opaque" | "transparent" | undefined // 可选的背景设置:自动、不透明、透明
      input_fidelity: "low" | "high" | undefined // 可选的输入保真度:低、高
      input_image_mask: // 可选的输入图像遮罩
      | {
            file_id: string | undefined // 可选的文件ID
            image_url: string | undefined // 可选的图像URL
          }
        | undefined
      model: string | undefined // 可选的模型名称
      moderation: "auto" | undefined // 可选的内容审核设置:自动
      output_compression: number | undefined // 可选的输出压缩级别(0-100)
      output_format: "png" | "jpeg" | "webp" | undefined // 可选的输出格式:PNG、JPEG、WebP
      partial_images: number | undefined // 可选的部分图像数量(0-3)
      quality: "auto" | "low" | "medium" | "high" | undefined // 可选的质量设置:自动、低、中、高
      size: "auto" | "1024x1024" | "1024x1536" | "1536x1024" | undefined // 可选的图像尺寸:自动、1024x1024、1024x1536、1536x1024
    }
  | {
      type: "local_shell" // 类型:local_shell
    }

/**
 * OpenAI Responses推理类型
 * 定义了推理消息的格式,包含推理ID、加密内容和摘要
 */
export type OpenAIResponsesReasoning = {
  type: "reasoning" // 类型:reasoning
  id: string // 推理ID
  encrypted_content?: string | null // 可选的加密内容
  summary: Array<{
    // 摘要数组
    type: "summary_text" // 类型:summary_text
    text: string // 摘要文本
  }>
}
