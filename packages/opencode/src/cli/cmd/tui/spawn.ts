import { cmd } from "@/cli/cmd/cmd" // 导入命令创建工具，用于定义 CLI 命令
import { resolveNetworkOptions, withNetworkOptions } from "@/cli/network" // 导入网络选项处理工具，用于解析网络配置
import { upgrade } from "@/cli/upgrade" // 导入升级模块，用于检查和执行升级
import { Instance } from "@/project/instance" // 导入实例管理模块，用于清理实例资源
import { Server } from "@/server/server" // 导入服务器模块，用于启动和停止服务器
import path from "path" // 导入路径处理模块，用于解析文件路径

/**
 * TuiSpawnCommand TUI 启动命令定义
 *
 * 功能说明：
 * - 定义 "spawn" 命令，用于启动 OpenCode 服务器并附加到 TUI 界面
 * - 自动检查并执行升级（如果有新版本）
 * - 启动 OpenCode 服务器并监听网络请求
 * - 在新的进程中启动 TUI 界面并连接到服务器
 * - 支持指定项目路径作为工作目录
 * - 支持网络选项配置（如端口、主机等）
 * - 服务器和 TUI 进程退出时自动清理资源
 *
 * 使用场景：
 * - 需要启动 OpenCode 服务器和 TUI 界面时
 * - 需要在指定项目中启动 OpenCode 时
 * - 需要配置网络选项（如端口、主机）时
 * - 需要在开发环境中启动 OpenCode 时
 *
 * 命令格式：
 * - opencode spawn [project] [--port <port>] [--host <host>]
 * - 示例：opencode spawn ~/my-project --port 4096
 *
 * 参数说明：
 * - project: 项目路径（可选参数），用于指定启动 OpenCode 的工作目录
 * - 网络选项：--port（端口号）、--host（主机地址）等
 *
 * 工作流程：
 * 1. 检查并执行升级（如果有新版本）
 * 2. 解析网络选项（端口、主机等）
 * 3. 启动 OpenCode 服务器并监听请求
 * 4. 在新进程中启动 TUI 界面并连接到服务器
 * 5. 等待 TUI 进程退出
 * 6. 清理所有实例资源
 * 7. 停止服务器
 *
 * 注意事项：
 * - 使用 Bun.spawn 启动子进程
 * - 如果使用 Bun 运行，使用 "bun run" 命令启动
 * - 如果使用其他运行时（如 Node.js），直接使用可执行文件
 * - 子进程继承标准输入、输出和错误
 * - 清空 BUN_OPTIONS 环境变量以避免冲突
 * - 进程退出时自动清理资源
 */
export const TuiSpawnCommand = cmd({
  // 导出 TUI 启动命令定义
  command: "spawn [project]", // 命令名称和参数格式
  builder: (
    yargs, // 命令构建器，用于定义命令参数和选项
  ) =>
    withNetworkOptions(yargs).positional("project", {
      // 添加网络选项并定义位置参数 project
      type: "string", // 参数类型为字符串
      describe: "path to start opencode in", // 参数描述：启动 OpenCode 的路径
    }),
  handler: async (args) => {
    // 命令处理函数，异步执行
    upgrade() // 检查并执行升级（如果有新版本）
    const opts = await resolveNetworkOptions(args) // 解析网络选项（端口、主机等）
    const server = Server.listen(opts) // 启动 OpenCode 服务器并监听请求
    const bin = process.execPath // 获取当前可执行文件路径
    const cmd = [] // 初始化命令数组
    let cwd = process.cwd() // 初始化工作目录为当前目录

    if (bin.endsWith("bun")) {
      // 如果使用 Bun 运行
      cmd.push(
        // 添加 Bun 运行命令
        process.execPath, // Bun 可执行文件路径
        "run", // run 命令
        "--conditions", // 条件选项
        "browser", // 浏览器条件
        new URL("../../../index.ts", import.meta.url).pathname, // TUI 入口文件路径（相对于当前文件）
      )
      cwd = new URL("../../../../", import.meta.url).pathname // 设置工作目录为项目根目录
    } else cmd.push(process.execPath) // 如果使用其他运行时（如 Node.js），直接使用可执行文件

    cmd.push(
      // 添加 attach 命令参数
      "attach", // attach 命令
      server.url.toString(), // 服务器 URL
      "--dir", // 目录选项
      args.project ? path.resolve(args.project) : process.cwd(), // 项目路径（如果指定）或当前目录
    )

    const proc = Bun.spawn({
      // 启动子进程
      cmd, // 命令数组
      cwd, // 工作目录
      stdout: "inherit", // 继承标准输出
      stderr: "inherit", // 继承标准错误
      stdin: "inherit", // 继承标准输入
      env: {
        // 环境变量
        ...process.env, // 继承当前进程的环境变量
        BUN_OPTIONS: "", // 清空 BUN_OPTIONS 环境变量以避免冲突
      },
    })

    await proc.exited // 等待子进程退出
    await Instance.disposeAll() // 清理所有实例资源
    await server.stop(true) // 停止服务器（true 表示强制停止）
  },
})
