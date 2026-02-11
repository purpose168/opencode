#!/usr/bin/env node

/**
 * opencode 安装后脚本
 * 用于设置平台特定的二进制文件符号链接
 */

import fs from "fs"
import path from "path"
import os from "os"
import { fileURLToPath } from "url"
import { createRequire } from "module"

// 获取当前文件目录路径
const __dirname = path.dirname(fileURLToPath(import.meta.url))
// 创建 require 函数用于解析包路径
const require = createRequire(import.meta.url)

/**
 * 检测当前平台和架构
 * @returns {Object} 包含平台和架构信息的对象
 */
function detectPlatformAndArch() {
  // 映射平台名称
  let platform
  switch (os.platform()) {
    case "darwin":
      platform = "darwin" // macOS
      break
    case "linux":
      platform = "linux" // Linux
      break
    case "win32":
      platform = "windows" // Windows
      break
    default:
      platform = os.platform() // 其他平台使用原始名称
      break
  }

  // 映射架构名称
  let arch
  switch (os.arch()) {
    case "x64":
      arch = "x64" // 64位 x86
      break
    case "arm64":
      arch = "arm64" // 64位 ARM
      break
    case "arm":
      arch = "arm" // 32位 ARM
      break
    default:
      arch = os.arch() // 其他架构使用原始名称
      break
  }

  return { platform, arch }
}

/**
 * 查找对应平台的二进制文件
 * @returns {Object} 包含二进制文件路径和名称的对象
 */
function findBinary() {
  const { platform, arch } = detectPlatformAndArch()
  const packageName = `opencode-${platform}-${arch}`
  const binaryName = platform === "windows" ? "opencode.exe" : "opencode"

  try {
    // 使用 require.resolve 查找包
    const packageJsonPath = require.resolve(`${packageName}/package.json`)
    const packageDir = path.dirname(packageJsonPath)
    const binaryPath = path.join(packageDir, "bin", binaryName)

    if (!fs.existsSync(binaryPath)) {
      throw new Error(`在 ${binaryPath} 未找到二进制文件`)
    }

    return { binaryPath, binaryName }
  } catch (error) {
    throw new Error(`找不到包 ${packageName}: ${error.message}`)
  }
}

/**
 * 准备 bin 目录
 * @param {string} binaryName - 二进制文件名称
 * @returns {Object} 包含 bin 目录和目标路径的对象
 */
function prepareBinDirectory(binaryName) {
  const binDir = path.join(__dirname, "bin")
  const targetPath = path.join(binDir, binaryName)

  // 确保 bin 目录存在
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true })
  }

  // 如果目标路径已存在，删除现有文件或符号链接
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath)
  }

  return { binDir, targetPath }
}

/**
 * 创建二进制文件的符号链接
 * @param {string} sourcePath - 源文件路径
 * @param {string} binaryName - 二进制文件名称
 */
function symlinkBinary(sourcePath, binaryName) {
  const { targetPath } = prepareBinDirectory(binaryName)

  // 创建符号链接
  fs.symlinkSync(sourcePath, targetPath)
  console.log(`opencode 二进制文件已创建符号链接: ${targetPath} -> ${sourcePath}`)

  // 验证操作后文件是否存在
  if (!fs.existsSync(targetPath)) {
    throw new Error(`无法创建指向 ${targetPath} 的符号链接`)
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    if (os.platform() === "win32") {
      // 在 Windows 上，.exe 文件已包含在包中，bin 字段指向它
      // 不需要安装后设置
      console.log("检测到 Windows: 不需要设置二进制文件（使用打包的 .exe）")
      return
    }

    // 查找二进制文件并创建符号链接
    const { binaryPath, binaryName } = findBinary()
    symlinkBinary(binaryPath, binaryName)
  } catch (error) {
    console.error("设置 opencode 二进制文件失败:", error.message)
    process.exit(1)
  }
}

// 执行主函数
try {
  main()
} catch (error) {
  console.error("安装后脚本错误:", error.message)
  process.exit(0)
}
