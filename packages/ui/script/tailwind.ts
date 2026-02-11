#!/usr/bin/env bun

// 读取颜色配置文件内容
const colors = await Bun.file(import.meta.dir + "/colors.txt").text()

// 存储生成的 CSS 变量
const variables = []
// 遍历颜色配置的每一行
for (const line of colors.split("\n")) {
  // 跳过空行
  if (!line.trim()) continue
  // 解析变量名（格式如：--color-red-500: #ff0000）
  const [variable] = line.trim().split(":")
  // 提取颜色名称（去掉前缀 "--"）
  const name = variable!.trim().substring(2)
  // 生成 CSS 变量定义
  variables.push(`--color-${name}: var(--${name});`)
}

// 生成 Tailwind CSS 主题配置输出
const output = `
/* 由 script/tailwind.ts 自动生成 */
/* 请勿手动编辑此文件 */

@theme {
  --color-*: initial;
  ${variables.join("\n  ")}
}
`

// 将生成的 CSS 写入目标文件
await Bun.file(import.meta.dir + "/../src/styles/tailwind/colors.css").write(output.trim())
