import z from "zod"
import { Global } from "../global"
import { Log } from "../util/log"
import path from "path"
import { NamedError } from "@opencode-ai/util/error"
import { readableStreamToText } from "bun"
import { createRequire } from "module"
import { Lock } from "../util/lock"

/**
 * Bun 进程管理模块
 * 提供运行 Bun 命令和安装依赖包的功能
 */
export namespace BunProc {
  const log = Log.create({ service: "bun" })
  const req = createRequire(import.meta.url)

  /**
   * 运行 Bun 命令
   * @param cmd 命令参数数组
   * @param options 运行选项
   * @returns 命令执行结果
   * @throws 当命令执行失败时抛出错误
   */
  export async function run(cmd: string[], options?: Bun.SpawnOptions.OptionsObject<any, any, any>) {
    log.info("正在运行命令", {
      cmd: [which(), ...cmd],
      ...options,
    })
    const result = Bun.spawn([which(), ...cmd], {
      ...options,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        ...options?.env,
        BUN_BE_BUN: "1",
      },
    })
    const code = await result.exited
    const stdout = result.stdout
      ? typeof result.stdout === "number"
        ? result.stdout
        : await readableStreamToText(result.stdout)
      : undefined
    const stderr = result.stderr
      ? typeof result.stderr === "number"
        ? result.stderr
        : await readableStreamToText(result.stderr)
      : undefined
    log.info("命令执行完成", {
      code,
      stdout,
      stderr,
    })
    if (code !== 0) {
      throw new Error(`命令执行失败，退出码：${result.exitCode}`)
    }
    return result
  }

  /**
   * 获取当前 Bun 可执行文件路径
   * @returns Bun 可执行文件路径
   */
  export function which() {
    return process.execPath
  }

  /**
   * 安装失败错误
   * 当包安装失败时抛出的错误类型
   */
  export const InstallFailedError = NamedError.create(
    "BunInstallFailedError",
    z.object({
      pkg: z.string(), // 包名
      version: z.string(), // 版本号
    }),
  )

  /**
   * 安装 NPM 包
   * @param pkg 包名
   * @param version 版本号，默认为 "latest"
   * @returns 安装后的模块路径
   * @throws 当安装失败时抛出 InstallFailedError
   */
  export async function install(pkg: string, version = "latest") {
    // 使用锁确保同一时间只有一个安装操作
    using _ = await Lock.write("bun-install")

    const mod = path.join(Global.Path.cache, "node_modules", pkg)
    const pkgjson = Bun.file(path.join(Global.Path.cache, "package.json"))
    const parsed = await pkgjson.json().catch(async () => {
      const result = { dependencies: {} }
      await Bun.write(pkgjson.name!, JSON.stringify(result, null, 2))
      return result
    })
    if (parsed.dependencies[pkg] === version) return mod

    const proxied = !!(process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.https_proxy)

    // 构建命令参数
    const args = [
      "add",
      "--force",
      "--exact",
      // TODO: 移除这个条件（参见：https://github.com/oven-sh/bun/issues/19936）
      ...(proxied ? ["--no-cache"] : []),
      "--cwd",
      Global.Path.cache,
      pkg + "@" + version,
    ]

    // 让 Bun 处理注册表解析：
    // - 如果存在 .npmrc 文件，Bun 会自动使用它们
    // - 如果不存在 .npmrc 文件，Bun 会默认使用 https://registry.npmjs.org
    // - 不需要传递 --registry 标志
    log.info("使用 Bun 的默认注册表解析安装包", {
      pkg,
      version,
    })

    await BunProc.run(args, {
      cwd: Global.Path.cache,
    }).catch((e) => {
      throw new InstallFailedError(
        { pkg, version },
        {
          cause: e,
        },
      )
    })

    // 当使用 "latest" 时，从已安装的包中解析实际版本
    // 这样可以确保后续启动使用缓存的版本，直到显式更新
    let resolvedVersion = version
    if (version === "latest") {
      const installedPkgJson = Bun.file(path.join(mod, "package.json"))
      const installedPkg = await installedPkgJson.json().catch(() => null)
      if (installedPkg?.version) {
        resolvedVersion = installedPkg.version
      }
    }

    parsed.dependencies[pkg] = resolvedVersion
    await Bun.write(pkgjson.name!, JSON.stringify(parsed, null, 2))
    return mod
  }
}
