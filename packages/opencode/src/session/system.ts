import { Config } from "../config/config" // 导入配置模块
import { Ripgrep } from "../file/ripgrep" // 导入 Ripgrep 文件搜索工具
import { Global } from "../global" // 导入全局配置模块
import { Filesystem } from "../util/filesystem" // 导入文件系统工具

import os from "os" // 导入操作系统模块
import path from "path" // 导入路径处理模块
import { Instance } from "../project/instance" // 导入实例管理模块

import PROMPT_ANTHROPIC from "./prompt/anthropic.txt" // 导入 Anthropic 系统提示词
import PROMPT_ANTHROPIC_SPOOF from "./prompt/anthropic_spoof.txt" // 导入 Anthropic 伪装系统提示词
import PROMPT_BEAST from "./prompt/beast.txt" // 导入 Beast 系统提示词
import PROMPT_GEMINI from "./prompt/gemini.txt" // 导入 Gemini 系统提示词
import PROMPT_ANTHROPIC_WITHOUT_TODO from "./prompt/qwen.txt" // 导入 Qwen 系统提示词（不带 TODO）

import type { Provider } from "@/provider/provider" // 导入提供商类型
import PROMPT_CODEX from "./prompt/codex.txt" // 导入 Codex 系统提示词

export namespace SystemPrompt {
  /**
   * 根据提供商 ID 生成头部提示词
   * @param providerID - 提供商 ID
   * @returns string[] - 头部提示词数组
   */
  export function header(providerID: string) {
    if (providerID.includes("anthropic")) return [PROMPT_ANTHROPIC_SPOOF.trim()] // 如果是 Anthropic 提供商，返回伪装提示词
    return [] // 其他提供商返回空数组
  }

  /**
   * 根据模型提供商生成提供商提示词
   * @param model - 模型信息
   * @returns string[] - 提供商提示词数组
   */
  export function provider(model: Provider.Model) {
    if (model.api.id.includes("gpt-5")) return [PROMPT_CODEX] // 如果是 GPT-5 模型，返回 Codex 提示词
    if (model.api.id.includes("gpt-") || model.api.id.includes("o1") || model.api.id.includes("o3"))
      // 如果是 GPT 或 O 系列模型
      return [PROMPT_BEAST] // 返回 Beast 提示词
    if (model.api.id.includes("gemini-")) return [PROMPT_GEMINI] // 如果是 Gemini 模型，返回 Gemini 提示词
    if (model.api.id.includes("claude")) return [PROMPT_ANTHROPIC] // 如果是 Claude 模型，返回 Anthropic 提示词
    return [PROMPT_ANTHROPIC_WITHOUT_TODO] // 默认返回 Qwen 提示词（不带 TODO）
  }

  /**
   * 生成环境信息提示词
   * @returns Promise<string[]> - 环境信息提示词数组
   */
  export async function environment() {
    const project = Instance.project // 获取项目信息
    return [
      [
        `Here is some useful information about the environment you are running in:`, // 以下是关于运行环境的一些有用信息
        `<env>`, // 环境信息开始标签
        `  Working directory: ${Instance.directory}`, // 工作目录
        `  Is directory a git repo: ${project.vcs === "git" ? "yes" : "no"}`, // 是否是 git 仓库
        `  Platform: ${process.platform}`, // 平台信息
        `  Today's date: ${new Date().toDateString()}`, // 今天的日期
        `</env>`, // 环境信息结束标签
        `<files>`, // 文件列表开始标签
        `  ${
          project.vcs === "git" && false // 如果是 git 仓库且启用文件树（当前禁用）
            ? await Ripgrep.tree({
                // 使用 Ripgrep 生成文件树
                cwd: Instance.directory, // 工作目录
                limit: 200, // 文件数量限制
              })
            : "" // 否则为空字符串
        }`,
        `</files>`, // 文件列表结束标签
      ].join("\n"), // 用换行符连接所有行
    ]
  }

  const LOCAL_RULE_FILES = [
    // 本地规则文件列表
    "AGENTS.md", // 智能体规则文件
    "CLAUDE.md", // Claude 规则文件
    "CONTEXT.md", // 上下文规则文件（已废弃）
  ]
  const GLOBAL_RULE_FILES = [
    // 全局规则文件列表
    path.join(Global.Path.config, "AGENTS.md"), // 配置目录中的智能体规则文件
    path.join(os.homedir(), ".claude", "CLAUDE.md"), // 用户主目录下的 Claude 规则文件
  ]

  /**
   * 生成自定义规则提示词
   * @returns Promise<string[]> - 自定义规则提示词数组
   */
  export async function custom() {
    const config = await Config.get() // 获取配置
    const paths = new Set<string>() // 规则文件路径集合

    for (const localRuleFile of LOCAL_RULE_FILES) {
      // 遍历本地规则文件
      const matches = await Filesystem.findUp(localRuleFile, Instance.directory, Instance.worktree) // 向上查找规则文件
      if (matches.length > 0) {
        // 如果找到匹配的文件
        matches.forEach((path) => paths.add(path)) // 添加到路径集合
        break // 只使用第一个匹配的文件
      }
    }

    for (const globalRuleFile of GLOBAL_RULE_FILES) {
      // 遍历全局规则文件
      if (await Bun.file(globalRuleFile).exists()) {
        // 如果文件存在
        paths.add(globalRuleFile) // 添加到路径集合
        break // 只使用第一个存在的文件
      }
    }

    if (config.instructions) {
      // 如果配置中有指令
      for (let instruction of config.instructions) {
        // 遍历所有指令
        if (instruction.startsWith("~/")) {
          // 如果以 ~/ 开头
          instruction = path.join(os.homedir(), instruction.slice(2)) // 转换为绝对路径
        }
        let matches: string[] = [] // 匹配的文件列表
        if (path.isAbsolute(instruction)) {
          // 如果是绝对路径
          matches = await Array.fromAsync(
            // 使用 Glob 扫描文件
            new Bun.Glob(path.basename(instruction)).scan({
              // 创建 Glob 模式
              cwd: path.dirname(instruction), // 目录路径
              absolute: true, // 返回绝对路径
              onlyFiles: true, // 只包含文件
            }),
          ).catch(() => []) // 失败时返回空数组
        } else {
          // 如果是相对路径
          matches = await Filesystem.globUp(instruction, Instance.directory, Instance.worktree).catch(() => []) // 向上查找匹配的文件
        }
        matches.forEach((path) => paths.add(path)) // 添加所有匹配的文件到路径集合
      }
    }

    const found = Array.from(paths).map(
      (
        p, // 读取所有规则文件的内容
      ) =>
        Bun.file(p)
          .text() // 读取文件文本
          .catch(() => "") // 失败时返回空字符串
          .then((x) => "Instructions from: " + p + "\n" + x), // 添加文件路径前缀
    )
    return Promise.all(found).then((result) => result.filter(Boolean)) // 等待所有文件读取完成，过滤空结果
  }
}
