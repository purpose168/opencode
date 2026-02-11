import { lazy } from "@/util/lazy"
import { spawn } from "child_process"
import { Language } from "web-tree-sitter"
import z from "zod"
import { Instance } from "../project/instance"
import { Log } from "../util/log"
import DESCRIPTION from "./bash.txt"
import { Tool } from "./tool"

import { Flag } from "@/flag/flag.ts"
import { Shell } from "@/shell/shell"
import { Filesystem } from "@/util/filesystem"
import { $ } from "bun"
import { fileURLToPath } from "url"

import { BashArity } from "@/permission/arity"

// 最大输出长度限制，默认为30000字符
const MAX_OUTPUT_LENGTH = Flag.OPENCODE_EXPERIMENTAL_BASH_MAX_OUTPUT_LENGTH || 30_000
// 默认超时时间，默认为2分钟
const DEFAULT_TIMEOUT = Flag.OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS || 2 * 60 * 1000

// 创建bash工具的日志记录器
export const log = Log.create({ service: "bash-tool" })

// 解析WASM文件路径，处理不同格式的路径
const resolveWasm = (asset: string) => {
  if (asset.startsWith("file://")) return fileURLToPath(asset)
  if (asset.startsWith("/") || /^[a-z]:/i.test(asset)) return asset
  const url = new URL(asset, import.meta.url)
  return fileURLToPath(url)
}

// 懒加载并初始化bash语法解析器
const parser = lazy(async () => {
  const { Parser } = await import("web-tree-sitter")
  const { default: treeWasm } = await import("web-tree-sitter/tree-sitter.wasm" as string, {
    with: { type: "wasm" },
  })
  const treePath = resolveWasm(treeWasm)
  await Parser.init({
    locateFile() {
      return treePath
    },
  })
  const { default: bashWasm } = await import("tree-sitter-bash/tree-sitter-bash.wasm" as string, {
    with: { type: "wasm" },
  })
  const bashPath = resolveWasm(bashWasm)
  const bashLanguage = await Language.load(bashPath)
  const p = new Parser()
  p.setLanguage(bashLanguage)
  return p
})

