import { NamedError } from "@opencode-ai/util/error" // 导入命名错误工具
import matter from "gray-matter" // 导入gray-matter库用于解析markdown的frontmatter
import { z } from "zod" // 导入zod库用于数据验证

export namespace ConfigMarkdown {
  // 文件引用正则表达式,用于匹配@开头的文件路径
  export const FILE_REGEX = /(?<![\w`])@(\.?[^\s`,.]*(?:\.[^\s`,.]+)*)/g
  // Shell命令正则表达式,用于匹配!`...`格式的shell命令
  export const SHELL_REGEX = /!`([^`]+)`/g

  // 从模板中提取所有文件引用
  export function files(template: string) {
    return Array.from(template.matchAll(FILE_REGEX))
  }

  // 从模板中提取所有shell命令
  export function shell(template: string) {
    return Array.from(template.matchAll(SHELL_REGEX))
  }

  // 解析markdown文件,提取YAML frontmatter和内容
  export async function parse(filePath: string) {
    const template = await Bun.file(filePath).text() // 读取文件内容

    try {
      const md = matter(template) // 解析frontmatter
      return md
    } catch (err) {
      throw new FrontmatterError(
        {
          path: filePath,
          message: `解析YAML frontmatter失败: ${err instanceof Error ? err.message : String(err)}`,
        },
        { cause: err },
      )
    }
  }

  // Frontmatter解析错误定义
  export const FrontmatterError = NamedError.create(
    "ConfigFrontmatterError",
    z.object({
      path: z.string(),
      message: z.string(),
    }),
  )
}
