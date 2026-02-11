#!/usr/bin/env bun

import { $ } from "bun"

/**
 * SDK 生成脚本
 * 用于构建和生成 SDK 相关文件
 * 
 * 步骤说明：
 * 1. 构建 SDK JavaScript 部分
 * 2. 在 opencode 目录下生成 OpenAPI 规范文件
 * 3. 格式化生成的文件
 */

// 运行 SDK JavaScript 构建脚本
await $`bun ./packages/sdk/js/script/build.ts`

// 在 opencode 目录下运行 generate 命令，生成 OpenAPI 规范文件并输出到 ../sdk/openapi.json
await $`bun dev generate > ../sdk/openapi.json`.cwd("packages/opencode")

// 运行格式化脚本，确保生成的文件格式规范
await $`./script/format.ts`
