// 导入yargs的类型定义
import type { Argv } from "yargs"
// 导入UI工具类
import { UI } from "../ui"
// 导入交互式提示工具
import * as prompts from "@clack/prompts"
// 导入安装相关功能
import { Installation } from "../../installation"
// 导入全局配置和路径
import { Global } from "../../global"
// 导入Bun的shell命令执行工具
import { $ } from "bun"
// 导入文件系统操作API
import fs from "fs/promises"
// 导入路径处理工具
import path from "path"
// 导入操作系统相关工具
import os from "os"

// 卸载命令的参数接口
interface UninstallArgs {
  keepConfig: boolean // 是否保留配置文件
  keepData: boolean // 是否保留数据文件
  dryRun: boolean // 是否只是试运行
  force: boolean // 是否强制执行，跳过确认
}

// 需要删除的目标项接口
interface RemovalTargets {
  directories: Array<{ path: string; label: string; keep: boolean }> // 目录列表
  shellConfig: string | null // Shell配置文件路径
  binary: string | null // 二进制文件路径
}

// 卸载命令定义
export const UninstallCommand = {
  command: "uninstall", // 命令名称
  describe: "卸载OpenCode并删除所有相关文件", // 命令描述
  // 命令参数构建器
  builder: (yargs: Argv) =>
    yargs
      .option("keep-config", {
        alias: "c",
        type: "boolean",
        describe: "保留配置文件",
        default: false,
      })
      .option("keep-data", {
        alias: "d",
        type: "boolean",
        describe: "保留会话数据和快照",
        default: false,
      })
      .option("dry-run", {
        type: "boolean",
        describe: "显示将要删除的内容而不实际删除",
        default: false,
      })
      .option("force", {
        alias: "f",
        type: "boolean",
        describe: "跳过确认提示",
        default: false,
      }),

  // 命令处理函数
  handler: async (args: UninstallArgs) => {
    UI.empty()
    UI.println(UI.logo("  "))
    UI.empty()
    prompts.intro("卸载OpenCode")

    // 获取安装方式
    const method = await Installation.method()
    prompts.log.info(`安装方式: ${method}`)

    // 收集需要删除的目标
    const targets = await collectRemovalTargets(args, method)

    // 显示删除摘要
    await showRemovalSummary(targets, method)

    // 确认卸载
    if (!args.force && !args.dryRun) {
      const confirm = await prompts.confirm({
        message: "您确定要卸载吗？",
        initialValue: false,
      })
      if (!confirm || prompts.isCancel(confirm)) {
        prompts.outro("已取消")
        return
      }
    }

    // 试运行模式
    if (args.dryRun) {
      prompts.log.warn("试运行 - 未做任何更改")
      prompts.outro("完成")
      return
    }

    // 执行卸载
    await executeUninstall(method, targets)

    prompts.outro("完成")
  },
}

async function collectRemovalTargets(args: UninstallArgs, method: Installation.Method): Promise<RemovalTargets> {
  // 构建需要删除的目录列表
  const directories: RemovalTargets["directories"] = [
    { path: Global.Path.data, label: "数据", keep: args.keepData },
    { path: Global.Path.cache, label: "缓存", keep: false },
    { path: Global.Path.config, label: "配置", keep: args.keepConfig },
    { path: Global.Path.state, label: "状态", keep: false },
  ]

  // 根据安装方式确定是否需要清理shell配置和二进制文件
  const shellConfig = method === "curl" ? await getShellConfigFile() : null
  const binary = method === "curl" ? process.execPath : null

  // 返回需要删除的目标项
  return { directories, shellConfig, binary }
}

async function showRemovalSummary(targets: RemovalTargets, method: Installation.Method) {
  // 显示将要删除的内容提示
  prompts.log.message("以下内容将被删除:")

  // 遍历所有目录，显示每个目录的信息
  for (const dir of targets.directories) {
    // 检查目录是否存在
    const exists = await fs
      .access(dir.path)
      .then(() => true)
      .catch(() => false)
    if (!exists) continue

    // 获取目录大小并格式化
    const size = await getDirectorySize(dir.path)
    const sizeStr = formatSize(size)
    // 设置状态显示（保留或删除）
    const status = dir.keep ? UI.Style.TEXT_DIM + "(保留)" : ""
    const prefix = dir.keep ? "○" : "✓"

    // 显示目录信息
    prompts.log.info(`  ${prefix} ${dir.label}: ${shortenPath(dir.path)} ${UI.Style.TEXT_DIM}(${sizeStr})${status}`)
  }

  // 显示二进制文件信息
  if (targets.binary) {
    prompts.log.info(`  ✓ 二进制文件: ${shortenPath(targets.binary)}`)
  }

  // 显示Shell配置文件信息
  if (targets.shellConfig) {
    prompts.log.info(`  ✓ Shell PATH 在 ${shortenPath(targets.shellConfig)}`)
  }

  // 显示包管理器卸载命令
  if (method !== "curl" && method !== "unknown") {
    const cmds: Record<string, string> = {
      npm: "npm uninstall -g opencode-ai",
      pnpm: "pnpm uninstall -g opencode-ai",
      bun: "bun remove -g opencode-ai",
      yarn: "yarn global remove opencode-ai",
      brew: "brew uninstall opencode",
    }
    prompts.log.info(`  ✓ 包: ${cmds[method] || method}`)
  }
}

