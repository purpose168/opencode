import * as fs from "fs/promises"
import * as path from "path"
import z from "zod"
import { Log } from "../util/log"

export namespace Patch {
  const log = Log.create({ service: "patch" }) // 创建补丁服务日志记录器

  // Schema定义
  export const PatchSchema = z.object({
    patchText: z.string().describe("描述所有要进行的更改的完整补丁文本"),
  })

  export type PatchParams = z.infer<typeof PatchSchema>

  // 与Rust实现匹配的核心类型
  export interface ApplyPatchArgs {
    patch: string // 补丁文本
    hunks: Hunk[] // 补丁块列表
    workdir?: string // 工作目录(可选)
  }

  // 补丁块类型定义,支持添加、删除和更新文件
  export type Hunk =
    | { type: "add"; path: string; contents: string } // 添加文件
    | { type: "delete"; path: string } // 删除文件
    | { type: "update"; path: string; move_path?: string; chunks: UpdateFileChunk[] } // 更新文件

  // 更新文件的块定义
  export interface UpdateFileChunk {
    old_lines: string[] // 旧行内容
    new_lines: string[] // 新行内容
    change_context?: string // 更改上下文(可选)
    is_end_of_file?: boolean // 是否为文件结束标记(可选)
  }

  // 应用补丁操作接口
  export interface ApplyPatchAction {
    changes: Map<string, ApplyPatchFileChange> // 文件更改映射表
    patch: string // 补丁文本
    cwd: string // 当前工作目录
  }

  // 应用补丁文件更改类型
  export type ApplyPatchFileChange =
    | { type: "add"; content: string } // 添加文件
    | { type: "delete"; content: string } // 删除文件
    | { type: "update"; unified_diff: string; move_path?: string; new_content: string } // 更新文件

  // 受影响的路径接口
  export interface AffectedPaths {
    added: string[] // 添加的文件路径列表
    modified: string[] // 修改的文件路径列表
    deleted: string[] // 删除的文件路径列表
  }

  // 应用补丁错误枚举
  export enum ApplyPatchError {
    ParseError = "ParseError", // 解析错误
    IoError = "IoError", // 输入输出错误
    ComputeReplacements = "ComputeReplacements", // 计算替换错误
    ImplicitInvocation = "ImplicitInvocation", // 隐式调用错误
  }

  // 可能应用补丁枚举
  export enum MaybeApplyPatch {
    Body = "Body", // 主体
    ShellParseError = "ShellParseError", // Shell解析错误
    PatchParseError = "PatchParseError", // 补丁解析错误
    NotApplyPatch = "NotApplyPatch", // 不是应用补丁命令
  }

  // 可能应用补丁验证枚举
  export enum MaybeApplyPatchVerified {
    Body = "Body", // 主体
    ShellParseError = "ShellParseError", // Shell解析错误
    CorrectnessError = "CorrectnessError", // 正确性错误
    NotApplyPatch = "NotApplyPatch", // 不是应用补丁命令
  }

  // 解析器实现
  function parsePatchHeader(
    lines: string[],
    startIdx: number,
  ): { filePath: string; movePath?: string; nextIdx: number } | null {
    const line = lines[startIdx]

    if (line.startsWith("*** Add File:")) {
      const filePath = line.split(":", 2)[1]?.trim()
      return filePath ? { filePath, nextIdx: startIdx + 1 } : null
    }

    if (line.startsWith("*** Delete File:")) {
      const filePath = line.split(":", 2)[1]?.trim()
      return filePath ? { filePath, nextIdx: startIdx + 1 } : null
    }

    if (line.startsWith("*** Update File:")) {
      const filePath = line.split(":", 2)[1]?.trim()
      let movePath: string | undefined
      let nextIdx = startIdx + 1

      // 检查移动指令
      if (nextIdx < lines.length && lines[nextIdx].startsWith("*** Move to:")) {
        movePath = lines[nextIdx].split(":", 2)[1]?.trim()
        nextIdx++
      }

      return filePath ? { filePath, movePath, nextIdx } : null
    }

    return null
  }

