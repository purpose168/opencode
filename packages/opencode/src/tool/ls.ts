import * as path from "path"
import z from "zod"
import { Ripgrep } from "../file/ripgrep"
import { Instance } from "../project/instance"
import DESCRIPTION from "./ls.txt"
import { Tool } from "./tool"

// 默认忽略的目录模式列表
export const IGNORE_PATTERNS = [
  "node_modules/",
  "__pycache__/",
  ".git/",
  "dist/",
  "build/",
  "target/",
  "vendor/",
  "bin/",
  "obj/",
  ".idea/",
  ".vscode/",
  ".zig-cache/",
  "zig-out",
  ".coverage",
  "coverage/",
  "vendor/",
  "tmp/",
  "temp/",
  ".cache/",
  "cache/",
  "logs/",
  ".venv/",
  "venv/",
  "env/",
]

// 最多显示的文件数量限制
const LIMIT = 100

// 定义列表工具，用于列出目录内容
export const ListTool = Tool.define("list", {
  description: DESCRIPTION,
  parameters: z.object({
    path: z.string().describe("要列出的目录的绝对路径（必须是绝对路径，不能是相对路径）").optional(),
    ignore: z.array(z.string()).describe("要忽略的glob模式列表").optional(),
  }),
  async execute(params, ctx) {
    // 解析搜索路径
    const searchPath = path.resolve(Instance.directory, params.path || ".")

    // 请求列表权限
    await ctx.ask({
      permission: "list",
      patterns: [searchPath],
      always: ["*"],
      metadata: {
        path: searchPath,
      },
    })

    // 构建忽略的glob模式
    const ignoreGlobs = IGNORE_PATTERNS.map((p) => `!${p}*`).concat(params.ignore?.map((p) => `!${p}`) || [])
    const files = []
    // 使用Ripgrep搜索文件
    for await (const file of Ripgrep.files({ cwd: searchPath, glob: ignoreGlobs })) {
      files.push(file)
      if (files.length >= LIMIT) break
    }

    // 构建目录结构
    const dirs = new Set<string>()
    const filesByDir = new Map<string, string[]>()

    for (const file of files) {
      const dir = path.dirname(file)
      const parts = dir === "." ? [] : dir.split("/")

      // 添加所有父目录
      for (let i = 0; i <= parts.length; i++) {
        const dirPath = i === 0 ? "." : parts.slice(0, i).join("/")
        dirs.add(dirPath)
      }

      // 将文件添加到其目录
      if (!filesByDir.has(dir)) filesByDir.set(dir, [])
      filesByDir.get(dir)!.push(path.basename(file))
    }

    // 递归渲染目录的函数
    function renderDir(dirPath: string, depth: number): string {
      const indent = "  ".repeat(depth)
      let output = ""

      if (depth > 0) {
        output += `${indent}${path.basename(dirPath)}/\n`
      }

      const childIndent = "  ".repeat(depth + 1)
      const children = Array.from(dirs)
        .filter((d) => path.dirname(d) === dirPath && d !== dirPath)
        .sort()

      // 先渲染子目录
      for (const child of children) {
        output += renderDir(child, depth + 1)
      }

      // 渲染文件
      const files = filesByDir.get(dirPath) || []
      for (const file of files.sort()) {
        output += `${childIndent}${file}\n`
      }

      return output
    }

    // 生成输出
    const output = `${searchPath}/\n` + renderDir(".", 0)

    return {
      title: path.relative(Instance.worktree, searchPath),
      metadata: {
        count: files.length,
        truncated: files.length >= LIMIT,
      },
      output,
    }
  },
})
