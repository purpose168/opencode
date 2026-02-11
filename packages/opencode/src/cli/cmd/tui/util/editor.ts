import { defer } from "@/util/defer" // 导入延迟清理工具，用于在作用域结束时自动执行清理操作
import { CliRenderer } from "@opentui/core" // 导入 CLI 渲染器类型，用于控制 TUI 界面的渲染
import { rm } from "node:fs/promises" // 导入文件删除函数，用于删除临时文件
import { tmpdir } from "node:os" // 导入临时目录获取函数，用于获取系统临时目录路径
import { join } from "node:path" // 导入路径拼接函数，用于构建文件路径

/**
 * Editor 编辑器工具命名空间
 *
 * 功能说明：
 * - 提供打开外部编辑器编辑文本的功能
 * - 支持通过环境变量 VISUAL 或 EDITOR 指定编辑器
 * - 自动创建临时文件，编辑完成后自动清理
 * - 编辑期间暂停 TUI 界面渲染，编辑完成后恢复
 * - 支持多种编辑器（如 vim、nano、code 等）
 *
 * 使用场景：
 * - 需要在 TUI 界面中编辑长文本时
 * - 需要使用用户习惯的编辑器编辑内容时
 * - 需要提供更强大的编辑功能时
 * - 需要编辑 Markdown 或其他格式的内容时
 *
 * 注意事项：
 * - 需要系统安装了外部编辑器
 * - 需要设置 VISUAL 或 EDITOR 环境变量
 * - 编辑期间 TUI 界面会暂停
 * - 临时文件会在编辑完成后自动删除
 */
export namespace Editor {
  // 编辑器工具命名空间
  /**
   * open 打开外部编辑器编辑文本
   *
   * 功能说明：
   * - 创建临时文件并将初始内容写入文件
   * - 暂停 TUI 界面渲染
   * - 启动外部编辑器（通过 VISUAL 或 EDITOR 环境变量指定）
   * - 等待用户完成编辑并关闭编辑器
   * - 读取编辑后的内容
   * - 恢复 TUI 界面渲染并重新渲染
   * - 自动清理临时文件
   *
   * 使用场景：
   * - 需要在 TUI 界面中编辑长文本时
   * - 需要使用用户习惯的编辑器编辑内容时
   * - 需要提供更强大的编辑功能时
   * - 需要编辑 Markdown 或其他格式的内容时
   *
   * 参数说明：
   * - opts.value: 要编辑的初始文本内容
   * - opts.renderer: CLI 渲染器实例，用于控制 TUI 界面的渲染
   *
   * 返回值：
   * - 返回编辑后的文本内容
   * - 如果未设置编辑器环境变量，返回 undefined
   * - 如果编辑后文件为空，返回 undefined
   */
  export async function open(opts: { value: string; renderer: CliRenderer }): Promise<string | undefined> {
    // 异步函数，返回编辑后的文本或 undefined
    const editor = process.env["VISUAL"] || process.env["EDITOR"] // 获取编辑器命令，优先使用 VISUAL，其次使用 EDITOR
    if (!editor) return // 如果未设置编辑器环境变量，直接返回 undefined

    const filepath = join(tmpdir(), `${Date.now()}.md`) // 创建临时文件路径，使用时间戳避免冲突
    await using _ = defer(async () => rm(filepath, { force: true })) // 使用 defer 工具，在作用域结束时自动删除临时文件

    await Bun.write(filepath, opts.value) // 将初始内容写入临时文件
    opts.renderer.suspend() // 暂停 TUI 界面渲染
    opts.renderer.currentRenderBuffer.clear() // 清空当前渲染缓冲区
    const parts = editor.split(" ") // 将编辑器命令拆分为命令和参数
    const proc = Bun.spawn({
      // 启动外部编辑器进程
      cmd: [...parts, filepath], // 命令和参数，包括临时文件路径
      stdin: "inherit", // 继承标准输入
      stdout: "inherit", // 继承标准输出
      stderr: "inherit", // 继承标准错误
    })
    await proc.exited // 等待编辑器进程退出
    const content = await Bun.file(filepath).text() // 读取编辑后的文件内容
    opts.renderer.currentRenderBuffer.clear() // 清空当前渲染缓冲区
    opts.renderer.resume() // 恢复 TUI 界面渲染
    opts.renderer.requestRender() // 请求重新渲染界面
    return content || undefined // 返回编辑后的内容，如果为空则返回 undefined
  }
}
