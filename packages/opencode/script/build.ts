#!/usr/bin/env bun

/**
 * opencode 构建脚本
 * 用于为不同平台和架构构建 opencode 的二进制文件
 */

import solidPlugin from "../node_modules/@opentui/solid/scripts/solid-plugin"
import path from "path"
import fs from "fs"
import { $ } from "bun"
import { fileURLToPath } from "url"

// 获取当前文件和目录路径
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

// 切换到项目根目录
process.chdir(dir)

// 导入 package.json 和 Script 模块
import pkg from "../package.json"
import { Script } from "@opencode-ai/script"

// 解析命令行参数
const singleFlag = process.argv.includes("--single") // 仅构建当前平台的二进制文件
const baselineFlag = process.argv.includes("--baseline") // 构建基线版本（不使用 AVX2）
const skipInstall = process.argv.includes("--skip-install") // 跳过依赖安装

// 所有构建目标配置
const allTargets: {
  os: string // 操作系统
  arch: "arm64" | "x64" // 架构
  abi?: "musl" // ABI 类型（仅 Linux）
  avx2?: false // 是否禁用 AVX2
}[] = [
  {
    os: "linux",
    arch: "arm64",
  },
  {
    os: "linux",
    arch: "x64",
  },
  {
    os: "linux",
    arch: "x64",
    avx2: false, // 禁用 AVX2 的基线版本
  },
  {
    os: "linux",
    arch: "arm64",
    abi: "musl", // 使用 musl ABI
  },
  {
    os: "linux",
    arch: "x64",
    abi: "musl", // 使用 musl ABI
  },
  {
    os: "linux",
    arch: "x64",
    abi: "musl", // 使用 musl ABI
    avx2: false, // 禁用 AVX2 的基线版本
  },
  {
    os: "darwin", // macOS
    arch: "arm64",
  },
  {
    os: "darwin", // macOS
    arch: "x64",
  },
  {
    os: "darwin", // macOS
    arch: "x64",
    avx2: false, // 禁用 AVX2 的基线版本
  },
  {
    os: "win32", // Windows
    arch: "x64",
  },
  {
    os: "win32", // Windows
    arch: "x64",
    avx2: false, // 禁用 AVX2 的基线版本
  },
]

// 根据命令行参数筛选构建目标
const targets = singleFlag
  ? allTargets.filter((item) => {
      // 只保留与当前平台和架构匹配的目标
      if (item.os !== process.platform || item.arch !== process.arch) {
        return false
      }

      // 当构建当前平台时，默认优先使用单个原生二进制文件
      // 基线二进制文件需要额外的 Bun 构件，下载可能不稳定
      if (item.avx2 === false) {
        return baselineFlag
      }

      return true
    })
  : allTargets // 否则构建所有目标

// 清空 dist 目录
await $`rm -rf dist`

// 存储构建的二进制文件信息
const binaries: Record<string, string> = {}

// 安装跨平台依赖
if (!skipInstall) {
  await $`bun install --os="*" --cpu="*" @opentui/core@${pkg.dependencies["@opentui/core"]}`
  await $`bun install --os="*" --cpu="*" @parcel/watcher@${pkg.dependencies["@parcel/watcher"]}`
}

// 为每个目标构建二进制文件
for (const item of targets) {
  // 构建包名称
  const name = [
    pkg.name,
    // 由于某些原因，将 win32 更改为 windows
    item.os === "win32" ? "windows" : item.os,
    item.arch,
    item.avx2 === false ? "baseline" : undefined, // 如果禁用 AVX2，添加 baseline 后缀
    item.abi === undefined ? undefined : item.abi, // 如果指定了 ABI，添加 ABI 后缀
  ]
    .filter(Boolean) // 过滤掉 undefined 值
    .join("-") // 用连字符连接

  console.log(`构建 ${name}`)
  
  // 创建输出目录
  await $`mkdir -p dist/${name}/bin`

  // 获取解析器工作线程和本地工作线程路径
  const parserWorker = fs.realpathSync(path.resolve(dir, "./node_modules/@opentui/core/parser.worker.js"))
  const workerPath = "./src/cli/cmd/tui/worker.ts"

  // 根据目标操作系统使用特定的 bunfs 根路径
  const bunfsRoot = item.os === "win32" ? "B:/~BUN/root/" : "/$bunfs/root/"
  const workerRelativePath = path.relative(dir, parserWorker).replaceAll("\\", "/")

  // 使用 Bun.build 编译项目
  await Bun.build({
    conditions: ["browser"], // 使用浏览器条件
    tsconfig: "./tsconfig.json", // 使用项目的 tsconfig.json
    plugins: [solidPlugin], // 使用 Solid 插件
    sourcemap: "external", // 生成外部源映射
    compile: {
      autoloadBunfig: false, // 不自动加载 bunfig.toml
      autoloadDotenv: false, // 不自动加载 .env 文件
      //@ts-ignore (bun 类型定义未更新)
      autoloadTsconfig: true, // 自动加载 tsconfig.json
      autoloadPackageJson: true, // 自动加载 package.json
      target: name.replace(pkg.name, "bun") as any, // 构建目标
      outfile: `dist/${name}/bin/opencode`, // 输出文件路径
      execArgv: [`--user-agent=opencode/${Script.version}`, "--"], // 执行参数
      windows: {}, // Windows 特定配置
    },
    entrypoints: [
      "./src/index.ts", // 主入口
      parserWorker, // 解析器工作线程
      workerPath // 本地工作线程
    ],
    define: {
      OPENCODE_VERSION: `'${Script.version}'`, // 定义版本常量
      OTUI_TREE_SITTER_WORKER_PATH: bunfsRoot + workerRelativePath, // 定义解析器工作线程路径
      OPENCODE_WORKER_PATH: workerPath, // 定义本地工作线程路径
      OPENCODE_CHANNEL: `'${Script.channel}'`, // 定义发布通道
      OPENCODE_LIBC: item.os === "linux" ? `'${item.abi ?? "glibc"}'` : "", // 定义 libc 类型
    },
  })

  // 清理不需要的 tui 目录
  await $`rm -rf ./dist/${name}/bin/tui`
  
  // 写入 package.json 文件
  await Bun.file(`dist/${name}/package.json`).write(
    JSON.stringify(
      {
        name, // 包名称
        version: Script.version, // 版本号
        os: [item.os], // 支持的操作系统
        cpu: [item.arch], // 支持的架构
      },
      null,
      2, // 缩进为 2 空格
    ),
  )
  
  // 记录构建的二进制文件信息
  binaries[name] = Script.version
}

// 导出构建的二进制文件信息
export { binaries }
