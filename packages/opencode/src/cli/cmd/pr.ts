import { Instance } from "@/project/instance" // 导入实例管理模块
import { $ } from "bun" // 导入 Bun 的命令执行工具
import { UI } from "../ui" // 导入 UI 工具
import { cmd } from "./cmd" // 导入命令创建工具

/**
 * PrCommand PR 命令定义
 *
 * 功能说明：
 * - 定义 "pr" 命令，用于获取并检出 GitHub PR 分支
 * - 支持自动处理 fork 的 PR
 * - 支持检测并导入 opencode 会话链接
 * - 检出成功后自动启动 opencode TUI
 *
 * 使用场景：
 * - 需要测试某个 PR 的代码时
 * - 需要查看某个 PR 的代码变更时
 * - 需要在 PR 环境中运行 opencode 时
 *
 * 命令格式：
 * - opencode pr <number>
 *
 * 参数说明：
 * - number（必需参数）：PR 编号
 *
 * 工作流程：
 * 1. 检查是否在 git 仓库中
 * 2. 使用 gh CLI 检出 PR 分支
 * 3. 处理 fork 的 PR（添加远程仓库并设置上游）
 * 4. 检测 PR 描述中的 opencode 会话链接
 * 5. 如果找到会话链接，导入会话
 * 6. 启动 opencode TUI（如果有会话 ID 则使用）
 *
 * 注意事项：
 * - 需要安装 gh CLI 并已认证
 * - 需要在 git 仓库中运行
 * - fork 的 PR 会自动添加远程仓库
 * - 会话链接格式：https://opncd.ai/s/<session-id>
 */
