import { query } from "@solidjs/router"
import { config } from "~/config"

/**
 * GitHub 数据查询
 */
export const github = query(async () => {
  "use server"
  // 请求头信息
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
  }
  
  // 构建 GitHub API 基础 URL
  const apiBaseUrl = config.github.repoUrl.replace("https://github.com/", "https://api.github.com/repos/")
  
  try {
    // 并行获取 GitHub 数据
    const [meta, releases, contributors] = await Promise.all([
      fetch(apiBaseUrl, { headers }).then((res) => res.json()),
      fetch(`${apiBaseUrl}/releases`, { headers }).then((res) => res.json()),
      fetch(`${apiBaseUrl}/contributors?per_page=1`, { headers }),
    ])
    
    // 获取最新版本
    const [release] = releases
    
    // 从响应头中提取贡献者数量
    const contributorCount = Number.parseInt(
      contributors.headers
        .get("Link")!
        .match(/&page=(\d+)>; rel="last"/)!
        .at(1)!,
    )
    
    return {
      stars: meta.stargazers_count,  // 星标数量
      release: {
        name: release.name,           // 版本名称
        url: release.html_url,        // 版本 URL
        tag_name: release.tag_name,   // 版本标签
      },
      contributors: contributorCount, // 贡献者数量
    }
  } catch (e) {
    console.error(e)
  }
  return undefined
}, "github")
