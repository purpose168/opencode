/**
 * 应用程序更新模块
 * 负责检查、下载和安装 OpenCode 的更新
 */

import { check } from "@tauri-apps/plugin-updater"
import { relaunch } from "@tauri-apps/plugin-process"
import { ask, message } from "@tauri-apps/plugin-dialog"
import { invoke } from "@tauri-apps/api/core"
import { type as ostype } from "@tauri-apps/plugin-os"

/**
 * 更新功能是否启用
 * 从全局配置中读取，默认为 false
 */
export const UPDATER_ENABLED = window.__OPENCODE__?.updaterEnabled ?? false

/**
 * 运行更新检查和安装流程
 * @param alertOnFail 是否在失败时显示警报
 */
export async function runUpdater({ alertOnFail }: { alertOnFail: boolean }) {
  let update
  try {
    // 检查是否有可用更新
    update = await check()
  } catch {
    // 检查更新失败时显示错误信息
    if (alertOnFail) await message("检查更新失败", { title: "更新检查失败" })
    return
  }

  if (!update) {
    // 没有可用更新时显示信息
    if (alertOnFail)
      await message("您已经在使用最新版本的 OpenCode", { title: "无可用更新" })
    return
  }

  try {
    // 下载更新
    await update.download()
  } catch {
    // 下载更新失败时显示错误信息
    if (alertOnFail) await message("下载更新失败", { title: "更新失败" })
    return
  }

  // 询问用户是否安装更新
  const shouldUpdate = await ask(
    `OpenCode ${update.version} 版本已下载完成，是否要安装并重启应用？`,
    { title: "更新已下载" },
  )
  if (!shouldUpdate) return

  try {
    // 在 Windows 平台上，先终止 sidecar 进程
    if (ostype() === "windows") await invoke("kill_sidecar")
    // 安装更新
    await update.install()
  } catch {
    // 安装更新失败时显示错误信息
    await message("安装更新失败", { title: "更新失败" })
    return
  }

  // 终止 sidecar 进程并重启应用
  await invoke("kill_sidecar")
  await relaunch()
}