export const PrCommand = cmd({
  // 导出 PR 命令定义
  command: "pr <number>", // 命令名称和位置参数
  describe: "获取并检出 GitHub PR 分支，然后运行 opencode", // 命令描述：获取并检出 GitHub PR 分支，然后运行 opencode
  builder: (yargs) =>
    // 命令构建器
    yargs.positional("number", {
      // 定义位置参数 "number"
      type: "number", // 参数类型：数字
      describe: "要检出的 PR 编号", // 参数描述：要检出的 PR 编号
      demandOption: true, // 必需参数
    }),
  async handler(args) {
    // 命令处理函数，异步执行
    await Instance.provide({
      // 初始化应用环境
      directory: process.cwd(), // 在当前目录中执行
      async fn() {
        // 异步执行函数
        const project = Instance.project // 获取项目实例
        if (project.vcs !== "git") {
          // 如果不是 git 仓库
          UI.error("找不到git仓库。请从git仓库中运行此命令。") // 显示错误消息
          process.exit(1) // 退出程序
        }

        const prNumber = args.number // 获取 PR 编号
        const localBranchName = `pr/${prNumber}` // 生成本地分支名称
        UI.println(`正在获取并检出 PR #${prNumber}...`) // 显示进度消息

        // 使用 gh pr checkout 命令，并指定自定义分支名称
        // 使用 gh pr checkout 命令，并指定自定义分支名称
        const result = await $`gh pr checkout ${prNumber} --branch ${localBranchName} --force`.nothrow() // 执行检出命令

        if (result.exitCode !== 0) {
          // 如果检出失败
          UI.error(`检出 PR #${prNumber} 失败。请确保您已安装 gh CLI 并已认证。`) // 显示错误消息
          process.exit(1) // 退出程序
        }

        // Fetch PR info for fork handling and session link detection
        // 获取 PR 信息，用于处理 fork 和检测会话链接
        const prInfoResult =
          await $`gh pr view ${prNumber} --json headRepository,headRepositoryOwner,isCrossRepository,headRefName,body`.nothrow() // 获取 PR 信息（JSON 格式）

        let sessionId: string | undefined // 会话 ID（可选）

        if (prInfoResult.exitCode === 0) {
          // 如果获取 PR 信息成功
          const prInfoText = prInfoResult.text() // 获取 PR 信息文本
          if (prInfoText.trim()) {
            // 如果 PR 信息不为空
            const prInfo = JSON.parse(prInfoText) // 解析 PR 信息（JSON 格式）

            // Handle fork PRs
            // 处理 fork 的 PR
            if (prInfo && prInfo.isCrossRepository && prInfo.headRepository && prInfo.headRepositoryOwner) {
              // 如果是跨仓库的 PR（fork）
              const forkOwner = prInfo.headRepositoryOwner.login // 获取 fork 所有者
              const forkName = prInfo.headRepository.name // 获取 fork 仓库名称
              const remoteName = forkOwner // 远程仓库名称（使用 fork 所有者）

              // Check if remote already exists
              // 检查远程仓库是否已存在
              const remotes = (await $`git remote`.nothrow().text()).trim() // 获取所有远程仓库
              if (!remotes.split("\n").includes(remoteName)) {
                // 如果远程仓库不存在
                await $`git remote add ${remoteName} https://github.com/${forkOwner}/${forkName}.git`.nothrow() // 添加远程仓库
                UI.println(`已添加 fork 远程仓库：${remoteName}`) // 显示添加远程仓库消息
              }

              // Set upstream to the fork so pushes go there
              // 将上游设置为 fork，以便推送到 fork 仓库
              const headRefName = prInfo.headRefName // 获取 head 引用名称
              await $`git branch --set-upstream-to=${remoteName}/${headRefName} ${localBranchName}`.nothrow() // 设置上游分支
            }

            // Check for opencode session link in PR body
            // 检查 PR 描述中是否有 opencode 会话链接
            if (prInfo && prInfo.body) {
              // 如果 PR 描述存在
              const sessionMatch = prInfo.body.match(/https:\/\/opncd\.ai\/s\/([a-zA-Z0-9_-]+)/) // 匹配会话 URL
              if (sessionMatch) {
                // 如果找到会话链接
                const sessionUrl = sessionMatch[0] // 获取会话 URL
                UI.println(`找到 opencode 会话：${sessionUrl}`) // 显示找到会话消息
                UI.println(`正在导入会话...`) // 显示导入会话消息

                const importResult = await $`opencode import ${sessionUrl}`.nothrow() // 执行导入会话命令
                if (importResult.exitCode === 0) {
                  // 如果导入成功
                  const importOutput = importResult.text().trim() // 获取导入输出
                  // 从输出中提取会话 ID（格式："已导入会话：<session-id>"）
                  const sessionIdMatch = importOutput.match(/Imported session: ([a-zA-Z0-9_-]+)/) // 匹配已导入会话 ID（格式："已导入会话：<session-id>"）
                  if (sessionIdMatch) {
                    // 如果匹配到会话 ID
                    sessionId = sessionIdMatch[1] // 设置会话 ID
                    UI.println(`已导入会话：${sessionId}`) // 显示导入成功消息
                  }
                }
              }
            }
          }
        }

        UI.println(`已成功检出 PR #${prNumber} 为分支 '${localBranchName}'`) // 显示检出成功消息
        UI.println() // 输出空行
        UI.println("正在启动opencode...") // 显示启动消息
        UI.println() // 输出空行

        // Launch opencode TUI with session ID if available
        // 启动 opencode TUI（如果有会话 ID 则使用）
        const { spawn } = await import("child_process") // 导入子进程模块
        const opencodeArgs = sessionId ? ["-s", sessionId] : [] // opencode 参数（如果有会话 ID 则使用）
        const opencodeProcess = spawn("opencode", opencodeArgs, {
          // 启动 opencode 进程
          stdio: "inherit", // 标准输入输出继承
          cwd: process.cwd(), // 工作目录
        })

        await new Promise<void>((resolve, reject) => {
          // 等待进程结束
          opencodeProcess.on("exit", (code) => {
            // 监听进程退出事件
            if (code === 0)
              resolve() // 如果退出码为 0，表示成功
            else reject(new Error(`opencode 以代码 ${code} 退出`)) // 否则拒绝（抛出错误）
          })
          opencodeProcess.on("error", reject) // 监听进程错误事件
        })
      },
    })
  },
})
