#!/usr/bin/env bun
import { readdir, writeFile } from "fs/promises"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { config } from "../src/config.js"

// 获取当前文件所在目录
const __dirname = dirname(fileURLToPath(import.meta.url))
// 从配置中获取基础 URL
const BASE_URL = config.baseUrl
// 公共文件目录路径
const PUBLIC_DIR = join(__dirname, "../public")
// 路由目录路径
const ROUTES_DIR = join(__dirname, "../src/routes")
// 文档目录路径
const DOCS_DIR = join(__dirname, "../../../web/src/content/docs")

/**
 * 网站地图条目接口
 */
interface SitemapEntry {
  url: string       // 页面 URL
  priority: number  // 优先级 (0.0-1.0)
  changefreq: string // 更新频率
}

/**
 * 获取主路由
 * @returns 主路由数组
 */
async function getMainRoutes(): Promise<SitemapEntry[]> {
  const routes: SitemapEntry[] = []

  // 添加主要静态路由
  const staticRoutes = [
    { path: "/", priority: 1.0, changefreq: "daily" },         // 首页
    { path: "/enterprise", priority: 0.8, changefreq: "weekly" }, // 企业版
    { path: "/brand", priority: 0.6, changefreq: "monthly" },     // 品牌
    { path: "/zen", priority: 0.8, changefreq: "weekly" },        // Zen 页面
  ]

  for (const route of staticRoutes) {
    routes.push({
      url: `${BASE_URL}${route.path}`,
      priority: route.priority,
      changefreq: route.changefreq,
    })
  }

  return routes
}

/**
 * 获取文档路由
 * @returns 文档路由数组
 */
async function getDocsRoutes(): Promise<SitemapEntry[]> {
  const routes: SitemapEntry[] = []

  try {
    // 读取文档目录中的文件
    const files = await readdir(DOCS_DIR)

    for (const file of files) {
      // 只处理 .mdx 文件
      if (!file.endsWith(".mdx")) continue

      // 移除文件扩展名获取 slug
      const slug = file.replace(".mdx", "")
      // 构建路径，index 对应根文档路径
      const path = slug === "index" ? "/docs/" : `/docs/${slug}`

      routes.push({
        url: `${BASE_URL}${path}`,
        priority: slug === "index" ? 0.9 : 0.7, // 文档首页优先级更高
        changefreq: "weekly",
      })
    }
  } catch (error) {
    console.error("读取文档目录时出错:", error)
  }

  return routes
}

/**
 * 生成网站地图 XML
 * @param entries 网站地图条目数组
 * @returns XML 字符串
 */
function generateSitemapXML(entries: SitemapEntry[]): string {
  // 生成每个 URL 的 XML 元素
  const urls = entries
    .map(
      (entry) => `  <url>
    <loc>${entry.url}</loc>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
    )
    .join("\n")

  // 构建完整的 XML 文档
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
}

/**
 * 主函数
 */
async function main() {
  console.log("正在生成网站地图...")

  // 获取主路由和文档路由
  const mainRoutes = await getMainRoutes()
  const docsRoutes = await getDocsRoutes()

  // 合并所有路由
  const allRoutes = [...mainRoutes, ...docsRoutes]

  // 输出路由统计信息
  console.log(`找到 ${mainRoutes.length} 个主路由`)
  console.log(`找到 ${docsRoutes.length} 个文档路由`)
  console.log(`总计: ${allRoutes.length} 个路由`)

  // 生成网站地图 XML
  const xml = generateSitemapXML(allRoutes)

  // 定义输出路径并写入文件
  const outputPath = join(PUBLIC_DIR, "sitemap.xml")
  await writeFile(outputPath, xml, "utf-8")

  // 输出成功信息
  console.log(`✓ 网站地图已生成在 ${outputPath}`)
}

// 执行主函数
main()
