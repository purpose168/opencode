// Ripgrep工具函数
import { NamedError } from "@opencode-ai/util/error" // 导入命名错误工具
import { $ } from "bun" // 导入Bun的shell命令执行器
import fs from "fs/promises" // 导入文件系统Promise API
import path from "path" // 导入路径处理模块
import z from "zod" // 导入zod库用于数据验证
import { Global } from "../global" // 导入全局配置
import { lazy } from "../util/lazy" // 导入懒加载工具

import { Log } from "@/util/log" // 导入日志工具
import { BlobReader, BlobWriter, ZipReader } from "@zip.js/zip.js" // 导入ZIP文件处理工具

export namespace Ripgrep {
  const log = Log.create({ service: "ripgrep" }) // 创建ripgrep服务日志记录器

  // 统计信息schema
  const Stats = z.object({
    elapsed: z.object({
      secs: z.number(),
      nanos: z.number(),
      human: z.string(),
    }),
    searches: z.number(),
    searches_with_match: z.number(),
    bytes_searched: z.number(),
    bytes_printed: z.number(),
    matched_lines: z.number(),
    matches: z.number(),
  })

  // 开始事件schema
  const Begin = z.object({
    type: z.literal("begin"),
    data: z.object({
      path: z.object({
        text: z.string(),
      }),
    }),
  })

  // 匹配结果schema
  export const Match = z.object({
    type: z.literal("match"),
    data: z.object({
      path: z.object({
        text: z.string(),
      }),
      lines: z.object({
        text: z.string(),
      }),
      line_number: z.number(),
      absolute_offset: z.number(),
      submatches: z.array(
        z.object({
          match: z.object({
            text: z.string(),
          }),
          start: z.number(),
          end: z.number(),
        }),
      ),
    }),
  })

  // 结束事件schema
  const End = z.object({
    type: z.literal("end"),
    data: z.object({
      path: z.object({
        text: z.string(),
      }),
      binary_offset: z.number().nullable(),
      stats: Stats,
    }),
  })

  // 摘要事件schema
  const Summary = z.object({
    type: z.literal("summary"),
    data: z.object({
      elapsed_total: z.object({
        human: z.string(),
        nanos: z.number(),
        secs: z.number(),
      }),
      stats: Stats,
    }),
  })

  // 结果类型(联合类型)
  const Result = z.union([Begin, Match, End, Summary])

  export type Result = z.infer<typeof Result>
  export type Match = z.infer<typeof Match>
  export type Begin = z.infer<typeof Begin>
  export type End = z.infer<typeof End>
  export type Summary = z.infer<typeof Summary>

  // 平台配置映射
  const PLATFORM = {
    "arm64-darwin": { platform: "aarch64-apple-darwin", extension: "tar.gz" },
    "arm64-linux": {
      platform: "aarch64-unknown-linux-gnu",
      extension: "tar.gz",
    },
    "x64-darwin": { platform: "x86_64-apple-darwin", extension: "tar.gz" },
    "x64-linux": { platform: "x86_64-unknown-linux-musl", extension: "tar.gz" },
    "x64-win32": { platform: "x86_64-pc-windows-msvc", extension: "zip" },
  } as const

  // 解压失败错误
  export const ExtractionFailedError = NamedError.create(
    "RipgrepExtractionFailedError",
    z.object({
      filepath: z.string(),
      stderr: z.string(),
    }),
  )

  // 不支持的平台错误
  export const UnsupportedPlatformError = NamedError.create(
    "RipgrepUnsupportedPlatformError",
    z.object({
      platform: z.string(),
    }),
  )

  // 下载失败错误
  export const DownloadFailedError = NamedError.create(
    "RipgrepDownloadFailedError",
    z.object({
      url: z.string(),
      status: z.number(),
    }),
  )

