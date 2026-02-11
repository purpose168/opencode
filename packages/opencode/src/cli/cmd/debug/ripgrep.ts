import { EOL } from "os"
import { Ripgrep } from "../../../file/ripgrep"
import { Instance } from "../../../project/instance"
import { bootstrap } from "../../bootstrap"
import { cmd } from "../cmd"

/**
 * Ripgrep 命令
 * 包含多个子命令，用于文件搜索和目录树生成
 */
export const RipgrepCommand = cmd({
  /**
   * 命令定义：rg
   * 无参数，使用子命令
   */
  command: "rg",
  /**
   * 命令构建器
   * 注册子命令并要求必须提供子命令
   */
  builder: (yargs) =>
    yargs
      .command(TreeCommand)    // 目录树命令
      .command(FilesCommand)   // 文件列表命令
      .command(SearchCommand)  // 搜索命令
      .demandCommand(),
  /**
   * 命令处理函数
   * 无实际处理逻辑，由子命令处理
   */
  async handler() {},
})

/**
 * 目录树命令
 * 用于生成目录树结构
 */
const TreeCommand = cmd({
  /**
   * 命令定义：tree
   * 可选参数：--limit <number>（限制结果数量）
   */
  command: "tree",
  /**
   * 命令构建器
   * 定义限制参数
   */
  builder: (yargs) =>
    yargs.option("limit", {
      type: "number",
      description: "限制结果数量",
    }),
  /**
   * 命令处理函数
   * @param args 命令行参数
   */
  async handler(args) {
    await bootstrap(process.cwd(), async () => {
      // 生成目录树并输出
      process.stdout.write((await Ripgrep.tree({ cwd: Instance.directory, limit: args.limit })) + EOL)
    })
  },
})

/**
 * 文件列表命令
 * 用于列出符合条件的文件
 */
const FilesCommand = cmd({
  /**
   * 命令定义：files
   * 可选参数：
   * --query <string>（按查询过滤文件）
   * --glob <string>（匹配文件的 glob 模式）
   * --limit <number>（限制结果数量）
   */
  command: "files",
  /**
   * 命令构建器
   * 定义查询、glob 模式和限制参数
   */
  builder: (yargs) =>
    yargs
      .option("query", {
        type: "string",
        description: "按查询过滤文件",
      })
      .option("glob", {
        type: "string",
        description: "匹配文件的 glob 模式",
      })
      .option("limit", {
        type: "number",
        description: "限制结果数量",
      }),
  /**
   * 命令处理函数
   * @param args 命令行参数
   */
  async handler(args) {
    await bootstrap(process.cwd(), async () => {
      const files: string[] = []
      // 遍历符合条件的文件
      for await (const file of Ripgrep.files({
        cwd: Instance.directory,
        glob: args.glob ? [args.glob] : undefined,
      })) {
        files.push(file)
        // 如果设置了限制且已达到限制数量，则停止遍历
        if (args.limit && files.length >= args.limit) break
      }
      // 输出文件列表
      process.stdout.write(files.join(EOL) + EOL)
    })
  },
})

/**
 * 搜索命令
 * 用于在文件中搜索指定模式
 */
const SearchCommand = cmd({
  /**
   * 命令定义：search <pattern>
   * pattern: 搜索模式（必需参数）
   * 可选参数：
   * --glob <array>（文件 glob 模式数组）
   * --limit <number>（限制结果数量）
   */
  command: "search <pattern>",
  /**
   * 命令构建器
   * 定义搜索模式、glob 模式和限制参数
   */
  builder: (yargs) =>
    yargs
      .positional("pattern", {
        type: "string",
        demandOption: true,
        description: "搜索模式",
      })
      .option("glob", {
        type: "array",
        description: "文件 glob 模式",
      })
      .option("limit", {
        type: "number",
        description: "限制结果数量",
      }),
  /**
   * 命令处理函数
   * @param args 命令行参数
   */
  async handler(args) {
    // 执行搜索
    const results = await Ripgrep.search({
      cwd: process.cwd(),
      pattern: args.pattern,
      glob: args.glob as string[] | undefined,
      limit: args.limit,
    })
    // 输出搜索结果
    process.stdout.write(JSON.stringify(results, null, 2) + EOL)
  },
})
