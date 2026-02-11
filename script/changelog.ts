#!/usr/bin/env bun

import { $ } from "bun"
import { createOpencode } from "@opencode-ai/sdk"
import { parseArgs } from "util"

/**
 * 团队成员列表
 * 用于识别核心团队贡献者，排除在社区贡献者统计之外
 */
export const team = [
  "actions-user",
  "opencode",
  "rekram1-node",
  "thdxr",
  "kommander",
  "jayair",
  "fwang",
  "adamdotdevin",
  "iamdavidhill",
  "opencode-agent[bot]",
]

/**
 * 获取最新发布版本
 * @returns 最新版本号（不包含v前缀）
 */
export async function getLatestRelease() {
  return fetch("https://api.github.com/repos/sst/opencode/releases/latest")
    .then((res) => {
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    })
    .then((data: any) => data.tag_name.replace(/^v/, ""))
}

/**
 * 提交记录类型
 */
type Commit = {
  hash: string // 提交哈希
  author: string | null // 作者登录名
  message: string // 提交信息
  areas: Set<string> // 影响的代码区域
}

/**
 * 获取两个版本之间的提交记录
 * @param from 起始版本
 * @param to 结束版本
 * @returns 处理后的提交记录数组
 */
export async function getCommits(from: string, to: string): Promise<Commit[]> {
  const fromRef = from.startsWith("v") ? from : `v${from}`
  const toRef = to === "HEAD" ? to : to.startsWith("v") ? to : `v${to}`

  // 从GitHub API获取带有用户名的提交数据
  const compare =
    await $`gh api "/repos/sst/opencode/compare/${fromRef}...${toRef}" --jq '.commits[] | {sha: .sha, login: .author.login, message: .commit.message}'`.text()

  const commitData = new Map<string, { login: string | null; message: string }>()
  for (const line of compare.split("\n").filter(Boolean)) {
    const data = JSON.parse(line) as { sha: string; login: string | null; message: string }
    commitData.set(data.sha, { login: data.login, message: data.message.split("\n")[0] ?? "" })
  }

  // 获取影响相关包的提交
  const log =
    await $`git log ${fromRef}..${toRef} --oneline --format="%H" -- packages/opencode packages/sdk packages/plugin packages/desktop packages/app sdks/vscode packages/extensions github`.text()
  const hashes = log.split("\n").filter(Boolean)

  const commits: Commit[] = []
  for (const hash of hashes) {
    const data = commitData.get(hash)
    if (!data) continue

    const message = data.message
    // 跳过指定类型的提交
    if (message.match(/^(ignore:|test:|chore:|ci:|release:)/i)) continue

    // 获取提交修改的文件
    const files = await $`git diff-tree --no-commit-id --name-only -r ${hash}`.text()
    const areas = new Set<string>()

    // 根据修改的文件路径确定影响的代码区域
    for (const file of files.split("\n").filter(Boolean)) {
      if (file.startsWith("packages/opencode/src/cli/cmd/")) areas.add("tui")
      else if (file.startsWith("packages/opencode/")) areas.add("core")
      else if (file.startsWith("packages/desktop/src-tauri/")) areas.add("tauri")
      else if (file.startsWith("packages/desktop/")) areas.add("app")
      else if (file.startsWith("packages/app/")) areas.add("app")
      else if (file.startsWith("packages/sdk/")) areas.add("sdk")
      else if (file.startsWith("packages/plugin/")) areas.add("plugin")
      else if (file.startsWith("packages/extensions/")) areas.add("extensions/zed")
      else if (file.startsWith("sdks/vscode/")) areas.add("extensions/vscode")
      else if (file.startsWith("github/")) areas.add("github")
    }

    if (areas.size === 0) continue

    commits.push({
      hash: hash.slice(0, 7),
      author: data.login,
      message,
      areas,
    })
  }

  return filterRevertedCommits(commits)
}

/**
 * 过滤掉被撤销的提交
 * @param commits 提交记录数组
 * @returns 过滤后的提交记录数组
 */
