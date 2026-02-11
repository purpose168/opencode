import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { FileWatcher } from "@/file/watcher"
import { Log } from "@/util/log"
import { $ } from "bun"
import z from "zod"
import { Instance } from "./instance"

const log = Log.create({ service: "vcs" })

export namespace Vcs {
  // VCS事件定义
  export const Event = {
    // 分支更新事件
    BranchUpdated: BusEvent.define(
      "vcs.branch.updated",
      z.object({
        branch: z.string().optional(), // 分支名称(可选)
      }),
    ),
  }

  // VCS信息Schema定义
  export const Info = z
    .object({
      branch: z.string(), // 分支名称
    })
    .meta({
      ref: "VcsInfo",
    })
  export type Info = z.infer<typeof Info>

  // 获取当前Git分支
  // 使用git rev-parse命令获取当前分支名称
  async function currentBranch() {
    return $`git rev-parse --abbrev-ref HEAD`
      .quiet()
      .nothrow()
      .cwd(Instance.worktree)
      .text()
      .then((x) => x.trim())
      .catch(() => undefined)
  }

  // VCS状态管理
  // 跟踪当前Git分支并在分支变化时发送事件
  const state = Instance.state(
    async () => {
      // 如果项目不使用Git,返回空状态
      if (Instance.project.vcs !== "git") {
        return { branch: async () => undefined, unsubscribe: undefined }
      }
      // 获取当前分支
      let current = await currentBranch()
      log.info("已初始化", { branch: current })

      // 订阅文件更新事件,检测HEAD文件变化
      const unsubscribe = Bus.subscribe(FileWatcher.Event.Updated, async (evt) => {
        // 忽略HEAD文件本身的变化
        if (evt.properties.file.endsWith("HEAD")) return
        // 获取新的分支
        const next = await currentBranch()
        // 如果分支发生变化
        if (next !== current) {
          log.info("分支已更改", { from: current, to: next })
          current = next
          // 发布分支更新事件
          Bus.publish(Event.BranchUpdated, { branch: next })
        }
      })

      return {
        // 返回当前分支的函数
        branch: async () => current,
        // 取消订阅的函数
        unsubscribe,
      }
    },
    // 销毁函数:取消文件更新事件订阅
    async (state) => {
      state.unsubscribe?.()
    },
  )

  // 初始化VCS状态
  export async function init() {
    return state()
  }

  // 获取当前分支
  export async function branch() {
    return await state().then((s) => s.branch())
  }
}
