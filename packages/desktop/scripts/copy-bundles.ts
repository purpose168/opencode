import { $ } from "bun"
import * as path from "node:path"

import { RUST_TARGET } from "./utils"

/**
 * 复制打包文件脚本
 * 用于将 Tauri 构建的应用程序打包文件复制到统一的输出目录
 */

// 检查 RUST_TARGET 是否定义
if (!RUST_TARGET) throw new Error("RUST_TARGET 未定义")

/**
 * 打包文件目录
 * 格式：src-tauri/target/{RUST_TARGET}/release/bundle
 */
const BUNDLE_DIR = `src-tauri/target/${RUST_TARGET}/release/bundle`

/**
 * 打包文件输出目录
 * 路径：当前工作目录/src-tauri/target/bundles
 */
const BUNDLES_OUT_DIR = path.join(process.cwd(), `src-tauri/target/bundles`)

// 创建输出目录（如果不存在）
await $`mkdir -p ${BUNDLES_OUT_DIR}`

// 复制所有打包文件到输出目录
// 复制规则：${BUNDLE_DIR}/*/OpenCode* → ${BUNDLES_OUT_DIR}
await $`cp -r ${BUNDLE_DIR}/*/OpenCode* ${BUNDLES_OUT_DIR}`
