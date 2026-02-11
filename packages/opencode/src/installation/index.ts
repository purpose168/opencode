import { BusEvent } from "@/bus/bus-event" // 导入总线事件
import { iife } from "@/util/iife" // 导入立即执行函数工具
import { NamedError } from "@opencode-ai/util/error" // 导入命名错误工具
import { $ } from "bun" // 导入Bun的shell命令执行器
import path from "path" // 导入路径处理模块
import z from "zod" // 导入zod库用于数据验证
import { Flag } from "../flag/flag" // 导入标志配置
import { Log } from "../util/log" // 导入日志工具

// 全局变量声明
declare global {
  const OPENCODE_VERSION: string // OpenCode版本号
  const OPENCODE_CHANNEL: string // OpenCode发布渠道
}

export namespace Installation {
  const log = Log.create({ service: "installation" }) // 创建安装服务日志记录器

  export type Method = Awaited<ReturnType<typeof method>> // 安装方法类型

  export const Event = {
    // 安装更新完成事件
    Updated: BusEvent.define(
      "installation.updated",
      z.object({
        version: z.string(), // 更新后的版本号
      }),
    ),
    // 有新版本可用事件
    UpdateAvailable: BusEvent.define(
      "installation.update-available",
      z.object({
        version: z.string(), // 可用的新版本号
      }),
    ),
  }

  // 安装信息schema
  export const Info = z
    .object({
      version: z.string(), // 当前版本
      latest: z.string(), // 最新版本
    })
    .meta({
      ref: "InstallationInfo",
    })
  export type Info = z.infer<typeof Info>

  // 获取安装信息
  export async function info() {
    return {
      version: VERSION, // 当前版本
      latest: await latest(), // 最新版本
    }
  }

  // 检查是否为预览版本
  export function isPreview() {
    return CHANNEL !== "latest"
  }

  // 检查是否为本地开发版本
  export function isLocal() {
    return CHANNEL === "local"
  }

  // 检测安装方法
  export async function method() {
    // 检查是否通过curl安装
    if (process.execPath.includes(path.join(".opencode", "bin"))) return "curl"
    if (process.execPath.includes(path.join(".local", "bin"))) return "curl"
    const exec = process.execPath.toLowerCase()

    // 定义各种包管理器的检查方法
    const checks = [
      {
        name: "npm" as const,
        command: () => $`npm list -g --depth=0`.throws(false).quiet().text(), // 检查npm全局安装
      },
      {
        name: "yarn" as const,
        command: () => $`yarn global list`.throws(false).quiet().text(), // 检查yarn全局安装
      },
      {
        name: "pnpm" as const,
        command: () => $`pnpm list -g --depth=0`.throws(false).quiet().text(), // 检查pnpm全局安装
      },
      {
        name: "bun" as const,
        command: () => $`bun pm ls -g`.throws(false).quiet().text(), // 检查bun全局安装
      },
      {
        name: "brew" as const,
        command: () => $`brew list --formula opencode`.throws(false).quiet().text(), // 检查brew安装
      },
    ]

    // 根据可执行文件路径优先排序
    checks.sort((a, b) => {
      const aMatches = exec.includes(a.name)
      const bMatches = exec.includes(b.name)
      if (aMatches && !bMatches) return -1
      if (!aMatches && bMatches) return 1
      return 0
    })

    // 检查每个包管理器是否安装了opencode
    for (const check of checks) {
      const output = await check.command()
      if (output.includes(check.name === "brew" ? "opencode" : "opencode-ai")) {
        return check.name
      }
    }

    return "unknown" // 未知的安装方法
  }

  // 升级失败错误
  export const UpgradeFailedError = NamedError.create(
    "UpgradeFailedError",
    z.object({
      stderr: z.string(), // 标准错误输出
    }),
  )

  // 获取Homebrew的formula名称
  async function getBrewFormula() {
    const tapFormula = await $`brew list --formula sst/tap/opencode`.throws(false).quiet().text()
    if (tapFormula.includes("opencode")) return "sst/tap/opencode" // 使用tap源
    const coreFormula = await $`brew list --formula opencode`.throws(false).quiet().text()
    if (coreFormula.includes("opencode")) return "opencode" // 使用core源
    return "opencode" // 默认使用core源
  }

  // 升级到指定版本
  export async function upgrade(method: Method, target: string) {
    let cmd
    // 根据安装方法选择升级命令
    switch (method) {
      case "curl":
        cmd = $`curl -fsSL https://opencode.ai/install | bash`.env({
          ...process.env,
          VERSION: target, // 设置目标版本
        })
        break
      case "npm":
        cmd = $`npm install -g opencode-ai@${target}`
        break
      case "pnpm":
        cmd = $`pnpm install -g opencode-ai@${target}`
        break
      case "bun":
        cmd = $`bun install -g opencode-ai@${target}`
        break
      case "brew": {
        const formula = await getBrewFormula()
        cmd = $`brew install ${formula}`.env({
          HOMEBREW_NO_AUTO_UPDATE: "1", // 禁用自动更新
          ...process.env,
        })
        break
      }
      default:
        throw new Error(`Unknown method: ${method}`) // 未知的安装方法
    }
    const result = await cmd.quiet().throws(false)
    // 记录升级日志
    log.info("升级完成", {
      method,
      target,
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString(),
    })
    // 检查升级是否失败
    if (result.exitCode !== 0)
      throw new UpgradeFailedError({
        stderr: result.stderr.toString("utf8"),
      })
    // 验证新版本
    await $`${process.execPath} --version`.nothrow().quiet().text()
  }

  // 版本信息常量
  export const VERSION = typeof OPENCODE_VERSION === "string" ? OPENCODE_VERSION : "local" // 当前版本
  export const CHANNEL = typeof OPENCODE_CHANNEL === "string" ? OPENCODE_CHANNEL : "local" // 发布渠道
  export const USER_AGENT = `opencode/${CHANNEL}/${VERSION}/${Flag.OPENCODE_CLIENT}` // 用户代理字符串

  // 获取最新版本号
  export async function latest(installMethod?: Method) {
    const detectedMethod = installMethod || (await method()) // 使用指定方法或自动检测

    // 如果通过brew安装,从brew API获取最新版本
    if (detectedMethod === "brew") {
      const formula = await getBrewFormula()
      if (formula === "opencode") {
        return fetch("https://formulae.brew.sh/api/formula/opencode.json")
          .then((res) => {
            if (!res.ok) throw new Error(res.statusText)
            return res.json()
          })
          .then((data: any) => data.versions.stable) // 返回稳定版本
      }
    }

    // 如果通过npm/bun/pnpm安装,从npm registry获取最新版本
    if (detectedMethod === "npm" || detectedMethod === "bun" || detectedMethod === "pnpm") {
      const registry = await iife(async () => {
        const r = (await $`npm config get registry`.quiet().nothrow().text()).trim()
        const reg = r || "https://registry.npmjs.org"
        return reg.endsWith("/") ? reg.slice(0, -1) : reg // 移除末尾斜杠
      })
      const channel = CHANNEL
      return fetch(`${registry}/opencode-ai/${channel}`)
        .then((res) => {
          if (!res.ok) throw new Error(res.statusText)
          return res.json()
        })
        .then((data: any) => data.version) // 返回版本号
    }

    // 默认从GitHub API获取最新版本
    return fetch("https://api.github.com/repos/sst/opencode/releases/latest")
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText)
        return res.json()
      })
      .then((data: any) => data.tag_name.replace(/^v/, "")) // 移除版本号前的v
  }
}
