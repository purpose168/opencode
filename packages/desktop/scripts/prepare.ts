#!/usr/bin/env bun
import { $ } from "bun"

import { copyBinaryToSidecarFolder, getCurrentSidecar } from "./utils"

/**
 * 准备脚本
 * 用于从 GitHub Actions 下载 OpenCode 二进制文件并复制到 Tauri 侧车文件夹
 */

/**
 * 获取当前侧车配置
 * 根据当前平台获取对应的侧车配置信息
 */
const sidecarConfig = getCurrentSidecar()

/**
 * 二进制文件下载目录
 * 路径：src-tauri/target/opencode-binaries
 */
const dir = "src-tauri/target/opencode-binaries"

// 创建下载目录（如果不存在）
await $`mkdir -p ${dir}`

// 从 GitHub Actions 下载 OpenCode CLI 二进制文件
// 执行命令：gh run download ${GITHUB_RUN_ID} -n opencode-cli
// 工作目录：${dir}
await $`gh run download ${Bun.env.GITHUB_RUN_ID} -n opencode-cli`.cwd(dir)

/**
 * 复制二进制文件到侧车文件夹
 * @param binaryPath 二进制文件路径
 * 格式：${dir}/${sidecarConfig.ocBinary}/bin/opencode[.exe]
 * 根据平台自动添加 .exe 扩展名
 */
await copyBinaryToSidecarFolder(
  `${dir}/${sidecarConfig.ocBinary}/bin/opencode${process.platform === "win32" ? ".exe" : ""}`,
)
