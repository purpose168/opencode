import { Flag } from "@/flag/flag" // 导入标志模块
import { lazy } from "@/util/lazy" // 导入懒加载工具
import { spawn, type ChildProcess } from "child_process" // 导入子进程模块
import path from "path" // 导入路径处理模块

const SIGKILL_TIMEOUT_MS = 200 // SIGKILL 超时时间（毫秒）

export namespace Shell {
  /**
   * 终止进程树，包括所有子进程
   * @param proc - 要终止的子进程
   * @param opts - 可选参数
   * @param opts.exited - 检查进程是否已退出的函数
   * @returns Promise<void>
   */
  export async function killTree(proc: ChildProcess, opts?: { exited?: () => boolean }): Promise<void> {
    const pid = proc.pid // 获取进程 ID
    if (!pid || opts?.exited?.()) return // 如果进程不存在或已退出，直接返回

    if (process.platform === "win32") {
      // 如果是 Windows 平台
      await new Promise<void>((resolve) => {
        const killer = spawn("taskkill", ["/pid", String(pid), "/f", "/t"], { stdio: "ignore" }) // 使用 taskkill 命令终止进程树
        killer.once("exit", () => resolve()) // 监听退出事件
        killer.once("error", () => resolve()) // 监听错误事件
      })
      return
    }

    try {
      // 非 Windows 平台
      process.kill(-pid, "SIGTERM") // 发送 SIGTERM 信号终止进程组
      await Bun.sleep(SIGKILL_TIMEOUT_MS) // 等待超时
      if (!opts?.exited?.()) {
        // 如果进程未退出
        process.kill(-pid, "SIGKILL") // 发送 SIGKILL 信号强制终止
      }
    } catch (_e) {
      // 捕获异常
      proc.kill("SIGTERM") // 发送 SIGTERM 信号
      await Bun.sleep(SIGKILL_TIMEOUT_MS) // 等待超时
      if (!opts?.exited?.()) {
        // 如果进程未退出
        proc.kill("SIGKILL") // 发送 SIGKILL 信号强制终止
      }
    }
  }
  const BLACKLIST = new Set(["fish", "nu"]) // 黑名单 shell（不支持的 shell）

  /**
   * 获取备选 shell
   * @returns string - shell 路径
   */
  function fallback() {
    if (process.platform === "win32") {
      // 如果是 Windows 平台
      if (Flag.OPENCODE_GIT_BASH_PATH) return Flag.OPENCODE_GIT_BASH_PATH // 如果设置了 Git Bash 路径标志，使用该路径
      const git = Bun.which("git") // 查找 git 可执行文件
      if (git) {
        // 如果找到 git
        // git.exe 通常位于：C:\Program Files\Git\cmd\git.exe
        // bash.exe 位于：C:\Program Files\Git\bin\bash.exe
        const bash = path.join(git, "..", "..", "bin", "bash.exe") // 构造 bash.exe 路径
        if (Bun.file(bash).size) return bash // 如果 bash.exe 存在，返回路径
      }
      return process.env.COMSPEC || "cmd.exe" // 返回命令提示符或默认 cmd.exe
    }
    if (process.platform === "darwin") return "/bin/zsh" // 如果是 macOS，返回 zsh
    const bash = Bun.which("bash") // 查找 bash 可执行文件
    if (bash) return bash // 如果找到 bash，返回路径
    return "/bin/sh" // 返回默认 sh
  }

  /**
   * 获取首选 shell（懒加载）
   * @returns string - shell 路径
   */
  export const preferred = lazy(() => {
    const s = process.env.SHELL // 获取 SHELL 环境变量
    if (s) return s // 如果设置了 SHELL，返回该值
    return fallback() // 否则返回备选 shell
  })

  /**
   * 获取可接受的 shell（懒加载）
   * @returns string - shell 路径
   */
  export const acceptable = lazy(() => {
    const s = process.env.SHELL // 获取 SHELL 环境变量
    if (s && !BLACKLIST.has(process.platform === "win32" ? path.win32.basename(s) : path.basename(s))) return s // 如果设置了 SHELL 且不在黑名单中，返回该值
    return fallback() // 否则返回备选 shell
  })
}