// TODO: 我们可能想要重命名此工具，以便在其他shell上更好地工作
// 定义bash工具，用于执行bash命令
export const BashTool = Tool.define("bash", async () => {
  const shell = Shell.acceptable()
  log.info("bash tool using shell", { shell })

  return {
    description: DESCRIPTION.replaceAll("${directory}", Instance.directory),
    parameters: z.object({
      command: z.string().describe("要执行的命令"),
      timeout: z.number().describe("可选的超时时间（毫秒）").optional(),
      workdir: z
        .string()
        .describe(`运行命令的工作目录。默认为 ${Instance.directory}。使用此选项代替 'cd' 命令。`)
        .optional(),
      description: z
        .string()
        .describe(
          "用5-10个单词清晰、简洁地描述此命令的功能。示例：\n输入：ls\n输出：列出当前目录中的文件\n\n输入：git status\n输出：显示工作树状态\n\n输入：npm install\n输出：安装包依赖项\n\n输入：mkdir foo\n输出：创建目录 'foo'",
        ),
    }),
    async execute(params, ctx) {
      // 确定命令执行的工作目录
      const cwd = params.workdir || Instance.directory
      if (params.timeout !== undefined && params.timeout < 0) {
        throw new Error(`无效的超时值：${params.timeout}。超时必须为正数。`)
      }
      const timeout = params.timeout ?? DEFAULT_TIMEOUT
      // 解析命令以识别潜在的操作
      const tree = await parser().then((p) => p.parse(params.command))
      if (!tree) {
        throw new Error("解析命令失败")
      }
      // 收集可能访问的外部目录
      const directories = new Set<string>()
      if (!Filesystem.contains(Instance.directory, cwd)) directories.add(cwd)
      // 收集命令模式用于权限检查
      const patterns = new Set<string>()
      const always = new Set<string>()

      // 遍历语法树，识别命令和参数
      for (const node of tree.rootNode.descendantsOfType("command")) {
        if (!node) continue
        const command = []
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i)
          if (!child) continue
          if (
            child.type !== "command_name" &&
            child.type !== "word" &&
            child.type !== "string" &&
            child.type !== "raw_string" &&
            child.type !== "concatenation"
          ) {
            continue
          }
          command.push(child.text)
        }

        // 识别可能访问外部目录的命令（非详尽列表，但覆盖了大多数常见情况）
        if (["cd", "rm", "cp", "mv", "mkdir", "touch", "chmod", "chown"].includes(command[0])) {
          for (const arg of command.slice(1)) {
            if (arg.startsWith("-") || (command[0] === "chmod" && arg.startsWith("+"))) continue
            // 解析路径的绝对路径
            const resolved = await $`realpath ${arg}`
              .cwd(cwd)
              .quiet()
              .nothrow()
              .text()
              .then((x) => x.trim())
            log.info("resolved path", { arg, resolved })
            if (resolved) {
              // Windows上的Git Bash返回Unix风格路径，如/c/Users/...
              const normalized =
                process.platform === "win32" && resolved.match(/^\/[a-z]\//)
                  ? resolved.replace(/^\/([a-z])\//, (_, drive) => `${drive.toUpperCase()}:\\`).replace(/\//g, "\\")
                  : resolved
              if (!Filesystem.contains(Instance.directory, normalized)) directories.add(normalized)
            }
          }
        }

        // cd已由上述检查覆盖
        if (command.length && command[0] !== "cd") {
          patterns.add(command.join(" "))
          always.add(BashArity.prefix(command).join(" ") + "*")
        }
      }

      // 如果需要访问外部目录，请求权限
      if (directories.size > 0) {
        await ctx.ask({
          permission: "external_directory",
          patterns: Array.from(directories),
          always: Array.from(directories).map((x) => x + "*"),
          metadata: {},
        })
      }

      // 如果需要执行bash命令，请求权限
      if (patterns.size > 0) {
        await ctx.ask({
          permission: "bash",
          patterns: Array.from(patterns),
          always: Array.from(always),
          metadata: {},
        })
      }

      // 启动子进程执行命令
      const proc = spawn(params.command, {
        shell,
        cwd,
        env: {
          ...process.env,
        },
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32",
      })

      let output = ""

      // 使用空输出初始化元数据
      ctx.metadata({
        metadata: {
          output: "",
          description: params.description,
        },
      })

      // 将输出数据追加到结果中
      const append = (chunk: Buffer) => {
        if (output.length <= MAX_OUTPUT_LENGTH) {
          output += chunk.toString()
          ctx.metadata({
            metadata: {
              output,
              description: params.description,
            },
          })
        }
      }

      // 监听标准输出和标准错误
      proc.stdout?.on("data", append)
      proc.stderr?.on("data", append)

      let timedOut = false
      let aborted = false
      let exited = false

      // 终止进程树的方法
      const kill = () => Shell.killTree(proc, { exited: () => exited })

      // 检查是否已中止
      if (ctx.abort.aborted) {
        aborted = true
        await kill()
      }

      // 设置中止事件处理器
      const abortHandler = () => {
        aborted = true
        void kill()
      }

      ctx.abort.addEventListener("abort", abortHandler, { once: true })

      // 设置超时定时器
      const timeoutTimer = setTimeout(() => {
        timedOut = true
        void kill()
      }, timeout + 100)

      // 等待进程完成
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timeoutTimer)
          ctx.abort.removeEventListener("abort", abortHandler)
        }

        proc.once("exit", () => {
          exited = true
          cleanup()
          resolve()
        })

        proc.once("error", (error) => {
          exited = true
          cleanup()
          reject(error)
        })
      })

      // 构建结果元数据
      let resultMetadata: String[] = ["<bash_metadata>"]

      // 检查输出是否超过最大长度限制
      if (output.length > MAX_OUTPUT_LENGTH) {
        output = output.slice(0, MAX_OUTPUT_LENGTH)
        resultMetadata.push(`bash工具因超过${MAX_OUTPUT_LENGTH}字符限制而截断输出`)
      }

      // 检查是否超时
      if (timedOut) {
        resultMetadata.push(`bash工具在超过超时时间${timeout}毫秒后终止命令`)
      }

      // 检查是否被用户中止
      if (aborted) {
        resultMetadata.push("用户中止了命令")
      }

      // 如果有元数据信息，添加到输出中
      if (resultMetadata.length > 1) {
        resultMetadata.push("</bash_metadata>")
        output += "\n\n" + resultMetadata.join("\n")
      }

      return {
        title: params.description,
        metadata: {
          output,
          exit: proc.exitCode,
          description: params.description,
        },
        output,
      }
    },
  }
})
