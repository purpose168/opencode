import { select } from "@clack/prompts" // 导入交互式选择提示工具
import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk/v2" // 导入 Opencode SDK 客户端
import { EOL } from "os" // 导入操作系统换行符
import path from "path" // 导入路径处理模块
import type { Argv } from "yargs" // 导入 Yargs 类型定义
import { Agent } from "../../agent/agent" // 导入智能体管理模块
import { Command } from "../../command" // 导入命令管理模块
import { Flag } from "../../flag/flag" // 导入标志管理模块
import { Provider } from "../../provider/provider" // 导入提供者管理模块
import { Server } from "../../server/server" // 导入服务器模块
import { bootstrap } from "../bootstrap" // 导入应用初始化模块
import { UI } from "../ui" // 导入 UI 工具
import { cmd } from "./cmd" // 导入命令创建工具

const TOOL: Record<string, [string, string]> = {
  // 工具类型到显示名称和颜色的映射
  todowrite: ["Todo", UI.Style.TEXT_WARNING_BOLD], // TodoWrite 工具：黄色粗体
  todoread: ["Todo", UI.Style.TEXT_WARNING_BOLD], // TodoRead 工具：黄色粗体
  bash: ["Bash", UI.Style.TEXT_DANGER_BOLD], // Bash 工具：红色粗体
  edit: ["Edit", UI.Style.TEXT_SUCCESS_BOLD], // Edit 工具：绿色粗体
  glob: ["Glob", UI.Style.TEXT_INFO_BOLD], // Glob 工具：蓝色粗体
  grep: ["Grep", UI.Style.TEXT_INFO_BOLD], // Grep 工具：蓝色粗体
  list: ["List", UI.Style.TEXT_INFO_BOLD], // List 工具：蓝色粗体
  read: ["Read", UI.Style.TEXT_HIGHLIGHT_BOLD], // Read 工具：高亮粗体
  write: ["Write", UI.Style.TEXT_SUCCESS_BOLD], // Write 工具：绿色粗体
  websearch: ["Search", UI.Style.TEXT_DIM_BOLD], // WebSearch 工具：暗色粗体
}

/**
 * RunCommand 运行命令定义
 *
 * 功能说明：
 * - 定义 "run" 命令，用于运行 opencode 并发送消息或执行命令
 * - 支持多种运行模式：消息模式、命令模式、会话继续模式
 * - 支持文件附件、模型选择、智能体选择
 * - 支持会话共享和远程服务器连接
 * - 支持本地服务器启动和事件流处理
 * - 支持权限请求交互
 * - 支持 JSON 格式输出
 *
 * 使用场景：
 * - 需要向 opencode 发送消息并获取响应时
 * - 需要执行预定义命令时
 * - 需要继续之前的会话时
 * - 需要附加文件到消息时
 * - 需要使用特定模型或智能体时
 * - 需要共享会话时
 * - 需要连接到远程 opencode 服务器时
 *
 * 命令格式：
 * - opencode run <message>
 * - opencode run --command <command> <args>
 * - opencode run --continue
 * - opencode run --session <session-id>
 * - opencode run --model <provider/model>
 * - opencode run --agent <agent-name>
 * - opencode run --file <file-path>
 * - opencode run --share
 * - opencode run --attach <server-url>
 * - opencode run --port <port>
 * - opencode run --format json
 *
 * 参数说明：
 * - message（可选参数）：要发送的消息（可以是多个参数，会自动拼接）
 * - --command（可选选项）：要执行的命令，使用 message 作为参数
 * - --continue / -c（可选选项）：继续上一个会话
 * - --session / -s（可选选项）：要继续的会话 ID
 * - --share（可选选项）：共享会话
 * - --model / -m（可选选项）：要使用的模型（格式：provider/model）
 * - --agent（可选选项）：要使用的智能体
 * - --format（可选选项）：输出格式（default 或 json）
 * - --file / -f（可选选项）：要附加到消息的文件（可以是多个）
 * - --title（可选选项）：会话标题（如果未提供值，则使用截断的提示词）
 * - --attach（可选选项）：附加到正在运行的 opencode 服务器（例如：http://localhost:4096）
 * - --port（可选选项）：本地服务器的端口（如果未提供值，则使用随机端口）
 *
 * 工作流程：
 * 1. 解析命令行参数和消息
 * 2. 处理文件附件（如果指定）
 * 3. 从标准输入读取内容（如果有）
 * 4. 验证消息或命令是否提供
 * 5. 如果指定了 --attach，连接到远程服务器
 * 6. 否则启动本地服务器
 * 7. 获取或创建会话 ID
 * 8. 处理会话共享（如果需要）
 * 9. 执行命令或发送消息
 * 10. 处理事件流并显示输出
 * 11. 处理权限请求
 * 12. 停止服务器（如果是本地服务器）
 *
 * 事件处理：
 * - message.part.updated：消息部分更新事件
 *   - tool：工具使用完成事件
 *   - step-start：步骤开始事件
 *   - step-finish：步骤完成事件
 *   - text：文本输出事件
 * - session.error：会话错误事件
 * - session.idle：会话空闲事件
 * - permission.asked：权限请求事件
 *
 * 注意事项：
 * - 使用 Opencode SDK 与服务器通信
 * - 支持管道输入（从标准输入读取）
 * - 支持多种输出格式（默认格式或 JSON 格式）
 * - 工具输出会根据类型使用不同的颜色
 * - 权限请求会使用交互式选择提示
 * - 会话共享需要服务器支持
 * - 本地服务器默认使用随机端口
 */
