import { BusEvent } from "@/bus/bus-event" // 导入总线事件
import { NamedError } from "@opencode-ai/util/error" // 导入命名错误工具
import { spawn } from "bun" // 导入Bun的进程生成器
import z from "zod" // 导入zod库用于数据验证
import { Log } from "../util/log" // 导入日志工具

// 支持的IDE列表
const SUPPORTED_IDES = [
  { name: "Windsurf" as const, cmd: "windsurf" }, // Windsurf IDE
  { name: "Visual Studio Code - Insiders" as const, cmd: "code-insiders" }, // VS Code内测版
  { name: "Visual Studio Code" as const, cmd: "code" }, // VS Code正式版
  { name: "Cursor" as const, cmd: "cursor" }, // Cursor IDE
  { name: "VSCodium" as const, cmd: "codium" }, // VSCodium IDE
]

export namespace Ide {
  const log = Log.create({ service: "ide" }) // 创建IDE服务日志记录器

  export const Event = {
    // IDE安装完成事件
    Installed: BusEvent.define(
      "ide.installed",
      z.object({
        ide: z.string(), // IDE名称
      }),
    ),
  }

  // 扩展已安装错误
  export const AlreadyInstalledError = NamedError.create("AlreadyInstalledError", z.object({}))

  // 扩展安装失败错误
  export const InstallFailedError = NamedError.create(
    "InstallFailedError",
    z.object({
      stderr: z.string(), // 标准错误输出
    }),
  )

  // 获取当前运行的IDE名称
  export function ide() {
    // 如果在VS Code中运行
    if (process.env["TERM_PROGRAM"] === "vscode") {
      const v = process.env["GIT_ASKPASS"]
      // 检查环境变量以确定具体的IDE版本
      for (const ide of SUPPORTED_IDES) {
        if (v?.includes(ide.name)) return ide.name
      }
    }
    return "unknown" // 未知IDE
  }

  // 检查扩展是否已在IDE中安装
  export function alreadyInstalled() {
    return process.env["OPENCODE_CALLER"] === "vscode" || process.env["OPENCODE_CALLER"] === "vscode-insiders"
  }

  // 安装扩展到指定的IDE
  export async function install(ide: (typeof SUPPORTED_IDES)[number]["name"]) {
    // 查找IDE对应的命令
    const cmd = SUPPORTED_IDES.find((i) => i.name === ide)?.cmd
    if (!cmd) throw new Error(`Unknown IDE: ${ide}`) // 未知IDE错误

    // 启动IDE扩展安装进程
    const p = spawn([cmd, "--install-extension", "sst-dev.opencode"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    await p.exited // 等待进程退出
    const stdout = await new Response(p.stdout).text() // 读取标准输出
    const stderr = await new Response(p.stderr).text() // 读取标准错误输出

    // 记录安装日志
    log.info("installed", {
      ide,
      stdout,
      stderr,
    })

    // 检查安装是否失败
    if (p.exitCode !== 0) {
      throw new InstallFailedError({ stderr })
    }
    // 检查扩展是否已安装
    if (stdout.includes("already installed")) {
      throw new AlreadyInstalledError({})
    }
  }
}
