#!/usr/bin/env bun

/**
 * 同步 Zed 扩展脚本
 * 用于将 OpenCode 扩展同步到 Zed 扩展仓库并创建拉取请求
 * 
 * 功能说明：
 * 1. 验证指定版本的标签和 extension.toml 中的版本是否匹配
 * 2. 克隆扩展仓库到临时目录
 * 3. 将分支与上游仓库同步
 * 4. 创建新分支并更新子模块到指定版本
 * 5. 更新 extensions.toml 中的版本号
 * 6. 提交更改并推送到仓库
 * 7. 删除已存在的相关分支
 * 8. 创建拉取请求到上游仓库
 */

import { $ } from "bun"
import { tmpdir } from "os"
import { join } from "path"

// 仓库配置
const FORK_REPO = "sst/zed-extensions" // 分叉仓库
const UPSTREAM_REPO = "zed-industries/extensions" // 上游仓库
const EXTENSION_NAME = "opencode" // 扩展名称

/**
 * 主函数，执行同步 Zed 扩展的流程
 */
async function main() {
  // 获取版本参数
  const version = process.argv[2]
  if (!version) throw new Error("需要版本参数，例如: bun script/sync-zed.ts v1.0.52")

  // 获取环境变量中的访问令牌
  const token = process.env.ZED_EXTENSIONS_PAT
  if (!token) throw new Error("需要 ZED_EXTENSIONS_PAT 环境变量")

  const prToken = process.env.ZED_PR_PAT
  if (!prToken) throw new Error("需要 ZED_PR_PAT 环境变量")

  // 清理版本号，移除前缀 "v"
  const cleanVersion = version.replace(/^v/, "")
  console.log(`📦 正在同步版本 ${cleanVersion} 的 Zed 扩展`)

  // 获取指定版本的提交 SHA
  const commitSha = await $`git rev-parse ${version}`.text()
  const sha = commitSha.trim()
  console.log(`🔍 找到提交 SHA: ${sha}`)

  // 获取指定版本的 extension.toml 文件内容
  const extensionToml = await $`git show ${version}:packages/extensions/zed/extension.toml`.text()
  const parsed = Bun.TOML.parse(extensionToml) as { version: string }
  const extensionVersion = parsed.version

  // 验证版本是否匹配
  if (extensionVersion !== cleanVersion) {
    throw new Error(`版本不匹配: extension.toml 中的版本是 ${extensionVersion}，但标签是 ${cleanVersion}`)
  }
  console.log(`✅ 版本 ${extensionVersion} 与标签匹配`)

  // 克隆分叉仓库到临时目录
  const workDir = join(tmpdir(), `zed-extensions-${Date.now()}`)
  console.log(`📁 工作目录: ${workDir}`)

  await $`git clone https://x-access-token:${token}@github.com/${FORK_REPO}.git ${workDir}`
  process.chdir(workDir)

  // 配置 Git 身份
  await $`git config user.name "Aiden Cline"`
  await $`git config user.email "63023139+rekram1-node@users.noreply.github.com "`

  // 与上游仓库同步（强制重置以完全匹配）
  console.log(`🔄 正在与上游仓库同步...`)
  await $`git remote add upstream https://github.com/${UPSTREAM_REPO}.git`
  await $`git fetch upstream`
  await $`git checkout main`
  await $`git reset --hard upstream/main`
  await $`git push origin main --force`
  console.log(`✅ 分叉仓库已同步（强制重置到上游）`)

  // 创建新分支
  const branchName = `update-${EXTENSION_NAME}-${cleanVersion}`
  console.log(`🌿 创建分支 ${branchName}`)
  await $`git checkout -b ${branchName}`

  // 更新子模块到指定提交
  const submodulePath = `extensions/${EXTENSION_NAME}`
  console.log(`📌 更新子模块到提交 ${sha}`)
  await $`git submodule update --init ${submodulePath}`
  process.chdir(submodulePath)
  await $`git fetch`
  await $`git checkout ${sha}`
  process.chdir(workDir)
  await $`git add ${submodulePath}`

  // 更新 extensions.toml 文件中的版本号
  console.log(`📝 更新 extensions.toml`)
  const extensionsTomlPath = "extensions.toml"
  const extensionsToml = await Bun.file(extensionsTomlPath).text()

  // 使用正则表达式匹配并替换版本号
  const versionRegex = new RegExp(`(\[${EXTENSION_NAME}\][\s\S]*?)version = "[^"]+"`)
  const updatedToml = extensionsToml.replace(versionRegex, `$1version = "${cleanVersion}"`)

  if (updatedToml === extensionsToml) {
    throw new Error(`更新 extensions.toml 中的版本失败 - 未找到匹配模式`)
  }

  // 写入更新后的内容
  await Bun.write(extensionsTomlPath, updatedToml)
  await $`git add extensions.toml`

  // 提交更改
  const commitMessage = `Update ${EXTENSION_NAME} to v${cleanVersion}`

  await $`git commit -m ${commitMessage}`
  console.log(`✅ 更改已提交`)

  // 删除已存在的 OpenCode 更新分支
  console.log(`🔍 检查是否存在已有的分支...`)
  const branches = await $`git ls-remote --heads https://x-access-token:${token}@github.com/${FORK_REPO}.git`.text()
  const branchPattern = `refs/heads/update-${EXTENSION_NAME}-`
  const oldBranches = branches
    .split("\n")
    .filter((line) => line.includes(branchPattern))
    .map((line) => line.split("refs/heads/")[1])
    .filter(Boolean)

  if (oldBranches.length > 0) {
    console.log(`🗑️  找到 ${oldBranches.length} 个旧分支，正在删除...`)
    for (const branch of oldBranches) {
      await $`git push https://x-access-token:${token}@github.com/${FORK_REPO}.git --delete ${branch}`
      console.log(`✅ 已删除分支 ${branch}`)
    }
  }

  // 推送到仓库
  console.log(`🚀 正在推送到分叉仓库...`)
  await $`git push https://x-access-token:${token}@github.com/${FORK_REPO}.git ${branchName}`

  // 创建拉取请求
  console.log(`📬 正在创建拉取请求...`)
  const prResult =
    await $`gh pr create --repo ${UPSTREAM_REPO} --base main --head ${FORK_REPO.split("/")[0]}:${branchName} --title "Update ${EXTENSION_NAME} to v${cleanVersion}" --body "Updating OpenCode extension to v${cleanVersion}"`
      .env({ ...process.env, GH_TOKEN: prToken })
      .nothrow()

  if (prResult.exitCode !== 0) {
    console.error("stderr:", prResult.stderr.toString())
    throw new Error(`操作失败，退出码 ${prResult.exitCode}`)
  }

  // 输出拉取请求 URL
  const prUrl = prResult.stdout.toString().trim()
  console.log(`✅ 拉取请求已创建: ${prUrl}`)
  console.log(`🎉 完成!`)
}

// 执行主函数并处理错误
main().catch((err) => {
  console.error("❌ 错误:", err.message)
  process.exit(1)
})
