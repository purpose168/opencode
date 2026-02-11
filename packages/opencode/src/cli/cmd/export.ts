// 导入 yargs 类型定义，用于命令行参数类型
import type { Argv } from "yargs"
// 导入会话模块，用于管理会话数据
import { Session } from "../../session"
// 导入命令创建工具，用于定义 CLI 命令
import { cmd } from "./cmd"
// 导入引导模块，用于初始化应用环境
import { bootstrap } from "../bootstrap"
// 导入 UI 工具，用于 UI 样式和布局
import { UI } from "../ui"
// 导入交互式提示工具，用于创建用户交互界面
import * as prompts from "@clack/prompts"
// 导入操作系统换行符，用于输出格式化
import { EOL } from "os"

/**
 * ExportCommand 导出会话命令定义
 *
 * 功能说明：
 * - 定义 "export" 命令，用于导出会话数据为 JSON 格式
 * - 支持指定会话 ID 导出特定会话
 * - 支持交互式选择会话（未指定会话 ID 时）
 * - 导出数据包含会话信息和消息列表
 *
 * 使用场景：
 * - 需要备份会话数据时
 * - 需要分析会话内容时
 * - 需要迁移会话数据时
 * - 需要导出会话用于其他工具时
 *
 * 命令格式：
 * - opencode export [sessionID]
 * - opencode export（交互式选择会话）
 *
 * 参数说明：
 * - sessionID: 要导出的会话 ID（可选参数）
 *
 * 输出格式：
 * - JSON 格式，包含两个字段：
 *   - info: 会话信息（标题、创建时间、更新时间等）
 *   - messages: 消息列表，每个消息包含 info 和 parts
 *
 * 工作流程：
 * 1. 如果提供了会话 ID，直接导出该会话
 * 2. 如果未提供会话 ID：
 *    - 显示会话列表
 *    - 让用户选择要导出的会话
 * 3. 获取会话信息和消息
 * 4. 将数据格式化为 JSON 并输出到标准输出
 *
 * 注意事项：
 * - 输出到标准输出（stdout）
 * - 进度信息输出到标准错误（stderr）
 * - 如果会话不存在，显示错误并退出
 * - 会话列表按更新时间倒序排列（最新的在前）
 */
export const ExportCommand = cmd({
  // 导出导出会话命令定义
  command: "export [sessionID]", // 命令名称，接受可选的会话 ID 参数
  describe: "导出会话数据为 JSON", // 命令描述：导出会话数据为 JSON
  builder: (yargs: Argv) => {
    // 命令构建器，用于定义命令参数和选项
    return yargs.positional("sessionID", {
      // 定义位置参数 sessionID
      describe: "要导出的会话 ID", // 参数描述：要导出的会话 ID
      type: "string", // 参数类型为字符串
    })
  },
  handler: async (args) => {
    // 命令处理函数，异步执行
    await bootstrap(process.cwd(), async () => {
      // 初始化应用环境，在当前目录中执行
      let sessionID = args.sessionID // 获取命令行参数中的会话 ID
      process.stderr.write(`Exporting session: ${sessionID ?? "latest"}`) // 向标准错误输出导出进度信息（显示会话 ID 或 "latest"）

      if (!sessionID) {
        // 如果未提供会话 ID
        UI.empty() // 清空 UI
        prompts.intro("导出会话", {
          // 显示导出会话标题
          output: process.stderr, // 输出到标准错误
        })

        const sessions = [] // 初始化会话数组
        for await (const session of Session.list()) {
          // 遍历所有会话
          sessions.push(session) // 将会话添加到数组
        }

        if (sessions.length === 0) {
          // 如果没有会话
          prompts.log.error("未找到会话", {
            // 显示错误消息
            output: process.stderr, // 输出到标准错误
          })
          prompts.outro("完成", {
            // 显示结束消息
            output: process.stderr, // 输出到标准错误
          })
          return // 返回
        }

        sessions.sort((a, b) => b.time.updated - a.time.updated) // 按更新时间倒序排列会话（最新的在前）

        const selectedSession = await prompts.autocomplete({
          // 显示自动完成提示，让用户选择要导出的会话
          message: "选择要导出的会话", // 提示消息：选择要导出的会话
          maxItems: 10, // 最多显示 10 个选项
          options: sessions.map((session) => ({
            // 映射会话为选项对象
            label: session.title, // 选项标签为会话标题
            value: session.id, // 选项值为会话 ID
            hint: `${new Date(session.time.updated).toLocaleString()} • ${session.id.slice(-8)}`, // 提示信息：更新时间和会话 ID 后 8 位
          })),
          output: process.stderr, // 输出到标准错误
        })

        if (prompts.isCancel(selectedSession)) {
          // 如果用户取消
          throw new UI.CancelledError() // 抛出取消错误
        }

        sessionID = selectedSession as string // 将选中的会话 ID 赋值给 sessionID

        prompts.outro("正在导出会话...", {
          // 显示正在导出消息
          output: process.stderr, // 输出到标准错误
        })
      }

      try {
        // 尝试导出会话数据
        const sessionInfo = await Session.get(sessionID!) // 获取会话信息
        const messages = await Session.messages({ sessionID: sessionID! }) // 获取会话的所有消息

        const exportData = {
          // 构建导出数据对象
          info: sessionInfo, // 会话信息
          messages: messages.map((msg) => ({
            // 映射消息列表
            info: msg.info, // 消息信息
            parts: msg.parts, // 消息部分
          })),
        }

        process.stdout.write(JSON.stringify(exportData, null, 2)) // 将导出数据格式化为 JSON 并写入标准输出（缩进 2 个空格）
        process.stdout.write(EOL) // 写入换行符
      } catch (error) {
        // 捕获导出错误
        UI.error(`Session not found: ${sessionID!}`) // 显示错误消息：会话未找到
        process.exit(1) // 退出程序，返回错误码 1
      }
    })
  },
})
