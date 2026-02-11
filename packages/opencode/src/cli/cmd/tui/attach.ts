import { cmd } from "../cmd" // 导入命令创建工具，用于定义 CLI 命令
import { tui } from "./app" // 导入 TUI 应用入口函数

/**
 * AttachCommand 附加命令定义
 *
 * 功能说明：
 * - 定义 "attach" 命令，用于连接到正在运行的 OpenCode 服务器
 * - 支持指定服务器 URL、工作目录和会话 ID
 * - 连接成功后启动 TUI 界面
 * - 允许用户继续之前的会话或开始新的会话
 *
 * 使用场景：
 * - 需要连接到远程或本地运行的 OpenCode 服务器时
 * - 需要在指定的工作目录中运行 OpenCode 时
 * - 需要继续之前的会话时
 * - 需要在不同的终端中连接到同一个 OpenCode 服务器时
 *
 * 命令格式：
 * - opencode attach <url> [--dir <directory>] [--session <session-id>]
 * - 示例：opencode attach http://localhost:4096 --dir ~/project --session abc123
 *
 * 参数说明：
 * - url: OpenCode 服务器的 URL 地址（必需参数）
 * - dir: 运行时的工作目录（可选参数）
 * - session: 要继续的会话 ID（可选参数，别名为 -s）
 */
export const AttachCommand = cmd({
  // 导出附加命令定义
  command: "attach <url>", // 命令名称和参数格式
  describe: "attach to a running opencode server", // 命令描述：连接到正在运行的 OpenCode 服务器
  builder: (
    yargs, // 命令构建器，用于定义命令参数和选项
  ) =>
    yargs
      .positional("url", {
        // 定义位置参数 url
        type: "string", // 参数类型为字符串
        describe: "http://localhost:4096", // 参数描述（示例 URL）
        demandOption: true, // 参数为必需选项
      })
      .option("dir", {
        // 定义选项 dir
        type: "string", // 选项类型为字符串
        description: "directory to run in", // 选项描述：运行时的工作目录
      })
      .option("session", {
        // 定义选项 session
        alias: ["s"], // 选项别名为 -s
        type: "string", // 选项类型为字符串
        describe: "session id to continue", // 选项描述：要继续的会话 ID
      }),
  handler: async (args) => {
    // 命令处理函数，异步执行
    if (args.dir) process.chdir(args.dir) // 如果指定了工作目录，切换到该目录
    await tui({
      // 启动 TUI 应用
      url: args.url, // 传递服务器 URL
      args: { sessionID: args.session }, // 传递会话 ID 参数
    })
  },
})
