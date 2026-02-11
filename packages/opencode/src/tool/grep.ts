import z from "zod"
import { Ripgrep } from "../file/ripgrep"
import { Tool } from "./tool"

import { Instance } from "../project/instance"
import DESCRIPTION from "./grep.txt"

// 每行最大长度限制
const MAX_LINE_LENGTH = 2000

// 定义grep工具，用于在文件内容中搜索正则表达式模式
export const GrepTool = Tool.define("grep", {
  description: DESCRIPTION,
  parameters: z.object({
    pattern: z.string().describe("在文件内容中搜索的正则表达式模式"),
    path: z.string().optional().describe("要搜索的目录。默认为当前工作目录。"),
    include: z.string().optional().describe('搜索中要包含的文件模式（例如"*.js"、"*.{ts,tsx}"）'),
  }),
  async execute(params, ctx) {
    if (!params.pattern) {
      throw new Error("pattern是必需的")
    }

    // 请求grep权限
    await ctx.ask({
      permission: "grep",
      patterns: [params.pattern],
      always: ["*"],
      metadata: {
        pattern: params.pattern,
        path: params.path,
        include: params.include,
      },
    })

    const searchPath = params.path || Instance.directory

    // 构建ripgrep命令参数
    const rgPath = await Ripgrep.filepath()
    const args = ["-nH", "--field-match-separator=|", "--regexp", params.pattern]
    if (params.include) {
      args.push("--glob", params.include)
    }
    args.push(searchPath)

    // 启动ripgrep进程
    const proc = Bun.spawn([rgPath, ...args], {
      stdout: "pipe",
      stderr: "pipe",
    })

    const output = await new Response(proc.stdout).text()
    const errorOutput = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    // 处理未找到文件的情况
    if (exitCode === 1) {
      return {
        title: params.pattern,
        metadata: { matches: 0, truncated: false },
        output: "未找到文件",
      }
    }

    // 处理ripgrep执行失败的情况
    if (exitCode !== 0) {
      throw new Error(`ripgrep失败：${errorOutput}`)
    }

    // 处理Unix（\n）和Windows（\r\n）行尾符
    const lines = output.trim().split(/\r?\n/)
    const matches = []

    // 解析匹配结果
    for (const line of lines) {
      if (!line) continue

      const [filePath, lineNumStr, ...lineTextParts] = line.split("|")
      if (!filePath || !lineNumStr || lineTextParts.length === 0) continue

      const lineNum = parseInt(lineNumStr, 10)
      const lineText = lineTextParts.join("|")

      const file = Bun.file(filePath)
      const stats = await file.stat().catch(() => null)
      if (!stats) continue

      matches.push({
        path: filePath,
        modTime: stats.mtime.getTime(),
        lineNum,
        lineText,
      })
    }

    // 按修改时间降序排序
    matches.sort((a, b) => b.modTime - a.modTime)

    // 限制最多返回100个匹配项
    const limit = 100
    const truncated = matches.length > limit
    const finalMatches = truncated ? matches.slice(0, limit) : matches

    if (finalMatches.length === 0) {
      return {
        title: params.pattern,
        metadata: { matches: 0, truncated: false },
        output: "未找到文件",
      }
    }

    // 构建输出
    const outputLines = [`找到 ${finalMatches.length} 个匹配项`]

    let currentFile = ""
    for (const match of finalMatches) {
      if (currentFile !== match.path) {
        if (currentFile !== "") {
          outputLines.push("")
        }
        currentFile = match.path
        outputLines.push(`${match.path}：`)
      }
      const truncatedLineText =
        match.lineText.length > MAX_LINE_LENGTH ? match.lineText.substring(0, MAX_LINE_LENGTH) + "..." : match.lineText
      outputLines.push(`  行 ${match.lineNum}：${truncatedLineText}`)
    }

    // 添加截断提示
    if (truncated) {
      outputLines.push("")
      outputLines.push("（结果已被截断。考虑使用更具体的路径或模式。）")
    }

    return {
      title: params.pattern,
      metadata: {
        matches: finalMatches.length,
        truncated,
      },
      output: outputLines.join("\n"),
    }
  },
})
