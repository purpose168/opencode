import { $ } from "bun"

import { copyBinaryToSidecarFolder, getCurrentSidecar } from "./utils"

/**
 * 开发前准备脚本
 * 用于在开发前构建 OpenCode 二进制文件并复制到 Tauri 侧车文件夹
 */

/**
 * Rust 目标平台
 * 从环境变量 TAURI_ENV_TARGET_TRIPLE 获取
 */
const RUST_TARGET = Bun.env.TAURI_ENV_TARGET_TRIPLE

/**
 * 获取当前侧车配置
 * 根据目标平台获取对应的侧车配置信息
 */
const sidecarConfig = getCurrentSidecar(RUST_TARGET)

/**
 * 二进制文件路径
 * 格式：../opencode/dist/{sidecarConfig.ocBinary}/bin/opencode[.exe]
 * 根据平台自动添加 .exe 扩展名
 */
const binaryPath = `../opencode/dist/${sidecarConfig.ocBinary}/bin/opencode${process.platform === "win32" ? ".exe" : ""}`

/**
 * 构建 OpenCode 二进制文件
 * 执行命令：cd ../opencode && bun run build --single
 */
await $`cd ../opencode && bun run build --single`

/**
 * 复制二进制文件到侧车文件夹
 * @param binaryPath 二进制文件路径
 * @param RUST_TARGET 目标平台
 */
await copyBinaryToSidecarFolder(binaryPath, RUST_TARGET)
