import { Bus } from "@/bus" // 导入事件总线
import { Config } from "@/config/config" // 导入配置模块
import { Flag } from "@/flag/flag" // 导入标志模块
import { Installation } from "@/installation" // 导入安装管理模块

// 升级函数
export async function upgrade() {
  const config = await Config.global() // 获取全局配置
  const method = await Installation.method() // 获取安装方法
  const latest = await Installation.latest(method).catch(() => {}) // 获取最新版本
  if (!latest) return // 如果没有最新版本,直接返回
  if (Installation.VERSION === latest) return // 如果已是最新版本,直接返回

  if (config.autoupdate === false || Flag.OPENCODE_DISABLE_AUTOUPDATE) {
    return // 如果禁用自动更新,直接返回
  }
  if (config.autoupdate === "notify") {
    await Bus.publish(Installation.Event.UpdateAvailable, { version: latest }) // 发布更新可用事件
    return
  }

  if (method === "unknown") return // 如果安装方法未知,直接返回
  await Installation.upgrade(method, latest) // 执行升级
    .then(() => Bus.publish(Installation.Event.Updated, { version: latest })) // 发布更新完成事件
    .catch(() => {}) // 忽略错误
}
