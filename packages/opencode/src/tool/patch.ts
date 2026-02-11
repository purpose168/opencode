import { createTwoFilesPatch } from "diff"
import * as fs from "fs/promises"
import * as path from "path"
import z from "zod"
import { Bus } from "../bus"
import { FileTime } from "../file/time"
import { FileWatcher } from "../file/watcher"
import { Patch } from "../patch"
import { Instance } from "../project/instance"
import { Filesystem } from "../util/filesystem"
import { Tool } from "./tool"

// 补丁参数定义
const PatchParams = z.object({
  patchText: z.string().describe("描述所有要进行的更改的完整补丁文本"),
})

// 定义补丁工具，用于应用补丁修改多个文件
export const PatchTool = Tool.define("patch", {
  description: "应用补丁以修改多个文件。支持添加、更新和删除具有上下文感知的文件。",
  parameters: PatchParams,
  async execute(params, ctx) {
    if (!params.patchText) {
      throw new Error("patchText是必需的")
    }

    // 解析补丁以获取hunks
    let hunks: Patch.Hunk[]
    try {
      const parseResult = Patch.parsePatch(params.patchText)
      hunks = parseResult.hunks
    } catch (error) {
      throw new Error(`解析补丁失败：${error}`)
    }

    if (hunks.length === 0) {
      throw new Error("在补丁中未找到文件更改")
    }

    // 验证文件路径并检查权限
    const fileChanges: Array<{
      filePath: string
      oldContent: string
      newContent: string
      type: "add" | "update" | "delete" | "move"
      movePath?: string
    }> = []

    let totalDiff = ""

    for (const hunk of hunks) {
      const filePath = path.resolve(Instance.directory, hunk.path)

      // 检查是否需要外部目录权限
      if (!Filesystem.contains(Instance.directory, filePath)) {
        const parentDir = path.dirname(filePath)
        await ctx.ask({
          permission: "external_directory",
          patterns: [parentDir, path.join(parentDir, "*")],
          always: [parentDir + "/*"],
          metadata: {
            filepath: filePath,
            parentDir,
          },
        })
      }

      switch (hunk.type) {
        case "add":
          if (hunk.type === "add") {
            const oldContent = ""
            const newContent = hunk.contents
            const diff = createTwoFilesPatch(filePath, filePath, oldContent, newContent)

            fileChanges.push({
              filePath,
              oldContent,
              newContent,
              type: "add",
            })

            totalDiff += diff + "\n"
          }
          break

        case "update":
          // 对于更新操作，检查文件是否存在
          const stats = await fs.stat(filePath).catch(() => null)
          if (!stats || stats.isDirectory()) {
            throw new Error(`文件未找到或是目录：${filePath}`)
          }

          // 读取文件并更新时间跟踪（类似于编辑工具）
          await FileTime.assert(ctx.sessionID, filePath)
          const oldContent = await fs.readFile(filePath, "utf-8")
          let newContent = oldContent

          // 应用更新块以获取新内容
          try {
            const fileUpdate = Patch.deriveNewContentsFromChunks(filePath, hunk.chunks)
            newContent = fileUpdate.content
          } catch (error) {
            throw new Error(`无法将更新应用于${filePath}：${error}`)
          }

          const diff = createTwoFilesPatch(filePath, filePath, oldContent, newContent)

          fileChanges.push({
            filePath,
            oldContent,
            newContent,
            type: hunk.move_path ? "move" : "update",
            movePath: hunk.move_path ? path.resolve(Instance.directory, hunk.move_path) : undefined,
          })

          totalDiff += diff + "\n"
          break

        case "delete":
          // 对于删除操作，检查文件是否存在
          await FileTime.assert(ctx.sessionID, filePath)
          const contentToDelete = await fs.readFile(filePath, "utf-8")
          const deleteDiff = createTwoFilesPatch(filePath, filePath, contentToDelete, "")

          fileChanges.push({
            filePath,
            oldContent: contentToDelete,
            newContent: "",
            type: "delete",
          })

          totalDiff += deleteDiff + "\n"
          break
      }
    }

    // 如果需要，检查权限
    await ctx.ask({
      permission: "edit",
      patterns: fileChanges.map((c) => path.relative(Instance.worktree, c.filePath)),
      always: ["*"],
      metadata: {
        diff: totalDiff,
      },
    })

    // 应用更改
    const changedFiles: string[] = []

    for (const change of fileChanges) {
      switch (change.type) {
        case "add":
          // 创建父目录
          const addDir = path.dirname(change.filePath)
          if (addDir !== "." && addDir !== "/") {
            await fs.mkdir(addDir, { recursive: true })
          }
          await fs.writeFile(change.filePath, change.newContent, "utf-8")
          changedFiles.push(change.filePath)
          break

        case "update":
          await fs.writeFile(change.filePath, change.newContent, "utf-8")
          changedFiles.push(change.filePath)
          break

        case "move":
          if (change.movePath) {
            // 为目标创建父目录
            const moveDir = path.dirname(change.movePath)
            if (moveDir !== "." && moveDir !== "/") {
              await fs.mkdir(moveDir, { recursive: true })
            }
            // 写入新位置
            await fs.writeFile(change.movePath, change.newContent, "utf-8")
            // 删除原始文件
            await fs.unlink(change.filePath)
            changedFiles.push(change.movePath)
          }
          break

        case "delete":
          await fs.unlink(change.filePath)
          changedFiles.push(change.filePath)
          break
      }

      // 更新文件时间跟踪
      FileTime.read(ctx.sessionID, change.filePath)
      if (change.movePath) {
        FileTime.read(ctx.sessionID, change.movePath)
      }
    }

    // 发布文件更改事件
    for (const filePath of changedFiles) {
      await Bus.publish(FileWatcher.Event.Updated, { file: filePath, event: "change" })
    }

    // 生成输出摘要
    const relativePaths = changedFiles.map((filePath) => path.relative(Instance.worktree, filePath))
    const summary = `${fileChanges.length} 个文件已更改`

    return {
      title: summary,
      metadata: {
        diff: totalDiff,
      },
      output: `补丁应用成功。${summary}：\n${relativePaths.map((p) => `  ${p}`).join("\n")}`,
    }
  },
})
