import { $ } from "bun" // 导入 Bun 的命令执行工具，用于执行系统命令
import clipboardy from "clipboardy" // 导入跨平台剪贴板库，用于基本的剪贴板读写操作
import { platform, release, tmpdir } from "os" // 导入操作系统信息获取函数，用于获取平台类型和系统版本
import path from "path" // 导入路径处理模块，用于文件路径操作
import { lazy } from "../../../../util/lazy.js" // 导入懒加载工具函数，用于延迟初始化

/**
 * Clipboard 剪贴板工具命名空间
 *
 * 功能说明：
 * - 提供跨平台的剪贴板读取和写入功能
 * - 支持多种操作系统：macOS、Windows、Linux
 * - 支持多种剪贴板内容类型：文本、图片（PNG）
 * - 自动检测并使用最适合的剪贴板工具
 * - 在 Linux 上支持 Wayland 和 X11 两种显示协议
 * - 在 Windows 上支持 WSL 环境
 *
 * 使用场景：
 * - 需要在 TUI 界面中读取剪贴板内容时
 * - 需要将内容复制到剪贴板时
 * - 需要处理图片剪贴板内容时
 * - 需要在不同操作系统上统一剪贴板操作时
 */
export namespace Clipboard {
  // 剪贴板工具命名空间
  /**
   * Content 剪贴板内容接口定义
   *
   * 属性说明：
   * - data: 内容数据，文本为字符串，图片为 base64 编码的字符串
   * - mime: MIME 类型，如 "text/plain" 或 "image/png"
   */
  export interface Content {
    // 剪贴板内容接口
    data: string // 内容数据，文本为字符串，图片为 base64 编码的字符串
    mime: string // MIME 类型，如 "text/plain" 或 "image/png"
  }

  /**
   * read 读取剪贴板内容
   *
   * 功能说明：
   * - 从系统剪贴板读取内容，优先尝试读取图片
   * - 支持多种操作系统和剪贴板工具
   * - macOS: 使用 osascript 读取 PNG 图片
   * - Windows/WSL: 使用 PowerShell 读取 PNG 图片
   * - Linux: 优先使用 wl-paste (Wayland)，然后使用 xclip (X11)
   * - 如果无法读取图片，则尝试读取文本内容
   * - 返回 undefined 表示剪贴板为空或读取失败
   *
   * 使用场景：
   * - 需要读取用户剪贴板内容时
   * - 需要处理图片剪贴板内容时
   * - 需要粘贴剪贴板内容到应用中时
   *
   * 返回值：
   * - 返回剪贴板内容对象，包含数据和 MIME 类型
   * - 如果剪贴板为空或读取失败，返回 undefined
   */
  export async function read(): Promise<Content | undefined> {
    // 异步函数，返回剪贴板内容或 undefined
    const os = platform() // 获取当前操作系统平台

    if (os === "darwin") {
      // 如果是 macOS 系统
      const tmpfile = path.join(tmpdir(), "opencode-clipboard.png") // 创建临时文件路径
      try {
        // 尝试读取图片剪贴板
        // 使用 osascript 执行 AppleScript 读取 PNG 图片并保存到临时文件
        await $`osascript -e 'set imageData to the clipboard as "PNGf"' -e 'set fileRef to open for access POSIX file "${tmpfile}" with write permission' -e 'set eof fileRef to 0' -e 'write imageData to fileRef' -e 'close access fileRef'`
          .nothrow() // 不抛出异常
          .quiet() // 静默执行，不输出到控制台
        const file = Bun.file(tmpfile) // 读取临时文件
        const buffer = await file.arrayBuffer() // 获取文件内容为 ArrayBuffer
        return { data: Buffer.from(buffer).toString("base64"), mime: "image/png" } // 返回 base64 编码的图片数据
      } catch {
        // 捕获异常，忽略错误
      } finally {
        // 无论成功或失败都执行
        await $`rm -f "${tmpfile}"`.nothrow().quiet() // 删除临时文件
      }
    }

    if (os === "win32" || release().includes("WSL")) {
      // 如果是 Windows 或 WSL 环境
      // PowerShell 脚本：从剪贴板获取图片并转换为 base64
      const script =
        "Add-Type -AssemblyName System.Windows.Forms; $img = [System.Windows.Forms.Clipboard]::GetImage(); if ($img) { $ms = New-Object System.IO.MemoryStream; $img.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png); [System.Convert]::ToBase64String($ms.ToArray()) }"
      const base64 = await $`powershell.exe -command "${script}"`.nothrow().text() // 执行 PowerShell 脚本获取 base64 字符串
      if (base64) {
        // 如果获取到 base64 字符串
        const imageBuffer = Buffer.from(base64.trim(), "base64") // 将 base64 字符串转换为 Buffer
        if (imageBuffer.length > 0) {
          // 如果图片数据不为空
          return { data: imageBuffer.toString("base64"), mime: "image/png" } // 返回 base64 编码的图片数据
        }
      }
    }

    if (os === "linux") {
      // 如果是 Linux 系统
      // 尝试使用 wl-paste (Wayland) 读取 PNG 图片
      const wayland = await $`wl-paste -t image/png`.nothrow().arrayBuffer()
      if (wayland && wayland.byteLength > 0) {
        // 如果获取到图片数据且不为空
        return { data: Buffer.from(wayland).toString("base64"), mime: "image/png" } // 返回 base64 编码的图片数据
      }
      // 尝试使用 xclip (X11) 读取 PNG 图片
      const x11 = await $`xclip -selection clipboard -t image/png -o`.nothrow().arrayBuffer()
      if (x11 && x11.byteLength > 0) {
        // 如果获取到图片数据且不为空
        return { data: Buffer.from(x11).toString("base64"), mime: "image/png" } // 返回 base64 编码的图片数据
      }
    }

    // 如果无法读取图片，尝试读取文本内容
    const text = await clipboardy.read().catch(() => {}) // 使用 clipboardy 库读取文本，捕获并忽略错误
    if (text) {
      // 如果读取到文本
      return { data: text, mime: "text/plain" } // 返回文本内容
    }
  }

