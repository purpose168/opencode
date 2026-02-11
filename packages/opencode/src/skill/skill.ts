import { Global } from "@/global" // 导入全局配置模块
import { Filesystem } from "@/util/filesystem" // 导入文件系统工具
import { NamedError } from "@opencode-ai/util/error" // 导入命名错误工具
import { exists } from "fs/promises" // 导入文件系统 Promise 接口
import z from "zod" // 导入 Zod 验证库
import { Config } from "../config/config" // 导入配置模块
import { ConfigMarkdown } from "../config/markdown" // 导入 Markdown 配置解析模块
import { Instance } from "../project/instance" // 导入实例管理模块
import { Log } from "../util/log" // 导入日志工具

export namespace Skill {
  const log = Log.create({ service: "skill" }) // 创建日志实例

  /**
   * 技能信息的 Zod schema 定义
   */
  export const Info = z.object({
    name: z.string(), // 技能名称
    description: z.string(), // 技能描述
    location: z.string(), // 技能位置
  })
  export type Info = z.infer<typeof Info> // 技能信息类型

  /**
   * 技能无效错误
   */
  export const InvalidError = NamedError.create(
    "SkillInvalidError", // 错误名称
    z.object({
      path: z.string(), // 技能文件路径
      message: z.string().optional(), // 错误消息（可选）
      issues: z.custom<z.core.$ZodIssue[]>().optional(), // 验证问题列表（可选）
    }),
  )

  /**
   * 技能名称不匹配错误
   */
  export const NameMismatchError = NamedError.create(
    "SkillNameMismatchError", // 错误名称
    z.object({
      path: z.string(), // 技能文件路径
      expected: z.string(), // 期望的技能名称
      actual: z.string(), // 实际的技能名称
    }),
  )

  const OPENCODE_SKILL_GLOB = new Bun.Glob("{skill,skills}/**/SKILL.md") // OpenCode 技能文件 Glob 模式
  const CLAUDE_SKILL_GLOB = new Bun.Glob("skills/**/SKILL.md") // Claude 技能文件 Glob 模式

  /**
   * 技能状态（懒加载）
   */
  export const state = Instance.state(async () => {
    const skills: Record<string, Info> = {} // 技能映射（名称到信息）

    /**
     * 添加技能到映射
     * @param match - 技能文件路径
     */
    const addSkill = async (match: string) => {
      const md = await ConfigMarkdown.parse(match) // 解析 Markdown 文件
      if (!md) {
        // 如果解析失败
        return
      }

      const parsed = Info.pick({ name: true, description: true }).safeParse(md.data) // 解析技能信息
      if (!parsed.success) return // 如果解析失败，直接返回

      // 警告重复的技能名称
      if (skills[parsed.data.name]) {
        // 如果技能名称已存在
        log.warn("duplicate skill name", {
          // 记录警告日志
          name: parsed.data.name, // 技能名称
          existing: skills[parsed.data.name].location, // 已存在的技能位置
          duplicate: match, // 重复的技能位置
        })
      }

      skills[parsed.data.name] = {
        // 添加到技能映射
        name: parsed.data.name, // 技能名称
        description: parsed.data.description, // 技能描述
        location: match, // 技能位置
      }
    }

    // 扫描 .claude/skills/ 目录（项目级别）
    const claudeDirs = await Array.fromAsync(
      // 获取所有 Claude 技能目录
      Filesystem.up({
        // 向上查找目录
        targets: [".claude"], // 目标目录
        start: Instance.directory, // 起始目录
        stop: Instance.worktree, // 停止目录
      }),
    )
    // 同时包含全局 ~/.claude/skills/
    const globalClaude = `${Global.Path.home}/.claude` // 全局 Claude 目录
    if (await exists(globalClaude)) {
      // 如果全局目录存在
      claudeDirs.push(globalClaude) // 添加到目录列表
    }

    for (const dir of claudeDirs) {
      // 遍历 Claude 技能目录
      for await (const match of CLAUDE_SKILL_GLOB.scan({
        // 扫描技能文件
        cwd: dir, // 工作目录
        absolute: true, // 返回绝对路径
        onlyFiles: true, // 只包含文件
        followSymlinks: true, // 跟随符号链接
        dot: true, // 包含点文件
      })) {
        await addSkill(match) // 添加技能
      }
    }

    // 扫描 .opencode/skill/ 目录
    for (const dir of await Config.directories()) {
      // 遍历配置目录
      for await (const match of OPENCODE_SKILL_GLOB.scan({
        // 扫描技能文件
        cwd: dir, // 工作目录
        absolute: true, // 返回绝对路径
        onlyFiles: true, // 只包含文件
        followSymlinks: true, // 跟随符号链接
      })) {
        await addSkill(match) // 添加技能
      }
    }

    return skills // 返回技能映射
  })

  /**
   * 获取指定名称的技能
   * @param name - 技能名称
   * @returns Promise<Info | undefined> - 技能信息
   */
  export async function get(name: string) {
    return state().then((x) => x[name]) // 从状态中获取技能
  }

  /**
   * 获取所有技能
   * @returns Promise<Info[]> - 技能列表
   */
  export async function all() {
    return state().then((x) => Object.values(x)) // 返回所有技能
  }
}