// 执行卸载操作
// 根据安装方式和目标项，执行实际的卸载流程
// 包括删除目录、清理shell配置、运行包管理器卸载命令等
// 执行卸载操作
// 根据安装方式和目标项，执行实际的卸载流程
// 包括删除目录、清理shell配置、运行包管理器卸载命令等
async function executeUninstall(method: Installation.Method, targets: RemovalTargets) {
  // 创建加载动画和错误收集数组
  const spinner = prompts.spinner()
  const errors: string[] = []

  // 遍历需要删除的目录
  for (const dir of targets.directories) {
    // 如果用户选择保留该目录，则跳过删除
    if (dir.keep) {
      prompts.log.step(`跳过 ${dir.label} (--keep-${dir.label.toLowerCase()})`)
      continue
    }

    // 检查目录是否存在
    const exists = await fs
      .access(dir.path)
      .then(() => true)
      .catch(() => false)
    if (!exists) continue

    // 开始删除目录
    spinner.start(`正在删除 ${dir.label}...`)
    const err = await fs.rm(dir.path, { recursive: true, force: true }).catch((e) => e)
    if (err) {
      // 删除失败，记录错误
      spinner.stop(`删除 ${dir.label} 失败`, 1)
      errors.push(`${dir.label}: ${err.message}`)
      continue
    }
    // 删除成功
    spinner.stop(`已删除 ${dir.label}`)
  }

  // 如果需要清理shell配置文件
  if (targets.shellConfig) {
    spinner.start("正在清理shell配置...")
    const err = await cleanShellConfig(targets.shellConfig).catch((e) => e)
    if (err) {
      // 清理失败，记录错误
      spinner.stop("清理shell配置失败", 1)
      errors.push(`Shell config: ${err.message}`)
    } else {
      // 清理成功
      spinner.stop("已清理shell配置")
    }
  }

  // 如果是通过包管理器安装的，执行对应的卸载命令
  if (method !== "curl" && method !== "unknown") {
    // 定义各包管理器的卸载命令
    const cmds: Record<string, string[]> = {
      npm: ["npm", "uninstall", "-g", "opencode-ai"],
      pnpm: ["pnpm", "uninstall", "-g", "opencode-ai"],
      bun: ["bun", "remove", "-g", "opencode-ai"],
      yarn: ["yarn", "global", "remove", "opencode-ai"],
      brew: ["brew", "uninstall", "opencode"],
    }

    const cmd = cmds[method]
    if (cmd) {
      // 执行包管理器卸载命令
      spinner.start(`正在运行 ${cmd.join(" ")}...`)
      const result = await $`${cmd}`.quiet().nothrow()
      if (result.exitCode !== 0) {
        // 卸载失败，提示用户手动执行
        spinner.stop(`包管理器卸载失败`, 1)
        prompts.log.warn(`您可能需要手动运行: ${cmd.join(" ")}`)
        errors.push(`包管理器: 退出码 ${result.exitCode}`)
      } else {
        // 卸载成功
        spinner.stop("包已移除")
      }
    }
  }

  // 如果是通过curl安装的，提示用户手动删除二进制文件
  if (method === "curl" && targets.binary) {
    UI.empty()
    prompts.log.message("要完成二进制文件的移除，请运行:")
    prompts.log.info(`  rm "${targets.binary}"`)

    // 如果二进制目录包含.opencode，也提示删除该目录
    const binDir = path.dirname(targets.binary)
    if (binDir.includes(".opencode")) {
      prompts.log.info(`  rmdir "${binDir}" 2>/dev/null`)
    }
  }

  // 如果有错误发生，显示所有错误信息
  if (errors.length > 0) {
    UI.empty()
    prompts.log.warn("某些操作失败:")
    for (const err of errors) {
      prompts.log.error(`  ${err}`)
    }
  }

  // 显示感谢信息
  UI.empty()
  prompts.log.success("感谢您使用OpenCode!")
}

