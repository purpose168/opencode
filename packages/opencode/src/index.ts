import { NamedError } from "@opencode-ai/util/error"
import { EOL } from "os"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { AcpCommand } from "./cli/cmd/acp"
import { AgentCommand } from "./cli/cmd/agent"
import { AuthCommand } from "./cli/cmd/auth"
import { DebugCommand } from "./cli/cmd/debug"
import { ExportCommand } from "./cli/cmd/export"
import { GenerateCommand } from "./cli/cmd/generate"
import { GithubCommand } from "./cli/cmd/github"
import { ImportCommand } from "./cli/cmd/import"
import { McpCommand } from "./cli/cmd/mcp"
import { ModelsCommand } from "./cli/cmd/models"
import { PrCommand } from "./cli/cmd/pr"
import { RunCommand } from "./cli/cmd/run"
import { ServeCommand } from "./cli/cmd/serve"
import { SessionCommand } from "./cli/cmd/session"
import { StatsCommand } from "./cli/cmd/stats"
import { AttachCommand } from "./cli/cmd/tui/attach"
import { TuiSpawnCommand } from "./cli/cmd/tui/spawn"
import { TuiThreadCommand } from "./cli/cmd/tui/thread"
import { UninstallCommand } from "./cli/cmd/uninstall"
import { UpgradeCommand } from "./cli/cmd/upgrade"
import { WebCommand } from "./cli/cmd/web"
import { FormatError } from "./cli/error"
import { UI } from "./cli/ui"
import { Installation } from "./installation"
import { Log } from "./util/log"

process.on("unhandledRejection", (e) => {
  Log.Default.error("rejection", {
    e: e instanceof Error ? e.message : e,
  })
})

process.on("uncaughtException", (e) => {
  Log.Default.error("exception", {
    e: e instanceof Error ? e.message : e,
  })
})

const cli = yargs(hideBin(process.argv))
  .parserConfiguration({ "populate--": true })
  .scriptName("opencode")
  .wrap(100)
  .help("help", "显示帮助")
  .alias("help", "h")
  .version("version", "显示版本号", Installation.VERSION)
  .alias("version", "v")
  .option("print-logs", {
    describe: "将日志打印到stderr",
    type: "boolean",
  })
  .option("log-level", {
    describe: "日志级别",
    type: "string",
    choices: ["DEBUG", "INFO", "WARN", "ERROR"],
  })
  .middleware(async (opts) => {
    await Log.init({
      print: process.argv.includes("--print-logs"),
      dev: Installation.isLocal(),
      level: (() => {
        if (opts.logLevel) return opts.logLevel as Log.Level
        if (Installation.isLocal()) return "DEBUG"
        return "INFO"
      })(),
    })

    process.env.AGENT = "1"
    process.env.OPENCODE = "1"

    Log.Default.info("opencode", {
      version: Installation.VERSION,
      args: process.argv.slice(2),
    })
  })
  .usage("\n" + UI.logo())
  .completion("completion", "生成shell自动补全脚本")
  .command(AcpCommand)
  .command(McpCommand)
  .command(TuiThreadCommand)
  .command(TuiSpawnCommand)
  .command(AttachCommand)
  .command(RunCommand)
  .command(GenerateCommand)
  .command(DebugCommand)
  .command(AuthCommand)
  .command(AgentCommand)
  .command(UpgradeCommand)
  .command(UninstallCommand)
  .command(ServeCommand)
  .command(WebCommand)
  .command(ModelsCommand)
  .command(StatsCommand)
  .command(ExportCommand)
  .command(ImportCommand)
  .command(GithubCommand)
  .command(PrCommand)
  .command(SessionCommand)
  .fail((msg) => {
    if (msg.startsWith("未知参数") || msg.startsWith("非选项参数不足") || msg.startsWith("无效值：")) {
      cli.showHelp("log")
    }
    process.exit(1)
  })
  .strict()

