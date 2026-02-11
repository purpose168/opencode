#!/usr/bin/env bun

import { Script } from "@opencode-ai/script"
import { $ } from "bun"

/**
 * 发布完成脚本
 * 用于完成发布流程的后续操作
 * 
 * 步骤说明：
 * 1. 如果不是预览版本，将GitHub Release从草稿状态改为发布状态
 * 2. 安装项目依赖
 * 3. 下载发布的二进制文件到dist目录
 * 4. 执行发布到注册表的脚本
 */

// 如果不是预览版本，则将GitHub Release从草稿状态改为发布状态
if (!Script.preview) {
  await $`gh release edit v${Script.version} --draft=false`
}

// 安装项目依赖
await $`bun install`

// 下载发布的二进制文件到dist目录
// 下载模式：
// - opencode-linux-*64.tar.gz: Linux 64位二进制文件
// - opencode-darwin-*64.zip: macOS 64位二进制文件
await $`gh release download --pattern "opencode-linux-*64.tar.gz" --pattern "opencode-darwin-*64.zip" -D dist`

// 导入并执行发布到注册表的脚本
await import(`../packages/opencode/script/publish-registries.ts`)
