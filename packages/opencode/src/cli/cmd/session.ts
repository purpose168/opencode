import { EOL } from "os" // 导入操作系统换行符
import path from "path" // 导入路径处理模块
import type { Argv } from "yargs" // 导入 Yargs 类型定义
import { Flag } from "../../flag/flag" // 导入标志管理模块
import { Session } from "../../session" // 导入会话管理模块
import { Locale } from "../../util/locale" // 导入本地化工具
import { bootstrap } from "../bootstrap" // 导入应用初始化模块
import { cmd } from "./cmd" // 导入命令创建工具

/**
 * pagerCmd 分页命令函数
 *
 * 功能说明：
 * - 返回适合当前操作系统的分页命令
 * - 在非 Windows 系统上使用 less 命令
 * - 在 Windows 系统上尝试使用 less，如果不存在则使用 more
 *
 * 返回值：string[]（分页命令数组）
 *
 * 注意事项：
 * - less 命令使用 -R（支持 ANSI 颜色）和 -S（不换行）选项
 * - Windows 系统上会尝试从多个位置查找 less 命令
 * - 如果找不到 less，则使用 Windows 内置的 more 命令
 */
function pagerCmd(): string[] {
  // 分页命令函数
  const lessOptions = ["-R", "-S"] // less 命令选项：-R（支持 ANSI 颜色）、-S（不换行）
  if (process.platform !== "win32") {
    // 如果不是 Windows 系统
    return ["less", ...lessOptions] // 返回 less 命令
  }

  // user could have less installed via other options
  // 用户可能通过其他方式安装了 less
  const lessOnPath = Bun.which("less") // 查找 less 命令
  if (lessOnPath) {
    // 如果找到 less 命令
    if (Bun.file(lessOnPath).size) return [lessOnPath, ...lessOptions] // 如果文件存在，返回 less 命令
  }

  if (Flag.OPENCODE_GIT_BASH_PATH) {
    // 如果设置了 Git Bash 路径
    const less = path.join(Flag.OPENCODE_GIT_BASH_PATH, "..", "..", "usr", "bin", "less.exe") // 拼接 less.exe 路径
    if (Bun.file(less).size) return [less, ...lessOptions] // 如果文件存在，返回 less 命令
  }

  const git = Bun.which("git") // 查找 git 命令
  if (git) {
    // 如果找到 git 命令
    const less = path.join(git, "..", "..", "usr", "bin", "less.exe") // 拼接 less.exe 路径
    if (Bun.file(less).size) return [less, ...lessOptions] // 如果文件存在，返回 less 命令
  }

  // Fall back to Windows built-in more (via cmd.exe)
  // 回退到 Windows 内置的 more 命令（通过 cmd.exe）
  return ["cmd", "/c", "more"] // 返回 more 命令
}

/**
 * SessionCommand 会话命令定义
 *
 * 功能说明：
 * - 定义 "session" 命令，用于管理 opencode 会话
 * - 包含子命令：list（列表）
 * - 要求必须指定子命令
 *
 * 使用场景：
 * - 需要查看所有会话时
 * - 需要管理会话时
 *
 * 命令格式：
 * - opencode session list
 *
 * 注意事项：
 * - 必须指定子命令
 * - 使用 demandCommand() 强制要求子命令
 */
export const SessionCommand = cmd({
  // 导出会话命令定义
  command: "session", // 命令名称
  describe: "管理会话", // 命令描述：管理会话
  builder: (yargs: Argv) => yargs.command(SessionListCommand).demandCommand(), // 命令构建器：添加 list 子命令并要求必须指定子命令
  async handler() {}, // 空处理函数（由子命令处理）
})

/**
 * SessionListCommand 会话列表命令定义
 *
 * 功能说明：
 * - 定义 "list" 子命令，用于列出所有 opencode 会话
 * - 支持限制显示的会话数量
 * - 支持多种输出格式（表格或 JSON）
 * - 支持分页显示（使用 less 或 more）
 * - 只显示根会话（没有父会话的会话）
 *
 * 使用场景：
 * - 需要查看所有会话时
 * - 需要查看最近的 N 个会话时
 * - 需要以 JSON 格式导出会话信息时
 * - 需要分页查看大量会话时
 *
 * 命令格式：
 * - opencode session list
 * - opencode session list --max-count 10
 * - opencode session list -n 10
 * - opencode session list --format json
 *
 * 参数说明：
 * - --max-count / -n（可选选项）：限制显示最近的 N 个会话
 * - --format（可选选项）：输出格式（table 或 json），默认值为 table
 *
 * 输出格式：
 * - 表格格式：显示会话 ID、标题、更新时间
 * - JSON 格式：显示会话 ID、标题、更新时间、创建时间、项目 ID、目录
 *
 * 注意事项：
 * - 只显示根会话（没有父会话的会话）
 * - 会话按更新时间降序排序（最新的在前）
 * - 如果输出到终端且未限制数量，使用分页显示
 * - 使用 Instance.provide 初始化应用环境
 */
