#!/usr/bin/env bun

import { $ } from "bun"

/**
 * 代码格式化脚本
 * 使用 Prettier 格式化项目中的所有文件
 * 
 * 命令说明：
 * - bun run prettier: 运行 Prettier 格式化工具
 * - --ignore-unknown: 忽略未知类型的文件
 * - --write: 将格式化后的内容写回文件
 * - .: 对当前目录下的所有文件进行格式化
 */
await $`bun run prettier --ignore-unknown --write .`
