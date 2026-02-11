/**
 * 智能体（Agent）命名空间
 * 管理智能体的配置、列表和默认智能体设置
 */
import { Config } from "../config/config"
import z from "zod"
import { Provider } from "../provider/provider"
import { generateObject, type ModelMessage } from "ai"
import { SystemPrompt } from "../session/system"
import { Instance } from "../project/instance"

import PROMPT_GENERATE from "./generate.txt"
import PROMPT_COMPACTION from "./prompt/compaction.txt"
import PROMPT_EXPLORE from "./prompt/explore.txt"
import PROMPT_SUMMARY from "./prompt/summary.txt"
import PROMPT_TITLE from "./prompt/title.txt"
import { PermissionNext } from "@/permission/next"
import { mergeDeep, pipe, sortBy, values } from "remeda"

export namespace Agent {
  /**
   * 智能体信息结构
   * 定义了智能体的配置参数和属性
   */
  export const Info = z
    .object({
      name:        z.string(),                    // 智能体名称
      description: z.string().optional(),         // 智能体描述
      mode:        z.enum(["subagent", "primary", "all"]), // 智能体模式：subagent-子智能体 primary-主要智能体 all-所有模式
      native:      z.boolean().optional(),        // 是否为原生智能体
      hidden:      z.boolean().optional(),        // 是否隐藏
      topP:        z.number().optional(),         // 采样Top-P参数
      temperature: z.number().optional(),         // 温度参数
      color:       z.string().optional(),         // 颜色
      permission:  PermissionNext.Ruleset,        // 权限规则集
      model:       z.object({                     // 模型配置
        modelID:   z.string(),                    //   模型ID
        providerID:z.string(),                    //   提供商ID
      }).optional(),
      prompt:      z.string().optional(),         // 提示词
      options:     z.record(z.string(), z.any()),   // 选项
      steps:       z.number().int().positive().optional(), // 步骤数
    })
    .meta({
      ref: "Agent",
    })
  export type Info = z.infer<typeof Info>

