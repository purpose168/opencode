import { $ } from "bun" // 导入 Bun 的命令执行工具
import fs from "fs/promises" // 导入文件系统 Promise 接口
import path from "path" // 导入路径处理模块
import z from "zod" // 导入 Zod 验证库
import { Config } from "../config/config" // 导入配置模块
import { Global } from "../global" // 导入全局配置模块
import { Instance } from "../project/instance" // 导入实例管理模块
import { Log } from "../util/log" // 导入日志工具

export namespace Snapshot {
  const log = Log.create({ service: "snapshot" }) // 创建日志实例

  /**
   * 创建快照
   * @returns Promise<string> - 快照哈希值
   */
  export async function track() {
    if (Instance.project.vcs !== "git") return // 如果不是 git 仓库，直接返回
    const cfg = await Config.get() // 获取配置
    if (cfg.snapshot === false) return // 如果禁用快照，直接返回
    const git = gitdir() // 获取 git 目录
    if (await fs.mkdir(git, { recursive: true })) {
      // 如果 git 目录不存在，创建目录
      await $`git init` // 初始化 git 仓库
        .env({
          // 设置环境变量
          ...process.env, // 继承当前环境变量
          GIT_DIR: git, // Git 目录
          GIT_WORK_TREE: Instance.worktree, // Git 工作树
        })
        .quiet() // 静默模式
        .nothrow() // 不抛出异常
      // 配置 git 不在 Windows 上转换行尾符
      await $`git --git-dir ${git} config core.autocrlf false`.quiet().nothrow() // 禁用自动行尾符转换
      log.info("initialized") // 记录初始化日志
    }
    await $`git --git-dir ${git} --work-tree ${Instance.worktree} add .`.quiet().cwd(Instance.directory).nothrow() // 添加所有文件到暂存区
    const hash = await $`git --git-dir ${git} --work-tree ${Instance.worktree} write-tree` // 写入树对象
      .quiet() // 静默模式
      .cwd(Instance.directory) // 工作目录
      .nothrow() // 不抛出异常
      .text() // 获取文本输出
    log.info("tracking", { hash, cwd: Instance.directory, git }) // 记录跟踪日志
    return hash.trim() // 返回哈希值
  }

  /**
   * 补丁信息的 Zod schema 定义
   */
  export const Patch = z.object({
    hash: z.string(), // 快照哈希值
    files: z.string().array(), // 文件列表
  })
  export type Patch = z.infer<typeof Patch> // 补丁信息类型

  /**
   * 获取补丁
   * @param hash - 快照哈希值
   * @returns Promise<Patch> - 补丁信息
   */
  export async function patch(hash: string): Promise<Patch> {
    const git = gitdir() // 获取 git 目录
    await $`git --git-dir ${git} --work-tree ${Instance.worktree} add .`.quiet().cwd(Instance.directory).nothrow() // 添加所有文件到暂存区
    const result = // 获取差异
      await $`git -c core.autocrlf=false --git-dir ${git} --work-tree ${Instance.worktree} diff --no-ext-diff --name-only ${hash} -- .`
        .quiet() // 静默模式
        .cwd(Instance.directory) // 工作目录
        .nothrow() // 不抛出异常

    // 如果 git diff 失败，返回空补丁
    if (result.exitCode !== 0) {
      // 如果退出码非零
      log.warn("failed to get diff", { hash, exitCode: result.exitCode }) // 记录警告日志
      return { hash, files: [] } // 返回空补丁
    }

    const files = result.text() // 获取差异文本
    return {
      hash,
      files: files
        .trim() // 去除首尾空白
        .split("\n") // 按换行符分割
        .map((x) => x.trim()) // 去除每行空白
        .filter(Boolean) // 过滤空行
        .map((x) => path.join(Instance.worktree, x)), // 转换为绝对路径
    }
  }

  /**
   * 恢复快照
   * @param snapshot - 快照哈希值
   */
  export async function restore(snapshot: string) {
    log.info("restore", { commit: snapshot }) // 记录恢复日志
    const git = gitdir() // 获取 git 目录
    const result = // 读取树并检出索引
      await $`git --git-dir ${git} --work-tree ${Instance.worktree} read-tree ${snapshot} && git --git-dir ${git} --work-tree ${Instance.worktree} checkout-index -a -f`
        .quiet() // 静默模式
        .cwd(Instance.worktree) // 工作树目录
        .nothrow() // 不抛出异常

    if (result.exitCode !== 0) {
      // 如果退出码非零
      log.error("failed to restore snapshot", {
        // 记录错误日志
        snapshot, // 快照哈希值
        exitCode: result.exitCode, // 退出码
        stderr: result.stderr.toString(), // 标准错误输出
        stdout: result.stdout.toString(), // 标准输出
      })
    }
  }

