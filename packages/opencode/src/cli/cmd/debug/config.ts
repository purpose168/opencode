import { EOL } from "os"
import { Config } from "../../../config/config"
import { bootstrap } from "../../bootstrap"
import { cmd } from "../cmd"

/**
 * 配置调试命令
 * 用于显示当前配置信息
 */
export const ConfigCommand = cmd({
  /**
   * 命令定义：config
   * 无参数
   */
  command: "config",
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
      // 获取当前配置
      const config = await Config.get()
      // 以JSON格式输出配置信息
      process.stdout.write(JSON.stringify(config, null, 2) + EOL)
    })
  },
})
