import { $, readableStreamToText } from "bun" // 导入Bun工具
import { spawn, type ChildProcessWithoutNullStreams } from "child_process" // 导入子进程生成器
import fs from "fs/promises" // 导入文件系统Promise API
import os from "os" // 导入操作系统工具模块
import path from "path" // 导入路径处理模块
import { BunProc } from "../bun" // 导入Bun进程工具
import { Flag } from "../flag/flag" // 导入标志配置
import { Global } from "../global" // 导入全局配置
import { Instance } from "../project/instance" // 导入实例管理模块
import { Archive } from "../util/archive" // 导入归档工具
import { Filesystem } from "../util/filesystem" // 导入文件系统工具
import { Log } from "../util/log" // 导入日志工具

export namespace LSPServer {
  const log = Log.create({ service: "lsp.server" }) // 创建LSP服务器服务日志记录器

  export interface Handle {
    process: ChildProcessWithoutNullStreams // 子进程
    initialization?: Record<string, any> // 初始化选项
  }

  type RootFunction = (file: string) => Promise<string | undefined> // 根目录函数类型

  // 查找最近的根目录
  const NearestRoot = (includePatterns: string[], excludePatterns?: string[]): RootFunction => {
    return async (file) => {
      // 如果有排除模式,先检查是否被排除
      if (excludePatterns) {
        const excludedFiles = Filesystem.up({
          targets: excludePatterns,
          start: path.dirname(file),
          stop: Instance.directory,
        })
        const excluded = await excludedFiles.next()
        await excludedFiles.return()
        if (excluded.value) return undefined
      }
      // 向上查找包含指定文件的目录
      const files = Filesystem.up({
        targets: includePatterns,
        start: path.dirname(file),
        stop: Instance.directory,
      })
      const first = await files.next()
      await files.return()
      if (!first.value) return Instance.directory
      return path.dirname(first.value)
    }
  }

  export interface Info {
    id: string // 服务器ID
    extensions: string[] // 支持的文件扩展名
    global?: boolean // 是否为全局服务器
    root: RootFunction // 根目录函数
    spawn(root: string): Promise<Handle | undefined> // 生成服务器进程
  }

  // Deno LSP服务器
  export const Deno: Info = {
    id: "deno",
    root: async (file) => {
      // 查找deno配置文件
      const files = Filesystem.up({
        targets: ["deno.json", "deno.jsonc"],
        start: path.dirname(file),
        stop: Instance.directory,
      })
      const first = await files.next()
      await files.return()
      if (!first.value) return undefined
      return path.dirname(first.value)
    },
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs"], // 支持的扩展名
    async spawn(root) {
      const deno = Bun.which("deno") // 查找deno可执行文件
      if (!deno) {
        log.info("未找到deno,请先安装deno")
        return
      }
      return {
        process: spawn(deno, ["lsp"], {
          // 启动deno LSP服务器
          cwd: root,
        }),
      }
    },
  }

  // TypeScript LSP服务器
  export const Typescript: Info = {
    id: "typescript",
    root: NearestRoot(
      ["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"], // 包管理器锁定文件
      ["deno.json", "deno.jsonc"], // 排除deno配置文件
    ),
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"], // 支持的扩展名
    async spawn(root) {
      const tsserver = await Bun.resolve("typescript/lib/tsserver.js", Instance.directory).catch(() => {}) // 解析tsserver路径
      log.info("TypeScript服务器", { tsserver })
      if (!tsserver) return
      const proc = spawn(BunProc.which(), ["x", "typescript-language-server", "--stdio"], {
        // 启动TypeScript语言服务器
        cwd: root,
        env: {
          ...process.env,
          BUN_BE_BUN: "1", // 使用Bun运行时
        },
      })
      return {
        process: proc,
        initialization: {
          tsserver: {
            path: tsserver,
          },
        },
      }
    },
  }

  // Vue LSP服务器
  export const Vue: Info = {
    id: "vue",
    extensions: [".vue"], // 支持的扩展名
    root: NearestRoot(["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"]), // 包管理器锁定文件
    async spawn(root) {
      let binary = Bun.which("vue-language-server") // 查找vue-language-server可执行文件
      const args: string[] = []
      if (!binary) {
        // 尝试使用本地安装的版本
        const js = path.join(
          Global.Path.bin,
          "node_modules",
          "@vue",
          "language-server",
          "bin",
          "vue-language-server.js",
        )
        if (!(await Bun.file(js).exists())) {
          // 如果不存在,尝试安装
          if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
          await Bun.spawn([BunProc.which(), "install", "@vue/language-server"], {
            // 安装Vue语言服务器
            cwd: Global.Path.bin,
            env: {
              ...process.env,
              BUN_BE_BUN: "1",
            },
            stdout: "pipe",
            stderr: "pipe",
            stdin: "pipe",
          }).exited
        }
        binary = BunProc.which()
        args.push("run", js)
      }
      args.push("--stdio")
      const proc = spawn(binary, args, {
        // 启动Vue语言服务器
        cwd: root,
        env: {
          ...process.env,
          BUN_BE_BUN: "1",
        },
      })
      return {
        process: proc,
        initialization: {
          // 留空,服务器将自动检测工作区TypeScript
        },
      }
    },
  }

