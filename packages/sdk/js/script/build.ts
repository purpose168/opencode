#!/usr/bin/env bun

// 获取当前脚本所在目录的上级目录路径
const dir = new URL("..", import.meta.url).pathname
// 将当前工作目录切换到上级目录
process.chdir(dir)

// 导入 bun 的 $ 函数，用于执行 shell 命令
import { $ } from "bun"
// 导入 path 模块，用于处理文件路径
import path from "path"

// 导入 OpenAPI 客户端生成器
import { createClient } from "@hey-api/openapi-ts"

// 生成 OpenAPI 规范文件
await $`bun dev generate > ${dir}/openapi.json`.cwd(path.resolve(dir, "../../opencode"))

// 使用 OpenAPI 规范生成 TypeScript 客户端代码
await createClient({
  input: "./openapi.json",
  output: {
    path: "./src/v2/gen",
    tsConfigPath: path.join(dir, "tsconfig.json"),
    clean: true,
  },
  plugins: [
    {
      name: "@hey-api/typescript",
      exportFromIndex: false,
    },
    {
      name: "@hey-api/sdk",
      instance: "OpencodeClient",
      exportFromIndex: false,
      auth: false,
      paramsStructure: "flat",
    },
    {
      name: "@hey-api/client-fetch",
      exportFromIndex: false,
      baseUrl: "http://localhost:4096",
    },
  ],
})

// 使用 prettier 格式化生成的代码
await $`bun prettier --write src/gen`
await $`bun prettier --write src/v2`
// 删除旧的 dist 目录
await $`rm -rf dist`
// 编译 TypeScript 代码
await $`bun tsc`
// 删除临时的 openapi.json 文件
await $`rm openapi.json`