// 获取shell配置文件路径
// 查找包含OpenCode配置的shell配置文件
async function getShellConfigFile(): Promise<string | null> {
  // 获取当前shell类型，默认为bash
  const shell = path.basename(process.env.SHELL || "bash")
  // 获取用户主目录
  const home = os.homedir()
  // 获取XDG配置目录，如果没有设置则使用默认的~/.config
  const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, ".config")

  // 定义不同shell对应的配置文件路径列表
  const configFiles: Record<string, string[]> = {
    fish: [path.join(xdgConfig, "fish", "config.fish")],
    zsh: [
      path.join(home, ".zshrc"),
      path.join(home, ".zshenv"),
      path.join(xdgConfig, "zsh", ".zshrc"),
      path.join(xdgConfig, "zsh", ".zshenv"),
    ],
    bash: [
      path.join(home, ".bashrc"),
      path.join(home, ".bash_profile"),
      path.join(home, ".profile"),
      path.join(xdgConfig, "bash", ".bashrc"),
      path.join(xdgConfig, "bash", ".bash_profile"),
    ],
    ash: [path.join(home, ".ashrc"), path.join(home, ".profile")],
    sh: [path.join(home, ".profile")],
  }

  // 根据当前shell类型获取候选配置文件列表，如果未找到则使用bash的配置文件列表
  const candidates = configFiles[shell] || configFiles.bash

  // 遍历所有候选配置文件
  for (const file of candidates) {
    // 检查文件是否存在
    const exists = await fs
      .access(file)
      .then(() => true)
      .catch(() => false)
    if (!exists) continue

    // 读取文件内容
    const content = await Bun.file(file)
      .text()
      .catch(() => "")
    // 检查文件内容中是否包含opencode相关的配置
    if (content.includes("# opencode") || content.includes(".opencode/bin")) {
      return file
    }
  }

  // 如果没有找到包含opencode配置的文件，返回null
  return null
}

// 清理shell配置文件中的OpenCode相关配置
// 删除所有与OpenCode PATH相关的行和注释块
async function cleanShellConfig(file: string) {
  // 读取shell配置文件内容
  const content = await Bun.file(file).text()
  // 将内容按行分割
  const lines = content.split("\n")

  // 创建过滤后的行数组
  const filtered: string[] = []
  // 跳过标记，用于识别是否在opencode配置块中
  let skip = false

  // 遍历每一行
  for (const line of lines) {
    // 去除行首尾空白
    const trimmed = line.trim()

    // 如果遇到opencode配置块标记，设置跳过标记
    if (trimmed === "# opencode") {
      skip = true
      continue
    }

    // 如果在跳过状态中
    if (skip) {
      // 重置跳过标记
      skip = false
      // 如果是opencode相关的PATH配置，跳过该行
      if (trimmed.includes(".opencode/bin") || trimmed.includes("fish_add_path")) {
        continue
      }
    }

    // 检查是否是opencode相关的PATH导出或fish_add_path命令
    if (
      (trimmed.startsWith("export PATH=") && trimmed.includes(".opencode/bin")) ||
      (trimmed.startsWith("fish_add_path") && trimmed.includes(".opencode"))
    ) {
      continue
    }

    // 保留非opencode相关的行
    filtered.push(line)
  }

  // 移除末尾的空行
  while (filtered.length > 0 && filtered[filtered.length - 1].trim() === "") {
    filtered.pop()
  }

  // 重新组合内容并写回文件
  const output = filtered.join("\n") + "\n"
  await Bun.write(file, output)
}

// 获取目录大小
// 递归遍历目录及其子目录，计算所有文件的总大小
async function getDirectorySize(dir: string): Promise<number> {
  let total = 0

  // 递归遍历目录的辅助函数
  const walk = async (current: string) => {
    // 读取当前目录下的所有条目（文件和子目录）
    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => [])

    // 遍历所有条目
    for (const entry of entries) {
      // 构建完整路径
      const full = path.join(current, entry.name)
      // 如果是目录，递归遍历
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      // 如果是文件，获取文件大小并累加到总数
      if (entry.isFile()) {
        const stat = await fs.stat(full).catch(() => null)
        if (stat) total += stat.size
      }
    }
  }

  // 开始遍历目录
  await walk(dir)
  // 返回总大小（字节）
  return total
}

// 格式化文件大小
// 将字节数转换为人类可读的格式（B、KB、MB、GB）
function formatSize(bytes: number): string {
  // 如果小于1KB，直接返回字节数
  if (bytes < 1024) return `${bytes} B`
  // 如果小于1MB，转换为KB并保留一位小数
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  // 如果小于1GB，转换为MB并保留一位小数
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  // 否则转换为GB并保留一位小数
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

// 缩短路径显示
// 将绝对路径中的用户主目录替换为波浪号(~)，使路径更简洁易读
// 例如: /home/user/.opencode -> ~/.opencode

function shortenPath(p: string): string {
  const home = os.homedir()
  if (p.startsWith(home)) {
    return p.replace(home, "~")
  }
  return p
}
