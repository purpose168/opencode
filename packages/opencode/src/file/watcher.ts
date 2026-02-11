import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import z from "zod"
import { Instance } from "../project/instance"
import { Log } from "../util/log"
import { FileIgnore } from "./ignore"
import { Config } from "../config/config"
import path from "path"
// @ts-ignore
import { createWrapper } from "@parcel/watcher/wrapper"
import { lazy } from "@/util/lazy"
import { withTimeout } from "@/util/timeout"
import type ParcelWatcher from "@parcel/watcher"
import { $ } from "bun"
import { Flag } from "@/flag/flag"
import { readdir } from "fs/promises"

const SUBSCRIBE_TIMEOUT_MS = 10_000 // 订阅超时时间(毫秒)

declare const OPENCODE_LIBC: string | undefined // 声明libc类型常量

export namespace FileWatcher {
  const log = Log.create({ service: "file.watcher" }) // 创建文件监视器服务日志记录器

  // 文件监视器事件定义
  export const Event = {
    Updated: BusEvent.define(
      "file.watcher.updated",
      z.object({
        file: z.string(),
        event: z.union([z.literal("add"), z.literal("change"), z.literal("unlink")]),
      }),
    ),
  }

  // 文件监视器(懒加载)
  const watcher = lazy(() => {
    const binding = require(
      `@parcel/watcher-${process.platform}-${process.arch}${process.platform === "linux" ? `-${OPENCODE_LIBC || "glibc"}` : ""}`,
    )
    return createWrapper(binding) as typeof import("@parcel/watcher")
  })

  // 文件监视器状态管理
  const state = Instance.state(
    async () => {
      // 如果不是git项目,不启动监视器
      if (Instance.project.vcs !== "git") return {}
      log.info("初始化")
      const cfg = await Config.get()
      // 根据平台选择后端
      const backend = (() => {
        if (process.platform === "win32") return "windows"
        if (process.platform === "darwin") return "fs-events"
        if (process.platform === "linux") return "inotify"
      })()
      if (!backend) {
        log.error("监视器后端不支持", { platform: process.platform })
        return {}
      }
      log.info("监视器后端", { platform: process.platform, backend })

      // 订阅回调函数
      const subscribe: ParcelWatcher.SubscribeCallback = (err, evts) => {
        if (err) return
        for (const evt of evts) {
          if (evt.type === "create") Bus.publish(Event.Updated, { file: evt.path, event: "add" })
          if (evt.type === "update") Bus.publish(Event.Updated, { file: evt.path, event: "change" })
          if (evt.type === "delete") Bus.publish(Event.Updated, { file: evt.path, event: "unlink" })
        }
      }

      const subs: ParcelWatcher.AsyncSubscription[] = []
      const cfgIgnores = cfg.watcher?.ignore ?? []

      // 订阅项目目录
      if (Flag.OPENCODE_EXPERIMENTAL_FILEWATCHER) {
        const pending = watcher().subscribe(Instance.directory, subscribe, {
          ignore: [...FileIgnore.PATTERNS, ...cfgIgnores],
          backend,
        })
        const sub = await withTimeout(pending, SUBSCRIBE_TIMEOUT_MS).catch((err) => {
          log.error("订阅Instance.directory失败", { error: err })
          pending.then((s) => s.unsubscribe()).catch(() => {})
          return undefined
        })
        if (sub) subs.push(sub)
      }

      // 订阅git目录
      const vcsDir = await $`git rev-parse --git-dir`
        .quiet()
        .nothrow()
        .cwd(Instance.worktree)
        .text()
        .then((x) => path.resolve(Instance.worktree, x.trim()))
      if (vcsDir && !cfgIgnores.includes(".git") && !cfgIgnores.includes(vcsDir)) {
        const gitDirContents = await readdir(vcsDir).catch(() => [])
        const ignoreList = gitDirContents.filter((entry) => entry !== "HEAD")
        const pending = watcher().subscribe(vcsDir, subscribe, {
          ignore: ignoreList,
          backend,
        })
        const sub = await withTimeout(pending, SUBSCRIBE_TIMEOUT_MS).catch((err) => {
          log.error("订阅vcsDir失败", { error: err })
          pending.then((s) => s.unsubscribe()).catch(() => {})
          return undefined
        })
        if (sub) subs.push(sub)
      }

      return { subs }
    },
    // 清理函数
    async (state) => {
      if (!state.subs) return
      await Promise.all(state.subs.map((sub) => sub?.unsubscribe()))
    },
  )

  // 初始化文件监视器
  export function init() {
    if (Flag.OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER) {
      return
    }
    state()
  }
}