try {
  await cli.parse()
} catch (e) {
  let data: Record<string, any> = {}
  if (e instanceof NamedError) {
    const obj = e.toObject()
    Object.assign(data, {
      ...obj.data,
    })
  }

  if (e instanceof Error) {
    Object.assign(data, {
      name: e.name,
      message: e.message,
      cause: e.cause?.toString(),
      stack: e.stack,
    })
  }

  if (e instanceof ResolveMessage) {
    Object.assign(data, {
      name: e.name,
      message: e.message,
      code: e.code,
      specifier: e.specifier,
      referrer: e.referrer,
      position: e.position,
      importKind: e.importKind,
    })
  }
  Log.Default.error("fatal", data)
  const formatted = FormatError(e)
  if (formatted) UI.error(formatted)
  if (formatted === undefined) {
    UI.error("意外错误，请检查日志文件 " + Log.file() + " 获取更多详细信息" + EOL)
    console.error(e)
  }
  process.exitCode = 1
} finally {
  // Some subprocesses don't react properly to SIGTERM and similar signals.
  // Most notably, some docker-container-based MCP servers don't handle such signals unless
  // run using `docker run --init`.
  // Explicitly exit to avoid any hanging subprocesses.
  process.exit()
}

// index.ts - OpenCode CLI应用程序入口文件
// 功能：初始化和配置命令行界面（CLI），处理全局错误和日志
//
// 导入的模块：
// - yargs: 命令行参数解析库
// - hideBin: 隐藏二进制路径的辅助函数
// - RunCommand: 运行命令
// - GenerateCommand: 生成命令
// - Log: 日志工具
// - AuthCommand: 认证命令
// - AgentCommand: 代理命令
// - UpgradeCommand: 升级命令
// - UninstallCommand: 卸载命令
// - ModelsCommand: 模型命令
// - UI: 用户界面工具
// - Installation: 安装信息
// - NamedError: 命名错误类
// - FormatError: 错误格式化工具
// - ServeCommand: 服务命令
// - DebugCommand: 调试命令
// - StatsCommand: 统计命令
// - McpCommand: MCP命令
// - GithubCommand: GitHub命令
// - ExportCommand: 导出命令
// - ImportCommand: 导入命令
// - AttachCommand: 附加命令
// - TuiThreadCommand: TUI线程命令
// - TuiSpawnCommand: TUI生成命令
// - AcpCommand: ACP命令
// - EOL: 操作系统行结束符
// - WebCommand: Web命令
// - PrCommand: PR命令
// - SessionCommand: 会话命令
//
// 全局错误处理：
// - unhandledRejection: 处理未处理的Promise拒绝
// - uncaughtException: 处理未捕获的异常
//   - 记录错误消息到日志
//   - 区分Error对象和其他类型的错误
//
// CLI配置：
// - parserConfiguration: 配置解析器，populate--选项填充所有选项
// - scriptName: 脚本名称为"opencode"
// - wrap: 帮助文本换行宽度为100
// - help: 显示帮助信息，别名为"h"
// - version: 显示版本号，别名为"v"
// - print-logs选项：将日志打印到stderr（布尔类型）
// - log-level选项：设置日志级别（字符串类型），可选值：DEBUG、INFO、WARN、ERROR
//
// 中间件：
// - 初始化日志系统
//   - print: 检查是否启用--print-logs选项
//   - dev: 检查是否为本地开发环境
//   - level: 根据选项或环境设置日志级别
// - 设置环境变量AGENT和OPENCODE为"1"
// - 记录启动信息，包括版本和参数
//
// 命令注册：
// - completion: 生成shell自动补全脚本
// - 注册所有命令模块（Acp、Mcp、TuiThread、TuiSpawn、Attach、Run、Generate、Debug、Auth、Agent、Upgrade、Uninstall、Serve、Web、Models、Stats、Export、Import、Github、Pr、Session）
//
// 错误处理：
// - fail: 处理命令行参数错误
//   - 如果是未知参数、参数不足或无效值，显示帮助
//   - 退出码为1
// - strict: 启用严格模式，拒绝未知参数
//
// 主执行流程：
// - try: 解析命令行参数
// - catch: 捕获并处理所有错误
//   - NamedError: 提取错误数据
//   - Error: 提取错误名称、消息、原因和堆栈
//   - ResolveMessage: 提取模块解析错误信息
//   - 记录错误到日志
//   - 格式化并显示错误
//   - 如果无法格式化，显示通用错误消息和日志文件路径
//   - 设置退出码为1
// - finally: 显式退出进程
//   - 某些子进程无法正确响应SIGTERM等信号
//   - 特别是某些基于Docker容器的MCP服务器
//   - 除非使用`docker run --init`运行
//   - 显式退出以避免挂起的子进程
//
// 使用场景：
// - 作为OpenCode CLI应用程序的入口点
// - 提供统一的命令行界面和错误处理
// - 管理日志记录和配置
// - 注册和管理所有CLI命令
