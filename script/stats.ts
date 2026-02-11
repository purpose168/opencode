#!/usr/bin/env bun

/**
 * 统计脚本
 * 用于收集和计算 OpenCode 的下载统计数据
 * 
 * 功能说明：
 * 1. 从 GitHub API 获取所有发布版本的下载数据
 * 2. 从 npm API 获取包的下载数据
 * 3. 计算总下载量并生成统计报告
 * 4. 将统计数据保存到 STATS.md 文件
 * 5. 将下载统计发送到 PostHog 分析服务
 */

/**
 * 发送事件到 PostHog 分析服务
 * @param event 事件名称
 * @param properties 事件属性
 */
async function sendToPostHog(event: string, properties: Record<string, any>) {
  const key = process.env["POSTHOG_KEY"]

  if (!key) {
    console.warn("POSTHOG_API_KEY 未设置，跳过 PostHog 事件")
    return
  }

  const response = await fetch("https://us.i.posthog.com/i/v0/e/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      distinct_id: "download",
      api_key: key,
      event,
      properties: {
        ...properties,
      },
    }),
  }).catch(() => null)

  if (response && !response.ok) {
    console.warn(`PostHog API 错误: ${response.status}`)
  }
}

/**
 * 资产接口，表示发布版本中的可下载文件
 */
interface Asset {
  name: string
  download_count: number
}

/**
 * 发布版本接口，包含版本信息和资产列表
 */
interface Release {
  tag_name: string
  name: string
  assets: Asset[]
}

/**
 * npm 下载量范围接口
 */
interface NpmDownloadsRange {
  start: string
  end: string
  package: string
  downloads: Array<{
    downloads: number
    day: string
  }>
}

/**
 * 获取 npm 包的下载量
 * @param packageName npm 包名
 * @returns 总下载量
 */
async function fetchNpmDownloads(packageName: string): Promise<number> {
  try {
    // 使用从 2020 年到当前年份 + 5 年的范围，确保永远有效
    const currentYear = new Date().getFullYear()
    const endYear = currentYear + 5
    const response = await fetch(`https://api.npmjs.org/downloads/range/2020-01-01:${endYear}-12-31/${packageName}`)
    if (!response.ok) {
      console.warn(`获取 ${packageName} 的 npm 下载量失败: ${response.status}`)
      return 0
    }
    const data: NpmDownloadsRange = await response.json()
    return data.downloads.reduce((total, day) => total + day.downloads, 0)
  } catch (error) {
    console.warn(`获取 ${packageName} 的 npm 下载量时出错:`, error)
    return 0
  }
}

/**
 * 获取 GitHub 发布版本列表
 * @returns 发布版本数组
 */
async function fetchReleases(): Promise<Release[]> {
  const releases: Release[] = []
  let page = 1
  const per = 100

  while (true) {
    const url = `https://api.github.com/repos/sst/opencode/releases?page=${page}&per_page=${per}`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`GitHub API 错误: ${response.status} ${response.statusText}`)
    }

    const batch: Release[] = await response.json()
    if (batch.length === 0) break

    releases.push(...batch)
    console.log(`已获取第 ${page} 页，包含 ${batch.length} 个发布版本`)

    if (batch.length < per) break
    page++
    // 等待 1 秒，避免触发 GitHub API 速率限制
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  return releases
}

/**
 * 计算发布版本的下载统计
 * @param releases 发布版本数组
 * @returns 总下载量和详细统计数据
 */
function calculate(releases: Release[]) {
  let total = 0
  const stats = []

  for (const release of releases) {
    let downloads = 0
    const assets = []

    for (const asset of release.assets) {
      downloads += asset.download_count
      assets.push({
        name: asset.name,
        downloads: asset.download_count,
      })
    }

    total += downloads
    stats.push({
      tag: release.tag_name,
      name: release.name,
      downloads,
      assets,
    })
  }

  return { total, stats }
}

/**
 * 保存统计数据到 STATS.md 文件
 * @param githubTotal GitHub 总下载量
 * @param npmDownloads npm 总下载量
 */
