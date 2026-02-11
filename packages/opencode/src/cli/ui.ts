import { NamedError } from "@opencode-ai/util/error" // 导入命名错误类
import { EOL } from "os" // 导入操作系统换行符
import z from "zod" // 导入zod验证库

export namespace UI {
  // Logo图案
  const LOGO = [
    [`                    `, `             ▄     `],
    [`█▀▀█ █▀▀█ █▀▀█ █▀▀▄ `, `█▀▀▀ █▀▀█ █▀▀█ █▀▀█`],
    [`█░░█ █░░█ █▀▀▀ █░░█ `, `█░░░ █░░█ █░░█ █▀▀▀`],
    [`▀▀▀▀ █▀▀▀ ▀▀▀▀ ▀  ▀ `, `▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀`],
  ]

  // UI取消错误
  export const CancelledError = NamedError.create("UICancelledError", z.void())

  // 文本样式常量
  export const Style = {
    TEXT_HIGHLIGHT: "\x1b[96m", // 高亮文本
    TEXT_HIGHLIGHT_BOLD: "\x1b[96m\x1b[1m", // 高亮粗体文本
    TEXT_DIM: "\x1b[90m", // 暗淡文本
    TEXT_DIM_BOLD: "\x1b[90m\x1b[1m", // 暗淡粗体文本
    TEXT_NORMAL: "\x1b[0m", // 普通文本
    TEXT_NORMAL_BOLD: "\x1b[1m", // 普通粗体文本
    TEXT_WARNING: "\x1b[93m", // 警告文本
    TEXT_WARNING_BOLD: "\x1b[93m\x1b[1m", // 警告粗体文本
    TEXT_DANGER: "\x1b[91m", // 危险文本
    TEXT_DANGER_BOLD: "\x1b[91m\x1b[1m", // 危险粗体文本
    TEXT_SUCCESS: "\x1b[92m", // 成功文本
    TEXT_SUCCESS_BOLD: "\x1b[92m\x1b[1m", // 成功粗体文本
    TEXT_INFO: "\x1b[94m", // 信息文本
    TEXT_INFO_BOLD: "\x1b[94m\x1b[1m", // 信息粗体文本
  }

  // 打印消息并换行
  export function println(...message: string[]) {
    print(...message)
    Bun.stderr.write(EOL)
  }

  // 打印消息
  export function print(...message: string[]) {
    blank = false
    Bun.stderr.write(message.join(" "))
  }

  let blank = false
  // 打印空行
  export function empty() {
    if (blank) return
    println("" + Style.TEXT_NORMAL)
    blank = true
  }

  // 生成Logo
  export function logo(pad?: string) {
    const result = []
    for (const row of LOGO) {
      if (pad) result.push(pad)
      result.push(Bun.color("gray", "ansi"))
      result.push(row[0])
      result.push("\x1b[0m")
      result.push(row[1])
      result.push(EOL)
    }
    return result.join("").trimEnd()
  }

  // 获取用户输入
  export async function input(prompt: string): Promise<string> {
    const readline = require("readline")
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    return new Promise((resolve) => {
      rl.question(prompt, (answer: string) => {
        rl.close()
        resolve(answer.trim())
      })
    })
  }

  // 打印错误信息
  export function error(message: string) {
    println(Style.TEXT_DANGER_BOLD + "错误: " + Style.TEXT_NORMAL + message)
  }

  // 格式化Markdown文本
  export function markdown(text: string): string {
    return text
  }
}