  /**
   * getCopyMethod 获取复制方法（懒加载）
   *
   * 功能说明：
   * - 使用懒加载模式，只在第一次调用时检测并选择最佳的复制方法
   * - 根据操作系统和可用的剪贴板工具选择最合适的复制方法
   * - macOS: 优先使用 osascript
   * - Linux: 优先使用 wl-copy (Wayland)，然后 xclip，然后 xsel
   * - Windows: 使用 PowerShell
   * - 其他: 使用 clipboardy 库
   * - 检测到的方法会输出到控制台
   *
   * 使用场景：
   * - 需要复制文本到剪贴板时
   * - 需要在不同操作系统上统一复制操作时
   * - 需要自动选择最佳的剪贴板工具时
   *
   * 返回值：
   * - 返回一个异步函数，该函数接受文本参数并将其复制到剪贴板
   */
  const getCopyMethod = lazy(() => {
    // 使用懒加载包装函数
    const os = platform() // 获取当前操作系统平台

    if (os === "darwin" && Bun.which("osascript")) {
      // 如果是 macOS 且 osascript 可用
      console.log("剪贴板：使用osascript") // 输出使用的剪贴板工具
      return async (text: string) => {
        // 返回复制函数
        const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"') // 转义反斜杠和双引号
        await $`osascript -e 'set the clipboard to "${escaped}"'`.nothrow().quiet() // 使用 osascript 设置剪贴板内容
      }
    }

    if (os === "linux") {
      // 如果是 Linux 系统
      if (process.env["WAYLAND_DISPLAY"] && Bun.which("wl-copy")) {
        // 如果是 Wayland 且 wl-copy 可用
        console.log("剪贴板：使用wl-copy") // 输出使用的剪贴板工具
        return async (text: string) => {
          // 返回复制函数
          // 使用 wl-copy 命令，通过 stdin 传递文本
          const proc = Bun.spawn(["wl-copy"], { stdin: "pipe", stdout: "ignore", stderr: "ignore" }) // 启动 wl-copy 进程
          proc.stdin.write(text) // 将文本写入 stdin
          proc.stdin.end() // 关闭 stdin
          await proc.exited.catch(() => {}) // 等待进程退出，忽略错误
        }
      }
      if (Bun.which("xclip")) {
        // 如果 xclip 可用
        console.log("剪贴板：使用xclip") // 输出使用的剪贴板工具
        return async (text: string) => {
          // 返回复制函数
          // 使用 xclip 命令，通过 stdin 传递文本
          const proc = Bun.spawn(["xclip", "-selection", "clipboard"], {
            stdin: "pipe", // 使用 stdin 输入
            stdout: "ignore", // 忽略 stdout
            stderr: "ignore", // 忽略 stderr
          })
          proc.stdin.write(text) // 将文本写入 stdin
          proc.stdin.end() // 关闭 stdin
          await proc.exited.catch(() => {}) // 等待进程退出，忽略错误
        }
      }
      if (Bun.which("xsel")) {
        // 如果 xsel 可用
        console.log("剪贴板：使用xsel") // 输出使用的剪贴板工具
        return async (text: string) => {
          // 返回复制函数
          // 使用 xsel 命令，通过 stdin 传递文本
          const proc = Bun.spawn(["xsel", "--clipboard", "--input"], {
            stdin: "pipe", // 使用 stdin 输入
            stdout: "ignore", // 忽略 stdout
            stderr: "ignore", // 忽略 stderr
          })
          proc.stdin.write(text) // 将文本写入 stdin
          proc.stdin.end() // 关闭 stdin
          await proc.exited.catch(() => {}) // 等待进程退出，忽略错误
        }
      }
    }

    if (os === "win32") {
      // 如果是 Windows 系统
      console.log("剪贴板：使用powershell") // 输出使用的剪贴板工具
      return async (text: string) => {
        // 返回复制函数
        const escaped = text.replace(/"/g, '""') // 转义双引号（PowerShell 转义规则）
        await $`powershell -command "Set-Clipboard -Value \"${escaped}\""`.nothrow().quiet() // 使用 PowerShell 设置剪贴板内容
      }
    }

    console.log("剪贴板：无原生支持") // 输出无原生支持的提示
    return async (text: string) => {
      // 返回使用 clipboardy 库的复制函数
      await clipboardy.write(text).catch(() => {}) // 使用 clipboardy 库写入文本，捕获并忽略错误
    }
  })

  /**
   * copy 复制文本到剪贴板
   *
   * 功能说明：
   * - 将文本复制到系统剪贴板
   * - 使用懒加载的 getCopyMethod 函数获取最佳的复制方法
   * - 支持多种操作系统和剪贴板工具
   * - 自动处理错误，不会抛出异常
   *
   * 使用场景：
   * - 需要将文本复制到剪贴板时
   * - 需要在 TUI 界面中提供复制功能时
   * - 需要跨平台支持剪贴板操作时
   *
   * 参数说明：
   * - text: 要复制到剪贴板的文本内容
   */
  export async function copy(text: string): Promise<void> {
    // 异步函数，无返回值
    await getCopyMethod()(text) // 调用懒加载的复制方法并执行
  }
}
