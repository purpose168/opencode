import logoLight from "../asset/logo-ornate-light.svg"
import logoDark from "../asset/logo-ornate-dark.svg"
import copyLogoLight from "../asset/lander/logo-light.svg"
import copyLogoDark from "../asset/lander/logo-dark.svg"
import copyWordmarkLight from "../asset/lander/wordmark-light.svg"
import copyWordmarkDark from "../asset/lander/wordmark-dark.svg"
import copyBrandAssetsLight from "../asset/lander/brand-assets-light.svg"
import copyBrandAssetsDark from "../asset/lander/brand-assets-dark.svg"

// 用于复制的 SVG 文件（与按钮图标分开）
// 请用您实际的 SVG 文件替换这些文件
import copyLogoSvgLight from "../asset/lander/opencode-logo-light.svg"
import copyLogoSvgDark from "../asset/lander/opencode-logo-dark.svg"
import copyWordmarkSvgLight from "../asset/lander/opencode-wordmark-light.svg"
import copyWordmarkSvgDark from "../asset/lander/opencode-wordmark-dark.svg"
import { A, createAsync, useNavigate } from "@solidjs/router"
import { createMemo, Match, Show, Switch } from "solid-js"
import { createStore } from "solid-js/store"
import { github } from "~/lib/github"
import { createEffect, onCleanup } from "solid-js"
import { config } from "~/config"
import "./header-context-menu.css"

/**
 * 检查是否为深色模式
 * @returns 是否为深色模式
 */
const isDarkMode = () => window.matchMedia("(prefers-color-scheme: dark)").matches

/**
 * 获取 SVG 内容
 * @param svgPath SVG 文件路径
 * @returns SVG 文本内容
 */
const fetchSvgContent = async (svgPath: string): Promise<string> => {
  try {
    const response = await fetch(svgPath)
    const svgText = await response.text()
    return svgText
  } catch (err) {
    console.error("获取 SVG 内容失败:", err)
    throw err
  }
}

/**
 * 头部组件
 */
