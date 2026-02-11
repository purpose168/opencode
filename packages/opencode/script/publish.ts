#!/usr/bin/env bun
/**
 * opencode 发布脚本
 * 用于构建、测试和发布 opencode 到 npm 等平台
 */

import { $ } from "bun"
import pkg from "../package.json"
import { Script } from "@opencode-ai/script"
import { fileURLToPath } from "url"

// 获取项目根目录并切换到该目录
const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

// 导入构建脚本生成的二进制文件信息
const { binaries } = await import("./build.ts")

// 运行冒烟测试，验证构建的二进制文件是否正常工作
{
  const name = `${pkg.name}-${process.platform}-${process.arch}`
  console.log(`冒烟测试: 运行 dist/${name}/bin/opencode --version`)
  await $`./dist/${name}/bin/opencode --version`
}

// 创建主包目录并复制必要文件
await $`mkdir -p ./dist/${pkg.name}`
await $`cp -r ./bin ./dist/${pkg.name}/bin`
await $`cp ./script/postinstall.mjs ./dist/${pkg.name}/postinstall.mjs`

// 写入主包的 package.json 文件
await Bun.file(`./dist/${pkg.name}/package.json`).write(
  JSON.stringify(
    {
      name: pkg.name + "-ai", // 包名称
      bin: {
        [pkg.name]: `./bin/${pkg.name}`, // 命令行工具入口
      },
      scripts: {
        postinstall: "bun ./postinstall.mjs || node ./postinstall.mjs", // 安装后脚本
      },
      version: Script.version, // 版本号
      optionalDependencies: binaries, // 可选依赖（各平台二进制文件）
    },
    null,
    2, // 缩进为 2 空格
  ),
)

// 发布标签（如 latest、beta 等）
const tags = [Script.channel]

// 发布各平台的二进制包
const tasks = Object.entries(binaries).map(async ([name]) => {
  // 在非 Windows 平台上设置可执行权限
  if (process.platform !== "win32") {
    await $`chmod -R 755 .`.cwd(`./dist/${name}`)
  }
  // 打包二进制包
  await $`bun pm pack`.cwd(`./dist/${name}`)
  // 发布到 npm，使用指定标签
  for (const tag of tags) {
    await $`npm publish *.tgz --access public --tag ${tag}`.cwd(`./dist/${name}`)
  }
})

// 等待所有二进制包发布完成
await Promise.all(tasks)

// 发布主包
for (const tag of tags) {
  await $`cd ./dist/${pkg.name} && bun pm pack && npm publish *.tgz --access public --tag ${tag}`
}

// 非预览版本时，创建 GitHub Release 所需的归档文件
if (!Script.preview) {
  // 为每个平台创建归档文件
  for (const key of Object.keys(binaries)) {
    if (key.includes("linux")) {
      // Linux 平台使用 tar.gz 格式
      await $`tar -czf ../../${key}.tar.gz *`.cwd(`dist/${key}/bin`)
    } else {
      // 其他平台使用 zip 格式
      await $`zip -r ../../${key}.zip *`.cwd(`dist/${key}/bin`)
    }
  }

  // 构建并推送 Docker 镜像
  const image = "ghcr.io/sst/opencode" // Docker 镜像名称
  const platforms = "linux/amd64,linux/arm64" // 支持的平台
  const dockerTags = [`${image}:${Script.version}`, `${image}:latest`] // Docker 标签
  const tagFlags = dockerTags.flatMap((t) => ["-t", t]) // 构建标签参数
  // 使用 buildx 构建多平台镜像并推送
  await $`docker buildx build --platform ${platforms} ${tagFlags} --push .`
}
