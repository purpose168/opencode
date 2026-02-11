import { Server } from "../../server/server" // 导入服务器模块
import { resolveNetworkOptions, withNetworkOptions } from "../network" // 导入网络选项工具
import { cmd } from "./cmd" // 导入命令创建工具

/**
 * ServeCommand 服务命令定义
 *
 * 功能说明：
 * - 定义 "serve" 命令，用于启动无头（headless）opencode 服务器
 * - 支持自定义主机名和端口
 * - 支持绑定到特定网络接口
 * - 服务器启动后会持续运行，直到手动停止
 *
 * 使用场景：
 * - 需要在后台运行 opencode 服务器时
 * - 需要远程访问 opencode 服务器时
 * - 需要自定义服务器监听地址时
 * - 需要将 opencode 作为服务运行时
 *
 * 命令格式：
 * - opencode serve
 * - opencode serve --port 4096
 * - opencode serve --host 0.0.0.0
 * - opencode serve --port 8080 --host 0.0.0.0
 *
 * 参数说明：
 * - --port（可选选项）：服务器监听端口（默认值由网络选项决定）
 * - --host（可选选项）：服务器监听主机名（默认值由网络选项决定）
 *
 * 工作流程：
 * 1. 解析网络选项（主机名和端口）
 * 2. 启动服务器
 * 3. 显示服务器监听地址
 * 4. 持续运行（永不退出的 Promise）
 * 5. 等待服务器停止
 *
 * 注意事项：
 * - 服务器启动后会持续运行，直到手动停止（Ctrl+C）
 * - 默认使用随机端口或配置文件中指定的端口
 * - 默认绑定到 127.0.0.1（仅本地访问）
 * - 如需远程访问，需要使用 --host 0.0.0.0
 * - 无头模式意味着没有 TUI（终端用户界面）
 */
export const ServeCommand = cmd({
  // 导出服务命令定义
  command: "serve", // 命令名称
  builder: (yargs) => withNetworkOptions(yargs), // 命令构建器：添加网络选项
  describe: "启动无头 opencode 服务器", // 命令描述：启动无头 opencode 服务器
  handler: async (args) => {
    // 命令处理函数，异步执行
    const opts = await resolveNetworkOptions(args) // 解析网络选项（主机名和端口）
    const server = Server.listen(opts) // 启动服务器
    console.log(`opencode 服务器正在监听 http://${server.hostname}:${server.port}`) // 显示服务器监听地址
    await new Promise(() => {}) // 永不退出的 Promise（保持服务器运行）
    await server.stop() // 停止服务器（实际上不会执行到这里）
  },
})
