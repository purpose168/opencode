import path from "path" // 路径处理模块
import z from "zod" // 数据验证库
import { ConfigMarkdown } from "../config/markdown" // 配置Markdown解析
import { Skill } from "../skill" // 技能管理
import { Tool } from "./tool" // 工具基类

export const SkillTool = Tool.define("skill", async () => {
  const skills = await Skill.all() // 获取所有可用技能

  // 如果提供了agent，则根据agent权限过滤技能
  /*
    let accessibleSkills = skills
    if (ctx?.agent) {
      const permissions = ctx.agent.permission.skill
      accessibleSkills = skills.filter((skill) => {
        const action = Wildcard.all(skill.name, permissions)
        return action !== "deny"
      })
    }
    */

  const description =
    skills.length === 0
      ? "加载技能以获取特定任务的详细说明。当前没有可用的技能。"
      : [
          "加载技能以获取特定任务的详细说明。",
          "技能提供专业知识和分步指导。",
          "当任务与可用技能的描述匹配时使用此功能。",
          "<available_skills>",
          ...skills.flatMap((skill) => [
            `  <skill>`,
            `    <name>${skill.name}</name>`,
            `    <description>${skill.description}</description>`,
            `  </skill>`,
          ]),
          "</available_skills>",
        ].join(" ")

  return {
    description,
    parameters: z.object({
      name: z.string().describe("来自available_skills的技能标识符（例如：'code-review'或'category/helper'）"),
    }),
    async execute(params, ctx) {
      const skill = await Skill.get(params.name) // 获取指定技能

      if (!skill) {
        const available = Skill.all().then((x) => Object.keys(x).join(", ")) // 获取可用技能列表
        throw new Error(`技能"${params.name}"未找到。可用技能：${available || "无"}`)
      }

      await ctx.ask({
        permission: "skill",
        patterns: [params.name],
        always: [params.name],
        metadata: {},
      })
      // 加载并解析技能内容
      const parsed = await ConfigMarkdown.parse(skill.location)
      const dir = path.dirname(skill.location) // 获取技能所在目录

      // 格式化输出，类似于插件模式
      const output = [`## Skill: ${skill.name}`, "", `**Base directory**: ${dir}`, "", parsed.content.trim()].join("\n")

      return {
        title: `已加载技能：${skill.name}`,
        output,
        metadata: {
          name: skill.name,
          dir,
        },
      }
    },
  }
})