  /**
   * 智能体状态管理
   * 从配置中加载智能体定义并合并用户配置
   */
  const state = Instance.state(async () => {
    const cfg = await Config.get()

    // 默认权限配置
    const defaults = PermissionNext.fromConfig({
      "*": "allow",
      doom_loop: "ask",
      external_directory: "ask",
    })
    // 用户权限配置
    const user = PermissionNext.fromConfig(cfg.permission ?? {})

    // 预定义智能体
    const result: Record<string, Info> = {
      build: {
        name: "build",
        options: {},
        permission: PermissionNext.merge(defaults, user),
        mode: "primary",
        native: true,
      },
      plan: {
        name: "plan",
        options: {},
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            edit: {
              "*": "deny",
              ".opencode/plan/*.md": "allow",
            },
          }),
          user,
        ),
        mode: "primary",
        native: true,
      },
      general: {
        name: "general",
        description: `通用智能体，用于研究复杂问题和执行多步骤任务。使用此智能体并行执行多个工作单元。`,
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            todoread: "deny",
            todowrite: "deny",
          }),
          user,
        ),
        options: {},
        mode: "subagent",
        native: true,
        hidden: true,
      },
      explore: {
        name: "explore",
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            "*": "deny",
            grep: "allow",
            glob: "allow",
            list: "allow",
            bash: "allow",
            webfetch: "allow",
            websearch: "allow",
            codesearch: "allow",
            read: "allow",
          }),
          user,
        ),
        description: `专门用于探索代码库的快速智能体。当您需要按模式快速查找文件（例如 "src/components/**/*.tsx"）、搜索代码中的关键字（例如 "API endpoints"）或回答有关代码库的问题（例如 "API endpoints 如何工作？"）时使用此智能体。调用此智能体时，请指定所需的彻底程度："quick" 用于基本搜索，"medium" 用于适度探索，或 "very thorough" 用于跨多个位置和命名约定的全面分析。`,
        prompt: PROMPT_EXPLORE,
        options: {},
        mode: "subagent",
        native: true,
      },
      compaction: {
        name: "compaction",
        mode: "primary",
        native: true,
        hidden: true,
        prompt: PROMPT_COMPACTION,
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            "*": "deny",
          }),
          user,
        ),
        options: {},
      },
      title: {
        name: "title",
        mode: "primary",
        options: {},
        native: true,
        hidden: true,
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            "*": "deny",
          }),
          user,
        ),
        prompt: PROMPT_TITLE,
      },
      summary: {
        name: "summary",
        mode: "primary",
        options: {},
        native: true,
        hidden: true,
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            "*": "deny",
          }),
          user,
        ),
        prompt: PROMPT_SUMMARY,
      },
    }

    // 合并用户配置的智能体
    for (const [key, value] of Object.entries(cfg.agent ?? {})) {
      if (value.disable) {
        delete result[key]
        continue
      }
      let item = result[key]
      if (!item)
        item = result[key] = {
          name: key,
          mode: "all",
          permission: PermissionNext.merge(defaults, user),
          options: {},
          native: false,
        }
      if (value.model) item.model = Provider.parseModel(value.model)
      item.prompt = value.prompt ?? item.prompt
      item.description = value.description ?? item.description
      item.temperature = value.temperature ?? item.temperature
      item.topP = value.top_p ?? item.topP
      item.mode = value.mode ?? item.mode
      item.color = value.color ?? item.color
      item.name = value.options?.name ?? item.name
      item.steps = value.steps ?? item.steps
      item.options = mergeDeep(item.options, value.options ?? {})
      item.permission = PermissionNext.merge(item.permission, PermissionNext.fromConfig(value.permission ?? {}))
    }
    return result
  })

  /**
   * 获取指定智能体的配置
   * @param agent 智能体名称
   * @returns 智能体配置
   */
  export async function get(agent: string) {
    return state().then((x) => x[agent])
  }

  /**
   * 获取智能体列表
   * @returns 智能体列表，按默认智能体排序
   */
  export async function list() {
    const cfg = await Config.get()
    return pipe(
      await state(),
      values(),
      sortBy([(x) => (cfg.default_agent ? x.name === cfg.default_agent : x.name === "build"), "desc"]),
    )
  }

  /**
   * 获取默认智能体
   * @returns 默认智能体名称
   */
  export async function defaultAgent() {
    return state().then((x) => Object.keys(x)[0])
  }

  /**
   * 生成智能体配置
   * @param input 生成参数
   * @param input.description 智能体描述
   * @param input.model 可选的模型配置
   * @returns 生成的智能体配置
   */
  export async function generate(input: { description: string; model?: { providerID: string; modelID: string } }) {
    const cfg = await Config.get()
    const defaultModel = input.model ?? (await Provider.defaultModel())
    const model = await Provider.getModel(defaultModel.providerID, defaultModel.modelID)
    const language = await Provider.getLanguage(model)
    const system = SystemPrompt.header(defaultModel.providerID)
    system.push(PROMPT_GENERATE)
    const existing = await list()
    const result = await generateObject({
      experimental_telemetry: {
        isEnabled: cfg.experimental?.openTelemetry,
        metadata: {
          userId: cfg.username ?? "unknown",
        },
      },
      temperature: 0.3,
      messages: [
        ...system.map(
          (item): ModelMessage => ({
            role: "system",
            content: item,
          }),
        ),
        {
          role: "user",
          content: `基于此请求创建智能体配置：\"${input.description}\".\n\n重要：以下标识符已存在，不得使用：${existing.map((i) => i.name).join(", ")}\n  仅返回 JSON 对象，不要包含其他文本，不要用反引号包裹`,
        },
      ],
      model: language,
      schema: z.object({
        identifier: z.string(),
        whenToUse: z.string(),
        systemPrompt: z.string(),
      }),
    })
    return result.object
  }
}
