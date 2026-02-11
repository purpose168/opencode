import { Log } from "@/util/log" // 导入日志工具模块
import { Bonjour } from "bonjour-service" // 导入Bonjour服务库，用于mDNS服务发现

const log = Log.create({ service: "mdns" }) // 创建mdns服务的日志记录器

export namespace MDNS {
  // mDNS(Multicast DNS，多播DNS)服务命名空间
  let bonjour: Bonjour | undefined // Bonjour服务实例
  let currentPort: number | undefined // 当前发布的端口号

  export function publish(port: number, name = "opencode") {
    // 发布mDNS服务
    if (currentPort === port) return // 如果端口未变化，直接返回
    if (bonjour) unpublish() // 如果已有服务实例，先取消发布

    try {
      bonjour = new Bonjour() // 创建Bonjour实例
      const service = bonjour.publish({
        // 发布服务到本地网络
        name, // 服务名称
        type: "http", // 服务类型
        port, // 服务端口
        txt: { path: "/" }, // TXT记录，包含服务路径信息
      })

      service.on("up", () => {
        // 监听服务启动成功事件
        log.info("mDNS服务已发布", { name, port })
      })

      service.on("error", (err) => {
        // 监听服务错误事件
        log.error("mDNS服务错误", { error: err })
      })

      currentPort = port // 更新当前端口
    } catch (err) {
      // 捕获发布过程中的异常
      log.error("mDNS服务发布失败", { error: err })
      if (bonjour) {
        // 如果Bonjour实例存在，尝试清理
        try {
          bonjour.destroy() // 销毁Bonjour实例
        } catch {} // 忽略销毁过程中的错误
      }
      bonjour = undefined // 重置Bonjour实例
      currentPort = undefined // 重置当前端口
    }
  }

  export function unpublish() {
    // 取消发布mDNS服务
    if (bonjour) {
      // 如果Bonjour实例存在
      try {
        bonjour.unpublishAll() // 取消所有已发布的服务
        bonjour.destroy() // 销毁Bonjour实例
      } catch (err) {
        // 捕获取消发布过程中的异常
        log.error("mDNS服务取消发布失败", { error: err })
      }
      bonjour = undefined // 重置Bonjour实例
      currentPort = undefined // 重置当前端口
      log.info("mDNS服务已取消发布")
    }
  }
}
