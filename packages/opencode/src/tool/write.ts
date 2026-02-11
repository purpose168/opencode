import { createTwoFilesPatch } from "diff" // 创建文件差异补丁
import * as path from "path" // 路径处理模块
import z from "zod" // 数据验证库
import { Bus } from "../bus" // 事件总线
import { File } from "../file" // 文件管理
import { FileTime } from "../file/time" // 文件时间管理
import { LSP } from "../lsp" // 语言服务器协议
import { Instance } from "../project/instance" // 项目实例
import { Filesystem } from "../util/filesystem" // 文件系统工具
import { trimDiff } from "./edit" // 差异修剪工具
import { Tool } from "./tool" // 工具基类
import DESCRIPTION from "./write.txt" // 写入工具描述文件

const MAX_DIAGNOSTICS_PER_FILE = 20 // 每个文件最大诊断数量
const MAX_PROJECT_DIAGNOSTICS_FILES = 5 // 项目诊断文件最大数量

export const WriteTool = Tool.define("write", {
  description: DESCRIPTION,
  parameters: z.object({
    content: z.string().describe("要写入文件的内容"),
    filePath: z.string().describe("要写入文件的绝对路径（必须是绝对路径，不能是相对路径）"),
  }),
  async execute(params, ctx) {
    const filepath = path.isAbsolute(params.filePath) ? params.filePath : path.join(Instance.directory, params.filePath) // 处理文件路径
    /* TODO
    if (!Filesystem.contains(Instance.directory, filepath)) {
      const parentDir = path.dirname(filepath)
      ...
    }
    */

    const file = Bun.file(filepath)
    const exists = await file.exists() // 检查文件是否存在
    const contentOld = exists ? await file.text() : "" // 获取旧内容
    if (exists) await FileTime.assert(ctx.sessionID, filepath) // 验证文件时间

    const diff = trimDiff(createTwoFilesPatch(filepath, filepath, contentOld, params.content)) // 创建差异补丁
    await ctx.ask({
      permission: "edit",
      patterns: [path.relative(Instance.worktree, filepath)],
      always: ["*"],
      metadata: {
        filepath,
        diff,
      },
    })

    await Bun.write(filepath, params.content) // 写入文件
    await Bus.publish(File.Event.Edited, {
      file: filepath,
    })
    FileTime.read(ctx.sessionID, filepath) // 记录文件读取时间

    let output = ""
    await LSP.touchFile(filepath, true) // 触发LSP文件更新
    const diagnostics = await LSP.diagnostics() // 获取诊断信息
    const normalizedFilepath = Filesystem.normalizePath(filepath) // 规范化文件路径
    let projectDiagnosticsCount = 0
    for (const [file, issues] of Object.entries(diagnostics)) {
      const errors = issues.filter((item) => item.severity === 1) // 筛选错误
      if (errors.length === 0) continue
      const limited = errors.slice(0, MAX_DIAGNOSTICS_PER_FILE) // 限制错误数量
      const suffix =
        errors.length > MAX_DIAGNOSTICS_PER_FILE ? `\n... 还有 ${errors.length - MAX_DIAGNOSTICS_PER_FILE} 个错误` : ""
      if (file === normalizedFilepath) {
        output += `\n此文件有错误，请修复\n<file_diagnostics>\n${limited.map(LSP.Diagnostic.pretty).join("\n")}${suffix}\n</file_diagnostics>\n`
        continue
      }
      if (projectDiagnosticsCount >= MAX_PROJECT_DIAGNOSTICS_FILES) continue
      projectDiagnosticsCount++
      output += `\n<project_diagnostics>\n${file}\n${limited.map(LSP.Diagnostic.pretty).join("\n")}${suffix}\n</project_diagnostics>\n`
    }

    return {
      title: path.relative(Instance.worktree, filepath),
      metadata: {
        diagnostics,
        filepath,
        exists: exists,
      },
      output,
    }
  },
})
