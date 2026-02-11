import path from "path"
import z from "zod"
import { Instance } from "../project/instance"
import { EditTool } from "./edit"
import DESCRIPTION from "./multiedit.txt"
import { Tool } from "./tool"

// 定义多重编辑工具，用于在文件上顺序执行多个编辑操作
export const MultiEditTool = Tool.define("multiedit", {
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe("要修改的文件的绝对路径"),
    edits: z
      .array(
        z.object({
          filePath: z.string().describe("要修改的文件的绝对路径"),
          oldString: z.string().describe("要替换的文本"),
          newString: z.string().describe("替换后的文本（必须与oldString不同）"),
          replaceAll: z.boolean().optional().describe("替换所有出现的oldString（默认为false）"),
        }),
      )
      .describe("要在文件上顺序执行的编辑操作数组"),
  }),
  async execute(params, ctx) {
    // 初始化编辑工具
    const tool = await EditTool.init()
    const results = []
    // 顺序执行每个编辑操作
    for (const [, edit] of params.edits.entries()) {
      const result = await tool.execute(
        {
          filePath: params.filePath,
          oldString: edit.oldString,
          newString: edit.newString,
          replaceAll: edit.replaceAll,
        },
        ctx,
      )
      results.push(result)
    }
    return {
      title: path.relative(Instance.worktree, params.filePath),
      metadata: {
        results: results.map((r) => r.metadata),
      },
      output: results.at(-1)!.output,
    }
  },
})