function filterRevertedCommits(commits: Commit[]): Commit[] {
  const revertPattern = /^Revert "(.+)"$/
  const seen = new Map<string, Commit>()

  for (const commit of commits) {
    const match = commit.message.match(revertPattern)
    if (match) {
      // 是撤销提交 - 如果已经看到过原始提交，则移除原始提交
      const original = match[1]!
      if (seen.has(original)) seen.delete(original)
      else seen.set(commit.message, commit) // 如果原始提交不在范围内，则保留撤销提交
    } else {
      // 普通提交 - 如果存在对应的撤销提交，则移除该提交，否则添加
      const revertMsg = `Revert "${commit.message}"`
      if (seen.has(revertMsg)) seen.delete(revertMsg)
      else seen.set(commit.message, commit)
    }
  }

  return [...seen.values()]
}

/**
 * 代码区域到changelog部分的映射
 */
const sections = {
  core: "Core",
  tui: "TUI",
  app: "Desktop",
  tauri: "Desktop",
  sdk: "SDK",
  plugin: "SDK",
  "extensions/zed": "Extensions",
  "extensions/vscode": "Extensions",
  github: "Extensions",
} as const

/**
 * 获取提交所属的changelog部分
 * @param areas 影响的代码区域
 * @returns changelog部分名称
 */
function getSection(areas: Set<string>): string {
  // 多区域提交的优先级顺序
  const priority = ["core", "tui", "app", "tauri", "sdk", "plugin", "extensions/zed", "extensions/vscode", "github"]
  for (const area of priority) {
    if (areas.has(area)) return sections[area as keyof typeof sections]
  }
  return "Core"
}

/**
 * 为提交消息生成changelog摘要
 * @param opencode OpenCode客户端实例
 * @param message 提交消息
 * @returns 格式化的摘要
 */
async function summarizeCommit(opencode: Awaited<ReturnType<typeof createOpencode>>, message: string): Promise<string> {
  console.log("正在生成提交摘要:", message)
  const session = await opencode.client.session.create()
  const result = await opencode.client.session
    .prompt({
      path: { id: session.data!.id },
      body: {
        model: { providerID: "opencode", modelID: "claude-sonnet-4-5" },
        tools: {
          "*": false,
        },
        parts: [
          {
            type: "text",
            text: `为changelog条目总结此提交消息。只返回一行摘要，以大写字母开头。要简洁但具体。如果提交消息已经写得很好，只需清理它（大写，修复拼写错误，正确的语法）。不要包含任何前缀，如"fix:"或"feat:"。\n\n提交: ${message}`,
          },
        ],
      },
      signal: AbortSignal.timeout(120_000),
    })
    .then((x) => x.data?.parts?.find((y) => y.type === "text")?.text ?? message)
  return result.trim()
}

/**
 * 生成changelog
 * @param commits 提交记录数组
 * @param opencode OpenCode客户端实例
 * @returns changelog行数组
 */
export async function generateChangelog(commits: Commit[], opencode: Awaited<ReturnType<typeof createOpencode>>) {
  // 并行处理提交摘要，每次最多10个
  const BATCH_SIZE = 10
  const summaries: string[] = []
  for (let i = 0; i < commits.length; i += BATCH_SIZE) {
    const batch = commits.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(batch.map((c) => summarizeCommit(opencode, c.message)))
    summaries.push(...results)
  }

  // 按部分分组changelog条目
  const grouped = new Map<string, string[]>()
  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i]!
    const section = getSection(commit.areas)
    // 为非团队成员的贡献者添加署名
    const attribution = commit.author && !team.includes(commit.author) ? ` (@${commit.author})` : ""
    const entry = `- ${summaries[i]}${attribution}`

    if (!grouped.has(section)) grouped.set(section, [])
    grouped.get(section)!.push(entry)
  }

  // 按指定顺序输出部分
  const sectionOrder = ["Core", "TUI", "Desktop", "SDK", "Extensions"]
  const lines: string[] = []
  for (const section of sectionOrder) {
    const entries = grouped.get(section)
    if (!entries || entries.length === 0) continue
    lines.push(`## ${section}`)
    lines.push(...entries)
  }

  return lines
}

