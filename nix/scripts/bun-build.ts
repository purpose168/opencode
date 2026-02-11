// 导入Solid插件（Solid为响应式UI框架）
import solidPlugin from "./packages/opencode/node_modules/@opentui/solid/scripts/solid-plugin"
// 导入路径处理模块
import path from "path"
// 导入文件系统模块
import fs from "fs"

// 版本号占位符
const version = "@VERSION@"
// 包路径配置
const pkg = path.join(process.cwd(), "packages/opencode")
// 解析器Worker文件路径（Tree-sitter为语法解析库）
const parser = fs.realpathSync(path.join(pkg, "./node_modules/@opentui/core/parser.worker.js"))
// Worker入口文件路径
const worker = "./src/cli/cmd/tui/worker.ts"
// 获取编译目标环境变量
const target = process.env["BUN_COMPILE_TARGET"]

// 检查是否设置了编译目标
if (!target) {
  throw new Error("BUN_COMPILE_TARGET not set")
}

// 切换到包目录
process.chdir(pkg)

// 资源清单文件名
const manifestName = "opencode-assets.manifest"
// 资源清单文件路径
const manifestPath = path.join(pkg, manifestName)

// 读取已跟踪的资源文件列表
const readTrackedAssets = () => {
  if (!fs.existsSync(manifestPath)) return []
  return fs
    .readFileSync(manifestPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

// 删除已跟踪的资源文件
const removeTrackedAssets = () => {
  for (const file of readTrackedAssets()) {
    const filePath = path.join(pkg, file)
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true })
    }
  }
}

// 资源文件集合
const assets = new Set<string>()

// 添加资源文件到集合并复制到目标位置
const addAsset = async (p: string) => {
  const file = path.basename(p)
  const dest = path.join(pkg, file)
  await Bun.write(dest, Bun.file(p))
  assets.add(file)
}

// 删除之前构建的资源文件
removeTrackedAssets()

// 使用Bun构建主应用
const result = await Bun.build({
  // 构建条件设置为浏览器环境
  conditions: ["browser"],
  // TypeScript配置文件路径
  tsconfig: "./tsconfig.json",
  // 使用Solid插件
  plugins: [solidPlugin],
  // 生成外部源映射
  sourcemap: "external",
  // 入口文件列表
  entrypoints: ["./src/index.ts", parser, worker],
  // 定义全局常量
  define: {
    OPENCODE_VERSION: `'@VERSION@'`,
    // Tree-sitter Worker路径配置
    OTUI_TREE_SITTER_WORKER_PATH: "/$bunfs/root/" + path.relative(pkg, parser).replace(/\\/g, "/"),
    OPENCODE_CHANNEL: "'latest'",
  },
  // 编译配置
  compile: {
    target,
    // 输出文件名
    outfile: "opencode",
    // 执行参数配置
    execArgv: ["--user-agent=opencode/" + version, '--env-file=""', "--"],
    // Windows平台配置
    windows: {},
  },
})

// 检查构建是否成功
if (!result.success) {
  console.error("Build failed!")
  for (const log of result.logs) {
    console.error(log)
  }
  throw new Error("Compilation failed")
}

// 处理资源文件输出
const assetOutputs = result.outputs?.filter((x) => x.kind === "asset") ?? []
for (const x of assetOutputs) {
  await addAsset(x.path)
}

// 构建Worker包
const bundle = await Bun.build({
  // Worker入口文件
  entrypoints: [worker],
  // TypeScript配置文件路径
  tsconfig: "./tsconfig.json",
  // 使用Solid插件
  plugins: [solidPlugin],
  // 构建目标为Bun运行时
  target: "bun",
  // 输出目录
  outdir: "./.opencode-worker",
  // 不生成源映射
  sourcemap: "none",
})

// 检查Worker构建是否成功
if (!bundle.success) {
  console.error("Worker build failed!")
  for (const log of bundle.logs) {
    console.error(log)
  }
  throw new Error("Worker compilation failed")
}

// 处理Worker资源文件输出
const workerAssets = bundle.outputs?.filter((x) => x.kind === "asset") ?? []
for (const x of workerAssets) {
  await addAsset(x.path)
}

// 查找Worker入口点输出
const output = bundle.outputs.find((x) => x.kind === "entry-point")
if (!output) {
  throw new Error("Worker build produced no entry-point output")
}

// 复制Worker输出文件到目标位置
const dest = path.join(pkg, "opencode-worker.js")
await Bun.write(dest, Bun.file(output.path))
// 删除临时构建目录
fs.rmSync(path.dirname(output.path), { recursive: true, force: true })

// 将资源集合转换为数组
const list = Array.from(assets)
// 写入资源清单文件
await Bun.write(manifestPath, list.length > 0 ? list.join("\n") + "\n" : "")

// 输出构建成功信息
console.log("Build successful!")