  // ESLint LSP服务器
  export const ESLint: Info = {
    id: "eslint",
    root: NearestRoot(["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"]), // 包管理器锁定文件
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".vue"], // 支持的扩展名
    async spawn(root) {
      const eslint = await Bun.resolve("eslint", Instance.directory).catch(() => {}) // 解析eslint路径
      if (!eslint) return
      log.info("启动ESLint服务器")
      const serverPath = path.join(Global.Path.bin, "vscode-eslint", "server", "out", "eslintServer.js")
      if (!(await Bun.file(serverPath).exists())) {
        // 如果服务器不存在,尝试下载和构建
        if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
        log.info("下载并构建VS Code ESLint服务器")
        const response = await fetch("https://github.com/microsoft/vscode-eslint/archive/refs/heads/main.zip") // 下载VS Code ESLint服务器
        if (!response.ok) return

        const zipPath = path.join(Global.Path.bin, "vscode-eslint.zip")
        await Bun.file(zipPath).write(response)

        // 解压zip文件
        const ok = await Archive.extractZip(zipPath, Global.Path.bin)
          .then(() => true)
          .catch((error) => {
            log.error("解压vscode-eslint归档文件失败", { error })
            return false
          })
        if (!ok) return
        await fs.rm(zipPath, { force: true })

        const extractedPath = path.join(Global.Path.bin, "vscode-eslint-main")
        const finalPath = path.join(Global.Path.bin, "vscode-eslint")

        // 移除旧安装
        const stats = await fs.stat(finalPath).catch(() => undefined)
        if (stats) {
          log.info("移除旧的ESLint安装", { path: finalPath })
          await fs.rm(finalPath, { force: true, recursive: true })
        }
        await fs.rename(extractedPath, finalPath)

        // 安装依赖并编译
        const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm"
        await $`${npmCmd} install`.cwd(finalPath).quiet()
        await $`${npmCmd} run compile`.cwd(finalPath).quiet()

        log.info("已安装VS Code ESLint服务器", { serverPath })
      }

      const proc = spawn(BunProc.which(), [serverPath, "--stdio"], {
        // 启动ESLint服务器
        cwd: root,
        env: {
          ...process.env,
          BUN_BE_BUN: "1",
        },
      })

      return {
        process: proc,
      }
    },
  }

  // Oxlint LSP服务器
  export const Oxlint: Info = {
    id: "oxlint",
    root: NearestRoot([
      ".oxlintrc.json", // Oxlint配置文件
      "package-lock.json",
      "bun.lockb",
      "bun.lock",
      "pnpm-lock.yaml",
      "yarn.lock",
      "package.json",
    ]),
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".vue", ".astro", ".svelte"], // 支持的扩展名
    async spawn(root) {
      const ext = process.platform === "win32" ? ".cmd" : "" // Windows平台使用.cmd扩展名

      const serverTarget = path.join("node_modules", ".bin", "oxc_language_server" + ext)
      const lintTarget = path.join("node_modules", ".bin", "oxlint" + ext)

      // 解析二进制文件路径
      const resolveBin = async (target: string) => {
        const localBin = path.join(root, target)
        if (await Bun.file(localBin).exists()) return localBin

        // 向上查找二进制文件
        const candidates = Filesystem.up({
          targets: [target],
          start: root,
          stop: Instance.worktree,
        })
        const first = await candidates.next()
        await candidates.return()
        if (first.value) return first.value

        return undefined
      }

      // 尝试查找oxlint
      let lintBin = await resolveBin(lintTarget)
      if (!lintBin) {
        const found = Bun.which("oxlint")
        if (found) lintBin = found
      }

      // 检查oxlint是否支持LSP
      if (lintBin) {
        const proc = Bun.spawn([lintBin, "--help"], { stdout: "pipe" })
        await proc.exited
        const help = await readableStreamToText(proc.stdout)
        if (help.includes("--lsp")) {
          return {
            process: spawn(lintBin, ["--lsp"], {
              // 启动oxlint LSP服务器
              cwd: root,
            }),
          }
        }
      }

      // 尝试查找oxc_language_server
      let serverBin = await resolveBin(serverTarget)
      if (!serverBin) {
        const found = Bun.which("oxc_language_server")
        if (found) serverBin = found
      }
      if (serverBin) {
        return {
          process: spawn(serverBin, [], {
            // 启动oxc语言服务器
            cwd: root,
          }),
        }
      }

      log.info("未找到oxlint,请先安装oxlint")
      return
    },
  }

  // Biome LSP服务器
  export const Biome: Info = {
    id: "biome",
    root: NearestRoot([
      "biome.json", // Biome配置文件
      "biome.jsonc",
      "package-lock.json",
      "bun.lockb",
      "bun.lock",
      "pnpm-lock.yaml",
      "yarn.lock",
    ]),
    extensions: [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".mjs",
      ".cjs",
      ".mts",
      ".cts",
      ".json",
      ".jsonc",
      ".vue",
      ".astro",
      ".svelte",
      ".css",
      ".graphql",
      ".gql",
      ".html",
    ], // 支持的扩展名
    async spawn(root) {
      const localBin = path.join(root, "node_modules", ".bin", "biome")
      let bin: string | undefined
      if (await Bun.file(localBin).exists()) bin = localBin
      if (!bin) {
        const found = Bun.which("biome")
        if (found) bin = found
      }

      let args = ["lsp-proxy", "--stdio"]

      // 如果找不到本地安装,使用Bun运行
      if (!bin) {
        const resolved = await Bun.resolve("biome", root).catch(() => undefined)
        if (!resolved) return
        bin = BunProc.which()
        args = ["x", "biome", "lsp-proxy", "--stdio"]
      }

      const proc = spawn(bin, args, {
        // 启动Biome LSP服务器
        cwd: root,
        env: {
          ...process.env,
          BUN_BE_BUN: "1",
        },
      })

      return {
        process: proc,
      }
    },
  }

  // Gopls LSP服务器
  export const Gopls: Info = {
    id: "gopls",
    root: async (file) => {
      // 优先查找go.work,然后查找go.mod或go.sum
      const work = await NearestRoot(["go.work"])(file)
      if (work) return work
      return NearestRoot(["go.mod", "go.sum"])(file)
    },
    extensions: [".go"], // 支持的扩展名
    async spawn(root) {
      let bin = Bun.which("gopls", {
        // 查找gopls可执行文件
        PATH: process.env["PATH"] + path.delimiter + Global.Path.bin,
      })
      if (!bin) {
        // 如果找不到gopls,尝试安装
        if (!Bun.which("go")) return
        if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return

        log.info("安装gopls")
        const proc = Bun.spawn({
          // 安装gopls
          cmd: ["go", "install", "golang.org/x/tools/gopls@latest"],
          env: { ...process.env, GOBIN: Global.Path.bin },
          stdout: "pipe",
          stderr: "pipe",
          stdin: "pipe",
        })
        const exit = await proc.exited
        if (exit !== 0) {
          log.error("安装gopls失败")
          return
        }
        bin = path.join(Global.Path.bin, "gopls" + (process.platform === "win32" ? ".exe" : ""))
        log.info(`installed gopls`, {
          bin,
        })
      }
      return {
        process: spawn(bin!, {
          // 启动gopls服务器
          cwd: root,
        }),
      }
    },
  }

  // Rubocop LSP服务器
  export const Rubocop: Info = {
    id: "ruby-lsp",
    root: NearestRoot(["Gemfile"]), // Ruby依赖文件
    extensions: [".rb", ".rake", ".gemspec", ".ru"], // 支持的扩展名
    async spawn(root) {
      let bin = Bun.which("rubocop", {
        // 查找rubocop可执行文件
        PATH: process.env["PATH"] + path.delimiter + Global.Path.bin,
      })
      if (!bin) {
        // 如果找不到rubocop,尝试安装
        const ruby = Bun.which("ruby")
        const gem = Bun.which("gem")
        if (!ruby || !gem) {
          log.info("未找到Ruby,请先安装Ruby")
          return
        }
        if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
        log.info("安装rubocop")
        const proc = Bun.spawn({
          // 安装rubocop
          cmd: ["gem", "install", "rubocop", "--bindir", Global.Path.bin],
          stdout: "pipe",
          stderr: "pipe",
          stdin: "pipe",
        })
        const exit = await proc.exited
        if (exit !== 0) {
          log.error("安装rubocop失败")
          return
        }
        bin = path.join(Global.Path.bin, "rubocop" + (process.platform === "win32" ? ".exe" : ""))
        log.info(`installed rubocop`, {
          bin,
        })
      }
      return {
        process: spawn(bin!, ["--lsp"], {
          // 启动rubocop LSP服务器
          cwd: root,
        }),
      }
    },
  }

  // Ty LSP服务器
  export const Ty: Info = {
    id: "ty",
    extensions: [".py", ".pyi"], // 支持的扩展名
    root: NearestRoot([
      "pyproject.toml", // Python项目配置文件
      "ty.toml",
      "setup.py",
      "setup.cfg",
      "requirements.txt",
      "Pipfile",
      "pyrightconfig.json",
    ]),
    async spawn(root) {
      // 如果未启用实验性标志,不使用ty
      if (!Flag.OPENCODE_EXPERIMENTAL_LSP_TY) {
        return undefined
      }

      let binary = Bun.which("ty") // 查找ty可执行文件

      const initialization: Record<string, string> = {}

      // 查找Python虚拟环境
      const potentialVenvPaths = [process.env["VIRTUAL_ENV"], path.join(root, ".venv"), path.join(root, "venv")].filter(
        (p): p is string => p !== undefined,
      )
      for (const venvPath of potentialVenvPaths) {
        const isWindows = process.platform === "win32"
        const potentialPythonPath = isWindows
          ? path.join(venvPath, "Scripts", "python.exe")
          : path.join(venvPath, "bin", "python")
        if (await Bun.file(potentialPythonPath).exists()) {
          initialization["pythonPath"] = potentialPythonPath
          break
        }
      }

      if (!binary) {
        // 在虚拟环境中查找ty
        for (const venvPath of potentialVenvPaths) {
          const isWindows = process.platform === "win32"
          const potentialTyPath = isWindows
            ? path.join(venvPath, "Scripts", "ty.exe")
            : path.join(venvPath, "bin", "ty")
          if (await Bun.file(potentialTyPath).exists()) {
            binary = potentialTyPath
            break
          }
        }
      }

      if (!binary) {
        log.error("未找到ty,请先安装ty")
        return
      }

      const proc = spawn(binary, ["server"], {
        // 启动ty服务器
        cwd: root,
      })

      return {
        process: proc,
        initialization,
      }
    },
  }

  // Pyright LSP服务器
  export const Pyright: Info = {
    id: "pyright",
    extensions: [".py", ".pyi"], // 支持的扩展名
    root: NearestRoot(["pyproject.toml", "setup.py", "setup.cfg", "requirements.txt", "Pipfile", "pyrightconfig.json"]), // Python项目配置文件
    async spawn(root) {
      let binary = Bun.which("pyright-langserver") // 查找pyright-langserver可执行文件
      const args = []
      if (!binary) {
        // 尝试使用本地安装的版本
        const js = path.join(Global.Path.bin, "node_modules", "pyright", "dist", "pyright-langserver.js")
        if (!(await Bun.file(js).exists())) {
          // 如果不存在,尝试安装
          if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
          await Bun.spawn([BunProc.which(), "install", "pyright"], {
            // 安装pyright
            cwd: Global.Path.bin,
            env: {
              ...process.env,
              BUN_BE_BUN: "1",
            },
          }).exited
        }
        binary = BunProc.which()
        args.push(...["run", js])
      }
      args.push("--stdio")

      const initialization: Record<string, string> = {}

      // 查找Python虚拟环境
      const potentialVenvPaths = [process.env["VIRTUAL_ENV"], path.join(root, ".venv"), path.join(root, "venv")].filter(
        (p): p is string => p !== undefined,
      )
      for (const venvPath of potentialVenvPaths) {
        const isWindows = process.platform === "win32"
        const potentialPythonPath = isWindows
          ? path.join(venvPath, "Scripts", "python.exe")
          : path.join(venvPath, "bin", "python")
        if (await Bun.file(potentialPythonPath).exists()) {
          initialization["pythonPath"] = potentialPythonPath
          break
        }
      }

      const proc = spawn(binary, args, {
        // 启动pyright服务器
        cwd: root,
        env: {
          ...process.env,
          BUN_BE_BUN: "1",
        },
      })
      return {
        process: proc,
        initialization,
      }
    },
  }

  // ElixirLS LSP服务器
  export const ElixirLS: Info = {
    id: "elixir-ls",
    extensions: [".ex", ".exs"], // 支持的扩展名
    root: NearestRoot(["mix.exs", "mix.lock"]), // Elixir Mix配置文件
    async spawn(root) {
      let binary = Bun.which("elixir-ls") // 查找elixir-ls可执行文件
      if (!binary) {
        const elixirLsPath = path.join(Global.Path.bin, "elixir-ls")
        binary = path.join(
          Global.Path.bin,
          "elixir-ls-master",
          "release",
          process.platform === "win32" ? "language_server.bat" : "language_server.sh",
        )

        if (!(await Bun.file(binary).exists())) {
          // 如果不存在,尝试下载和构建
          const elixir = Bun.which("elixir")
          if (!elixir) {
            log.error("运行elixir-ls需要elixir")
            return
          }

          if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
          log.info("从GitHub发布版本下载elixir-ls")

          const response = await fetch("https://github.com/elixir-lsp/elixir-ls/archive/refs/heads/master.zip") // 下载elixir-ls
          if (!response.ok) return
          const zipPath = path.join(Global.Path.bin, "elixir-ls.zip")
          await Bun.file(zipPath).write(response)

          // 解压zip文件
          const ok = await Archive.extractZip(zipPath, Global.Path.bin)
            .then(() => true)
            .catch((error) => {
              log.error("解压elixir-ls归档文件失败", { error })
              return false
            })
          if (!ok) return

          await fs.rm(zipPath, {
            force: true,
            recursive: true,
          })

          // 编译elixir-ls
          await $`mix deps.get && mix compile && mix elixir_ls.release2 -o release`
            .quiet()
            .cwd(path.join(Global.Path.bin, "elixir-ls-master"))
            .env({ MIX_ENV: "prod", ...process.env })

          log.info(`installed elixir-ls`, {
            path: elixirLsPath,
          })
        }
      }

      return {
        process: spawn(binary, {
          // 启动elixir-ls服务器
          cwd: root,
        }),
      }
    },
  }

  // Zls LSP服务器
  export const Zls: Info = {
    id: "zls",
    extensions: [".zig", ".zon"], // 支持的扩展名
    root: NearestRoot(["build.zig"]), // Zig构建文件
    async spawn(root) {
      let bin = Bun.which("zls", {
        // 查找zls可执行文件
        PATH: process.env["PATH"] + path.delimiter + Global.Path.bin,
      })

      if (!bin) {
        // 如果找不到zls,尝试安装
        const zig = Bun.which("zig")
        if (!zig) {
          log.error("使用zls需要Zig。请先安装Zig。")
          return
        }

        if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
        log.info("从GitHub发布版本下载zls")

        // 获取最新版本信息
        const releaseResponse = await fetch("https://api.github.com/repos/zigtools/zls/releases/latest")
        if (!releaseResponse.ok) {
          log.error("获取zls发布信息失败")
          return
        }

        const release = (await releaseResponse.json()) as any

        // 确定平台和架构
        const platform = process.platform
        const arch = process.arch
        let assetName = ""

        let zlsArch: string = arch
        if (arch === "arm64") zlsArch = "aarch64"
        else if (arch === "x64") zlsArch = "x86_64"
        else if (arch === "ia32") zlsArch = "x86"

        let zlsPlatform: string = platform
        if (platform === "darwin") zlsPlatform = "macos"
        else if (platform === "win32") zlsPlatform = "windows"

        const ext = platform === "win32" ? "zip" : "tar.xz"

        assetName = `zls-${zlsArch}-${zlsPlatform}.${ext}`

        const supportedCombos = [
          "zls-x86_64-linux.tar.xz",
          "zls-x86_64-macos.tar.xz",
          "zls-x86_64-windows.zip",
          "zls-aarch64-linux.tar.xz",
          "zls-aarch64-macos.tar.xz",
          "zls-aarch64-windows.zip",
          "zls-x86-linux.tar.xz",
          "zls-x86-windows.zip",
        ]

        if (!supportedCombos.includes(assetName)) {
          log.error(`Platform ${platform} and architecture ${arch} is not supported by zls`)
          return
        }

        const asset = release.assets.find((a: any) => a.name === assetName)
        if (!asset) {
          log.error(`Could not find asset ${assetName} in latest zls release`)
          return
        }

        const downloadUrl = asset.browser_download_url
        const downloadResponse = await fetch(downloadUrl) // 下载zls
        if (!downloadResponse.ok) {
          log.error("下载zls失败")
          return
        }

        const tempPath = path.join(Global.Path.bin, assetName)
        await Bun.file(tempPath).write(downloadResponse)

        // 解压文件
        if (ext === "zip") {
          const ok = await Archive.extractZip(tempPath, Global.Path.bin)
            .then(() => true)
            .catch((error) => {
              log.error("解压zls归档文件失败", { error })
              return false
            })
          if (!ok) return
        } else {
          await $`tar -xf ${tempPath}`.cwd(Global.Path.bin).quiet().nothrow()
        }

        await fs.rm(tempPath, { force: true })

        bin = path.join(Global.Path.bin, "zls" + (platform === "win32" ? ".exe" : ""))

        if (!(await Bun.file(bin).exists())) {
          log.error("解压zls二进制文件失败")
          return
        }

        // 设置可执行权限
        if (platform !== "win32") {
          await $`chmod +x ${bin}`.quiet().nothrow()
        }

        log.info("已安装zls", { bin })
      }

      return {
        process: spawn(bin, {
          // 启动zls服务器
          cwd: root,
        }),
      }
    },
  }

  // CSharp LSP服务器
  export const CSharp: Info = {
    id: "csharp",
    root: NearestRoot([".sln", ".csproj", "global.json"]), // .NET项目文件
    extensions: [".cs"], // 支持的扩展名
    async spawn(root) {
      let bin = Bun.which("csharp-ls", {
        // 查找csharp-ls可执行文件
        PATH: process.env["PATH"] + path.delimiter + Global.Path.bin,
      })
      if (!bin) {
        // 如果找不到csharp-ls,尝试安装
        if (!Bun.which("dotnet")) {
          log.error("安装csharp-ls需要.NET SDK")
          return
        }

        if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
        log.info("通过dotnet工具安装csharp-ls")
        const proc = Bun.spawn({
          // 安装csharp-ls
          cmd: ["dotnet", "tool", "install", "csharp-ls", "--tool-path", Global.Path.bin],
          stdout: "pipe",
          stderr: "pipe",
          stdin: "pipe",
        })
        const exit = await proc.exited
        if (exit !== 0) {
          log.error("安装csharp-ls失败")
          return
        }

        bin = path.join(Global.Path.bin, "csharp-ls" + (process.platform === "win32" ? ".exe" : ""))
        log.info(`installed csharp-ls`, { bin })
      }

      return {
        process: spawn(bin, {
          // 启动csharp-ls服务器
          cwd: root,
        }),
      }
    },
  }

  // FSharp LSP服务器
  export const FSharp: Info = {
    id: "fsharp",
    root: NearestRoot([".sln", ".fsproj", "global.json"]), // .NET项目文件
    extensions: [".fs", ".fsi", ".fsx", ".fsscript"], // 支持的扩展名
    async spawn(root) {
      let bin = Bun.which("fsautocomplete", {
        // 查找fsautocomplete可执行文件
        PATH: process.env["PATH"] + path.delimiter + Global.Path.bin,
      })
      if (!bin) {
        // 如果找不到fsautocomplete,尝试安装
        if (!Bun.which("dotnet")) {
          log.error("安装fsautocomplete需要.NET SDK")
          return
        }

        if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
        log.info("通过dotnet工具安装fsautocomplete")
        const proc = Bun.spawn({
          // 安装fsautocomplete
          cmd: ["dotnet", "tool", "install", "fsautocomplete", "--tool-path", Global.Path.bin],
          stdout: "pipe",
          stderr: "pipe",
          stdin: "pipe",
        })
        const exit = await proc.exited
        if (exit !== 0) {
          log.error("安装fsautocomplete失败")
          return
        }

        bin = path.join(Global.Path.bin, "fsautocomplete" + (process.platform === "win32" ? ".exe" : ""))
        log.info(`installed fsautocomplete`, { bin })
      }

      return {
        process: spawn(bin, {
          // 启动fsautocomplete服务器
          cwd: root,
        }),
      }
    },
  }

  // SourceKit LSP服务器
  export const SourceKit: Info = {
    id: "sourcekit-lsp",
    extensions: [".swift", ".objc", "objcpp"], // 支持的扩展名
    root: NearestRoot(["Package.swift", "*.xcodeproj", "*.xcworkspace"]), // Swift项目文件
    async spawn(root) {
      // 检查PATH中是否有sourcekit-lsp
      // 这是通过Swift工具链安装的
      const sourcekit = Bun.which("sourcekit-lsp")
      if (sourcekit) {
        return {
          process: spawn(sourcekit, {
            // 启动sourcekit-lsp服务器
            cwd: root,
          }),
        }
      }

      // 如果找不到sourcekit-lsp,检查xcrun是否可用
      // 这特定于macOS,其中sourcekit-lsp通常随Xcode安装
      if (!Bun.which("xcrun")) return

      const lspLoc = await $`xcrun --find sourcekit-lsp`.quiet().nothrow()

      if (lspLoc.exitCode !== 0) return

      const bin = lspLoc.text().trim()

      return {
        process: spawn(bin, {
          // 启动sourcekit-lsp服务器
          cwd: root,
        }),
      }
    },
  }

  // RustAnalyzer LSP服务器
  export const RustAnalyzer: Info = {
    id: "rust",
    root: async (root) => {
      // 查找Cargo项目根目录
      const crateRoot = await NearestRoot(["Cargo.toml", "Cargo.lock"])(root)
      if (crateRoot === undefined) {
        return undefined
      }
      let currentDir = crateRoot

      while (currentDir !== path.dirname(currentDir)) {
        // 在文件系统根目录停止
        const cargoTomlPath = path.join(currentDir, "Cargo.toml")
        try {
          const cargoTomlContent = await Bun.file(cargoTomlPath).text()
          if (cargoTomlContent.includes("[workspace]")) {
            return currentDir // 返回工作区根目录
          }
        } catch (err) {
          // 文件不存在或无法读取,继续向上搜索
        }

        const parentDir = path.dirname(currentDir)
        if (parentDir === currentDir) break // 到达文件系统根目录
        currentDir = parentDir

        // 如果已经超过应用根目录则停止
        if (!currentDir.startsWith(Instance.worktree)) break
      }

      return crateRoot
    },
    extensions: [".rs"], // 支持的扩展名
    async spawn(root) {
      const bin = Bun.which("rust-analyzer") // 查找rust-analyzer可执行文件
      if (!bin) {
        log.info("未在PATH中找到rust-analyzer,请先安装")
        return
      }
      return {
        process: spawn(bin, {
          // 启动rust-analyzer服务器
          cwd: root,
        }),
      }
    },
  }

  // Clangd LSP服务器
  export const Clangd: Info = {
    id: "clangd",
    root: NearestRoot(["compile_commands.json", "compile_flags.txt", ".clangd", "CMakeLists.txt", "Makefile"]), // C/C++项目配置文件
    extensions: [".c", ".cpp", ".cc", ".cxx", ".c++", ".h", ".hpp", ".hh", ".hxx", ".h++"], // 支持的扩展名
    async spawn(root) {
      const args = ["--background-index", "--clang-tidy"]
      const fromPath = Bun.which("clangd") // 查找clangd可执行文件
      if (fromPath) {
        return {
          process: spawn(fromPath, args, {
            // 启动clangd服务器
            cwd: root,
          }),
        }
      }

      // 尝试直接查找clangd
      const ext = process.platform === "win32" ? ".exe" : ""
      const direct = path.join(Global.Path.bin, "clangd" + ext)
      if (await Bun.file(direct).exists()) {
        return {
          process: spawn(direct, args, {
            // 启动clangd服务器
            cwd: root,
          }),
        }
      }

      // 在bin目录中查找clangd子目录
      const entries = await fs.readdir(Global.Path.bin, { withFileTypes: true }).catch(() => [])
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (!entry.name.startsWith("clangd_")) continue
        const candidate = path.join(Global.Path.bin, entry.name, "bin", "clangd" + ext)
        if (await Bun.file(candidate).exists()) {
          return {
            process: spawn(candidate, args, {
              // 启动clangd服务器
              cwd: root,
            }),
          }
        }
      }

      // 如果找不到clangd,尝试下载
      if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
      log.info("从GitHub发布版本下载clangd")

      // 获取最新版本信息
      const releaseResponse = await fetch("https://api.github.com/repos/clangd/clangd/releases/latest")
      if (!releaseResponse.ok) {
        log.error("获取clangd发布信息失败")
        return
      }

      const release: {
        tag_name?: string
        assets?: { name?: string; browser_download_url?: string }[]
      } = await releaseResponse.json()

      const tag = release.tag_name
      if (!tag) {
        log.error("clangd发布版本未包含标签名称")
        return
      }
      // 确定平台
      const platform = process.platform
      const tokens: Record<string, string> = {
        darwin: "mac",
        linux: "linux",
        win32: "windows",
      }
      const token = tokens[platform]
      if (!token) {
        log.error(`Platform ${platform} is not supported by clangd auto-download`)
        return
      }

      // 查找匹配的资源
      const assets = release.assets ?? []
      const valid = (item: { name?: string; browser_download_url?: string }) => {
        if (!item.name) return false
        if (!item.browser_download_url) return false
        if (!item.name.includes(token)) return false
        return item.name.includes(tag)
      }

      const asset =
        assets.find((item) => valid(item) && item.name?.endsWith(".zip")) ??
        assets.find((item) => valid(item) && item.name?.endsWith(".tar.xz")) ??
        assets.find((item) => valid(item))
      if (!asset?.name || !asset.browser_download_url) {
        log.error("clangd无法匹配发布资源", { tag, platform })
        return
      }

      const name = asset.name
      const downloadResponse = await fetch(asset.browser_download_url) // 下载clangd
      if (!downloadResponse.ok) {
        log.error("下载clangd失败")
        return
      }

      const archive = path.join(Global.Path.bin, name)
      const buf = await downloadResponse.arrayBuffer()
      if (buf.byteLength === 0) {
        log.error("写入clangd归档文件失败")
        return
      }
      await Bun.write(archive, buf)

      // 解压文件
      const zip = name.endsWith(".zip")
      const tar = name.endsWith(".tar.xz")
      if (!zip && !tar) {
        log.error("clangd遇到不支持的资源", { asset: name })
        return
      }

      if (zip) {
        const ok = await Archive.extractZip(archive, Global.Path.bin)
          .then(() => true)
          .catch((error) => {
            log.error("解压clangd归档文件失败", { error })
            return false
          })
        if (!ok) return
      }
      if (tar) {
        await $`tar -xf ${archive}`.cwd(Global.Path.bin).quiet().nothrow()
      }
      await fs.rm(archive, { force: true })

      const bin = path.join(Global.Path.bin, "clangd_" + tag, "bin", "clangd" + ext)
      if (!(await Bun.file(bin).exists())) {
        log.error("解压clangd二进制文件失败")
        return
      }

      // 设置可执行权限
      if (platform !== "win32") {
        await $`chmod +x ${bin}`.quiet().nothrow()
      }

      // 创建符号链接
      await fs.unlink(path.join(Global.Path.bin, "clangd")).catch(() => {})
      await fs.symlink(bin, path.join(Global.Path.bin, "clangd")).catch(() => {})

      log.info(`installed clangd`, { bin })

      return {
        process: spawn(bin, args, {
          // 启动clangd服务器
          cwd: root,
        }),
      }
    },
  }

  // Svelte LSP服务器
  export const Svelte: Info = {
    id: "svelte",
    extensions: [".svelte"], // 支持的扩展名
    root: NearestRoot(["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"]), // 包管理器锁定文件
    async spawn(root) {
      let binary = Bun.which("svelteserver") // 查找svelteserver可执行文件
      const args: string[] = []
      if (!binary) {
        // 尝试使用本地安装的版本
        const js = path.join(Global.Path.bin, "node_modules", "svelte-language-server", "bin", "server.js")
        if (!(await Bun.file(js).exists())) {
          // 如果不存在,尝试安装
          if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
          await Bun.spawn([BunProc.which(), "install", "svelte-language-server"], {
            // 安装Svelte语言服务器
            cwd: Global.Path.bin,
            env: {
              ...process.env,
              BUN_BE_BUN: "1",
            },
            stdout: "pipe",
            stderr: "pipe",
            stdin: "pipe",
          }).exited
        }
        binary = BunProc.which()
        args.push("run", js)
      }
      args.push("--stdio")
      const proc = spawn(binary, args, {
        // 启动Svelte语言服务器
        cwd: root,
        env: {
          ...process.env,
          BUN_BE_BUN: "1",
        },
      })
      return {
        process: proc,
        initialization: {},
      }
    },
  }

  // Astro LSP服务器
  export const Astro: Info = {
    id: "astro",
    extensions: [".astro"], // 支持的扩展名
    root: NearestRoot(["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"]), // 包管理器锁定文件
    async spawn(root) {
      const tsserver = await Bun.resolve("typescript/lib/tsserver.js", Instance.directory).catch(() => {}) // 解析tsserver路径
      if (!tsserver) {
        log.info("未找到typescript,Astro语言服务器需要")
        return
      }
      const tsdk = path.dirname(tsserver)

      let binary = Bun.which("astro-ls") // 查找astro-ls可执行文件
      const args: string[] = []
      if (!binary) {
        // 尝试使用本地安装的版本
        const js = path.join(Global.Path.bin, "node_modules", "@astrojs", "language-server", "bin", "nodeServer.js")
        if (!(await Bun.file(js).exists())) {
          // 如果不存在,尝试安装
          if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
          await Bun.spawn([BunProc.which(), "install", "@astrojs/language-server"], {
            // 安装Astro语言服务器
            cwd: Global.Path.bin,
            env: {
              ...process.env,
              BUN_BE_BUN: "1",
            },
            stdout: "pipe",
            stderr: "pipe",
            stdin: "pipe",
          }).exited
        }
        binary = BunProc.which()
        args.push("run", js)
      }
      args.push("--stdio")
      const proc = spawn(binary, args, {
        // 启动Astro语言服务器
        cwd: root,
        env: {
          ...process.env,
          BUN_BE_BUN: "1",
        },
      })
      return {
        process: proc,
        initialization: {
          typescript: {
            tsdk, // TypeScript SDK路径
          },
        },
      }
    },
  }

  // JDTLS LSP服务器
  export const JDTLS: Info = {
    id: "jdtls",
    root: NearestRoot(["pom.xml", "build.gradle", "build.gradle.kts", ".project", ".classpath"]), // Java项目配置文件
    extensions: [".java"], // 支持的扩展名
    async spawn(root) {
      const java = Bun.which("java") // 查找Java可执行文件
      if (!java) {
        log.error("运行JDTLS需要Java 21或更高版本。请先安装。")
        return
      }
      // 获取Java版本
      const javaMajorVersion = await $`java -version`
        .quiet()
        .nothrow()
        .then(({ stderr }) => {
          const m = /"(\d+)\.\d+\.\d+"/.exec(stderr.toString())
          return !m ? undefined : parseInt(m[1])
        })
      if (javaMajorVersion == null || javaMajorVersion < 21) {
        log.error("JDTLS需要至少Java 21。")
        return
      }
      // 查找JDTLS安装目录
      const distPath = path.join(Global.Path.bin, "jdtls")
      const launcherDir = path.join(distPath, "plugins")
      const installed = await fs.exists(launcherDir)
      if (!installed) {
        // 如果未安装,尝试下载
        if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
        log.info("正在下载JDTLS LSP服务器。")
        await fs.mkdir(distPath, { recursive: true })
        const releaseURL =
          "https://www.eclipse.org/downloads/download.php?file=/jdtls/snapshots/jdt-language-server-latest.tar.gz"
        const archivePath = path.join(distPath, "release.tar.gz")
        await $`curl -L -o '${archivePath}' '${releaseURL}'`.quiet().nothrow()
        await $`tar -xzf ${archivePath}`.cwd(distPath).quiet().nothrow()
        await fs.rm(archivePath, { force: true })
      }
      // 查找启动器JAR文件
      const jarFileName = await $`ls org.eclipse.equinox.launcher_*.jar`
        .cwd(launcherDir)
        .quiet()
        .nothrow()
        .then(({ stdout }) => stdout.toString().trim())
      const launcherJar = path.join(launcherDir, jarFileName)
      if (!(await fs.exists(launcherJar))) {
        log.error(`Failed to locate the JDTLS launcher module in the installed directory: ${distPath}.`)
        return
      }
      // 确定配置文件
      const configFile = path.join(
        distPath,
        (() => {
          switch (process.platform) {
            case "darwin":
              return "config_mac"
            case "linux":
              return "config_linux"
            case "win32":
              return "config_win"
            default:
              return "config_linux"
          }
        })(),
      )
      // 创建临时数据目录
      const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-jdtls-data"))
      return {
        process: spawn(
          // 启动JDTLS服务器
          java,
          [
            "-jar",
            launcherJar,
            "-configuration",
            configFile,
            "-data",
            dataDir,
            "-Declipse.application=org.eclipse.jdt.ls.core.id1",
            "-Dosgi.bundles.defaultStartLevel=4",
            "-Declipse.product=org.eclipse.jdt.ls.core.product",
            "-Dlog.level=ALL",
            "--add-modules=ALL-SYSTEM",
            "--add-opens java.base/java.util=ALL-UNNAMED",
            "--add-opens java.base/java.lang=ALL-UNNAMED",
          ],
          {
            cwd: root,
          },
        ),
      }
    },
  }

  // YamlLS LSP服务器
  export const YamlLS: Info = {
    id: "yaml-ls",
    extensions: [".yaml", ".yml"], // 支持的扩展名
    root: NearestRoot(["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"]), // 包管理器锁定文件
    async spawn(root) {
      let binary = Bun.which("yaml-language-server") // 查找yaml-language-server可执行文件
      const args: string[] = []
      if (!binary) {
        // 尝试使用本地安装的版本
        const js = path.join(
          Global.Path.bin,
          "node_modules",
          "yaml-language-server",
          "out",
          "server",
          "src",
          "server.js",
        )
        const exists = await Bun.file(js).exists()
        if (!exists) {
          // 如果不存在,尝试安装
          if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
          await Bun.spawn([BunProc.which(), "install", "yaml-language-server"], {
            // 安装YAML语言服务器
            cwd: Global.Path.bin,
            env: {
              ...process.env,
              BUN_BE_BUN: "1",
            },
            stdout: "pipe",
            stderr: "pipe",
            stdin: "pipe",
          }).exited
        }
        binary = BunProc.which()
        args.push("run", js)
      }
      args.push("--stdio")
      const proc = spawn(binary, args, {
        // 启动YAML语言服务器
        cwd: root,
        env: {
          ...process.env,
          BUN_BE_BUN: "1",
        },
      })
      return {
        process: proc,
      }
    },
  }

  // LuaLS LSP服务器
  export const LuaLS: Info = {
    id: "lua-ls",
    root: NearestRoot([
      ".luarc.json", // Lua配置文件
      ".luarc.jsonc",
      ".luacheckrc",
      ".stylua.toml",
      "stylua.toml",
      "selene.toml",
      "selene.yml",
    ]),
    extensions: [".lua"], // 支持的扩展名
    async spawn(root) {
      let bin = Bun.which("lua-language-server", {
        // 查找lua-language-server可执行文件
        PATH: process.env["PATH"] + path.delimiter + Global.Path.bin,
      })

      if (!bin) {
        // 如果找不到lua-language-server,尝试下载
        if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
        log.info("从GitHub发布版本下载lua-language-server")

        // 获取最新版本信息
        const releaseResponse = await fetch("https://api.github.com/repos/LuaLS/lua-language-server/releases/latest")
        if (!releaseResponse.ok) {
          log.error("获取lua-language-server发布信息失败")
          return
        }

        const release = await releaseResponse.json()

        // 确定平台和架构
        const platform = process.platform
        const arch = process.arch
        let assetName = ""

        let lualsArch: string = arch
        if (arch === "arm64") lualsArch = "arm64"
        else if (arch === "x64") lualsArch = "x64"
        else if (arch === "ia32") lualsArch = "ia32"

        let lualsPlatform: string = platform
        if (platform === "darwin") lualsPlatform = "darwin"
        else if (platform === "linux") lualsPlatform = "linux"
        else if (platform === "win32") lualsPlatform = "win32"

        const ext = platform === "win32" ? "zip" : "tar.gz"

        assetName = `lua-language-server-${release.tag_name}-${lualsPlatform}-${lualsArch}.${ext}`

        const supportedCombos = [
          "darwin-arm64.tar.gz",
          "darwin-x64.tar.gz",
          "linux-x64.tar.gz",
          "linux-arm64.tar.gz",
          "win32-x64.zip",
          "win32-ia32.zip",
        ]

        const assetSuffix = `${lualsPlatform}-${lualsArch}.${ext}`
        if (!supportedCombos.includes(assetSuffix)) {
          log.error(`Platform ${platform} and architecture ${arch} is not supported by lua-language-server`)
          return
        }

        const asset = release.assets.find((a: any) => a.name === assetName)
        if (!asset) {
          log.error(`无法在最新的lua-language-server发布版本中找到资源${assetName}`)
          return
        }

        const downloadUrl = asset.browser_download_url
        const downloadResponse = await fetch(downloadUrl) // 下载lua-language-server
        if (!downloadResponse.ok) {
          log.error("下载lua-language-server失败")
          return
        }

        const tempPath = path.join(Global.Path.bin, assetName)
        await Bun.file(tempPath).write(downloadResponse)

        // 与zls不同,zls是单个自包含的二进制文件,
        // lua-language-server需要支持文件(meta/, locale/等)
        // 将整个归档文件提取到专用目录以保留所有文件
        const installDir = path.join(Global.Path.bin, `lua-language-server-${lualsArch}-${lualsPlatform}`)

        // 移除旧安装(如果存在)
        const stats = await fs.stat(installDir).catch(() => undefined)
        if (stats) {
          await fs.rm(installDir, { force: true, recursive: true })
        }

        await fs.mkdir(installDir, { recursive: true })

        // 解压文件
        if (ext === "zip") {
          const ok = await Archive.extractZip(tempPath, installDir)
            .then(() => true)
            .catch((error) => {
              log.error("解压lua-language-server归档文件失败", { error })
              return false
            })
          if (!ok) return
        } else {
          const ok = await $`tar -xzf ${tempPath} -C ${installDir}`
            .quiet()
            .then(() => true)
            .catch((error) => {
              log.error("解压lua-language-server归档文件失败", { error })
              return false
            })
          if (!ok) return
        }

        await fs.rm(tempPath, { force: true })

        // 二进制文件位于提取归档文件的bin/子目录中
        bin = path.join(installDir, "bin", "lua-language-server" + (platform === "win32" ? ".exe" : ""))

        if (!(await Bun.file(bin).exists())) {
          log.error("解压lua-language-server二进制文件失败")
          return
        }

        // 设置可执行权限
        if (platform !== "win32") {
          const ok = await $`chmod +x ${bin}`.quiet().catch((error) => {
            log.error("无法为lua-language-server二进制文件设置可执行权限", {
              error,
            })
          })
          if (!ok) return
        }

        log.info("已安装lua-language-server", { bin })
      }

      return {
        process: spawn(bin, {
          // 启动lua-language-server服务器
          cwd: root,
        }),
      }
    },
  }

  export const PHPIntelephense: Info = {
    id: "php intelephense",
    extensions: [".php"],
    root: NearestRoot(["composer.json", "composer.lock", ".php-version"]),
    async spawn(root) {
      let binary = Bun.which("intelephense")
      const args: string[] = []
      if (!binary) {
        const js = path.join(Global.Path.bin, "node_modules", "intelephense", "lib", "intelephense.js")
        if (!(await Bun.file(js).exists())) {
          if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
          await Bun.spawn([BunProc.which(), "install", "intelephense"], {
            cwd: Global.Path.bin,
            env: {
              ...process.env,
              BUN_BE_BUN: "1",
            },
            stdout: "pipe",
            stderr: "pipe",
            stdin: "pipe",
          }).exited
        }
        binary = BunProc.which()
        args.push("run", js)
      }
      args.push("--stdio")
      const proc = spawn(binary, args, {
        cwd: root,
        env: {
          ...process.env,
          BUN_BE_BUN: "1",
        },
      })
      return {
        process: proc,
        initialization: {},
      }
    },
  }

  export const Prisma: Info = {
    id: "prisma",
    extensions: [".prisma"],
    root: NearestRoot(["schema.prisma", "prisma/schema.prisma", "prisma"], ["package.json"]),
    async spawn(root) {
      const prisma = Bun.which("prisma")
      if (!prisma) {
        log.info("未找到prisma,请先安装prisma")
        return
      }
      return {
        process: spawn(prisma, ["language-server"], {
          cwd: root,
        }),
      }
    },
  }

  export const Dart: Info = {
    id: "dart",
    extensions: [".dart"],
    root: NearestRoot(["pubspec.yaml", "analysis_options.yaml"]),
    async spawn(root) {
      const dart = Bun.which("dart")
      if (!dart) {
        log.info("未找到dart,请先安装dart")
        return
      }
      return {
        process: spawn(dart, ["language-server", "--lsp"], {
          cwd: root,
        }),
      }
    },
  }

  export const Ocaml: Info = {
    id: "ocaml-lsp",
    extensions: [".ml", ".mli"],
    root: NearestRoot(["dune-project", "dune-workspace", ".merlin", "opam"]),
    async spawn(root) {
      const bin = Bun.which("ocamllsp")
      if (!bin) {
        log.info("未找到ocamllsp,请先安装ocaml-lsp-server")
        return
      }
      return {
        process: spawn(bin, {
          cwd: root,
        }),
      }
    },
  }
  export const BashLS: Info = {
    id: "bash",
    extensions: [".sh", ".bash", ".zsh", ".ksh"],
    root: async () => Instance.directory,
    async spawn(root) {
      let binary = Bun.which("bash-language-server")
      const args: string[] = []
      if (!binary) {
        const js = path.join(Global.Path.bin, "node_modules", "bash-language-server", "out", "cli.js")
        if (!(await Bun.file(js).exists())) {
          if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
          await Bun.spawn([BunProc.which(), "install", "bash-language-server"], {
            cwd: Global.Path.bin,
            env: {
              ...process.env,
              BUN_BE_BUN: "1",
            },
            stdout: "pipe",
            stderr: "pipe",
            stdin: "pipe",
          }).exited
        }
        binary = BunProc.which()
        args.push("run", js)
      }
      args.push("start")
      const proc = spawn(binary, args, {
        cwd: root,
        env: {
          ...process.env,
          BUN_BE_BUN: "1",
        },
      })
      return {
        process: proc,
      }
    },
  }

  export const TerraformLS: Info = {
    id: "terraform",
    extensions: [".tf", ".tfvars"],
    root: NearestRoot([".terraform.lock.hcl", "terraform.tfstate", "*.tf"]),
    async spawn(root) {
      let bin = Bun.which("terraform-ls", {
        PATH: process.env["PATH"] + path.delimiter + Global.Path.bin,
      })

      if (!bin) {
        if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
        log.info("从GitHub发布版本下载terraform-ls")

        const releaseResponse = await fetch("https://api.github.com/repos/hashicorp/terraform-ls/releases/latest")
        if (!releaseResponse.ok) {
          log.error("获取terraform-ls发布信息失败")
          return
        }

        const release = (await releaseResponse.json()) as {
          tag_name?: string
          assets?: { name?: string; browser_download_url?: string }[]
        }
        const version = release.tag_name?.replace("v", "")
        if (!version) {
          log.error("terraform-ls发布版本未包含版本标签")
          return
        }

        const platform = process.platform
        const arch = process.arch

        const tfArch = arch === "arm64" ? "arm64" : "amd64"
        const tfPlatform = platform === "win32" ? "windows" : platform

        const assetName = `terraform-ls_${version}_${tfPlatform}_${tfArch}.zip`

        const assets = release.assets ?? []
        const asset = assets.find((a) => a.name === assetName)
        if (!asset?.browser_download_url) {
          log.error(`Could not find asset ${assetName} in terraform-ls release`)
          return
        }

        const downloadResponse = await fetch(asset.browser_download_url)
        if (!downloadResponse.ok) {
          log.error("下载terraform-ls失败")
          return
        }

        const tempPath = path.join(Global.Path.bin, assetName)
        await Bun.file(tempPath).write(downloadResponse)

        const ok = await Archive.extractZip(tempPath, Global.Path.bin)
          .then(() => true)
          .catch((error) => {
            log.error("解压terraform-ls归档文件失败", { error })
            return false
          })
        if (!ok) return
        await fs.rm(tempPath, { force: true })

        bin = path.join(Global.Path.bin, "terraform-ls" + (platform === "win32" ? ".exe" : ""))

        if (!(await Bun.file(bin).exists())) {
          log.error("解压terraform-ls二进制文件失败")
          return
        }

        if (platform !== "win32") {
          await $`chmod +x ${bin}`.quiet().nothrow()
        }

        log.info(`installed terraform-ls`, { bin })
      }

      return {
        process: spawn(bin, ["serve"], {
          cwd: root,
        }),
        initialization: {
          experimentalFeatures: {
            prefillRequiredFields: true,
            validateOnSave: true,
          },
        },
      }
    },
  }

  export const TexLab: Info = {
    id: "texlab",
    extensions: [".tex", ".bib"],
    root: NearestRoot([".latexmkrc", "latexmkrc", ".texlabroot", "texlabroot"]),
    async spawn(root) {
      let bin = Bun.which("texlab", {
        PATH: process.env["PATH"] + path.delimiter + Global.Path.bin,
      })

      if (!bin) {
        if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
        log.info("从GitHub发布版本下载texlab")

        const response = await fetch("https://api.github.com/repos/latex-lsp/texlab/releases/latest")
        if (!response.ok) {
          log.error("获取texlab发布信息失败")
          return
        }

        const release = (await response.json()) as {
          tag_name?: string
          assets?: { name?: string; browser_download_url?: string }[]
        }
        const version = release.tag_name?.replace("v", "")
        if (!version) {
          log.error("texlab发布版本未包含版本标签")
          return
        }

        const platform = process.platform
        const arch = process.arch

        const texArch = arch === "arm64" ? "aarch64" : "x86_64"
        const texPlatform = platform === "darwin" ? "macos" : platform === "win32" ? "windows" : "linux"
        const ext = platform === "win32" ? "zip" : "tar.gz"
        const assetName = `texlab-${texArch}-${texPlatform}.${ext}`

        const assets = release.assets ?? []
        const asset = assets.find((a) => a.name === assetName)
        if (!asset?.browser_download_url) {
          log.error(`Could not find asset ${assetName} in texlab release`)
          return
        }

        const downloadResponse = await fetch(asset.browser_download_url)
        if (!downloadResponse.ok) {
          log.error("下载texlab失败")
          return
        }

        const tempPath = path.join(Global.Path.bin, assetName)
        await Bun.file(tempPath).write(downloadResponse)

        if (ext === "zip") {
          const ok = await Archive.extractZip(tempPath, Global.Path.bin)
            .then(() => true)
            .catch((error) => {
              log.error("解压texlab归档文件失败", { error })
              return false
            })
          if (!ok) return
        }
        if (ext === "tar.gz") {
          await $`tar -xzf ${tempPath}`.cwd(Global.Path.bin).quiet().nothrow()
        }

        await fs.rm(tempPath, { force: true })

        bin = path.join(Global.Path.bin, "texlab" + (platform === "win32" ? ".exe" : ""))

        if (!(await Bun.file(bin).exists())) {
          log.error("解压texlab二进制文件失败")
          return
        }

        if (platform !== "win32") {
          await $`chmod +x ${bin}`.quiet().nothrow()
        }

        log.info("已安装texlab", { bin })
      }

      return {
        process: spawn(bin, {
          cwd: root,
        }),
      }
    },
  }

  export const DockerfileLS: Info = {
    id: "dockerfile",
    extensions: [".dockerfile", "Dockerfile"],
    root: async () => Instance.directory,
    async spawn(root) {
      let binary = Bun.which("docker-langserver")
      const args: string[] = []
      if (!binary) {
        const js = path.join(Global.Path.bin, "node_modules", "dockerfile-language-server-nodejs", "lib", "server.js")
        if (!(await Bun.file(js).exists())) {
          if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
          await Bun.spawn([BunProc.which(), "install", "dockerfile-language-server-nodejs"], {
            cwd: Global.Path.bin,
            env: {
              ...process.env,
              BUN_BE_BUN: "1",
            },
            stdout: "pipe",
            stderr: "pipe",
            stdin: "pipe",
          }).exited
        }
        binary = BunProc.which()
        args.push("run", js)
      }
      args.push("--stdio")
      const proc = spawn(binary, args, {
        cwd: root,
        env: {
          ...process.env,
          BUN_BE_BUN: "1",
        },
      })
      return {
        process: proc,
      }
    },
  }

  export const Gleam: Info = {
    id: "gleam",
    extensions: [".gleam"],
    root: NearestRoot(["gleam.toml"]),
    async spawn(root) {
      const gleam = Bun.which("gleam")
      if (!gleam) {
        log.info("未找到gleam,请先安装gleam")
        return
      }
      return {
        process: spawn(gleam, ["lsp"], {
          cwd: root,
        }),
      }
    },
  }

  export const Clojure: Info = {
    id: "clojure-lsp",
    extensions: [".clj", ".cljs", ".cljc", ".edn"],
    root: NearestRoot(["deps.edn", "project.clj", "shadow-cljs.edn", "bb.edn", "build.boot"]),
    async spawn(root) {
      let bin = Bun.which("clojure-lsp")
      if (!bin && process.platform === "win32") {
        bin = Bun.which("clojure-lsp.exe")
      }
      if (!bin) {
        log.info("未找到clojure-lsp,请先安装clojure-lsp")
        return
      }
      return {
        process: spawn(bin, ["listen"], {
          cwd: root,
        }),
      }
    },
  }

  export const Nixd: Info = {
    id: "nixd",
    extensions: [".nix"],
    root: async (file) => {
      // First, look for flake.nix - the most reliable Nix project root indicator
      const flakeRoot = await NearestRoot(["flake.nix"])(file)
      if (flakeRoot && flakeRoot !== Instance.directory) return flakeRoot

      // If no flake.nix, fall back to git repository root
      if (Instance.worktree && Instance.worktree !== Instance.directory) return Instance.worktree

      // Finally, use the instance directory as fallback
      return Instance.directory
    },
    async spawn(root) {
      const nixd = Bun.which("nixd")
      if (!nixd) {
        log.info("未找到nixd,请先安装nixd")
        return
      }
      return {
        process: spawn(nixd, [], {
          cwd: root,
          env: {
            ...process.env,
          },
        }),
      }
    },
  }

  export const Tinymist: Info = {
    id: "tinymist",
    extensions: [".typ", ".typc"],
    root: NearestRoot(["typst.toml"]),
    async spawn(root) {
      let bin = Bun.which("tinymist", {
        PATH: process.env["PATH"] + path.delimiter + Global.Path.bin,
      })

      if (!bin) {
        if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
        log.info("从GitHub发布版本下载tinymist")

        const response = await fetch("https://api.github.com/repos/Myriad-Dreamin/tinymist/releases/latest")
        if (!response.ok) {
          log.error("获取tinymist发布信息失败")
          return
        }

        const release = (await response.json()) as {
          tag_name?: string
          assets?: { name?: string; browser_download_url?: string }[]
        }

        const platform = process.platform
        const arch = process.arch

        const tinymistArch = arch === "arm64" ? "aarch64" : "x86_64"
        let tinymistPlatform: string
        let ext: string

        if (platform === "darwin") {
          tinymistPlatform = "apple-darwin"
          ext = "tar.gz"
        } else if (platform === "win32") {
          tinymistPlatform = "pc-windows-msvc"
          ext = "zip"
        } else {
          tinymistPlatform = "unknown-linux-gnu"
          ext = "tar.gz"
        }

        const assetName = `tinymist-${tinymistArch}-${tinymistPlatform}.${ext}`

        const assets = release.assets ?? []
        const asset = assets.find((a) => a.name === assetName)
        if (!asset?.browser_download_url) {
          log.error(`Could not find asset ${assetName} in tinymist release`)
          return
        }

        const downloadResponse = await fetch(asset.browser_download_url)
        if (!downloadResponse.ok) {
          log.error("下载tinymist失败")
          return
        }

        const tempPath = path.join(Global.Path.bin, assetName)
        await Bun.file(tempPath).write(downloadResponse)

        if (ext === "zip") {
          const ok = await Archive.extractZip(tempPath, Global.Path.bin)
            .then(() => true)
            .catch((error) => {
              log.error("解压tinymist归档文件失败", { error })
              return false
            })
          if (!ok) return
        } else {
          await $`tar -xzf ${tempPath} --strip-components=1`.cwd(Global.Path.bin).quiet().nothrow()
        }

        await fs.rm(tempPath, { force: true })

        bin = path.join(Global.Path.bin, "tinymist" + (platform === "win32" ? ".exe" : ""))

        if (!(await Bun.file(bin).exists())) {
          log.error("解压tinymist二进制文件失败")
          return
        }

        if (platform !== "win32") {
          await $`chmod +x ${bin}`.quiet().nothrow()
        }

        log.info("已安装tinymist", { bin })
      }

      return {
        process: spawn(bin, { cwd: root }),
      }
    },
  }

  export const HLS: Info = {
    id: "haskell-language-server",
    extensions: [".hs", ".lhs"],
    root: NearestRoot(["stack.yaml", "cabal.project", "hie.yaml", "*.cabal"]),
    async spawn(root) {
      const bin = Bun.which("haskell-language-server-wrapper")
      if (!bin) {
        log.info("未找到haskell-language-server-wrapper,请先安装haskell-language-server")
        return
      }
      return {
        process: spawn(bin, ["--lsp"], {
          cwd: root,
        }),
      }
    },
  }
}
