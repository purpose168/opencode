import { cmd } from "@/cli/cmd/cmd" // 导入命令创建工具，用于定义 CLI 命令
import { resolveNetworkOptions, withNetworkOptions } from "@/cli/network" // 导入网络选项处理工具，用于解析网络配置
import { UI } from "@/cli/ui" // 导入 UI 工具，用于显示错误信息
import { iife } from "@/util/iife" // 导入立即执行函数工具，用于异步初始化
import { Log } from "@/util/log" // 导入日志工具，用于记录错误信息
import { Rpc } from "@/util/rpc" // 导入 RPC 客户端，用于与 Worker 进程通信
import path from "path" // 导入路径处理模块，用于解析文件路径
import { tui } from "./app" // 导入 TUI 应用入口函数
import { type rpc } from "./worker" // 导入 Worker RPC 类型定义

declare global {
  // 声明全局变量
  const OPENCODE_WORKER_PATH: string // OpenCode Worker 路径常量
}

/**
 * TuiThreadCommand TUI 线程命令定义
 *
 * 功能说明：
 * - 定义默认命令（$0），用于启动 OpenCode TUI 界面
 * - 使用 Worker 进程处理服务器逻辑，避免阻塞主线程
 * - 支持指定项目路径作为工作目录
 * - 支持网络选项配置（如端口、主机等）
 * - 支持指定模型、代理、会话 ID、提示内容等参数
 * - 支持继续上次会话或指定会话 ID
 * - 支持从标准输入读取提示内容（管道输入）
 * - 自动检查升级（延迟 1 秒后执行）
 * - 捕获未处理的异常和 Promise 拒绝
 * - TUI 退出时自动关闭 Worker 和服务器
 *
 * 使用场景：
 * - 需要启动 OpenCode TUI 界面时
 * - 需要在指定项目中启动 OpenCode 时
 * - 需要配置模型、代理等参数时
 * - 需要继续上次会话或指定会话时
 * - 需要通过管道输入提示内容时
 * - 需要使用 Worker 进程处理服务器逻辑时
 *
 * 命令格式：
 * - opencode [project] [--model <model>] [--continue] [--session <session-id>] [--prompt <prompt>] [--agent <agent>]
 * - 示例：opencode ~/my-project --model openai/gpt-4 --continue
 *
 * 参数说明：
 * - project: 项目路径（可选参数），用于指定启动 OpenCode 的工作目录
 * - model: 模型（可选参数），格式为 provider/model，别名为 -m
 * - continue: 继续上次会话（可选布尔参数），别名为 -c
 * - session: 会话 ID（可选参数），用于继续指定会话，别名为 -s
 * - prompt: 提示内容（可选参数），用于设置初始提示
 * - agent: 代理（可选参数），用于指定使用的代理
 * - 网络选项：--port（端口号）、--host（主机地址）等
 *
 * 工作流程：
 * 1. 解析项目路径（考虑 --cwd 标志）
 * 2. 确定 Worker 文件路径（优先使用全局变量，其次使用编译后的文件，最后使用源文件）
 * 3. 切换到工作目录
 * 4. 启动 Worker 进程
 * 5. 设置错误处理和日志记录
 * 6. 通过 RPC 调用 Worker 启动服务器
 * 7. 解析提示内容（管道输入或命令参数）
 * 8. 启动 TUI 界面并连接到服务器
 * 9. 延迟 1 秒后检查升级
 * 10. 等待 TUI 退出
 * 11. 关闭 Worker 和服务器
 *
 * 注意事项：
 * - 使用 Worker 进程处理服务器逻辑，避免阻塞主线程
 * - Worker 文件路径优先级：全局变量 > 编译后的文件 > 源文件
 * - 管道输入和命令参数提示可以组合使用
 * - 捕获未处理的异常和 Promise 拒绝并记录日志
 * - TUI 退出时自动关闭 Worker 和服务器
 * - 检查升级延迟 1 秒，避免影响启动速度
 */
