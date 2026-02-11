import path from "path" // 导入路径处理模块
import z from "zod" // 导入zod库用于数据验证
import { Bus } from "../bus" // 导入总线
import { File } from "../file" // 导入文件模块
import { Log } from "../util/log" // 导入日志工具

import { mergeDeep } from "remeda" // 导入深度合并工具
import { Config } from "../config/config" // 导入配置
import { Instance } from "../project/instance" // 导入实例管理模块
import * as Formatter from "./formatter" // 导入格式化工具

export namespace Format {
  const log = Log.create({ service: "format" }) // 创建格式化服务日志记录器

  // 格式化工具状态schema
  export const Status = z
    .object({
      name: z.string(),
      extensions: z.string().array(),
      enabled: z.boolean(),
    })
    .meta({
      ref: "FormatterStatus",
    })
  export type Status = z.infer<typeof Status>

  // 格式化工具状态管理
  const state = Instance.state(async () => {
    const enabled: Record<string, boolean> = {}
    const cfg = await Config.get()

    const formatters: Record<string, Formatter.Info> = {}
    // 如果配置禁用了所有格式化工具
    if (cfg.formatter === false) {
      log.info("所有格式化工具已禁用")
      return {
        enabled,
        formatters,
      }
    }

    // 初始化所有格式化工具
    for (const item of Object.values(Formatter)) {
      formatters[item.name] = item
    }
    // 应用用户配置
    for (const [name, item] of Object.entries(cfg.formatter ?? {})) {
      if (item.disabled) {
        delete formatters[name]
        continue
      }
      const result: Formatter.Info = mergeDeep(formatters[name] ?? {}, {
        command: [],
        extensions: [],
        ...item,
      })

      if (result.command.length === 0) continue

      result.enabled = async () => true
      result.name = name
      formatters[name] = result
    }

    return {
      enabled,
      formatters,
    }
  })

  // 检查格式化工具是否启用
  async function isEnabled(item: Formatter.Info) {
    const s = await state()
    let status = s.enabled[item.name]
    if (status === undefined) {
      status = await item.enabled()
      s.enabled[item.name] = status
    }
    return status
  }

  // 根据文件扩展名获取可用的格式化工具
  async function getFormatter(ext: string) {
    const formatters = await state().then((x) => x.formatters)
    const result = []
    for (const item of Object.values(formatters)) {
      log.info("检查中", { name: item.name, ext })
      if (!item.extensions.includes(ext)) continue
      if (!(await isEnabled(item))) continue
      log.info("已启用", { name: item.name, ext })
      result.push(item)
    }
    return result
  }

  // 获取所有格式化工具的状态
  export async function status() {
    const s = await state()
    const result: Status[] = []
    for (const formatter of Object.values(s.formatters)) {
      const enabled = await isEnabled(formatter)
      result.push({
        name: formatter.name,
        extensions: formatter.extensions,
        enabled,
      })
    }
    return result
  }

  // 初始化格式化服务
  export function init() {
    log.info("初始化")
    Bus.subscribe(File.Event.Edited, async (payload) => {
      const file = payload.properties.file
      log.info("格式化中", { file })
      const ext = path.extname(file)

      for (const item of await getFormatter(ext)) {
        log.info("运行中", { command: item.command })
        try {
          const proc = Bun.spawn({
            cmd: item.command.map((x) => x.replace("$FILE", file)),
            cwd: Instance.directory,
            env: { ...process.env, ...item.environment },
            stdout: "ignore",
            stderr: "ignore",
          })
          const exit = await proc.exited
          if (exit !== 0)
            log.error("失败", {
              command: item.command,
              ...item.environment,
            })
        } catch (error) {
          log.error("格式化文件失败", {
            error,
            command: item.command,
            ...item.environment,
            file,
          })
        }
      }
    })
  }
}
