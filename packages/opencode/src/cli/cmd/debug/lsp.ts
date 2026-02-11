import { LSP } from "../../../lsp"
import { bootstrap } from "../../bootstrap"
import { cmd } from "../cmd"
import { Log } from "../../../util/log"
import { EOL } from "os"

/**
 * LSP（语言服务器协议）命令
 * 包含多个子命令，用于调试LSP相关功能
 */
export const LSPCommand = cmd({
  /**
   * 命令定义：lsp
   * 无参数，使用子命令
   */
  command: "lsp",
  /**
   * 命令构建器
   * 注册子命令并要求必须提供子命令
   */
  builder: (yargs) =>
    yargs
      .command(DiagnosticsCommand)      // 诊断命令
      .command(SymbolsCommand)          // 符号搜索命令
      .command(DocumentSymbolsCommand)  // 文档符号命令
      .demandCommand(),
  /**
   * 命令处理函数
   * 无实际处理逻辑，由子命令处理
   */
  async handler() {},
})

/**
 * 诊断命令
 * 用于显示文件的诊断信息（如错误、警告等）
 */
const DiagnosticsCommand = cmd({
  /**
   * 命令定义：diagnostics <file>
   * file: 文件路径（必需参数）
   */
  command: "diagnostics <file>",
  /**
   * 命令构建器
   * 定义文件路径参数
   */
  builder: (yargs) => yargs.positional("file", { type: "string", demandOption: true, description: "文件路径" }),
  /**
   * 命令处理函数
   * @param args 命令行参数
   */
  async handler(args) {
    await bootstrap(process.cwd(), async () => {
      // 触发生成文件的诊断信息
      await LSP.touchFile(args.file, true)
      // 等待1秒确保诊断信息已生成
      await Bun.sleep(1000)
      // 输出诊断信息
      process.stdout.write(JSON.stringify(await LSP.diagnostics(), null, 2) + EOL)
    })
  },
})

/**
 * 符号搜索命令
 * 用于在工作区中搜索符号
 */
export const SymbolsCommand = cmd({
  /**
   * 命令定义：symbols <query>
   * query: 搜索查询字符串（必需参数）
   */
  command: "symbols <query>",
  /**
   * 命令构建器
   * 定义搜索查询参数
   */
  builder: (yargs) => yargs.positional("query", { type: "string", demandOption: true, description: "搜索查询字符串" }),
  /**
   * 命令处理函数
   * @param args 命令行参数
   */
  async handler(args) {
    await bootstrap(process.cwd(), async () => {
      // 记录执行时间
      using _ = Log.Default.time("symbols")
      // 搜索工作区符号
      const results = await LSP.workspaceSymbol(args.query)
      // 输出搜索结果
      process.stdout.write(JSON.stringify(results, null, 2) + EOL)
    })
  },
})

/**
 * 文档符号命令
 * 用于显示文档中的符号（如类、函数、变量等）
 */
export const DocumentSymbolsCommand = cmd({
  /**
   * 命令定义：document-symbols <uri>
   * uri: 文档URI（必需参数）
   */
  command: "document-symbols <uri>",
  /**
   * 命令构建器
   * 定义文档URI参数
   */
  builder: (yargs) => yargs.positional("uri", { type: "string", demandOption: true, description: "文档URI" }),
  /**
   * 命令处理函数
   * @param args 命令行参数
   */
  async handler(args) {
    await bootstrap(process.cwd(), async () => {
      // 记录执行时间
      using _ = Log.Default.time("document-symbols")
      // 获取文档符号
      const results = await LSP.documentSymbol(args.uri)
      // 输出文档符号
      process.stdout.write(JSON.stringify(results, null, 2) + EOL)
    })
  },
})
