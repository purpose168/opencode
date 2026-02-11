#!/usr/bin/env bun

import { $ } from "bun"
import { Script } from "@opencode-ai/script"
import { buildNotes, getLatestRelease } from "./changelog"

/**
 * 发布开始脚本
 * 用于准备和执行发布流程
 * 
 * 步骤说明：
 * 1. 生成发布说明
 * 2. 更新所有 package.json 文件的版本号
 * 3. 更新 Zed 扩展的版本号
 * 4. 安装依赖
 * 5. 执行各个组件的发布脚本
 * 6. 提交代码、创建标签并推送到远程仓库
 * 7. 创建 GitHub Release
 */

let notes: string[] = []

console.log("=== 开始发布 ===\n")

// 如果不是预览版本，生成发布说明
if (!Script.preview) {
  const previous = await getLatestRelease()
  notes = await buildNotes(previous, "HEAD")
}

// 查找所有 package.json 文件（排除 node_modules 和 dist 目录）
const pkgjsons = await Array.fromAsync(
  new Bun.Glob("**/package.json").scan({
    absolute: true,
  }),
).then((arr) => arr.filter((x) => !x.includes("node_modules") && !x.includes("dist")))

// 更新所有 package.json 文件的版本号
for (const file of pkgjsons) {
  let pkg = await Bun.file(file).text()
  pkg = pkg.replaceAll(/"version": "[^"]+"/g, `"version": "${Script.version}"`)
  console.log("已更新:", file)
  await Bun.file(file).write(pkg)
}

// 更新 Zed 扩展的版本号
const extensionToml = new URL("../packages/extensions/zed/extension.toml", import.meta.url).pathname
let toml = await Bun.file(extensionToml).text()
toml = toml.replace(/^version = "[^"]+"/m, `version = "${Script.version}"`)
toml = toml.replaceAll(/releases\/download\/v[^/]+\//g, `releases/download/v${Script.version}/`)
console.log("已更新:", extensionToml)
await Bun.file(extensionToml).write(toml)

// 安装依赖
await $`bun install`

// 执行 opencode 发布脚本
console.log("\n=== 发布 opencode ===\n")
await import(`../packages/opencode/script/publish.ts`)

// 执行 SDK 发布脚本
console.log("\n=== 发布 SDK ===\n")
await import(`../packages/sdk/js/script/publish.ts`)

// 执行插件发布脚本
console.log("\n=== 发布插件 ===\n")
await import(`../packages/plugin/script/publish.ts`)

// 切换到项目根目录
const dir = new URL("..", import.meta.url).pathname
process.chdir(dir)

// 准备输出变量
let output = `version=${Script.version}\n`

// 如果不是预览版本，执行 Git 操作和创建 GitHub Release
if (!Script.preview) {
  // 提交代码
  await $`git commit -am "release: v${Script.version}"`
  // 创建标签
  await $`git tag v${Script.version}`
  // 拉取远程代码
  await $`git fetch origin`
  // 尝试 cherry-pick 远程 dev 分支的更改（忽略错误）
  await $`git cherry-pick HEAD..origin/dev`.nothrow()
  // 推送代码和标签到远程仓库
  await $`git push origin HEAD --tags --no-verify --force-with-lease`
  // 等待 5 秒，确保远程仓库已同步
  await new Promise((resolve) => setTimeout(resolve, 5_000))
  // 创建 GitHub Release（草稿状态）
  await $`gh release create v${Script.version} -d --title "v${Script.version}" --notes ${notes.join("\n") || "无显著变更"} ./packages/opencode/dist/*.zip ./packages/opencode/dist/*.tar.gz`
  // 获取发布信息
  const release = await $`gh release view v${Script.version} --json id,tagName`.json()
  output += `release=${release.id}\n`
  output += `tag=${release.tagName}\n`
}

// 如果在 GitHub Actions 环境中，写入输出变量
if (process.env.GITHUB_OUTPUT) {
  await Bun.write(process.env.GITHUB_OUTPUT, output)
}
