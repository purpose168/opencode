import { Global } from "../../../global"
import { bootstrap } from "../../bootstrap"
import { cmd } from "../cmd"
import { ConfigCommand } from "./config"
import { FileCommand } from "./file"
import { LSPCommand } from "./lsp"
import { RipgrepCommand } from "./ripgrep"
import { ScrapCommand } from "./scrap"
import { SkillCommand } from "./skill"
import { SnapshotCommand } from "./snapshot"
import { AgentCommand } from "./agent"

/**
 * 调试命令
 * 包含多个子命令，用于调试应用程序的不同部分
 */
export const DebugCommand = cmd({
  /**
   * 命令定义：debug
   * 无参数，使用子命令
   */
  command: "debug",
  /**
   * 命令构建器
   * 注册多个子命令并要求必须提供子命令
   */
  builder: (yargs) =>
    yargs
      .command(ConfigCommand)      // 配置调试命令
      .command(LSPCommand)         // LSP（语言服务器协议）调试命令
      .command(RipgrepCommand)     // Ripgrep 调试命令
      .command(FileCommand)        // 文件操作调试命令
      .command(ScrapCommand)       // 抓取（Scrap）调试命令
      .command(SkillCommand)       // 技能（Skill）调试命令
      .command(SnapshotCommand)    // 快照（Snapshot）调试命令
      .command(AgentCommand)       // 智能体（Agent）调试命令
      .command(PathsCommand)       // 路径调试命令
      .command({
        /**
         * 等待命令
         * 用于使进程保持运行状态
         */
        command: "wait",
        /**
         * 命令处理函数
         * 启动引导程序并等待24小时
         */
        async handler() {
          await bootstrap(process.cwd(), async () => {
            // 等待24小时
            await new Promise((resolve) => setTimeout(resolve, 1_000 * 60 * 60 * 24))
          })
        },
      })
      .demandCommand(),
  /**
   * 命令处理函数
   * 无实际处理逻辑，由子命令处理
   */
  async handler() {},
})

/**
 * 路径命令
 * 用于显示全局路径配置
 */
const PathsCommand = cmd({
  /**
   * 命令定义：paths
   * 无参数
   */
  command: "paths",
  /**
   * 命令处理函数
   * 显示所有全局路径配置
   */
  handler() {
    // 遍历并输出所有全局路径配置
    for (const [key, value] of Object.entries(Global.Path)) {
      console.log(key.padEnd(10), value)
    }
  },
})
