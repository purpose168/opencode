import { EOL } from "os"
import { File } from "../../../file"
import { bootstrap } from "../../bootstrap"
import { cmd } from "../cmd"
import { Ripgrep } from "@/file/ripgrep"

/**
 * 文件搜索命令
 * 用于搜索文件内容
 */
const FileSearchCommand = cmd({
  /**
   * 命令定义：search <query>
   * query: 搜索查询字符串（必需参数）
   */
  command: "search <query>",
  /**
   * 命令构建器
   * 定义搜索查询参数
   */
  builder: (yargs) =>
    yargs.positional("query", {
      type: "string",
      demandOption: true,
      description: "搜索查询字符串",
    }),
  /**
   * 命令处理函数
   * @param args 命令行参数
   */
  async handler(args) {
    await bootstrap(process.cwd(), async () => {
      // 执行文件搜索
      const results = await File.search({ query: args.query })
      // 输出搜索结果
      process.stdout.write(results.join(EOL) + EOL)
    })
  },
})

/**
 * 文件读取命令
 * 用于读取文件内容
 */
const FileReadCommand = cmd({
  /**
   * 命令定义：read <path>
   * path: 要读取的文件路径（必需参数）
   */
  command: "read <path>",
  /**
   * 命令构建器
   * 定义文件路径参数
   */
  builder: (yargs) =>
    yargs.positional("path", {
      type: "string",
      demandOption: true,
      description: "要读取的文件路径",
    }),
  /**
   * 命令处理函数
   * @param args 命令行参数
   */
  async handler(args) {
    await bootstrap(process.cwd(), async () => {
      // 读取文件内容
      const content = await File.read(args.path)
      // 以JSON格式输出文件内容
      process.stdout.write(JSON.stringify(content, null, 2) + EOL)
    })
  },
})

/**
 * 文件状态命令
 * 用于显示文件系统状态
 */
const FileStatusCommand = cmd({
  /**
   * 命令定义：status
   * 无参数
   */
  command: "status",
  /**
   * 命令构建器
   * 无额外参数定义
   */
  builder: (yargs) => yargs,
  /**
   * 命令处理函数
   */
  async handler() {
    await bootstrap(process.cwd(), async () => {
      // 获取文件系统状态
      const status = await File.status()
      // 以JSON格式输出状态信息
      process.stdout.write(JSON.stringify(status, null, 2) + EOL)
    })
  },
})

/**
 * 文件列表命令
 * 用于列出指定路径下的文件
 */
const FileListCommand = cmd({
  /**
   * 命令定义：list <path>
   * path: 要列出的文件路径（必需参数）
   */
  command: "list <path>",
  /**
   * 命令构建器
   * 定义文件路径参数
   */
  builder: (yargs) =>
    yargs.positional("path", {
      type: "string",
      demandOption: true,
      description: "要列出的文件路径",
    }),
  /**
   * 命令处理函数
   * @param args 命令行参数
   */
  async handler(args) {
    await bootstrap(process.cwd(), async () => {
      // 列出指定路径下的文件
      const files = await File.list(args.path)
      // 以JSON格式输出文件列表
      process.stdout.write(JSON.stringify(files, null, 2) + EOL)
    })
  },
})

/**
 * 文件树命令
 * 用于显示目录树结构
 */
const FileTreeCommand = cmd({
  /**
   * 命令定义：tree [dir]
   * dir: 要显示树结构的目录（可选参数，默认为当前工作目录）
   */
  command: "tree [dir]",
  /**
   * 命令构建器
   * 定义目录参数
   */
  builder: (yargs) =>
    yargs.positional("dir", {
      type: "string",
      description: "要显示树结构的目录",
      default: process.cwd(),
    }),
  /**
   * 命令处理函数
   * @param args 命令行参数
   */
  async handler(args) {
    // 使用Ripgrep生成目录树
    const files = await Ripgrep.tree({ cwd: args.dir, limit: 200 })
    // 输出目录树
    console.log(files)
  },
})

/**
 * 文件命令
 * 包含多个子命令：read、status、list、search、tree
 */
export const FileCommand = cmd({
  /**
   * 命令定义：file
   * 无参数，使用子命令
   */
  command: "file",
  /**
   * 命令构建器
   * 注册子命令并要求必须提供子命令
   */
  builder: (yargs) =>
    yargs
      .command(FileReadCommand)
      .command(FileStatusCommand)
      .command(FileListCommand)
      .command(FileSearchCommand)
      .command(FileTreeCommand)
      .demandCommand(),
  /**
   * 命令处理函数
   * 无实际处理逻辑，由子命令处理
   */
  async handler() {},
})