  function parseUpdateFileChunks(lines: string[], startIdx: number): { chunks: UpdateFileChunk[]; nextIdx: number } {
    const chunks: UpdateFileChunk[] = []
    let i = startIdx

    while (i < lines.length && !lines[i].startsWith("***")) {
      if (lines[i].startsWith("@@")) {
        // 解析上下文行
        const contextLine = lines[i].substring(2).trim()
        i++

        const oldLines: string[] = []
        const newLines: string[] = []
        let isEndOfFile = false

        // 解析更改行
        while (i < lines.length && !lines[i].startsWith("@@") && !lines[i].startsWith("***")) {
          const changeLine = lines[i]

          if (changeLine === "*** End of File") {
            isEndOfFile = true
            i++
            break
          }

          if (changeLine.startsWith(" ")) {
            // 保留行 - 同时出现在旧文件和新文件中
            const content = changeLine.substring(1)
            oldLines.push(content)
            newLines.push(content)
          } else if (changeLine.startsWith("-")) {
            // 删除行 - 仅在旧文件中
            oldLines.push(changeLine.substring(1))
          } else if (changeLine.startsWith("+")) {
            // 添加行 - 仅在新文件中
            newLines.push(changeLine.substring(1))
          }

          i++
        }

        chunks.push({
          old_lines: oldLines,
          new_lines: newLines,
          change_context: contextLine || undefined,
          is_end_of_file: isEndOfFile || undefined,
        })
      } else {
        i++
      }
    }

    return { chunks, nextIdx: i }
  }

  function parseAddFileContent(lines: string[], startIdx: number): { content: string; nextIdx: number } {
    let content = ""
    let i = startIdx

    while (i < lines.length && !lines[i].startsWith("***")) {
      if (lines[i].startsWith("+")) {
        content += lines[i].substring(1) + "\n"
      }
      i++
    }

    // 移除末尾换行符
    if (content.endsWith("\n")) {
      content = content.slice(0, -1)
    }

    return { content, nextIdx: i }
  }

  export function parsePatch(patchText: string): { hunks: Hunk[] } {
    const lines = patchText.split("\n")
    const hunks: Hunk[] = []
    let i = 0

    // 查找开始/结束补丁标记
    const beginMarker = "*** Begin Patch"
    const endMarker = "*** End Patch"

    const beginIdx = lines.findIndex((line) => line.trim() === beginMarker)
    const endIdx = lines.findIndex((line) => line.trim() === endMarker)

    if (beginIdx === -1 || endIdx === -1 || beginIdx >= endIdx) {
      throw new Error("无效的补丁格式：缺少开始/结束标记")
    }

    // 解析标记之间的内容
    i = beginIdx + 1

    while (i < endIdx) {
      const header = parsePatchHeader(lines, i)
      if (!header) {
        i++
        continue
      }

      if (lines[i].startsWith("*** Add File:")) {
        const { content, nextIdx } = parseAddFileContent(lines, header.nextIdx)
        hunks.push({
          type: "add",
          path: header.filePath,
          contents: content,
        })
        i = nextIdx
      } else if (lines[i].startsWith("*** Delete File:")) {
        hunks.push({
          type: "delete",
          path: header.filePath,
        })
        i = header.nextIdx
      } else if (lines[i].startsWith("*** Update File:")) {
        const { chunks, nextIdx } = parseUpdateFileChunks(lines, header.nextIdx)
        hunks.push({
          type: "update",
          path: header.filePath,
          move_path: header.movePath,
          chunks,
        })
        i = nextIdx
      } else {
        i++
      }
    }

    return { hunks }
  }