async function save(githubTotal: number, npmDownloads: number) {
  const file = "STATS.md"
  const date = new Date().toISOString().split("T")[0]
  const total = githubTotal + npmDownloads

  let previousGithub = 0
  let previousNpm = 0
  let previousTotal = 0
  let content = ""

  try {
    content = await Bun.file(file).text()
    const lines = content.trim().split("\n")

    // 从文件末尾开始查找，获取上一次的统计数据
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim()
      if (line.startsWith("|") && !line.includes("Date") && !line.includes("---")) {
        const match = line.match(
          /\|\s*[\d-]+\s*\|\s*([\d,]+)\s*(?:\([^)]*\))?\s*\|\s*([\d,]+)\s*(?:\([^)]*\))?\s*\|\s*([\d,]+)\s*(?:\([^)]*\))?\s*\|/,
        )
        if (match) {
          previousGithub = parseInt(match[1].replace(/,/g, ""))
          previousNpm = parseInt(match[2].replace(/,/g, ""))
          previousTotal = parseInt(match[3].replace(/,/g, ""))
          break
        }
      }
    }
  } catch {
    // 如果文件不存在或无法读取，创建新的文件内容
    content =
      "# 下载统计\n\n| 日期 | GitHub 下载量 | npm 下载量 | 总计 |\n|------|------------------|---------------|-------|\n"
  }

  // 计算与上一次统计的变化量
  const githubChange = githubTotal - previousGithub
  const npmChange = npmDownloads - previousNpm
  const totalChange = total - previousTotal

  // 格式化变化量字符串
  const githubChangeStr =
    githubChange > 0
      ? ` (+${githubChange.toLocaleString()})`
      : githubChange < 0
        ? ` (${githubChange.toLocaleString()})`
        : " (+0)"
  const npmChangeStr =
    npmChange > 0 ? ` (+${npmChange.toLocaleString()})` : npmChange < 0 ? ` (${npmChange.toLocaleString()})` : " (+0)"
  const totalChangeStr =
    totalChange > 0
      ? ` (+${totalChange.toLocaleString()})`
      : totalChange < 0
        ? ` (${totalChange.toLocaleString()})`
        : " (+0)"

  // 生成新的统计行
  const line = `| ${date} | ${githubTotal.toLocaleString()}${githubChangeStr} | ${npmDownloads.toLocaleString()}${npmChangeStr} | ${total.toLocaleString()}${totalChangeStr} |\n`

  // 如果文件内容不包含标题，添加标题
  if (!content.includes("# 下载统计")) {
    content =
      "# 下载统计\n\n| 日期 | GitHub 下载量 | npm 下载量 | 总计 |\n|------|------------------|---------------|-------|\n"
  }

  // 写入文件并格式化
  await Bun.write(file, content + line)
  await Bun.spawn(["bunx", "prettier", "--write", file]).exited

  console.log(
    `\n已将统计数据追加到 ${file}: GitHub ${githubTotal.toLocaleString()}${githubChangeStr}, npm ${npmDownloads.toLocaleString()}${npmChangeStr}, 总计 ${total.toLocaleString()}${totalChangeStr}`,
  )
}

// 开始执行统计流程
console.log("正在获取 sst/opencode 的 GitHub 发布版本...\n")

const releases = await fetchReleases()
console.log(`\n共获取到 ${releases.length} 个发布版本\n`)

const { total: githubTotal, stats } = calculate(releases)

console.log("正在获取 opencode-ai 的 npm 历史下载量...\n")
const npmDownloads = await fetchNpmDownloads("opencode-ai")
console.log(`已获取 npm 历史下载量: ${npmDownloads.toLocaleString()}\n`)

// 保存统计数据
await save(githubTotal, npmDownloads)

// 发送统计数据到 PostHog
await sendToPostHog("download", {
  count: githubTotal,
  source: "github",
})

await sendToPostHog("download", {
  count: npmDownloads,
  source: "npm",
})

// 计算总下载量
const totalDownloads = githubTotal + npmDownloads

// 输出统计结果
console.log("=".repeat(60))
console.log(`总下载量: ${totalDownloads.toLocaleString()}`)
console.log(`  GitHub: ${githubTotal.toLocaleString()}`)
console.log(`  npm: ${npmDownloads.toLocaleString()}`)
console.log("=".repeat(60))

console.log("-".repeat(60))
console.log(`GitHub 总计: ${githubTotal.toLocaleString()} 次下载，跨越 ${releases.length} 个发布版本`)
console.log(`npm 总计: ${npmDownloads.toLocaleString()} 次下载`)
console.log(`合并总计: ${totalDownloads.toLocaleString()} 次下载`)