export function Header(props: { zen?: boolean; hideGetStarted?: boolean }) {
  const navigate = useNavigate()
  // 异步获取 GitHub 数据
  const githubData = createAsync(() => github())
  // 格式化星标数量
  const starCount = createMemo(() =>
    githubData()?.stars
      ? new Intl.NumberFormat("en-US", {
          notation: "compact",     // 紧凑表示法
          compactDisplay: "short", // 简短显示
        }).format(githubData()?.stars!)
      : config.github.starsFormatted.compact,
  )

  // 创建状态存储
  const [store, setStore] = createStore({
    mobileMenuOpen: false,      // 移动端菜单是否打开
    contextMenuOpen: false,      // 上下文菜单是否打开
    contextMenuPosition: { x: 0, y: 0 }, // 上下文菜单位置
  })

  // 监听上下文菜单状态
  createEffect(() => {
    const handleClickOutside = () => {
      setStore("contextMenuOpen", false)
    }

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault()
      setStore("contextMenuOpen", false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setStore("contextMenuOpen", false)
      }
    }

    if (store.contextMenuOpen) {
      document.addEventListener("click", handleClickOutside)
      document.addEventListener("contextmenu", handleContextMenu)
      document.addEventListener("keydown", handleKeyDown)
      onCleanup(() => {
        document.removeEventListener("click", handleClickOutside)
        document.removeEventListener("contextmenu", handleContextMenu)
        document.removeEventListener("keydown", handleKeyDown)
      })
    }
  })

  /**
   * 处理 Logo 上下文菜单
   */
  const handleLogoContextMenu = (event: MouseEvent) => {
    event.preventDefault()
    const logoElement = (event.currentTarget as HTMLElement).querySelector("a")
    if (logoElement) {
      const rect = logoElement.getBoundingClientRect()
      setStore("contextMenuPosition", {
        x: rect.left - 16,
        y: rect.bottom + 8,
      })
    }
    setStore("contextMenuOpen", true)
  }

  /**
   * 复制文字标记到剪贴板
   */
  const copyWordmarkToClipboard = async () => {
    try {
      const isDark = isDarkMode()
      const wordmarkSvgPath = isDark ? copyWordmarkSvgDark : copyWordmarkSvgLight
      const wordmarkSvg = await fetchSvgContent(wordmarkSvgPath)
      await navigator.clipboard.writeText(wordmarkSvg)
    } catch (err) {
      console.error("复制文字标记到剪贴板失败:", err)
    }
  }

  /**
   * 复制 Logo 到剪贴板
   */
  const copyLogoToClipboard = async () => {
    try {
      const isDark = isDarkMode()
      const logoSvgPath = isDark ? copyLogoSvgDark : copyLogoSvgLight
      const logoSvg = await fetchSvgContent(logoSvgPath)
      await navigator.clipboard.writeText(logoSvg)
    } catch (err) {
      console.error("复制 Logo 到剪贴板失败:", err)
    }
  }

  return (
    <section data-component="top">
      <div onContextMenu={handleLogoContextMenu}>
        <A href="/">
          <img data-slot="logo light" src={logoLight} alt="opencode logo light" width="189" height="34" />
          <img data-slot="logo dark" src={logoDark} alt="opencode logo dark" width="189" height="34" />
        </A>
      </div>

      <Show when={store.contextMenuOpen}>
        <div
          class="context-menu"
          style={`left: ${store.contextMenuPosition.x}px; top: ${store.contextMenuPosition.y}px;`}
        >
          <button class="context-menu-item" onClick={copyLogoToClipboard}>
            <img data-slot="copy light" src={copyLogoLight} alt="Logo" />
            <img data-slot="copy dark" src={copyLogoDark} alt="Logo" />
            复制 Logo 为 SVG
          </button>
          <button class="context-menu-item" onClick={copyWordmarkToClipboard}>
            <img data-slot="copy light" src={copyWordmarkLight} alt="Wordmark" />
            <img data-slot="copy dark" src={copyWordmarkDark} alt="Wordmark" />
            复制文字标记为 SVG
          </button>
          <button class="context-menu-item" onClick={() => navigate("/brand")}>
            <img data-slot="copy light" src={copyBrandAssetsLight} alt="Brand Assets" />
            <img data-slot="copy dark" src={copyBrandAssetsDark} alt="Brand Assets" />
            品牌资产
          </button>
        </div>
      </Show>
      <nav data-component="nav-desktop">
        <ul>
          <li>
            <a href={config.github.repoUrl} target="_blank">
              GitHub <span>[{starCount()}]</span>
            </a>
          </li>
          <li>
            <a href="/docs">文档</a>
          </li>
          <li>
            <A href="/enterprise">企业版</A>
          </li>
          <li>
            <Switch>
              <Match when={props.zen}>
                <a href="/auth">登录</a>
              </Match>
              <Match when={!props.zen}>
                <A href="/zen">Zen</A>
              </Match>
            </Switch>
          </li>
          <Show when={!props.hideGetStarted}>
            {" "}
            <li>
              {" "}
              <A href="/download" data-slot="cta-button">
                {" "}
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {" "}
                  <path
                    d="M12.1875 9.75L9.00001 12.9375L5.8125 9.75M9.00001 2.0625L9 12.375M14.4375 15.9375H3.5625"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="square"
                  />{" "}
                </svg>{" "}
                免费{" "}
              </A>{" "}
            </li>
          </Show>
        </ul>
      </nav>
      <nav data-component="nav-mobile">
        <button
          type="button"
          data-component="nav-mobile-toggle"
          aria-expanded="false"
          aria-controls="nav-mobile-menu"
          class="nav-toggle"
          onClick={() => setStore("mobileMenuOpen", !store.mobileMenuOpen)}
        >
          <span class="sr-only">打开菜单</span>
          <Switch>
            <Match when={store.mobileMenuOpen}>
              <svg
                class="icon icon-close"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12.7071 11.9993L18.0104 17.3026L17.3033 18.0097L12 12.7064L6.6967 18.0097L5.98959 17.3026L11.2929 11.9993L5.98959 6.69595L6.6967 5.98885L12 11.2921L17.3033 5.98885L18.0104 6.69595L12.7071 11.9993Z"
                  fill="currentColor"
                />
              </svg>
            </Match>
            <Match when={!store.mobileMenuOpen}>
              <svg
                class="icon icon-hamburger"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M19 17H5V16H19V17Z" fill="currentColor" />
                <path d="M19 8H5V7H19V8Z" fill="currentColor" />
              </svg>
            </Match>
          </Switch>
        </button>

        <Show when={store.mobileMenuOpen}>
          <div id="nav-mobile-menu" data-component="nav-mobile">
            <nav data-component="nav-mobile-menu-list">
              <ul>
                <li>
                  <A href="/">首页</A>
                </li>
                <li>
                  <a href={config.github.repoUrl} target="_blank">
                    GitHub <span>[{starCount()}]</span>
                  </a>
                </li>
                <li>
                  <a href="/docs">文档</a>
                </li>
                <li>
                  <A href="/enterprise">企业版</A>
                </li>
                <li>
                  <Switch>
                    <Match when={props.zen}>
                      <a href="/auth">登录</a>
                    </Match>
                    <Match when={!props.zen}>
                      <A href="/zen">Zen</A>
                    </Match>
                  </Switch>
                </li>
                <Show when={!props.hideGetStarted}>
                  <li>
                    <A href="/download" data-slot="cta-button">
                      免费开始使用
                    </A>
                  </li>
                </Show>
              </ul>
            </nav>
          </div>
        </Show>
      </nav>
    </section>
  )
}