export const TuiThreadCommand = cmd({
  // 导出 TUI 线程命令定义
  command: "$0 [project]", // 命令名称和参数格式（$0 表示默认命令）
  describe: "启动 OpenCode TUI 界面", // 命令描述：启动 OpenCode TUI 界面
  builder: (
    yargs, // 命令构建器，用于定义命令参数和选项
  ) =>
    withNetworkOptions(yargs) // 添加网络选项
      .positional("project", {
        // 定义位置参数 project
        type: "string", // 参数类型为字符串
        describe: "启动 OpenCode 的路径", // 参数描述：启动 OpenCode 的路径
      })
      .option("model", {
        // 定义选项 model
        type: "string", // 选项类型为字符串
        alias: ["m"], // 选项别名为 -m
        describe: "要使用的模型，格式为 provider/model", // 选项描述：要使用的模型，格式为 provider/model
      })
      .option("continue", {
        // 定义选项 continue
        alias: ["c"], // 选项别名为 -c
        describe: "继续上次会话", // 选项描述：继续上次会话
        type: "boolean", // 选项类型为布尔值
      })
      .option("session", {
        // 定义选项 session
        alias: ["s"], // 选项别名为 -s
        type: "string", // 选项类型为字符串
        describe: "要继续的会话 ID", // 选项描述：要继续的会话 ID
      })
      .option("prompt", {
        // 定义选项 prompt
        type: "string", // 选项类型为字符串
        describe: "要使用的提示内容", // 选项描述：要使用的提示内容
      })
      .option("agent", {
        // 定义选项 agent
        type: "string", // 选项类型为字符串
        describe: "要使用的代理", // 选项描述：要使用的代理
      }),
  handler: async (args) => {
    // 命令处理函数，异步执行
    // 解析相对路径，考虑 PWD 环境变量以保持 --cwd 标志的行为
    const baseCwd = process.env.PWD ?? process.cwd() // 获取基础工作目录（优先使用 PWD 环境变量）
    const cwd = args.project ? path.resolve(baseCwd, args.project) : process.cwd() // 解析项目路径（如果指定）或使用当前目录

    const localWorker = new URL("./worker.ts", import.meta.url) // 本地 Worker 文件路径（TypeScript 源文件）
    const distWorker = new URL("./cli/cmd/tui/worker.js", import.meta.url) // 编译后的 Worker 文件路径（JavaScript 文件）

    const workerPath = await iife(async () => {
      // 使用立即执行函数确定 Worker 文件路径
      if (typeof OPENCODE_WORKER_PATH !== "undefined") return OPENCODE_WORKER_PATH // 如果定义了全局变量，使用全局变量
      if (await Bun.file(distWorker).exists()) return distWorker // 如果编译后的文件存在，使用编译后的文件
      return localWorker // 否则使用本地源文件
    })

    try {
      // 尝试切换到工作目录
      process.chdir(cwd) // 切换到工作目录
    } catch (e) {
      // 捕获错误
      UI.error("无法切换到目录 " + cwd) // 显示错误信息
      return // 退出命令处理
    }

    const worker = new Worker(workerPath, {
      // 创建 Worker 进程
      env: Object.fromEntries(
        // 过滤环境变量，移除 undefined 值
        Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
      ),
    })

    worker.onerror = (e) => {
      // 设置 Worker 错误处理
      Log.Default.error(e) // 记录错误日志
    }

    const client = Rpc.client<typeof rpc>(worker) // 创建 RPC 客户端，用于与 Worker 通信

    process.on("uncaughtException", (e) => {
      // 监听未捕获的异常
      Log.Default.error(e) // 记录错误日志
    })

    process.on("unhandledRejection", (e) => {
      // 监听未处理的 Promise 拒绝
      Log.Default.error(e) // 记录错误日志
    })

    const opts = await resolveNetworkOptions(args) // 解析网络选项（端口、主机等）

    const server = await client.call("server", opts) // 通过 RPC 调用 Worker 的 server 方法启动服务器

    const prompt = await iife(async () => {
      // 使用立即执行函数解析提示内容
      const piped = !process.stdin.isTTY ? await Bun.stdin.text() : undefined // 如果不是 TTY，读取标准输入内容（管道输入）
      if (!args.prompt) return piped // 如果没有指定提示参数，返回管道输入
      return piped ? piped + "\n" + args.prompt : args.prompt // 组合管道输入和命令参数提示
    })

    const tuiPromise = tui({
      // 启动 TUI 应用
      url: server.url, // 服务器 URL
      args: {
        // TUI 参数
        continue: args.continue, // 是否继续上次会话
        sessionID: args.session, // 会话 ID
        agent: args.agent, // 代理
        model: args.model, // 模型
        prompt, // 提示内容
      },
      onExit: async () => {
        // TUI 退出回调
        await client.call("shutdown", undefined) // 通过 RPC 调用 Worker 的 shutdown 方法关闭服务器
      },
    })

    setTimeout(() => {
      // 延迟执行升级检查
      client.call("checkUpgrade", { directory: cwd }).catch(() => {}) // 通过 RPC 调用 Worker 的 checkUpgrade 方法检查升级，忽略错误
    }, 1000) // 延迟 1 秒

    await tuiPromise // 等待 TUI 退出
  },
})
