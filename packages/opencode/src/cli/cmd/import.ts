// 导入 yargs 的 Argv 类型定义
import type { Argv } from "yargs"
// 导入会话模块
import { Session } from "../../session"
// 导入命令创建工具
import { cmd } from "./cmd"
// 导入引导工具
import { bootstrap } from "../bootstrap"
// 导入存储模块
import { Storage } from "../../storage/storage"
// 导入实例管理模块
import { Instance } from "../../project/instance"
// 导入操作系统换行符常量
import { EOL } from "os"

/**
 * ImportCommand 导入命令定义
 *
 * 功能说明：
 * - 定义 "import" 命令，用于从 JSON 文件或 URL 导入会话数据
 * - 支持从本地 JSON 文件导入会话数据
 * - 支持从 opencode.ai 分享 URL 导入会话数据
 * - 将导入的数据写入存储
 *
 * 使用场景：
 * - 需要从备份文件恢复会话时
 * - 需要从分享链接导入会话时
 * - 需要迁移会话数据时
 *
 * 命令格式：
 * - opencode import <file>
 * - opencode import https://opncd.ai/share/<slug>
 *
 * 参数说明：
 * - file（必需参数）：JSON 文件路径或 opencode.ai 分享 URL
 *
 * 工作流程：
 * 1. 初始化应用环境
 * 2. 判断输入是 URL 还是文件路径
 * 3. 如果是 URL：
 *    - 验证 URL 格式
 *    - 从 API 获取分享数据
 *    - 验证数据有效性
 * 4. 如果是文件路径：
 *    - 读取 JSON 文件
 *    - 验证文件存在性
 * 5. 将会话信息写入存储
 * 6. 将所有消息写入存储
 * 7. 将所有消息部件写入存储
 * 8. 显示导入成功消息
 *
 * 注意事项：
 * - URL 必须符合格式：https://opncd.ai/share/<slug>
 * - JSON 文件必须包含有效的会话数据结构
 * - 导入的数据会覆盖现有的会话数据
 */
export const ImportCommand = cmd({
  // 导出导入命令定义
  command: "import <file>", // 命令名称和位置参数
  describe: "从 JSON 文件或 URL 导入会话数据", // 命令描述：从 JSON 文件或 URL 导入会话数据
  builder: (yargs: Argv) => {
    // 命令构建器
    return yargs.positional("file", {
      // 定义位置参数 "file"
      describe: "JSON 文件路径或 opencode.ai 分享 URL", // 参数描述：JSON 文件路径或 opencode.ai 分享 URL
      type: "string", // 参数类型：字符串
      demandOption: true, // 必需参数
    })
  },
  handler: async (args) => {
    // 命令处理函数，异步执行
    await bootstrap(process.cwd(), async () => {
      // 初始化应用环境，在当前目录中执行
      let exportData:
        | {
            // 导出数据类型定义
            info: Session.Info // 会话信息
            messages: Array<{
              // 消息数组
              info: any // 消息信息
              parts: any[] // 消息部件数组
            }>
          }
        | undefined // 可能未定义

      const isUrl = args.file.startsWith("http://") || args.file.startsWith("https://") // 判断是否为 URL

      if (isUrl) {
        // 如果是 URL
        const urlMatch = args.file.match(/https?:\/\/opncd\.ai\/share\/([a-zA-Z0-9_-]+)/) // 匹配 URL 格式
        if (!urlMatch) {
          // 如果 URL 格式不匹配
          process.stdout.write(`无效的 URL 格式。预期格式：https://opncd.ai/share/<slug>`) // 输出错误消息
          process.stdout.write(EOL) // 输出换行符
          return // 返回
        }

        const slug = urlMatch[1] // 提取 slug（分享标识符）
        const response = await fetch(`https://opncd.ai/api/share/${slug}`) // 从 API 获取分享数据

        if (!response.ok) {
          // 如果请求失败
          process.stdout.write(`获取分享数据失败：${response.statusText}`) // 输出错误消息
          process.stdout.write(EOL) // 输出换行符
          return // 返回
        }

        const data = await response.json() // 解析响应 JSON

        if (!data.info || !data.messages || Object.keys(data.messages).length === 0) {
          // 如果数据无效
          process.stdout.write(`未找到分享：${slug}`) // 输出错误消息
          process.stdout.write(EOL) // 输出换行符
          return // 返回
        }

        exportData = {
          // 构建导出数据
          info: data.info, // 会话信息
          messages: Object.values(data.messages).map((msg: any) => {
            // 转换消息数组
            const { parts, ...info } = msg // 解构消息，分离部件和信息
            return {
              // 返回消息对象
              info, // 消息信息
              parts, // 消息部件
            }
          }),
        }
      } else {
        // 如果是文件路径
        const file = Bun.file(args.file) // 创建文件对象
        exportData = await file.json().catch(() => {}) // 读取 JSON 文件，忽略错误
        if (!exportData) {
          // 如果文件不存在或读取失败
          process.stdout.write(`文件未找到：${args.file}`) // 输出错误消息
          process.stdout.write(EOL) // 输出换行符
          return // 返回
        }
      }

      if (!exportData) {
        // 如果导出数据未定义
        process.stdout.write(`读取会话数据失败`) // 输出错误消息
        process.stdout.write(EOL) // 输出换行符
        return // 返回
      }

      await Storage.write(["session", Instance.project.id, exportData.info.id], exportData.info) // 写入会话信息到存储

      for (const msg of exportData.messages) {
        // 遍历所有消息
        await Storage.write(["message", exportData.info.id, msg.info.id], msg.info) // 写入消息到存储

        for (const part of msg.parts) {
          // 遍历消息的所有部件
          await Storage.write(["part", msg.info.id, part.id], part) // 写入消息部件到存储
        }
      }

      process.stdout.write(`已导入会话：${exportData.info.id}`) // 输出成功消息
      process.stdout.write(EOL) // 输出换行符
    })
  },
})