  // Ripgrep状态管理(懒加载)
  const state = lazy(async () => {
    // 检查系统PATH中是否已安装rg
    let filepath = Bun.which("rg")
    if (filepath) return { filepath }
    // 使用全局bin目录中的rg
    filepath = path.join(Global.Path.bin, "rg" + (process.platform === "win32" ? ".exe" : ""))

    const file = Bun.file(filepath)
    // 如果文件不存在,下载并安装ripgrep
    if (!(await file.exists())) {
      const platformKey = `${process.arch}-${process.platform}` as keyof typeof PLATFORM
      const config = PLATFORM[platformKey]
      if (!config) throw new UnsupportedPlatformError({ platform: platformKey })

      const version = "14.1.1"
      const filename = `ripgrep-${version}-${config.platform}.${config.extension}`
      const url = `https://github.com/BurntSushi/ripgrep/releases/download/${version}/${filename}`

      // 下载ripgrep
      const response = await fetch(url)
      if (!response.ok) throw new DownloadFailedError({ url, status: response.status })

      const buffer = await response.arrayBuffer()
      const archivePath = path.join(Global.Path.bin, filename)
      await Bun.write(archivePath, buffer)
      // 解压tar.gz文件
      if (config.extension === "tar.gz") {
        const args = ["tar", "-xzf", archivePath, "--strip-components=1"]

        if (platformKey.endsWith("-darwin")) args.push("--include=*/rg")
        if (platformKey.endsWith("-linux")) args.push("--wildcards", "*/rg")

        const proc = Bun.spawn(args, {
          cwd: Global.Path.bin,
          stderr: "pipe",
          stdout: "pipe",
        })
        await proc.exited
        if (proc.exitCode !== 0)
          throw new ExtractionFailedError({
            filepath,
            stderr: await Bun.readableStreamToText(proc.stderr),
          })
      }
      // 解压zip文件
      if (config.extension === "zip") {
        if (config.extension === "zip") {
          const zipFileReader = new ZipReader(new BlobReader(new Blob([await Bun.file(archivePath).arrayBuffer()])))
          const entries = await zipFileReader.getEntries()
          let rgEntry: any
          for (const entry of entries) {
            if (entry.filename.endsWith("rg.exe")) {
              rgEntry = entry
              break
            }
          }

          if (!rgEntry) {
            throw new ExtractionFailedError({
              filepath: archivePath,
              stderr: "zip压缩包中未找到rg.exe",
            })
          }

          const rgBlob = await rgEntry.getData(new BlobWriter())
          if (!rgBlob) {
            throw new ExtractionFailedError({
              filepath: archivePath,
              stderr: "从zip压缩包中提取rg.exe失败",
            })
          }
          await Bun.write(filepath, await rgBlob.arrayBuffer())
          await zipFileReader.close()
        }
      }
      // 删除下载的压缩包
      await fs.unlink(archivePath)
      // 设置可执行权限(Windows除外)
      if (!platformKey.endsWith("-win32")) await fs.chmod(filepath, 0o755)
    }

    return {
      filepath,
    }
  })

  // 获取ripgrep可执行文件路径
  export async function filepath() {
    const { filepath } = await state()
    return filepath
  }