  // 应用补丁功能
  export function maybeParseApplyPatch(
    argv: string[],
  ):
    | { type: MaybeApplyPatch.Body; args: ApplyPatchArgs }
    | { type: MaybeApplyPatch.PatchParseError; error: Error }
    | { type: MaybeApplyPatch.NotApplyPatch } {
      const APPLY_PATCH_COMMANDS = ["apply_patch", "applypatch"]

      // 直接调用: apply_patch <patch>
      if (argv.length === 2 && APPLY_PATCH_COMMANDS.includes(argv[0])) {
        try {
          const { hunks } = parsePatch(argv[1])
          return {
            type: MaybeApplyPatch.Body,
            args: {
              patch: argv[1],
              hunks,
            },
          }
        } catch (error) {
          return {
            type: MaybeApplyPatch.PatchParseError,
            error: error as Error,
          }
        }
      }

      // Bash heredoc形式: bash -lc 'apply_patch <<"EOF" ...'
      if (argv.length === 3 && argv[0] === "bash" && argv[1] === "-lc") {
        // 简单提取 - 在实际实现中需要正确的bash解析
        const script = argv[2]
        const heredocMatch = script.match(/apply_patch\s*<<['"](\w+)['"]\s*\n([\s\S]*?)\n\1/)

        if (heredocMatch) {
          const patchContent = heredocMatch[2]
          try {
            const { hunks } = parsePatch(patchContent)
            return {
              type: MaybeApplyPatch.Body,
              args: {
                patch: patchContent,
                hunks,
              },
            }
          } catch (error) {
            return {
              type: MaybeApplyPatch.PatchParseError,
              error: error as Error,
            }
          }
        }
      }

      return { type: MaybeApplyPatch.NotApplyPatch }
    }

  // 文件内容操作
  interface ApplyPatchFileUpdate {
    unified_diff: string
    content: string
  }

  export function deriveNewContentsFromChunks(filePath: string, chunks: UpdateFileChunk[]): ApplyPatchFileUpdate {
    // 读取原始文件内容
    let originalContent: string
    try {
      originalContent = require("fs").readFileSync(filePath, "utf-8")
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error}`)
    }

    let originalLines = originalContent.split("\n")

    // 移除末尾空元素以保持一致的行计数
    if (originalLines.length > 0 && originalLines[originalLines.length - 1] === "") {
      originalLines.pop()
    }

    const replacements = computeReplacements(originalLines, filePath, chunks)
    let newLines = applyReplacements(originalLines, replacements)

    // 确保末尾换行
    if (newLines.length === 0 || newLines[newLines.length - 1] !== "") {
      newLines.push("")
    }

    const newContent = newLines.join("\n")

    // 生成统一差异
    const unifiedDiff = generateUnifiedDiff(originalContent, newContent)

    return {
      unified_diff: unifiedDiff,
      content: newContent,
    }
  }

  function computeReplacements(
    originalLines: string[],
    filePath: string,
    chunks: UpdateFileChunk[],
  ): Array<[number, number, string[]]> {
    const replacements: Array<[number, number, string[]]> = []
    let lineIndex = 0

    for (const chunk of chunks) {
      // 处理基于上下文的查找
      if (chunk.change_context) {
        const contextIdx = seekSequence(originalLines, [chunk.change_context], lineIndex)
        if (contextIdx === -1) {
          throw new Error(`Failed to find context '${chunk.change_context}' in ${filePath}`)
        }
        lineIndex = contextIdx + 1
      }

      // 处理纯添加(没有旧行)
      if (chunk.old_lines.length === 0) {
        const insertionIdx =
          originalLines.length > 0 && originalLines[originalLines.length - 1] === ""
            ? originalLines.length - 1
            : originalLines.length
        replacements.push([insertionIdx, 0, chunk.new_lines])
        continue
      }

      // 尝试在文件中匹配旧行
      let pattern = chunk.old_lines
      let newSlice = chunk.new_lines
      let found = seekSequence(originalLines, pattern, lineIndex)

      // 如果未找到,重试不带末尾空行的情况
      if (found === -1 && pattern.length > 0 && pattern[pattern.length - 1] === "") {
        pattern = pattern.slice(0, -1)
        if (newSlice.length > 0 && newSlice[newSlice.length - 1] === "") {
          newSlice = newSlice.slice(0, -1)
        }
        found = seekSequence(originalLines, pattern, lineIndex)
      }

      if (found !== -1) {
        replacements.push([found, pattern.length, newSlice])
        lineIndex = found + pattern.length
      } else {
        throw new Error(`Failed to find expected lines in ${filePath}:\n${chunk.old_lines.join("\n")}`)
      }
    }

    // 按索引排序替换项以按顺序应用
    replacements.sort((a, b) => a[0] - b[0])

    return replacements
  }

  function applyReplacements(lines: string[], replacements: Array<[number, number, string[]]>): string[] {
    // 按相反顺序应用替换以避免索引偏移
    const result = [...lines]

    for (let i = replacements.length - 1; i >= 0; i--) {
      const [startIdx, oldLen, newSegment] = replacements[i]

      // 移除旧行
      result.splice(startIdx, oldLen)

      // 插入新行
      for (let j = 0; j < newSegment.length; j++) {
        result.splice(startIdx + j, 0, newSegment[j])
      }
    }

    return result
  }

  function seekSequence(lines: string[], pattern: string[], startIndex: number): number {
    if (pattern.length === 0) return -1

    // 简单的子字符串搜索实现
    for (let i = startIndex; i <= lines.length - pattern.length; i++) {
      let matches = true

      for (let j = 0; j < pattern.length; j++) {
        if (lines[i + j] !== pattern[j]) {
          matches = false
          break
        }
      }

      if (matches) {
        return i
      }
    }

    return -1
  }

  function generateUnifiedDiff(oldContent: string, newContent: string): string {
    const oldLines = oldContent.split("\n")
    const newLines = newContent.split("\n")

    // 简单的差异生成 - 在实际实现中应使用适当的差异算法
    let diff = "@@ -1 +1 @@\n"

    // 查找更改(简化方法)
    const maxLen = Math.max(oldLines.length, newLines.length)
    let hasChanges = false

    for (let i = 0; i < maxLen; i++) {
      const oldLine = oldLines[i] || ""
      const newLine = newLines[i] || ""

      if (oldLine !== newLine) {
        if (oldLine) diff += `-${oldLine}\n`
        if (newLine) diff += `+${newLine}\n`
        hasChanges = true
      } else if (oldLine) {
        diff += ` ${oldLine}\n`
      }
    }

    return hasChanges ? diff : ""
  }

  // 将补丁块应用到文件系统
  export async function applyHunksToFiles(hunks: Hunk[]): Promise<AffectedPaths> {
    if (hunks.length === 0) {
      throw new Error("没有文件被修改。")
    }

    const added: string[] = []
    const modified: string[] = []
    const deleted: string[] = []

    for (const hunk of hunks) {
      switch (hunk.type) {
        case "add":
          // 创建父目录
          const addDir = path.dirname(hunk.path)
          if (addDir !== "." && addDir !== "/") {
            await fs.mkdir(addDir, { recursive: true })
          }

          await fs.writeFile(hunk.path, hunk.contents, "utf-8")
          added.push(hunk.path)
          log.info(`Added file: ${hunk.path}`)
          break

        case "delete":
          await fs.unlink(hunk.path)
          deleted.push(hunk.path)
          log.info(`Deleted file: ${hunk.path}`)
          break

        case "update":
          const fileUpdate = deriveNewContentsFromChunks(hunk.path, hunk.chunks)

          if (hunk.move_path) {
            // 处理文件移动
            const moveDir = path.dirname(hunk.move_path)
            if (moveDir !== "." && moveDir !== "/") {
              await fs.mkdir(moveDir, { recursive: true })
            }

            await fs.writeFile(hunk.move_path, fileUpdate.content, "utf-8")
            await fs.unlink(hunk.path)
            modified.push(hunk.move_path)
            log.info(`Moved file: ${hunk.path} -> ${hunk.move_path}`)
          } else {
            // 常规更新
            await fs.writeFile(hunk.path, fileUpdate.content, "utf-8")
            modified.push(hunk.path)
            log.info(`Updated file: ${hunk.path}`)
          }
          break
      }
    }

    return { added, modified, deleted }
  }

  // 主补丁应用函数
  export async function applyPatch(patchText: string): Promise<AffectedPaths> {
    const { hunks } = parsePatch(patchText)
    return applyHunksToFiles(hunks)
  }

  // maybeParseApplyPatchVerified的异步版本
  export async function maybeParseApplyPatchVerified(
    argv: string[],
    cwd: string,
  ): Promise<
    | { type: MaybeApplyPatchVerified.Body; action: ApplyPatchAction }
    | { type: MaybeApplyPatchVerified.CorrectnessError; error: Error }
    | { type: MaybeApplyPatchVerified.NotApplyPatch }
  > {
    // 检测隐式补丁调用(没有apply_patch命令的原始补丁)
    if (argv.length === 1) {
      try {
        parsePatch(argv[0])
        return {
          type: MaybeApplyPatchVerified.CorrectnessError,
          error: new Error(ApplyPatchError.ImplicitInvocation),
        }
      } catch {
        // 不是补丁,继续
      }
    }

    const result = maybeParseApplyPatch(argv)

    switch (result.type) {
      case MaybeApplyPatch.Body:
        const { args } = result
        const effectiveCwd = args.workdir ? path.resolve(cwd, args.workdir) : cwd
        const changes = new Map<string, ApplyPatchFileChange>()

        for (const hunk of args.hunks) {
          const resolvedPath = path.resolve(
            effectiveCwd,
            hunk.type === "update" && hunk.move_path ? hunk.move_path : hunk.path,
          )

          switch (hunk.type) {
            case "add":
              changes.set(resolvedPath, {
                type: "add",
                content: hunk.contents,
              })
              break

            case "delete":
              // 对于删除,需要读取当前内容
              const deletePath = path.resolve(effectiveCwd, hunk.path)
              try {
                const content = await fs.readFile(deletePath, "utf-8")
                changes.set(resolvedPath, {
                  type: "delete",
                  content,
                })
              } catch (error) {
                return {
                  type: MaybeApplyPatchVerified.CorrectnessError,
                  error: new Error(`Failed to read file for deletion: ${deletePath}`),
                }
              }
              break

            case "update":
              const updatePath = path.resolve(effectiveCwd, hunk.path)
              try {
                const fileUpdate = deriveNewContentsFromChunks(updatePath, hunk.chunks)
                changes.set(resolvedPath, {
                  type: "update",
                  unified_diff: fileUpdate.unified_diff,
                  move_path: hunk.move_path ? path.resolve(effectiveCwd, hunk.move_path) : undefined,
                  new_content: fileUpdate.content,
                })
              } catch (error) {
                return {
                  type: MaybeApplyPatchVerified.CorrectnessError,
                  error: error as Error,
                }
              }
              break
          }
        }

        return {
          type: MaybeApplyPatchVerified.Body,
          action: {
            changes,
            patch: args.patch,
            cwd: effectiveCwd,
          },
        }

      case MaybeApplyPatch.PatchParseError:
        return {
          type: MaybeApplyPatchVerified.CorrectnessError,
          error: result.error,
        }

      case MaybeApplyPatch.NotApplyPatch:
        return { type: MaybeApplyPatchVerified.NotApplyPatch }
    }
  }
}
