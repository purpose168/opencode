import path from "path"
import { pathToFileURL } from "url"
import z from "zod"
import { LSP } from "../lsp"
import { Instance } from "../project/instance"
import DESCRIPTION from "./lsp.txt"
import { Tool } from "./tool"

// 支持的LSP操作列表
const operations = [
  "goToDefinition",
  "findReferences",
  "hover",
  "documentSymbol",
  "workspaceSymbol",
  "goToImplementation",
  "prepareCallHierarchy",
  "incomingCalls",
  "outgoingCalls",
] as const

// 定义LSP工具，用于执行语言服务器协议操作
export const LspTool = Tool.define("lsp", {
  description: DESCRIPTION,
  parameters: z.object({
    operation: z.enum(operations).describe("要执行的LSP操作"),
    filePath: z.string().describe("文件的绝对路径或相对路径"),
    line: z.number().int().min(1).describe("行号（从1开始，如编辑器中所示）"),
    character: z.number().int().min(1).describe("字符偏移量（从1开始，如编辑器中所示）"),
  }),
  execute: async (args, ctx) => {
    // 请求LSP权限
    await ctx.ask({
      permission: "lsp",
      patterns: ["*"],
      always: ["*"],
      metadata: {},
    })

    // 解析文件路径
    const file = path.isAbsolute(args.filePath) ? args.filePath : path.join(Instance.directory, args.filePath)
    const uri = pathToFileURL(file).href
    const position = {
      file,
      line: args.line - 1,
      character: args.character - 1,
    }

    const relPath = path.relative(Instance.worktree, file)
    const title = `${args.operation} ${relPath}:${args.line}:${args.character}`

    // 检查文件是否存在
    const exists = await Bun.file(file).exists()
    if (!exists) {
      throw new Error(`文件未找到：${file}`)
    }

    // 检查是否有可用的LSP服务器
    const available = await LSP.hasClients(file)
    if (!available) {
      throw new Error("没有可用于此文件类型的LSP服务器。")
    }

    // 触发LSP文件更新
    await LSP.touchFile(file, true)

    // 根据操作类型执行相应的LSP方法
    const result: unknown[] = await (async () => {
      switch (args.operation) {
        case "goToDefinition":
          return LSP.definition(position)
        case "findReferences":
          return LSP.references(position)
        case "hover":
          return LSP.hover(position)
        case "documentSymbol":
          return LSP.documentSymbol(uri)
        case "workspaceSymbol":
          return LSP.workspaceSymbol("")
        case "goToImplementation":
          return LSP.implementation(position)
        case "prepareCallHierarchy":
          return LSP.prepareCallHierarchy(position)
        case "incomingCalls":
          return LSP.incomingCalls(position)
        case "outgoingCalls":
          return LSP.outgoingCalls(position)
      }
    })()

    // 构建输出
    const output = (() => {
      if (result.length === 0) return `未找到${args.operation}的结果`
      return JSON.stringify(result, null, 2)
    })()

    return {
      title,
      metadata: { result },
      output,
    }
  },
})
