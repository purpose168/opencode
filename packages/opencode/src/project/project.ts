import { BusEvent } from "@/bus/bus-event"
import { GlobalBus } from "@/bus/global"
import { Flag } from "@/flag/flag"
import { iife } from "@/util/iife"
import { fn } from "@opencode-ai/util/fn"
import { $ } from "bun"
import path from "path"
import z from "zod"
import { Session } from "../session"
import { Storage } from "../storage/storage"
import { Filesystem } from "../util/filesystem"
import { Log } from "../util/log"
import { work } from "../util/queue"

export namespace Project {
  const log = Log.create({ service: "project" })

  // 项目信息Schema定义
  // 包含项目的所有元数据和配置信息
  export const Info = z
    .object({
      id: z.string(), // 项目唯一标识符
      worktree: z.string(), // 工作树路径
      vcs: z.literal("git").optional(), // 版本控制系统类型(可选)
      name: z.string().optional(), // 项目名称(可选)
      icon: z
        .object({
          url: z.string().optional(), // 图标URL(可选)
          color: z.string().optional(), // 图标颜色(可选)
        })
        .optional(), // 图标信息(可选)
      time: z.object({
        created: z.number(), // 创建时间戳
        updated: z.number(), // 更新时间戳
        initialized: z.number().optional(), // 初始化时间戳(可选)
      }),
    })
    .meta({
      ref: "Project",
    })
  export type Info = z.infer<typeof Info>

  // 项目事件定义
  export const Event = {
    Updated: BusEvent.define("project.updated", Info), // 项目更新事件
  }

  // 从目录创建项目信息
  // 通过扫描目录结构和Git仓库信息来构建项目对象
  export async function fromDirectory(directory: string) {
    log.info("从目录加载项目", { directory })

    // 使用IIFE获取项目ID、工作树和版本控制信息
    const { id, worktree, vcs } = await iife(async () => {
      // 向上搜索.git目录以确定Git仓库位置
      const matches = Filesystem.up({ targets: [".git"], start: directory })
      const git = await matches.next().then((x) => x.value)
      await matches.return()
      if (git) {
        // 找到Git仓库
        let worktree = path.dirname(git)
        // 尝试从.git/opencode文件读取项目ID
        let id = await Bun.file(path.join(git, "opencode"))
          .text()
          .then((x) => x.trim())
          .catch(() => {})
        if (!id) {
          // 如果没有opencode文件,使用Git根提交哈希作为项目ID
          const roots = await $`git rev-list --max-parents=0 --all`
            .quiet()
            .nothrow()
            .cwd(worktree)
            .text()
            .then((x) =>
              x
                .split("\n")
                .filter(Boolean)
                .map((x) => x.trim())
                .toSorted(),
            )
          id = roots[0]
          if (id) Bun.file(path.join(git, "opencode")).write(id)
        }
        if (!id)
          // 如果无法确定项目ID,使用全局项目
          return {
            id: "global",
            worktree,
            vcs: "git",
          }
        // 获取Git工作树根目录
        worktree = await $`git rev-parse --show-toplevel`
          .quiet()
          .nothrow()
          .cwd(worktree)
          .text()
          .then((x) => path.resolve(worktree, x.trim()))
        return { id, worktree, vcs: "git" }
      }

      // 没有找到Git仓库,返回全局项目
      return {
        id: "global",
        worktree: "/",
        vcs: Info.shape.vcs.parse(Flag.OPENCODE_FAKE_VCS),
      }
    })

    // 尝试从存储中读取现有项目信息
    let existing = await Storage.read<Info>(["project", id]).catch(() => undefined)
    if (!existing) {
      // 创建新的项目信息
      existing = {
        id,
        worktree,
        vcs: vcs as Info["vcs"],
        time: {
          created: Date.now(),
          updated: Date.now(),
        },
      }
      // 如果不是全局项目,从全局项目迁移会话
      if (id !== "global") {
        await migrateFromGlobal(id, worktree)
      }
    }
    // 如果启用了实验性图标发现功能,尝试发现项目图标
    if (Flag.OPENCODE_EXPERIMENTAL_ICON_DISCOVERY) discover(existing)
    // 构建最终的项目信息
    const result: Info = {
      ...existing,
      worktree,
      vcs: vcs as Info["vcs"],
      time: {
        ...existing.time,
        updated: Date.now(),
      },
    }
    // 保存项目信息到存储
    await Storage.write<Info>(["project", id], result)
    // 发送项目更新事件
    GlobalBus.emit("event", {
      payload: {
        type: Event.Updated.type,
        properties: result,
      },
    })
    return result
  }