export const SessionListCommand = cmd({
  // 导出会话列表命令定义
  command: "list", // 命令名称
  describe: "列出会话", // 命令描述：列出会话
  builder: (yargs: Argv) => {
    // 命令构建器
    return yargs
      .option("max-count", {
        // 定义选项 "max-count"
        alias: "n", // 别名：n
        describe: "限制显示最近的 N 个会话", // 选项描述：限制显示最近的 N 个会话
        type: "number", // 选项类型：数字
      })
      .option("format", {
        // 定义选项 "format"
        describe: "输出格式", // 选项描述：输出格式
        type: "string", // 选项类型：字符串
        choices: ["table", "json"], // 可选值：table 或 json
        default: "table", // 默认值：table
      })
  },
  handler: async (args) => {
    // 命令处理函数，异步执行
    await bootstrap(process.cwd(), async () => {
      // 初始化应用环境（在当前目录中）
      const sessions = [] // 会话数组
      for await (const session of Session.list()) {
        // 遍历所有会话
        if (!session.parentID) {
          // 如果是根会话（没有父会话）
          sessions.push(session) // 添加到会话数组
        }
      }

      sessions.sort((a, b) => b.time.updated - a.time.updated) // 按更新时间降序排序（最新的在前）

      const limitedSessions = args.maxCount ? sessions.slice(0, args.maxCount) : sessions // 如果指定了最大数量，则截取前 N 个会话

      if (limitedSessions.length === 0) {
        // 如果没有会话
        return // 返回
      }

      let output: string // 输出字符串
      if (args.format === "json") {
        // 如果输出格式为 JSON
        output = formatSessionJSON(limitedSessions) // 格式化为 JSON
      } else {
        // 否则
        output = formatSessionTable(limitedSessions) // 格式化为表格
      }

      const shouldPaginate = process.stdout.isTTY && !args.maxCount && args.format === "table" // 判断是否需要分页（输出到终端、未限制数量、表格格式）

      if (shouldPaginate) {
        // 如果需要分页
        const proc = Bun.spawn({
          // 启动分页进程
          cmd: pagerCmd(), // 分页命令
          stdin: "pipe", // 标准输入：管道
          stdout: "inherit", // 标准输出：继承
          stderr: "inherit", // 标准错误：继承
        })

        proc.stdin.write(output) // 写入输出到分页进程
        proc.stdin.end() // 关闭标准输入
        await proc.exited // 等待进程退出
      } else {
        // 否则
        console.log(output) // 直接输出到控制台
      }
    })
  },
})

/**
 * formatSessionTable 格式化会话表格函数
 *
 * 功能说明：
 * - 将会话列表格式化为表格形式
 * - 自动计算列宽以适应内容
 * - 显示会话 ID、标题、更新时间
 *
 * 参数说明：sessions（Session.Info[]，会话信息数组）
 *
 * 返回值：string（格式化后的表格字符串）
 *
 * 表格格式：
 * - 表头：Session ID、Title、Updated
 * - 分隔线：使用 "─" 字符
 * - 每行显示一个会话的信息
 *
 * 注意事项：
 * - 会话 ID 列最小宽度为 20 个字符
 * - 标题列最小宽度为 25 个字符
 * - 标题过长时会自动截断
 * - 更新时间使用本地化格式（今天的时间或日期时间）
 */
function formatSessionTable(sessions: Session.Info[]): string {
  // 格式化会话表格函数
  const lines: string[] =
    // 行数组
    []

  const maxIdWidth = Math.max(20, ...sessions.map((s) => s.id.length)) // 计算会话 ID 列的最大宽度（最小 20 个字符）
  const maxTitleWidth = Math.max(25, ...sessions.map((s) => s.title.length)) // 计算标题列的最大宽度（最小 25 个字符）

  const header = `Session ID${" ".repeat(maxIdWidth - 10)}  Title${" ".repeat(maxTitleWidth - 5)}  Updated` // 表头
  lines.push(header) // 添加表头
  lines.push("─".repeat(header.length)) // 添加分隔线
  for (const session of sessions) {
    // 遍历所有会话
    const truncatedTitle = Locale.truncate(session.title, maxTitleWidth) // 截断标题（如果过长）
    const timeStr = Locale.todayTimeOrDateTime(session.time.updated) // 格式化更新时间（今天的时间或日期时间）
    const line = `${session.id.padEnd(maxIdWidth)}  ${truncatedTitle.padEnd(maxTitleWidth)}  ${timeStr}` // 构建行
    lines.push(line) // 添加行
  }

  return lines.join(EOL) // 用换行符连接所有行
}

/**
 * formatSessionJSON 格式化会话 JSON 函数
 *
 * 功能说明：
 * - 将会话列表格式化为 JSON 格式
 * - 包含会话的详细信息
 * - 使用缩进格式化 JSON（2 个空格）
 *
 * 参数说明：sessions（Session.Info[]，会话信息数组）
 *
 * 返回值：string（格式化后的 JSON 字符串）
 *
 * JSON 结构：
 * - id：会话 ID
 * - title：会话标题
 * - updated：更新时间
 * - created：创建时间
 * - projectId：项目 ID
 * - directory：目录路径
 *
 * 注意事项：
 * - 使用 JSON.stringify 格式化 JSON
 * - 缩进为 2 个空格
 * - 每个会话作为一个对象
 * - 所有会话作为一个数组
 */
function formatSessionJSON(sessions: Session.Info[]): string {
  // 格式化会话 JSON 函数
  const jsonData = sessions.map((session) => ({
    // 映射会话数组为 JSON 对象数组
    id: session.id, // 会话 ID
    title: session.title, // 会话标题
    updated: session.time.updated, // 更新时间
    created: session.time.created, // 创建时间
    projectId: session.projectID, // 项目 ID
    directory: session.directory, // 目录路径
  }))
  return JSON.stringify(jsonData, null, 2) // 格式化为 JSON（缩进 2 个空格）
}