/**
 * 获取贡献者信息
 * @param from 起始版本
 * @param to 结束版本
 * @returns 贡献者及其提交的映射
 */
export async function getContributors(from: string, to: string) {
  const fromRef = from.startsWith("v") ? from : `v${from}`
  const toRef = to === "HEAD" ? to : to.startsWith("v") ? to : `v${to}`
  // 从GitHub API获取提交数据
  const compare =
    await $`gh api "/repos/sst/opencode/compare/${fromRef}...${toRef}" --jq '.commits[] | {login: .author.login, message: .commit.message}'`.text()
  const contributors = new Map<string, string[]>()

  for (const line of compare.split("\n").filter(Boolean)) {
    const { login, message } = JSON.parse(line) as { login: string | null; message: string }
    const title = message.split("\n")[0] ?? ""
    // 跳过指定类型的提交
    if (title.match(/^(ignore:|test:|chore:|ci:|release:)/i)) continue

    // 只记录非团队成员的贡献
    if (login && !team.includes(login)) {
      if (!contributors.has(login)) contributors.set(login, [])
      contributors.get(login)?.push(title)
    }
  }

  return contributors
}

/**
 * 构建发布说明
 * @param from 起始版本
 * @param to 结束版本
 * @returns 发布说明行数组
 */
export async function buildNotes(from: string, to: string) {
  const commits = await getCommits(from, to)

  if (commits.length === 0) {
    return []
  }

  console.log("正在生成自 " + from + " 以来的变更日志")

  const opencode = await createOpencode({ port: 5044 })
  const notes: string[] = []

  try {
    // 生成changelog
    const lines = await generateChangelog(commits, opencode)
    notes.push(...lines)
    console.log("---- 生成的变更日志 ----")
    console.log(notes.join("\n"))
    console.log("------------------------")
  } catch (error) {
    // 处理超时错误
    if (error instanceof Error && error.name === "TimeoutError") {
      console.log("变更日志生成超时，使用原始提交消息")
      for (const commit of commits) {
        const attribution = commit.author && !team.includes(commit.author) ? ` (@${commit.author})` : ""
        notes.push(`- ${commit.message}${attribution}`)
      }
    } else {
      throw error
    }
  } finally {
    opencode.server.close()
  }

  // 添加贡献者信息
  const contributors = await getContributors(from, to)

  if (contributors.size > 0) {
    notes.push("")
    notes.push(`**感谢 ${contributors.size} 位社区贡献者${contributors.size > 1 ? "们" : ""}:**`)
    for (const [username, userCommits] of contributors) {
      notes.push(`- @${username}:`)
      for (const c of userCommits) {
        notes.push(`  - ${c}`)
      }
    }
  }

  return notes
}

// CLI入口点
if (import.meta.main) {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      from: { type: "string", short: "f" },
      to: { type: "string", short: "t", default: "HEAD" },
      help: { type: "boolean", short: "h", default: false },
    },
  })

  if (values.help) {
    console.log(`
使用方法: bun script/changelog.ts [选项]

选项:
  -f, --from <version>   起始版本 (默认: 最新GitHub发布版本)
  -t, --to <ref>         结束引用 (默认: HEAD)
  -h, --help             显示此帮助信息

示例:
  bun script/changelog.ts                     # 从最新版本到HEAD
  bun script/changelog.ts --from 1.0.200      # 从v1.0.200到HEAD
  bun script/changelog.ts -f 1.0.200 -t 1.0.205
`)
    process.exit(0)
  }

  const to = values.to!
  const from = values.from ?? (await getLatestRelease())

  console.log(`正在生成变更日志: v${from} -> ${to}\n`)

  const notes = await buildNotes(from, to)
  console.log("\n=== 最终发布说明 ===")
  console.log(notes.join("\n"))
}
