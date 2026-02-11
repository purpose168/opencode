import path from "path"
import z from "zod"
import { Ripgrep } from "../file/ripgrep"
import { Instance } from "../project/instance"
import DESCRIPTION from "./glob.txt"
import { Tool } from "./tool"

// 定义glob工具，用于使用glob模式匹配文件
export const GlobTool = Tool.define("glob", {
  description: DESCRIPTION,
  parameters: z.object({
    pattern: z.string().describe("用于匹配文件的glob模式"),
    path: z
      .string()
      .optional()
      .describe(
        `要搜索的目录。如果未指定，将使用当前工作目录。重要提示：省略此字段以使用默认目录。不要输入"undefined"或"null" - 只需省略它即可使用默认行为。如果提供，必须是有效的目录路径。`,
      ),
  }),
  async execute(params, ctx) {
    // 请求glob权限
    await ctx.ask({
      permission: "glob",
      patterns: [params.pattern],
      always: ["*"],
      metadata: {
        pattern: params.pattern,
        path: params.path,
      },
    })

    // 解析搜索路径
    let search = params.path ?? Instance.directory
    search = path.isAbsolute(search) ? search : path.resolve(Instance.directory, search)

    // 限制最多返回100个文件
    const limit = 100
    const files = []
    let truncated = false
    // 使用Ripgrep搜索文件
    for await (const file of Ripgrep.files({
      cwd: search,
      glob: [params.pattern],
    })) {
      if (files.length >= limit) {
        truncated = true
        break
      }
      const full = path.resolve(search, file)
      const stats = await Bun.file(full)
        .stat()
        .then((x) => x.mtime.getTime())
        .catch(() => 0)
      files.push({
        path: full,
        mtime: stats,
      })
    }
    // 按修改时间降序排序
    files.sort((a, b) => b.mtime - a.mtime)

    // 构建输出
    const output = []
    if (files.length === 0) output.push("未找到文件")
    if (files.length > 0) {
      output.push(...files.map((f) => f.path))
      if (truncated) {
        output.push("")
        output.push("（结果已被截断。考虑使用更具体的路径或模式。）")
      }
    }

    return {
      title: path.relative(Instance.worktree, search),
      metadata: {
        count: files.length,
        truncated,
      },
      output: output.join("\n"),
    }
  },
})
