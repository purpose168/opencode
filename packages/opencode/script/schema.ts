#!/usr/bin/env bun

/**
 * opencode 配置模式生成脚本
 * 用于从 Zod schema 生成 JSON Schema，用于配置文件验证和编辑器提示
 */

import { z } from "zod"
import { Config } from "../src/config/config"

// 获取输出文件路径
const file = process.argv[2]
console.log(file)

// 从 Zod schema 生成 JSON Schema
const result = z.toJSONSchema(Config.Info, {
  io: "input", // 生成输入形状（将 optional().default() 视为非必需）
  /**
   * 我们将使用字段的 `default` 值作为 `examples` 中的唯一值。
   * 这样可以确保不需要阅读文档，因为配置是自文档化的。
   *
   * 参见 https://json-schema.org/draft/2020-12/draft-bhutton-json-schema-validation-00#rfc.section.9.5
   */
  override(ctx) {
    const schema = ctx.jsonSchema

    // 保持严格性：为对象设置 additionalProperties: false
    if (schema && typeof schema === "object" && schema.type === "object" && schema.additionalProperties === undefined) {
      schema.additionalProperties = false
    }

    // 为带有默认值的字符串字段添加示例和默认值描述
    if (schema && typeof schema === "object" && "type" in schema && schema.type === "string" && schema?.default) {
      if (!schema.examples) {
        schema.examples = [schema.default]
      }

      schema.description = [schema.description || "", `default: \`${schema.default}\``]
        .filter(Boolean)
        .join("\n\n")
        .trim()
    }
  },
}) as Record<string, unknown> & {
  allowComments?: boolean
  allowTrailingCommas?: boolean
}

// 用于 JSON LSP，因为配置支持 JSONC 格式
result.allowComments = true
result.allowTrailingCommas = true

// 将生成的 JSON Schema 写入文件
await Bun.write(file, JSON.stringify(result, null, 2))
