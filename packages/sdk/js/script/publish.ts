#!/usr/bin/env bun

// 导入 Script 模块，用于获取发布渠道信息
import { Script } from "@opencode-ai/script"
// 导入 bun 的 $ 函数，用于执行 shell 命令
import { $ } from "bun"

// 获取当前脚本所在目录的上级目录路径
const dir = new URL("..", import.meta.url).pathname
// 将当前工作目录切换到上级目录
process.chdir(dir)

// 执行构建脚本
await import("./build")

// 导入 package.json 文件的内容
const pkg = await import("../package.json").then((m) => m.default)
// 备份原始的 package.json 内容
const original = JSON.parse(JSON.stringify(pkg))
// 遍历 package.json 中的 exports 字段，将源文件路径替换为编译后的路径
for (const [key, value] of Object.entries(pkg.exports)) {
  const file = value.replace("./src/", "./dist/").replace(".ts", "")
  /// @ts-expect-error
  pkg.exports[key] = {
    import: file + ".js",
    types: file + ".d.ts",
  }
}
// 将修改后的 package.json 写入文件
await Bun.write("package.json", JSON.stringify(pkg, null, 2))
// 打包项目
await $`bun pm pack`
// 发布到 npm，使用指定的发布渠道
await $`npm publish *.tgz --tag ${Script.channel} --access public`
// 恢复原始的 package.json 内容
await Bun.write("package.json", JSON.stringify(original, null, 2))
