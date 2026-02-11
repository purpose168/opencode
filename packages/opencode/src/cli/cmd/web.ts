import open from "open" // 导入打开浏览器工具
import { networkInterfaces } from "os" // 导入操作系统网络接口工具
import { Server } from "../../server/server" // 导入服务器模块
import { resolveNetworkOptions, withNetworkOptions } from "../network" // 导入网络选项工具
import { UI } from "../ui" // 导入UI工具
import { cmd } from "./cmd" // 导入命令工具

// 获取网络IP地址
function getNetworkIPs() {
  const nets = networkInterfaces() // 获取所有网络接口
  const results: string[] = [] // 存储结果IP地址

  for (const name of Object.keys(nets)) {
    const net = nets[name]
    if (!net) continue

    for (const netInfo of net) {
      // 跳过内部地址和非IPv4地址
      if (netInfo.internal || netInfo.family !== "IPv4") continue

      // 跳过Docker桥接网络(通常是172.x.x.x)
      if (netInfo.address.startsWith("172.")) continue

      results.push(netInfo.address)
    }
  }

  return results
}

// Web命令定义
export const WebCommand = cmd({
  command: "web", // 命令名称
  builder: (yargs) => withNetworkOptions(yargs), // 命令参数构建器
  describe: "启动无头模式的OpenCode服务器", // 命令描述
  // 命令处理函数
  handler: async (args) => {
    const opts = await resolveNetworkOptions(args) // 解析网络选项
    const server = Server.listen(opts) // 启动服务器
    UI.empty() // 清空UI
    UI.println(UI.logo("  ")) // 打印logo
    UI.empty() // 清空UI

    if (opts.hostname === "0.0.0.0") {
      // 显示本地访问地址
      const localhostUrl = `http://localhost:${server.port}`
      UI.println(UI.Style.TEXT_INFO_BOLD + "  本地访问:         ", UI.Style.TEXT_NORMAL, localhostUrl)

      // 显示网络IP地址用于远程访问
      const networkIPs = getNetworkIPs()
      if (networkIPs.length > 0) {
        for (const ip of networkIPs) {
          UI.println(
            UI.Style.TEXT_INFO_BOLD + "  网络访问:         ",
            UI.Style.TEXT_NORMAL,
            `http://${ip}:${server.port}`,
          )
        }
      }

      if (opts.mdns) {
        UI.println(UI.Style.TEXT_INFO_BOLD + "  mDNS:              ", UI.Style.TEXT_NORMAL, "opencode.local")
      }

      // 在浏览器中打开本地地址
      open(localhostUrl.toString()).catch(() => {})
    } else {
      const displayUrl = server.url.toString()
      UI.println(UI.Style.TEXT_INFO_BOLD + "  Web界面:          ", UI.Style.TEXT_NORMAL, displayUrl)
      open(displayUrl).catch(() => {})
    }

    await new Promise(() => {}) // 保持服务器运行
    await server.stop() // 停止服务器
  },
})
