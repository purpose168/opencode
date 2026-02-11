// @refresh reload
import { render } from "solid-js/web"
import { App, PlatformProvider, Platform } from "@opencode-ai/app"
import { open, save } from "@tauri-apps/plugin-dialog"
import { open as shellOpen } from "@tauri-apps/plugin-shell"
import { type as ostype } from "@tauri-apps/plugin-os"
import { AsyncStorage } from "@solid-primitives/storage"
import { fetch as tauriFetch } from "@tauri-apps/plugin-http"
import { Store } from "@tauri-apps/plugin-store"

import { UPDATER_ENABLED } from "./updater"
import { createMenu } from "./menu"
import { check, Update } from "@tauri-apps/plugin-updater"
import { invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification"
import { relaunch } from "@tauri-apps/plugin-process"
import pkg from "../package.json"

/**
 * 桌面应用主入口
 * 使用 Tauri 和 Solid.js 构建的 OpenCode 桌面应用
 */

// 获取根元素
const root = document.getElementById("root")
// 开发环境下检查根元素是否存在
if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    "未找到根元素。您是否忘记将其添加到 index.html？或者 id 属性拼写错误？",
  )
}

// 更新对象，用于存储下载的更新
let update: Update | null = null

/**
 * 平台配置对象
 * 实现了 Platform 接口，提供了桌面应用所需的各种功能
 */
