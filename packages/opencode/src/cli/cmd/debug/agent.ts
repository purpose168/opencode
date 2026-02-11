import { EOL } from "os"
import { basename } from "path"
import { Agent } from "../../../agent/agent"
import { bootstrap } from "../../bootstrap"
import { cmd } from "../cmd"

/**
 * 智能体调试命令
 * 用于显示指定智能体的详细信息
 */
export const AgentCommand = cmd({
  /**
   * 命令定义：agent <name>
   * name: 智能体名称（必需参数）
   */
  command: "agent <name>",
  /**
   * 命令构建器
   * 定义命令行参数
   */
  builder: (yargs) =>
    yargs.positional("name", {
      type: "string",
      demandOption: true,
      description: "智能体名称",
    }),
  /**
   * 命令处理函数
   * @param args 命令行参数
   */
  async handler(args) {
    await bootstrap(process.cwd(), async () => {
      const agentName = args.name as string
      // 获取指定名称的智能体
      const agent = await Agent.get(agentName)
      if (!agent) {
        // 如果智能体不存在，输出错误信息并退出
        process.stderr.write(
          `智能体 ${agentName} 未找到，请运行 '${basename(process.execPath)} agent list' 获取智能体列表` + EOL,
        )
        process.exit(1)
      }
      // 以JSON格式输出智能体信息
      process.stdout.write(JSON.stringify(agent, null, 2) + EOL)
    })
  },
})
