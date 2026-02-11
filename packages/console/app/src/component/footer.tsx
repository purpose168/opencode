import { createAsync } from "@solidjs/router"
import { createMemo } from "solid-js"
import { github } from "~/lib/github"
import { config } from "~/config"

/**
 * 页脚组件
 */
export function Footer() {
  // 异步获取 GitHub 数据
  const githubData = createAsync(() => github())
  
  // 格式化星标数量
  const starCount = createMemo(() =>
    githubData()?.stars
      ? new Intl.NumberFormat("en-US", {
          notation: "compact",     // 紧凑表示法
          compactDisplay: "short", // 简短显示
        }).format(githubData()!.stars!)
      : config.github.starsFormatted.compact,
  )

  return (
    <footer data-component="footer">
      <div data-slot="cell">
        <a href={config.github.repoUrl} target="_blank">
          GitHub <span>[{starCount()}]</span>
        </a>
      </div>
      <div data-slot="cell">
        <a href="/docs">文档</a>
      </div>
      <div data-slot="cell">
        <a href="/discord">Discord</a>
      </div>
      <div data-slot="cell">
        <a href={config.social.twitter}>X</a>
      </div>
    </footer>
  )
}
