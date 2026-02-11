import { EOL } from "os"
import { Project } from "../../../project/project"
import { Log } from "../../../util/log"
import { cmd } from "../cmd"

/**
 * 项目抓取命令
 * 用于列出所有项目
 */
export const ScrapCommand = cmd({
  /**
   * 命令定义：scrap
   * 无参数
   */
  command: "scrap",
  /**
   * 命令构建器
   * 无额外参数定义
   */
  builder: (yargs) => yargs,
  /**
   * 命令处理函数
   * 列出所有项目并输出
   */
  async handler() {
    // 记录执行时间
    const timer = Log.Default.time("scrap")
    // 获取项目列表
    const list = await Project.list()
    // 输出项目列表
    process.stdout.write(JSON.stringify(list, null, 2) + EOL)
    // 停止计时
    timer.stop()
  },
})