const platform: Platform = {
  platform: "tauri",
  version: pkg.version,

  /**
   * 打开目录选择对话框
   * @param opts 选项配置
   * @returns 选择的目录路径或路径数组
   */
  async openDirectoryPickerDialog(opts) {
    const result = await open({
      directory: true,
      multiple: opts?.multiple ?? false,
      title: opts?.title ?? "选择文件夹",
    })
    return result
  },

  /**
   * 打开文件选择对话框
   * @param opts 选项配置
   * @returns 选择的文件路径或路径数组
   */
  async openFilePickerDialog(opts) {
    const result = await open({
      directory: false,
      multiple: opts?.multiple ?? false,
      title: opts?.title ?? "选择文件",
    })
    return result
  },

  /**
   * 打开保存文件对话框
   * @param opts 选项配置
   * @returns 保存的文件路径
   */
  async saveFilePickerDialog(opts) {
    const result = await save({
      title: opts?.title ?? "保存文件",
      defaultPath: opts?.defaultPath,
    })
    return result
  },

  /**
   * 打开链接
   * @param url 要打开的 URL
   */
  openLink(url: string) {
    void shellOpen(url).catch(() => undefined)
  },

  /**
   * 存储接口
   * @param name 存储文件名，默认为 "default.dat"
   * @returns 异步存储接口
   */
  storage: (name = "default.dat") => {
    /**
     * 存储接口类型
     */
    type StoreLike = {
      get(key: string): Promise<string | null | undefined>
      set(key: string, value: string): Promise<unknown>
      delete(key: string): Promise<unknown>
      clear(): Promise<unknown>
      keys(): Promise<string[]>
      length(): Promise<number>
    }

    /**
     * 创建内存存储
     * 当无法加载文件存储时使用
     */
    const memory = () => {
      const data = new Map<string, string>()
      const store: StoreLike = {
        get: async (key) => data.get(key),
        set: async (key, value) => {
          data.set(key, value)
        },
        delete: async (key) => {
          data.delete(key)
        },
        clear: async () => {
          data.clear()
        },
        keys: async () => Array.from(data.keys()),
        length: async () => data.size,
      }
      return store
    }

    /**
     * 存储 API 实现
     * 结合了文件存储和内存存储的实现
     */
    const api: AsyncStorage & { _store: Promise<StoreLike> | null; _getStore: () => Promise<StoreLike> } = {
      _store: null,
      /**
       * 获取存储实例
       * 如果尚未初始化，则初始化存储
       */
      _getStore: async () => {
        if (api._store) return api._store
        api._store = Store.load(name).catch(() => memory())
        return api._store
      },
      /**
       * 获取存储项
       * @param key 键名
       * @returns 存储的值或 null
       */
      getItem: async (key: string) => {
        const store = await api._getStore()
        const value = await store.get(key).catch(() => null)
        if (value === undefined) return null
        return value
      },
      /**
       * 设置存储项
       * @param key 键名
       * @param value 值
       */
      setItem: async (key: string, value: string) => {
        const store = await api._getStore()
        await store.set(key, value).catch(() => undefined)
      },
      /**
       * 移除存储项
       * @param key 键名
       */
      removeItem: async (key: string) => {
        const store = await api._getStore()
        await store.delete(key).catch(() => undefined)
      },
      /**
       * 清空存储
       */
      clear: async () => {
        const store = await api._getStore()
        await store.clear().catch(() => undefined)
      },
      /**
       * 获取指定索引的键名
       * @param index 索引
       * @returns 键名或 undefined
       */
      key: async (index: number) => {
        const store = await api._getStore()
        return (await store.keys().catch(() => []))[index]
      },
      /**
       * 获取存储项数量
       * @returns 存储项数量
       */
      getLength: async () => {
        const store = await api._getStore()
        return await store.length().catch(() => 0)
      },
      /**
       * 存储项数量属性
       */
      get length() {
        return api.getLength()
      },
    }
    return api
  },

  /**
   * 检查更新
   * @returns 更新信息对象
   */
  checkUpdate: async () => {
    if (!UPDATER_ENABLED) return { updateAvailable: false }
    const next = await check().catch(() => null)
    if (!next) return { updateAvailable: false }
    const ok = await next
      .download()
      .then(() => true)
      .catch(() => false)
    if (!ok) return { updateAvailable: false }
    update = next
    return { updateAvailable: true, version: next.version }
  },

  /**
   * 安装更新
   */
  update: async () => {
    if (!UPDATER_ENABLED || !update) return
    if (ostype() === "windows") await invoke("kill_sidecar").catch(() => undefined)
    await update.install().catch(() => undefined)
  },

  /**
   * 重启应用
   */
  restart: async () => {
    await invoke("kill_sidecar").catch(() => undefined)
    await relaunch()
  },

  /**
   * 发送通知
   * @param title 通知标题
   * @param description 通知描述
   * @param href 点击通知后跳转的链接
   */
  notify: async (title, description, href) => {
    const granted = await isPermissionGranted().catch(() => false)
    const permission = granted ? "granted" : await requestPermission().catch(() => "denied")
    if (permission !== "granted") return

    const win = getCurrentWindow()
    const focused = await win.isFocused().catch(() => document.hasFocus())
    if (focused) return

    await Promise.resolve()
      .then(() => {
        const notification = new Notification(title, {
          body: description ?? "",
          icon: "https://opencode.ai/favicon-96x96.png",
        })
        notification.onclick = () => {
          const win = getCurrentWindow()
          void win.show().catch(() => undefined)
          void win.unminimize().catch(() => undefined)
          void win.setFocus().catch(() => undefined)
          if (href) {
            window.history.pushState(null, "", href)
            window.dispatchEvent(new PopStateEvent("popstate"))
          }
          notification.close()
        }
      })
      .catch(() => undefined)
  },

  // @ts-expect-error 类型检查忽略
  fetch: tauriFetch,
}

// 创建应用菜单
createMenu()

// 阻止鼠标滚轮事件传递到 Tauri 的捏合缩放处理程序
root?.addEventListener("mousewheel", (e) => {
  e.stopPropagation()
})

// 渲染应用
render(() => {
  return (
    <PlatformProvider value={platform}>
      {/* macOS 平台添加拖拽区域 */}
      {ostype() === "macos" && (
        <div class="bg-background-base border-b border-border-weak-base h-8" data-tauri-drag-region />
      )}
      <App />
    </PlatformProvider>
  )
}, root!)
