import { Link, Meta } from "@solidjs/meta"

/**
 * 网站图标组件
 * 设置网站的各种图标和相关元信息
 */
export const Favicon = () => {
  return (
    <>
      {/* 96x96 像素的 PNG 格式图标 */}
      <Link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
      {/* 快捷方式图标 */}
      <Link rel="shortcut icon" href="/favicon.ico" />
      {/* Apple 触摸设备图标（180x180 像素） */}
      <Link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      {/* Web 应用清单文件 */}
      <Link rel="manifest" href="/site.webmanifest" />
      {/* Apple 移动 Web 应用标题 */}
      <Meta name="apple-mobile-web-app-title" content="OpenCode" />
    </>
  )
}
