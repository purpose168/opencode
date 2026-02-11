import { iife } from "@/util/iife"
import * as fs from "fs"
import * as path from "path"
import z from "zod"
import { FileTime } from "../file/time"
import { Identifier } from "../id/id"
import { LSP } from "../lsp"
import { Instance } from "../project/instance"
import { Filesystem } from "../util/filesystem"
import DESCRIPTION from "./read.txt"
import { Tool } from "./tool"

// 默认读取行数限制
const DEFAULT_READ_LIMIT = 2000
// 每行最大长度限制
const MAX_LINE_LENGTH = 200

// 定义读取工具，用于读取文件内容
export const ReadTool = Tool.define("read", {
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe("要读取的文件的路径"),
    offset: z.coerce.number().describe("开始读取的行号（从0开始）").optional(),
    limit: z.coerce.number().describe("要读取的行数（默认为2000）").optional(),
  }),
  async execute(params, ctx) {
    let filepath = params.filePath
    if (!path.isAbsolute(filepath)) {
      filepath = path.join(process.cwd(), filepath)
    }
    const title = path.relative(Instance.worktree, filepath)

    // 检查是否需要外部目录权限
    if (!ctx.extra?.["bypassCwdCheck"] && !Filesystem.contains(Instance.directory, filepath)) {
      const parentDir = path.dirname(filepath)
      await ctx.ask({
        permission: "external_directory",
        patterns: [parentDir],
        always: [parentDir + "/*"],
        metadata: {
          filepath,
          parentDir,
        },
      })
    }

    // 请求读取权限
    await ctx.ask({
      permission: "read",
      patterns: [filepath],
      always: ["*"],
      metadata: {},
    })

    // 检查是否应该阻止读取（例如.env文件）
    const block = iife(() => {
      const basename = path.basename(filepath)
      const whitelist = [".env.sample", ".env.example", ".example", ".env.template"]

      if (whitelist.some((w) => basename.endsWith(w))) return false
      // 阻止.env、.env.local、.env.production等，但不阻止.envrc
      if (/^\.env(\.|$)/.test(basename)) return true

      return false
    })

    if (block) {
      throw new Error(`用户已阻止您读取${filepath}，请勿再尝试读取它`)
    }

    const file = Bun.file(filepath)
    if (!(await file.exists())) {
      const dir = path.dirname(filepath)
      const base = path.basename(filepath)

      const dirEntries = fs.readdirSync(dir)
      const suggestions = dirEntries
        .filter(
          (entry) =>
            entry.toLowerCase().includes(base.toLowerCase()) || base.toLowerCase().includes(entry.toLowerCase()),
        )
        .map((entry) => path.join(dir, entry))
        .slice(0, 3)

      if (suggestions.length > 0) {
        throw new Error(`文件未找到：${filepath}\n\n您是指这些文件中的一个吗？\n${suggestions.join("\n")}`)
      }

      throw new Error(`文件未找到：${filepath}`)
    }

    // 检查是否为图片或PDF文件
    const isImage = file.type.startsWith("image/") && file.type !== "image/svg+xml"
    const isPdf = file.type === "application/pdf"
    if (isImage || isPdf) {
      const mime = file.type
      const msg = `${isImage ? "图片" : "PDF"}读取成功`
      return {
        title,
        output: msg,
        metadata: {
          preview: msg,
        },
        attachments: [
          {
            id: Identifier.ascending("part"),
            sessionID: ctx.sessionID,
            messageID: ctx.messageID,
            type: "file",
            mime,
            url: `data:${mime};base64,${Buffer.from(await file.bytes()).toString("base64")}`,
          },
        ],
      }
    }

    // 检查是否为二进制文件
    const isBinary = await isBinaryFile(filepath, file)
    if (isBinary) throw new Error(`无法读取二进制文件：${filepath}`)

    // 读取文件内容
    const limit = params.limit ?? DEFAULT_READ_LIMIT
    const offset = params.offset || 0
    const lines = await file.text().then((text) => text.split("\n"))
    const raw = lines.slice(offset, offset + limit).map((line) => {
      return line.length > MAX_LINE_LENGTH ? line.substring(0, MAX_LINE_LENGTH) + "..." : line
    })
    const content = raw.map((line, index) => {
      return `${(index + offset + 1).toString().padStart(5, "0")}| ${line}`
    })
    const preview = raw.slice(0, 20).join("\n")

    // 构建输出
    let output = "<file>\n"
    output += content.join("\n")

    const totalLines = lines.length
    const lastReadLine = offset + content.length
    const hasMoreLines = totalLines > lastReadLine

    if (hasMoreLines) {
      output += `\n\n（文件还有更多行。使用'offset'参数读取第${lastReadLine}行之后的内容）`
    } else {
      output += `\n\n（文件结束 - 共${totalLines}行）`
    }
    output += "\n</file>"

    // 通知LSP客户端
    LSP.touchFile(filepath, false)
    FileTime.read(ctx.sessionID, filepath)

    return {
      title,
      output,
      metadata: {
        preview,
      },
    }
  },
})

// 检查文件是否为二进制文件
async function isBinaryFile(filepath: string, file: Bun.BunFile): Promise<boolean> {
  const ext = path.extname(filepath).toLowerCase()
  // 常见非文本扩展名的二进制检查
  switch (ext) {
    case ".zip":
    case ".tar":
    case ".gz":
    case ".exe":
    case ".dll":
    case ".so":
    case ".class":
    case ".jar":
    case ".war":
    case ".7z":
    case ".doc":
    case ".docx":
    case ".xls":
    case ".xlsx":
    case ".ppt":
    case ".pptx":
    case ".odt":
    case ".ods":
    case ".odp":
    case ".bin":
    case ".dat":
    case ".obj":
    case ".o":
    case ".a":
    case ".lib":
    case ".wasm":
    case ".pyc":
    case ".pyo":
      return true
    default:
      break
  }

  const stat = await file.stat()
  const fileSize = stat.size
  if (fileSize === 0) return false

  const bufferSize = Math.min(4096, fileSize)
  const buffer = await file.arrayBuffer()
  if (buffer.byteLength === 0) return false
  const bytes = new Uint8Array(buffer.slice(0, bufferSize))

  let nonPrintableCount = 0
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) return true
    if (bytes[i] < 9 || (bytes[i] > 13 && bytes[i] < 32)) {
      nonPrintableCount++
    }
  }
  // 如果>30%的不可打印字符，则认为是二进制文件
  return nonPrintableCount / bytes.length > 0.3
}
