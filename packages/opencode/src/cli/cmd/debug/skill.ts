import { EOL } from "os"
import { Skill } from "../../../skill"
import { bootstrap } from "../../bootstrap"
import { cmd } from "../cmd"

/**
 * 技能命令
 * 用于列出所有技能
 */
export const SkillCommand = cmd({
  /**
   * 命令定义：skill
   * 无参数
   */
  command: "skill",
  /**
   * 命令构建器
   * 无额外参数定义
   */
  builder: (yargs) => yargs,
  /**
   * 命令处理函数
   * 列出所有技能并输出
   */
  async handler() {
    await bootstrap(process.cwd(), async () => {
      // 获取所有技能
      const skills = await Skill.all()
      // 输出技能列表
      process.stdout.write(JSON.stringify(skills, null, 2) + EOL)
    })
  },
})