  // 发现项目图标
  // 在项目工作树中搜索favicon文件并转换为base64编码
  export async function discover(input: Info) {
    // 只处理Git项目
    if (input.vcs !== "git") return
    // 如果已有图标URL,跳过
    if (input.icon?.url) return
    // 搜索favicon文件(支持多种格式)
    const glob = new Bun.Glob("**/{favicon}.{ico,png,svg,jpg,jpeg,webp}")
    const matches = await Array.fromAsync(
      glob.scan({
        cwd: input.worktree,
        absolute: true,
        onlyFiles: true,
        followSymlinks: false,
        dot: false,
      }),
    )
    // 选择路径最短的favicon文件
    const shortest = matches.sort((a, b) => a.length - b.length)[0]
    if (!shortest) return
    // 读取文件并转换为base64编码
    const file = Bun.file(shortest)
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString("base64")
    const mime = file.type || "image/png"
    const url = `data:${mime};base64,${base64}`
    // 更新项目图标
    await update({
      projectID: input.id,
      icon: {
        url,
      },
    })
    return
  }

  // 从全局项目迁移会话
  // 将属于新项目的会话从全局项目迁移到新项目
  async function migrateFromGlobal(newProjectID: string, worktree: string) {
    // 读取全局项目信息
    const globalProject = await Storage.read<Info>(["project", "global"]).catch(() => undefined)
    if (!globalProject) return

    // 列出全局项目的所有会话
    const globalSessions = await Storage.list(["session", "global"]).catch(() => [])
    if (globalSessions.length === 0) return

    log.info("正在从全局项目迁移会话", { newProjectID, worktree, count: globalSessions.length })

    // 使用工作队列迁移会话(并发数为10)
    await work(10, globalSessions, async (key) => {
      const sessionID = key[key.length - 1]
      const session = await Storage.read<Session.Info>(key).catch(() => undefined)
      if (!session) return
      // 只迁移属于新项目工作树的会话
      if (session.directory && session.directory !== worktree) return

      // 更新会话的项目ID
      session.projectID = newProjectID
      log.info("正在迁移会话", { sessionID, from: "global", to: newProjectID })
      // 将会话写入新项目
      await Storage.write(["session", newProjectID, sessionID], session)
      // 从全局项目删除会话
      await Storage.remove(key)
    }).catch((error) => {
      log.error("从全局项目迁移会话到项目失败", { error, projectId: newProjectID })
    })
  }

  // 设置项目已初始化状态
  // 记录项目初始化完成的时间戳
  export async function setInitialized(projectID: string) {
    await Storage.update<Info>(["project", projectID], (draft) => {
      draft.time.initialized = Date.now()
    })
  }

  // 列出所有项目
  // 从存储中读取所有项目信息
  export async function list() {
    const keys = await Storage.list(["project"])
    return await Promise.all(keys.map((x) => Storage.read<Info>(x)))
  }

  // 更新项目信息
  // 支持更新项目名称和图标
  export const update = fn(
    z.object({
      projectID: z.string(), // 项目ID
      name: z.string().optional(), // 项目名称(可选)
      icon: Info.shape.icon.optional(), // 图标信息(可选)
    }),
    async (input) => {
      // 更新项目信息
      const result = await Storage.update<Info>(["project", input.projectID], (draft) => {
        if (input.name !== undefined) draft.name = input.name
        if (input.icon !== undefined) {
          draft.icon = {
            ...draft.icon,
          }
          if (input.icon.url !== undefined) draft.icon.url = input.icon.url
          if (input.icon.color !== undefined) draft.icon.color = input.icon.color
        }
        draft.time.updated = Date.now()
      })
      // 发送项目更新事件
      GlobalBus.emit("event", {
        payload: {
          type: Event.Updated.type,
          properties: result,
        },
      })
      return result
    },
  )
}