export const RunCommand = cmd({
  // 导出运行命令定义
  command: "run [message..]", // 命令名称和位置参数
  describe: "使用消息运行 opencode", // 命令描述：使用消息运行 opencode
  builder: (yargs: Argv) => {
    // 命令构建器
    return yargs
      .positional("message", {
        // 定义位置参数 "message"
        describe: "要发送的消息", // 参数描述：要发送的消息
        type: "string", // 参数类型：字符串
        array: true, // 是否为数组：是
        default: [], // 默认值：空数组
      })
      .option("command", {
        // 定义选项 "command"
        describe: "要执行的命令，使用 message 作为参数", // 选项描述：要执行的命令，使用 message 作为参数
        type: "string", // 选项类型：字符串
      })
      .option("continue", {
        // 定义选项 "continue"
        alias: ["c"], // 别名：c
        describe: "继续上一个会话", // 选项描述：继续上一个会话
        type: "boolean", // 选项类型：布尔值
      })
      .option("session", {
        // 定义选项 "session"
        alias: ["s"], // 别名：s
        describe: "要继续的会话 ID", // 选项描述：要继续的会话 ID
        type: "string", // 选项类型：字符串
      })
      .option("share", {
        // 定义选项 "share"
        type: "boolean", // 选项类型：布尔值
        describe: "共享会话", // 选项描述：共享会话
      })
      .option("model", {
        // 定义选项 "model"
        type: "string", // 选项类型：字符串
        alias: ["m"], // 别名：m
        describe: "要使用的模型（格式：provider/model）", // 选项描述：要使用的模型（格式：provider/model）
      })
      .option("agent", {
        // 定义选项 "agent"
        type: "string", // 选项类型：字符串
        describe: "要使用的智能体", // 选项描述：要使用的智能体
      })
      .option("format", {
        // 定义选项 "format"
        type: "string", // 选项类型：字符串
        choices: ["default", "json"], // 可选值：default 或 json
        default: "default", // 默认值：default
        describe: "格式：default（格式化）或 json（原始 JSON 事件）", // 选项描述：格式：default（格式化）或 json（原始 JSON 事件）
      })
      .option("file", {
        // 定义选项 "file"
        alias: ["f"], // 别名：f
        type: "string", // 选项类型：字符串
        array: true, // 是否为数组：是
        describe: "要附加到消息的文件（可以是多个）", // 选项描述：要附加到消息的文件（可以是多个）
      })
      .option("title", {
        // 定义选项 "title"
        type: "string", // 选项类型：字符串
        describe: "会话标题（如果未提供值，则使用截断的提示词）", // 选项描述：会话标题（如果未提供值，则使用截断的提示词）
      })
      .option("attach", {
        // 定义选项 "attach"
        type: "string", // 选项类型：字符串
        describe: "附加到正在运行的 opencode 服务器（例如：http://localhost:4096）", // 选项描述：附加到正在运行的 opencode 服务器（例如：http://localhost:4096）
      })
      .option("port", {
        // 定义选项 "port"
        type: "number", // 选项类型：数字
        describe: "本地服务器的端口（如果未提供值，则使用随机端口）", // 选项描述：本地服务器的端口（如果未提供值，则使用随机端口）
      })
  },
  handler: async (args) => {
    // 命令处理函数，异步执行
    let message = [...args.message, ...(args["--"] || [])] // 合并消息参数和额外的参数
      .map((arg) => (arg.includes(" ") ? `"${arg.replace(/"/g, '\\"')}"` : arg)) // 如果参数包含空格，用引号包裹并转义内部引号
      .join(" ") // 用空格连接所有参数

    const fileParts: any[] = [] // 文件部分数组
    if (args.file) {
      // 如果指定了文件
      const files = Array.isArray(args.file) ? args.file : [args.file] // 将文件转换为数组

      for (const filePath of files) {
        // 遍历所有文件路径
        const resolvedPath = path.resolve(process.cwd(), filePath) // 解析为绝对路径
        const file = Bun.file(resolvedPath) // 获取文件对象
        const stats = await file.stat().catch(() => {}) // 获取文件统计信息（忽略错误）
        if (!stats) {
          // 如果文件不存在
          UI.error(`文件未找到: ${filePath}`) // 显示错误消息
          process.exit(1) // 退出程序
        }
        if (!(await file.exists())) {
          // 如果文件不存在
          UI.error(`文件未找到: ${filePath}`) // 显示错误消息
          process.exit(1) // 退出程序
        }

        const stat = await file.stat() // 获取文件统计信息
        const mime = stat.isDirectory() ? "application/x-directory" : "text/plain" // 判断 MIME 类型（目录或文本文件）

        fileParts.push({
          // 添加文件部分
          type: "file", // 类型：file
          url: `file://${resolvedPath}`, // 文件 URL
          filename: path.basename(resolvedPath), // 文件名
          mime, // MIME 类型
        })
      }
    }

    if (!process.stdin.isTTY) message += "\n" + (await Bun.stdin.text()) // 如果标准输入不是终端，从标准输入读取内容并追加到消息

    if (message.trim().length === 0 && !args.command) {
      // 如果消息为空且未指定命令
      UI.error("您必须提供消息或命令") // 显示错误消息
      process.exit(1) // 退出程序
    }

    const execute = async (sdk: OpencodeClient, sessionID: string) => {
      // 执行函数，使用 SDK 和会话 ID
      const printEvent = (color: string, type: string, title: string) => {
        // 打印事件函数
        UI.println(
          // 打印事件信息
          color + `|`, // 颜色和分隔符
          UI.Style.TEXT_NORMAL + UI.Style.TEXT_DIM + ` ${type.padEnd(7, " ")}`, // 类型（右对齐，7 个字符）
          "", // 空字符串
          UI.Style.TEXT_NORMAL + title, // 标题
        )
      }

      const outputJsonEvent = (type: string, data: any) => {
        // 输出 JSON 事件函数
        if (args.format === "json") {
          // 如果输出格式为 JSON
          process.stdout.write(JSON.stringify({ type, timestamp: Date.now(), sessionID, ...data }) + EOL) // 输出 JSON 格式的事件
          return true // 返回 true 表示已输出
        }
        return false // 返回 false 表示未输出
      }

      const events = await sdk.event.subscribe() // 订阅事件流
      let errorMsg: string | undefined // 错误消息（可选）

      const eventProcessor = (async () => {
        // 事件处理器（异步）
        for await (const event of events.stream) {
          // 遍历事件流
          if (event.type === "message.part.updated") {
            // 如果是消息部分更新事件
            const part = event.properties.part // 获取消息部分
            if (part.sessionID !== sessionID) continue // 如果不是当前会话，跳过

            if (part.type === "tool" && part.state.status === "completed") {
              // 如果是工具完成事件
              if (outputJsonEvent("tool_use", { part })) continue // 如果已输出 JSON 事件，跳过
              const [tool, color] = TOOL[part.tool] ?? [part.tool, UI.Style.TEXT_INFO_BOLD] // 获取工具名称和颜色（如果未定义，使用默认值）
              const title = // 获取标题
                part.state.title || // 如果有标题，使用标题
                (Object.keys(part.state.input).length > 0 ? JSON.stringify(part.state.input) : "未知") // 否则使用输入或"未知"
              printEvent(color, tool, title) // 打印事件
              if (part.tool === "bash" && part.state.output?.trim()) {
                // 如果是 Bash 工具且有输出
                UI.println() // 输出空行
                UI.println(part.state.output) // 输出 Bash 输出
              }
            }

            if (part.type === "step-start") {
              // 如果是步骤开始事件
              if (outputJsonEvent("step_start", { part })) continue // 如果已输出 JSON 事件，跳过
            }

            if (part.type === "step-finish") {
              // 如果是步骤完成事件
              if (outputJsonEvent("step_finish", { part })) continue // 如果已输出 JSON 事件，跳过
            }

            if (part.type === "text" && part.time?.end) {
              // 如果是文本输出事件且已完成
              if (outputJsonEvent("text", { part })) continue // 如果已输出 JSON 事件，跳过
              const isPiped = !process.stdout.isTTY // 判断是否为管道输出
              if (!isPiped) UI.println() // 如果不是管道输出，输出空行
              process.stdout.write((isPiped ? part.text : UI.markdown(part.text)) + EOL) // 输出文本（管道输出直接输出，否则使用 Markdown 渲染）
              if (!isPiped) UI.println() // 如果不是管道输出，输出空行
            }
          }

          if (event.type === "session.error") {
            // 如果是会话错误事件
            const props = event.properties // 获取事件属性
            if (props.sessionID !== sessionID || !props.error) continue // 如果不是当前会话或没有错误，跳过
            let err = String(props.error.name) // 获取错误名称
            if ("data" in props.error && props.error.data && "message" in props.error.data) {
              // 如果错误数据中有消息
              err = String(props.error.data.message) // 使用错误消息
            }
            errorMsg = errorMsg ? errorMsg + EOL + err : err // 追加错误消息
            if (outputJsonEvent("error", { error: props.error })) continue // 如果已输出 JSON 事件，跳过
            UI.error(err) // 显示错误消息
          }

          if (event.type === "session.idle" && event.properties.sessionID === sessionID) {
            // 如果是会话空闲事件且是当前会话
            break // 退出循环
          }

          if (event.type === "permission.asked") {
            // 如果是权限请求事件
            const permission = event.properties // 获取权限信息
            if (permission.sessionID !== sessionID) continue // 如果不是当前会话，跳过
            const result = await select({
              // 显示选择提示
              message: `需要权限: ${permission.permission} (${permission.patterns.join(", ")})`, // 提示消息
              options: [
                // 选项列表
                { value: "once", label: "允许一次" }, // 允许一次
                { value: "always", label: "总是允许: " + permission.always.join(", ") }, // 总是允许
                { value: "reject", label: "拒绝" }, // 拒绝
              ],
              initialValue: "once", // 初始值：允许一次
            }).catch(() => "reject") // 如果出错，返回拒绝
            const response = (result.toString().includes("cancel") ? "reject" : result) as "once" | "always" | "reject" // 处理响应（如果包含 cancel，则拒绝）
            await sdk.permission.respond({
              // 响应权限请求
              sessionID, // 会话 ID
              permissionID: permission.id, // 权限 ID
              response, // 响应
            })
          }
        }
      })() // 立即执行事件处理器

      // Validate agent if specified
      // 如果指定了智能体，验证智能体
      const resolvedAgent = await (async () => {
        // 解析智能体（异步）
        if (!args.agent) return undefined // 如果未指定智能体，返回 undefined
        const agent = await Agent.get(args.agent) // 获取智能体
        if (!agent) {
          // 如果智能体不存在
          UI.println(
            // 显示警告消息
            UI.Style.TEXT_WARNING_BOLD + "!", // 警告符号
            UI.Style.TEXT_NORMAL, // 恢复正常样式
            `未找到代理 "${args.agent}"。回退到默认代理`, // 警告消息
          )
          return undefined // 返回 undefined
        }
        if (agent.mode === "subagent") {
          // 如果智能体是子代理
          UI.println(
            // 显示警告消息
            UI.Style.TEXT_WARNING_BOLD + "!", // 警告符号
            UI.Style.TEXT_NORMAL, // 恢复正常样式
            `代理 "${args.agent}" 是子代理，不是主代理。回退到默认代理`, // 警告消息
          )
          return undefined // 返回 undefined
        }
        return args.agent // 返回智能体名称
      })()

      if (args.command) {
        // 如果指定了命令
        await sdk.session.command({
          // 执行命令
          sessionID, // 会话 ID
          agent: resolvedAgent, // 智能体
          model: args.model, // 模型
          command: args.command, // 命令
          arguments: message, // 参数
        })
      } else {
        // 否则发送消息
        const modelParam = args.model ? Provider.parseModel(args.model) : undefined // 解析模型参数（如果指定了模型）
        await sdk.session.prompt({
          // 发送消息
          sessionID, // 会话 ID
          agent: resolvedAgent, // 智能体
          model: modelParam, // 模型参数
          parts: [...fileParts, { type: "text", text: message }], // 消息部分（文件部分和文本部分）
        })
      }

      await eventProcessor // 等待事件处理器完成
      if (errorMsg) process.exit(1) // 如果有错误消息，退出程序
    }

    if (args.attach) {
      // 如果指定了附加到远程服务器
      const sdk = createOpencodeClient({ baseUrl: args.attach }) // 创建 Opencode 客户端（连接到远程服务器）

      const sessionID = await (async () => {
        // 获取会话 ID（异步）
        if (args.continue) {
          // 如果继续上一个会话
          const result = await sdk.session.list() // 获取会话列表
          return result.data?.find((s) => !s.parentID)?.id // 返回第一个没有父会话的会话 ID
        }
        if (args.session) return args.session // 如果指定了会话 ID，返回该 ID

        const title = // 计算会话标题
          args.title !== undefined // 如果指定了标题
            ? args.title === "" // 如果标题为空字符串
              ? message.slice(0, 50) + (message.length > 50 ? "..." : "") // 使用消息的前 50 个字符（如果超过 50 个字符，添加省略号）
              : args.title // 否则使用指定的标题
            : undefined // 否则为 undefined

        const result = await sdk.session.create(title ? { title } : {}) // 创建会话（如果有标题，则使用标题）
        return result.data?.id // 返回会话 ID
      })()

      if (!sessionID) {
        // 如果没有会话 ID
        UI.error("未找到会话") // 显示错误消息
        process.exit(1) // 退出程序
      }

      const cfgResult = await sdk.config.get() // 获取配置
      if (cfgResult.data && (cfgResult.data.share === "auto" || Flag.OPENCODE_AUTO_SHARE || args.share)) {
        // 如果配置中设置了自动共享或指定了共享
        const shareResult = await sdk.session.share({ sessionID }).catch((error) => {
          // 共享会话（捕获错误）
          if (error instanceof Error && error.message.includes("disabled")) {
            // 如果错误消息包含 "disabled"
            UI.println(UI.Style.TEXT_DANGER_BOLD + "!  " + error.message) // 显示错误消息
          }
          return { error } // 返回错误
        })
        if (!shareResult.error && "data" in shareResult && shareResult.data?.share?.url) {
          // 如果共享成功且有 URL
          UI.println(UI.Style.TEXT_INFO_BOLD + "~  " + shareResult.data.share.url) // 显示共享 URL
        }
      }

      return await execute(sdk, sessionID) // 执行命令
    }

    await bootstrap(process.cwd(), async () => {
      // 初始化应用环境（在当前目录中）
      const server = Server.listen({ port: args.port ?? 0, hostname: "127.0.0.1" }) // 启动本地服务器（如果未指定端口，则使用随机端口）
      const sdk = createOpencodeClient({ baseUrl: `http://${server.hostname}:${server.port}` }) // 创建 Opencode 客户端（连接到本地服务器）

      if (args.command) {
        // 如果指定了命令
        const exists = await Command.get(args.command) // 检查命令是否存在
        if (!exists) {
          // 如果命令不存在
          server.stop() // 停止服务器
          UI.error(`未找到命令 "${args.command}"`) // 显示错误消息
          process.exit(1) // 退出程序
        }
      }

      const sessionID = await (async () => {
        // 获取会话 ID（异步）
        if (args.continue) {
          // 如果继续上一个会话
          const result = await sdk.session.list() // 获取会话列表
          return result.data?.find((s) => !s.parentID)?.id // 返回第一个没有父会话的会话 ID
        }
        if (args.session) return args.session // 如果指定了会话 ID，返回该 ID

        const title = // 计算会话标题
          args.title !== undefined // 如果指定了标题
            ? args.title === "" // 如果标题为空字符串
              ? message.slice(0, 50) + (message.length > 50 ? "..." : "") // 使用消息的前 50 个字符（如果超过 50 个字符，添加省略号）
              : args.title // 否则使用指定的标题
            : undefined // 否则为 undefined

        const result = await sdk.session.create(title ? { title } : {}) // 创建会话（如果有标题，则使用标题）
        return result.data?.id // 返回会话 ID
      })()

      if (!sessionID) {
        // 如果没有会话 ID
        server.stop() // 停止服务器
        UI.error("未找到会话") // 显示错误消息
        process.exit(1) // 退出程序
      }

      const cfgResult = await sdk.config.get() // 获取配置
      if (cfgResult.data && (cfgResult.data.share === "auto" || Flag.OPENCODE_AUTO_SHARE || args.share)) {
        // 如果配置中设置了自动共享或指定了共享
        const shareResult = await sdk.session.share({ sessionID }).catch((error) => {
          // 共享会话（捕获错误）
          if (error instanceof Error && error.message.includes("disabled")) {
            // 如果错误消息包含 "disabled"
            UI.println(UI.Style.TEXT_DANGER_BOLD + "!  " + error.message) // 显示错误消息
          }
          return { error } // 返回错误
        })
        if (!shareResult.error && "data" in shareResult && shareResult.data?.share?.url) {
          // 如果共享成功且有 URL
          UI.println(UI.Style.TEXT_INFO_BOLD + "~  " + shareResult.data.share.url) // 显示共享 URL
        }
      }

      await execute(sdk, sessionID) // 执行命令
      server.stop() // 停止服务器
    })
  },
})
