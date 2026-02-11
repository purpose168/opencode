import { APIEvent } from "@solidjs/start"
import { DownloadPlatform } from "./types"

/**
 * 资产文件名映射
 * 不同平台对应的实际文件名
 */
const assetNames: Record<string, string> = {
  "darwin-aarch64-dmg": "opencode-desktop-darwin-aarch64.dmg",  // macOS ARM 版本
  "darwin-x64-dmg": "opencode-desktop-darwin-x64.dmg",          // macOS Intel 版本
  "windows-x64-nsis": "opencode-desktop-windows-x64.exe",        // Windows 64位版本
  "linux-x64-deb": "opencode-desktop-linux-amd64.deb",           // Linux Debian 包
  "linux-x64-appimage": "opencode-desktop-linux-amd64.AppImage",  // Linux AppImage 包
  "linux-x64-rpm": "opencode-desktop-linux-x86_64.rpm",          // Linux RPM 包
} satisfies Record<DownloadPlatform, string>

/**
 * 下载文件名映射
 * 不同平台对应的显示文件名
 * 在服务器端处理可以保留我们不想重命名的平台的原始名称
 */
const downloadNames: Record<string, string> = {
  "darwin-aarch64-dmg": "OpenCode Desktop.dmg",            // macOS ARM 版本显示名称
  "darwin-x64-dmg": "OpenCode Desktop.dmg",                // macOS Intel 版本显示名称
  "windows-x64-nsis": "OpenCode Desktop Installer.exe",    // Windows 版本显示名称
} satisfies { [K in DownloadPlatform]?: string }

/**
 * 处理下载请求
 * @param platform 平台标识
 * @returns 下载响应
 */
export async function GET({ params: { platform } }: APIEvent) {
  const assetName = assetNames[platform]
  if (!assetName) return new Response("未找到", { status: 404 })

  const resp = await fetch(`https://github.com/sst/opencode/releases/latest/download/${assetName}`, {
    cf: {
      // 以防 GitHub Releases 有速率限制
      cacheTtl: 60 * 60 * 24,
      cacheEverything: true,
    },
  } as any)

  const downloadName = downloadNames[platform]

  const headers = new Headers(resp.headers)
  if (downloadName) headers.set("content-disposition", `attachment; filename="${downloadName}"`)

  return new Response(resp.body, { ...resp, headers })
}