  /**
   * 回退补丁
   * @param patches - 补丁列表
   */
  export async function revert(patches: Patch[]) {
    const files = new Set<string>() // 已处理的文件集合
    const git = gitdir() // 获取 git 目录
    for (const item of patches) {
      // 遍历补丁
      for (const file of item.files) {
        // 遍历文件
        if (files.has(file)) continue // 如果文件已处理，跳过
        log.info("reverting", { file, hash: item.hash }) // 记录回退日志
        const result = await $`git --git-dir ${git} --work-tree ${Instance.worktree} checkout ${item.hash} -- ${file}` // 检出指定哈希的文件
          .quiet() // 静默模式
          .cwd(Instance.worktree) // 工作树目录
          .nothrow() // 不抛出异常
        if (result.exitCode !== 0) {
          // 如果退出码非零
          const relativePath = path.relative(Instance.worktree, file) // 计算相对路径
          const checkTree = // 检查文件是否在快照中存在
            await $`git --git-dir ${git} --work-tree ${Instance.worktree} ls-tree ${item.hash} -- ${relativePath}`
              .quiet() // 静默模式
              .cwd(Instance.worktree) // 工作树目录
              .nothrow() // 不抛出异常
          if (checkTree.exitCode === 0 && checkTree.text().trim()) {
            // 如果文件在快照中存在
            log.info("file existed in snapshot but checkout failed, keeping", {
              // 记录日志
              file, // 文件路径
            })
          } else {
            // 如果文件不在快照中
            log.info("file did not exist in snapshot, deleting", { file }) // 记录日志
            await fs.unlink(file).catch(() => {}) // 删除文件
          }
        }
        files.add(file) // 添加到已处理集合
      }
    }
  }

  /**
   * 获取差异
   * @param hash - 快照哈希值
   * @returns Promise<string> - 差异文本
   */
  export async function diff(hash: string) {
    const git = gitdir() // 获取 git 目录
    await $`git --git-dir ${git} --work-tree ${Instance.worktree} add .`.quiet().cwd(Instance.directory).nothrow() // 添加所有文件到暂存区
    const result = // 获取差异
      await $`git -c core.autocrlf=false --git-dir ${git} --work-tree ${Instance.worktree} diff --no-ext-diff ${hash} -- .`
        .quiet() // 静默模式
        .cwd(Instance.worktree) // 工作树目录
        .nothrow() // 不抛出异常

    if (result.exitCode !== 0) {
      // 如果退出码非零
      log.warn("failed to get diff", {
        // 记录警告日志
        hash, // 快照哈希值
        exitCode: result.exitCode, // 退出码
        stderr: result.stderr.toString(), // 标准错误输出
        stdout: result.stdout.toString(), // 标准输出
      })
      return "" // 返回空字符串
    }

    return result.text().trim() // 返回差异文本
  }

  /**
   * 文件差异信息的 Zod schema 定义
   */
  export const FileDiff = z
    .object({
      file: z.string(), // 文件路径
      before: z.string(), // 修改前的内容
      after: z.string(), // 修改后的内容
      additions: z.number(), // 新增行数
      deletions: z.number(), // 删除行数
    })
    .meta({
      ref: "FileDiff", // 引用名称
    })
  export type FileDiff = z.infer<typeof FileDiff> // 文件差异信息类型

  /**
   * 获取完整差异
   * @param from - 起始快照哈希值
   * @param to - 结束快照哈希值
   * @returns Promise<FileDiff[]> - 文件差异列表
   */
  export async function diffFull(from: string, to: string): Promise<FileDiff[]> {
    const git = gitdir() // 获取 git 目录
    const result: FileDiff[] = [] // 差异结果列表
    for await (const line of $`git -c core.autocrlf=false --git-dir ${git} --work-tree ${Instance.worktree} diff --no-ext-diff --no-renames --numstat ${from} ${to} -- .` // 获取差异统计
      .quiet() // 静默模式
      .cwd(Instance.directory) // 工作目录
      .nothrow() // 不抛出异常
      .lines()) {
      // 逐行处理
      if (!line) continue // 跳过空行
      const [additions, deletions, file] = line.split("\t") // 分割行：新增行数、删除行数、文件路径
      const isBinaryFile = additions === "-" && deletions === "-" // 判断是否为二进制文件
      const before = isBinaryFile // 获取修改前的内容
        ? "" // 二进制文件为空
        : await $`git -c core.autocrlf=false --git-dir ${git} --work-tree ${Instance.worktree} show ${from}:${file}` // 获取起始快照的文件内容
            .quiet() // 静默模式
            .nothrow() // 不抛出异常
            .text() // 获取文本输出
      const after = isBinaryFile // 获取修改后的内容
        ? "" // 二进制文件为空
        : await $`git -c core.autocrlf=false --git-dir ${git} --work-tree ${Instance.worktree} show ${to}:${file}` // 获取结束快照的文件内容
            .quiet() // 静默模式
            .nothrow() // 不抛出异常
            .text() // 获取文本输出
      result.push({
        // 添加到结果列表
        file, // 文件路径
        before, // 修改前的内容
        after, // 修改后的内容
        additions: parseInt(additions), // 新增行数
        deletions: parseInt(deletions), // 删除行数
      })
    }
    return result // 返回差异列表
  }

  /**
   * 获取 git 目录
   * @returns string - git 目录路径
   */
  function gitdir() {
    const project = Instance.project // 获取项目信息
    return path.join(Global.Path.data, "snapshot", project.id) // 构造 git 目录路径
  }
}