  // 生成文件列表
  export async function* files(input: {
    cwd: string
    glob?: string[]
    hidden?: boolean
    follow?: boolean
    maxDepth?: number
  }) {
    const args = [await filepath(), "--files", "--glob=!.git/*"]
    if (input.follow !== false) args.push("--follow")
    if (input.hidden !== false) args.push("--hidden")
    if (input.maxDepth !== undefined) args.push(`--max-depth=${input.maxDepth}`)
    if (input.glob) {
      for (const g of input.glob) {
        args.push(`--glob=${g}`)
      }
    }

    // Bun.spawn应该抛出这个错误,但它错误地报告可执行文件不存在。
    // 参见 https://github.com/oven-sh/bun/issues/24012
    if (!(await fs.stat(input.cwd).catch(() => undefined))?.isDirectory()) {
      throw Object.assign(new Error(`没有这样的文件或目录: '${input.cwd}'`), {
        code: "ENOENT",
        errno: -2,
        path: input.cwd,
      })
    }

    const proc = Bun.spawn(args, {
      cwd: input.cwd,
      stdout: "pipe",
      stderr: "ignore",
      maxBuffer: 1024 * 1024 * 20,
    })

    const reader = proc.stdout.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        // 处理Unix(\n)和Windows(\r\n)换行符
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line) yield line
        }
      }

      if (buffer) yield buffer
    } finally {
      reader.releaseLock()
      await proc.exited
    }
  }

  // 生成目录树
  export async function tree(input: { cwd: string; limit?: number }) {
    log.info("tree", input)
    const files = await Array.fromAsync(Ripgrep.files({ cwd: input.cwd }))
    interface Node {
      path: string[]
      children: Node[]
    }

    // 获取或创建路径节点
    function getPath(node: Node, parts: string[], create: boolean) {
      if (parts.length === 0) return node
      let current = node
      for (const part of parts) {
        let existing = current.children.find((x) => x.path.at(-1) === part)
        if (!existing) {
          if (!create) return
          existing = {
            path: current.path.concat(part),
            children: [],
          }
          current.children.push(existing)
        }
        current = existing
      }
      return current
    }

    // 构建根节点
    const root: Node = {
      path: [],
      children: [],
    }
    for (const file of files) {
      if (file.includes(".opencode")) continue
      const parts = file.split(path.sep)
      getPath(root, parts, true)
    }

    // 排序节点(目录在前,文件在后)
    function sort(node: Node) {
      node.children.sort((a, b) => {
        if (!a.children.length && b.children.length) return 1
        if (!b.children.length && a.children.length) return -1
        return a.path.at(-1)!.localeCompare(b.path.at(-1)!)
      })
      for (const child of node.children) {
        sort(child)
      }
    }
    sort(root)

    // 广度优先遍历生成树
    let current = [root]
    const result: Node = {
      path: [],
      children: [],
    }

    let processed = 0
    const limit = input.limit ?? 50
    while (current.length > 0) {
      const next = []
      for (const node of current) {
        if (node.children.length) next.push(...node.children)
      }
      const max = Math.max(...current.map((x) => x.children.length))
      for (let i = 0; i < max && processed < limit; i++) {
        for (const node of current) {
          const child = node.children[i]
          if (!child) continue
          getPath(result, child.path, true)
          processed++
          if (processed >= limit) break
        }
      }
      // 处理截断的节点
      if (processed >= limit) {
        for (const node of [...current, ...next]) {
          const compare = getPath(result, node.path, false)
          if (!compare) continue
          if (compare?.children.length !== node.children.length) {
            const diff = node.children.length - compare.children.length
            compare.children.push({
              path: compare.path.concat(`[${diff} 已截断]`),
              children: [],
            })
          }
        }
        break
      }
      current = next
    }

    const lines: string[] = []

    // 渲染节点为文本
    function render(node: Node, depth: number) {
      const indent = "\t".repeat(depth)
      lines.push(indent + node.path.at(-1) + (node.children.length ? "/" : ""))
      for (const child of node.children) {
        render(child, depth + 1)
      }
    }
    result.children.map((x) => render(x, 0))

    return lines.join("\n")
  }

  // 搜索文件内容
  export async function search(input: { cwd: string; pattern: string; glob?: string[]; limit?: number }) {
    const args = [`${await filepath()}`, "--json", "--hidden", "--glob='!.git/*'"]

    if (input.glob) {
      for (const g of input.glob) {
        args.push(`--glob=${g}`)
      }
    }

    if (input.limit) {
      args.push(`--max-count=${input.limit}`)
    }

    args.push("--")
    args.push(input.pattern)

    const command = args.join(" ")
    const result = await $`${{ raw: command }}`.cwd(input.cwd).quiet().nothrow()
    if (result.exitCode !== 0) {
      return []
    }

    // 处理Unix(\n)和Windows(\r\n)换行符
    const lines = result.text().trim().split(/\r?\n/).filter(Boolean)
    // 从ripgrep输出解析JSON行

    return lines
      .map((line) => JSON.parse(line))
      .map((parsed) => Result.parse(parsed))
      .filter((r) => r.type === "match")
      .map((r) => r.data)
  }
}
