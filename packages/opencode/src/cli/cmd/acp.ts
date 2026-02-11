import { ACP } from "@/acp/agent" // 导入 ACP 代理模块，用于创建代理实例
import { Server } from "@/server/server" // 导入服务器模块，用于创建和管理 HTTP 服务器
import { Log } from "@/util/log" // 导入日志工具，用于记录运行时信息
import { AgentSideConnection, ndJsonStream } from "@agentclientprotocol/sdk" // 导入 ACP SDK，用于创建代理客户端协议连接和流处理
import { createOpencodeClient } from "@opencode-ai/sdk/v2" // 导入 OpenCode SDK，用于创建客户端
import { bootstrap } from "../bootstrap" // 导入引导函数，用于初始化应用环境
import { resolveNetworkOptions, withNetworkOptions } from "../network" // 导入网络选项处理工具，用于解析网络配置
import { cmd } from "./cmd" // 导入命令创建工具，用于定义 CLI 命令

const log = Log.create({ service: "acp-command" }) // 创建日志记录器，服务名称为 "acp-command"

/**
 * AcpCommand ACP 命令定义
 *
 * 功能说明：
 * - 定义 "acp" 命令，用于启动 ACP（Agent Client Protocol）服务器
 * - 支持指定工作目录作为运行环境
 * - 支持网络选项配置（如端口、主机等）
 * - 通过标准输入/输出与代理客户端协议进行通信
 * - 使用 NDJSON（Newline Delimited JSON）格式进行数据传输
 * - 集成 OpenCode SDK 与服务器进行交互
 *
 * 使用场景：
 * - 需要启动 ACP 服务器时
 * - 需要通过标准输入/输出与代理通信时
 * - 需要使用 Agent Client Protocol 时
 * - 需要在指定的工作目录中运行 ACP 时
 *
 * 命令格式：
 * - opencode acp [--cwd <directory>] [--port <port>] [--host <host>]
 * - 示例：opencode acp --cwd ~/project --port 4096
 *
 * 参数说明：
 * - cwd: 工作目录（可选参数），默认为当前目录
 * - 网络选项：--port（端口号）、--host（主机地址）等
 *
 * 工作流程：
 * 1. 解析命令行参数和工作目录
 * 2. 初始化应用环境（引导）
 * 3. 解析网络选项（端口、主机等）
 * 4. 启动 HTTP 服务器
 * 5. 创建 OpenCode SDK 客户端
 * 6. 创建标准输出流（WritableStream）
 * 7. 创建标准输入流（ReadableStream）
 * 8. 创建 NDJSON 流处理
 * 9. 初始化 ACP 代理
 * 10. 创建代理客户端协议连接
 * 11. 恢复标准输入并等待连接结束
 *
 * 注意事项：
 * - 使用标准输入/输出进行通信，适合管道操作
 * - 使用 NDJSON 格式进行数据传输
 * - 代理通过 OpenCode SDK 与服务器交互
 * - 连接建立后会记录日志
 * - 标准输入结束时命令会退出
 */
export const AcpCommand = cmd({
  // 导出 ACP 命令定义
  command: "acp", // 命令名称
  describe: "启动 ACP（Agent Client Protocol）服务器", // 命令描述：启动 ACP（Agent Client Protocol）服务器
  builder: (yargs) => {
    // 命令构建器，用于定义命令参数和选项
    return withNetworkOptions(yargs) // 添加网络选项
      .option("cwd", {
        // 定义选项 cwd
        describe: "工作目录", // 选项描述：工作目录
        type: "string", // 选项类型为字符串
        default: process.cwd(), // 选项默认值为当前工作目录
      })
  },
  handler: async (args) => {
    // 命令处理函数，异步执行
    await bootstrap(process.cwd(), async () => {
      // 初始化应用环境，在当前目录中执行
      const opts = await resolveNetworkOptions(args) // 解析网络选项（端口、主机等）
      const server = Server.listen(opts) // 启动 HTTP 服务器，传入网络配置

      const sdk = createOpencodeClient({
        // 创建 OpenCode SDK 客户端
        baseUrl: `http://${server.hostname}:${server.port}`, // 设置服务器基础 URL
      })

      const input = new WritableStream<Uint8Array>({
        // 创建标准输出流（可写流），用于向标准输出写入数据
        write(chunk) {
          // 定义写入方法
          return new Promise<void>((resolve, reject) => {
            // 返回 Promise，支持异步写入
            process.stdout.write(chunk, (err) => {
              // 将数据块写入标准输出
              if (err) {
                // 如果发生错误
                reject(err) // 拒绝 Promise
              } else {
                // 如果成功
                resolve() // 解决 Promise
              }
            })
          })
        },
      })
      const output = new ReadableStream<Uint8Array>({
        // 创建标准输入流（可读流），用于从标准输入读取数据
        start(controller) {
          // 定义启动方法
          process.stdin.on("data", (chunk: Buffer) => {
            // 监听标准输入数据事件
            controller.enqueue(new Uint8Array(chunk)) // 将数据块转换为 Uint8Array 并加入队列
          })
          process.stdin.on("end", () => controller.close()) // 监听标准输入结束事件，关闭流
          process.stdin.on("error", (err) => controller.error(err)) // 监听标准输入错误事件，传递错误
        },
      })

      const stream = ndJsonStream(input, output) // 创建 NDJSON 流处理，用于解析和序列化 JSON 数据
      const agent = await ACP.init({ sdk }) // 初始化 ACP 代理，传入 SDK 客户端

      new AgentSideConnection((conn) => {
        // 创建代理客户端协议连接
        return agent.create(conn, { sdk }) // 创建代理实例，传入连接和 SDK
      }, stream) // 传入 NDJSON 流

      log.info("setup connection") // 记录信息日志，标记连接已建立
      process.stdin.resume() // 恢复标准输入，开始读取数据
      await new Promise((resolve, reject) => {
        // 创建 Promise，等待连接结束
        process.stdin.on("end", resolve) // 监听标准输入结束事件，解决 Promise
        process.stdin.on("error", reject) // 监听标准输入错误事件，拒绝 Promise
      })
    })
  },
})
