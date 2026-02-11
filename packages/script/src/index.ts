// 导入 bun 的 $ 函数，用于执行 shell 命令
import { $ } from "bun"
// 导入 path 模块，用于处理文件路径
import path from "path"

// 获取根目录 package.json 文件的路径
const rootPkgPath = path.resolve(import.meta.dir, "../../../package.json")
// 读取根目录 package.json 文件的内容
const rootPkg = await Bun.file(rootPkgPath).json()
// 从 package.json 中提取预期的 bun 版本号
const expectedBunVersion = rootPkg.packageManager?.split("@")[1]

// 检查是否找到了 packageManager 字段
if (!expectedBunVersion) {
  throw new Error("在根目录 package.json 中未找到 packageManager 字段")
}

// 检查当前 bun 版本是否与预期版本匹配
if (process.versions.bun !== expectedBunVersion) {
  throw new Error(`此脚本需要 bun@${expectedBunVersion}，但您正在使用 bun@${process.versions.bun}`)
}

// 定义环境变量对象
const env = {
  OPENCODE_CHANNEL: process.env["OPENCODE_CHANNEL"],
  OPENCODE_BUMP: process.env["OPENCODE_BUMP"],
  OPENCODE_VERSION: process.env["OPENCODE_VERSION"],
}
// 确定发布渠道
const CHANNEL = await (async () => {
  // 如果设置了 OPENCODE_CHANNEL 环境变量，则使用它
  if (env.OPENCODE_CHANNEL) return env.OPENCODE_CHANNEL
  // 如果设置了 OPENCODE_BUMP 环境变量，则使用 latest 渠道
  if (env.OPENCODE_BUMP) return "latest"
  // 如果设置了 OPENCODE_VERSION 且不是 0.0.0- 开头，则使用 latest 渠道
  if (env.OPENCODE_VERSION && !env.OPENCODE_VERSION.startsWith("0.0.0-")) return "latest"
  // 否则使用当前 git 分支名作为渠道
  return await $`git branch --show-current`.text().then((x) => x.trim())
})()
// 判断是否为预览版本
const IS_PREVIEW = CHANNEL !== "latest"

// 确定版本号
const VERSION = await (async () => {
  // 如果设置了 OPENCODE_VERSION 环境变量，则使用它
  if (env.OPENCODE_VERSION) return env.OPENCODE_VERSION
  // 如果是预览版本，则生成 0.0.0- 开头的版本号
  if (IS_PREVIEW) return `0.0.0-${CHANNEL}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`
  // 从 npm 获取最新的 opencode-ai 版本
  const version = await fetch("https://registry.npmjs.org/opencode-ai/latest")
    .then((res) => {
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    })
    .then((data: any) => data.version)
  // 解析版本号的各个部分
  const [major, minor, patch] = version.split(".").map((x: string) => Number(x) || 0)
  // 根据 OPENCODE_BUMP 环境变量决定如何升级版本
  const t = env.OPENCODE_BUMP?.toLowerCase()
  if (t === "major") return `${major + 1}.0.0`
  if (t === "minor") return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
})()

// 导出 Script 对象，包含渠道、版本和预览标志
export const Script = {
  get channel() {
    return CHANNEL
  },
  get version() {
    return VERSION
  },
  get preview() {
    return IS_PREVIEW
  },
}
// 输出脚本信息
console.log(`opencode 脚本`, JSON.stringify(Script, null, 2))
