/**
 * 主题管理上下文
 * 
 * 该文件定义了主题管理的上下文，包括主题切换、颜色方案管理、
 * 主题预览等功能，使用 SolidJS 的 Context API 进行状态管理
 */
import { onMount, onCleanup, createEffect } from "solid-js"
import { createStore } from "solid-js/store"
import type { DesktopTheme } from "./types"
import { resolveThemeVariant, themeToCss } from "./resolve"
import { DEFAULT_THEMES } from "./default-themes"
import { createSimpleContext } from "../context/helper"

/**
 * 颜色方案类型
 * 
 * @typedef {'light' | 'dark' | 'system'}
 * - light: 亮色主题
 * - dark: 暗色主题
 * - system: 跟随系统设置
 */
export type ColorScheme = "light" | "dark" | "system"

/**
 * 存储键值定义
 * 
 * 用于在 localStorage 中存储主题相关的设置
 */
const STORAGE_KEYS = {
  THEME_ID: "opencode-theme-id", // 主题 ID
  COLOR_SCHEME: "opencode-color-scheme", // 颜色方案
  THEME_CSS_LIGHT: "opencode-theme-css-light", // 亮色主题 CSS
  THEME_CSS_DARK: "opencode-theme-css-dark", // 暗色主题 CSS
} as const

/**
 * 主题样式元素的 ID
 */
const THEME_STYLE_ID = "oc-theme"

/**
 * 确保主题样式元素存在
 * 
 * 如果已经存在主题样式元素，则返回该元素；
 * 如果不存在，则创建一个新的样式元素并添加到文档头部
 * 
 * @returns HTMLStyleElement - 主题样式元素
 */
function ensureThemeStyleElement(): HTMLStyleElement {
  const existing = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null
  if (existing) return existing
  const element = document.createElement("style")
  element.id = THEME_STYLE_ID
  document.head.appendChild(element)
  return element
}

/**
 * 获取系统的颜色模式
 * 
 * 通过媒体查询检测系统的首选颜色方案
 * 
 * @returns 'light' | 'dark' - 系统的颜色模式
 */
function getSystemMode(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

/**
 * 应用主题 CSS
 * 
 * 根据主题、主题 ID 和模式生成并应用 CSS 样式
 * 
 * @param theme - 桌面主题对象
 * @param themeId - 主题 ID
 * @param mode - 颜色模式：'light' 或 'dark'
 */
function applyThemeCss(theme: DesktopTheme, themeId: string, mode: "light" | "dark") {
  const isDark = mode === "dark"
  const variant = isDark ? theme.dark : theme.light // 根据模式选择主题变体
  const tokens = resolveThemeVariant(variant, isDark) // 解析主题变体为令牌
  const css = themeToCss(tokens) // 将令牌转换为 CSS

  // 缓存主题 CSS 到本地存储（除了默认主题）
  if (themeId !== "oc-1") {
    try {
      localStorage.setItem(isDark ? STORAGE_KEYS.THEME_CSS_DARK : STORAGE_KEYS.THEME_CSS_LIGHT, css)
    } catch {}
  }

  // 生成完整的 CSS
  const fullCss = `:root {
  color-scheme: ${mode};
  --text-mix-blend-mode: ${isDark ? "plus-lighter" : "multiply"};
  ${css}
}`

  // 移除预加载的主题样式
  document.getElementById("oc-theme-preload")?.remove()
  // 应用主题样式
  ensureThemeStyleElement().textContent = fullCss
  // 设置文档的主题和颜色方案数据属性
  document.documentElement.dataset.theme = themeId
  document.documentElement.dataset.colorScheme = mode
}

/**
 * 缓存主题变体
 * 
 * 为亮色和暗色模式缓存主题 CSS 到本地存储
 * 
 * @param theme - 桌面主题对象
 * @param themeId - 主题 ID
 */
function cacheThemeVariants(theme: DesktopTheme, themeId: string) {
  if (themeId === "oc-1") return // 默认主题不需要缓存
  for (const mode of ["light", "dark"] as const) {
    const isDark = mode === "dark"
    const variant = isDark ? theme.dark : theme.light // 根据模式选择主题变体
    const tokens = resolveThemeVariant(variant, isDark) // 解析主题变体为令牌
    const css = themeToCss(tokens) // 将令牌转换为 CSS
    try {
      localStorage.setItem(isDark ? STORAGE_KEYS.THEME_CSS_DARK : STORAGE_KEYS.THEME_CSS_LIGHT, css) // 缓存到本地存储
    } catch {}
  }
}

/**
 * 主题上下文
 * 
 * 提供主题管理功能，包括主题切换、颜色方案管理、主题预览等
 * 
 * @returns {
 *   useTheme: () => ThemeContext - 使用主题上下文的钩子
 *   ThemeProvider: React.ComponentType - 主题上下文提供者组件
 * }
 */
export const { use: useTheme, provider: ThemeProvider } = createSimpleContext({
  name: "Theme",
  init: (props: { defaultTheme?: string }) => {
    // 创建主题状态存储
    const [store, setStore] = createStore({
      themes: DEFAULT_THEMES as Record<string, DesktopTheme>, // 所有可用主题
      themeId: props.defaultTheme ?? "oc-1", // 当前主题 ID，默认为 oc-1
      colorScheme: "system" as ColorScheme, // 当前颜色方案，默认为系统
      mode: getSystemMode(), // 当前颜色模式，根据系统设置
      previewThemeId: null as string | null, // 预览主题 ID
      previewScheme: null as ColorScheme | null, // 预览颜色方案
    })

    // 组件挂载时的操作
    onMount(() => {
      // 监听系统颜色方案变化
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      const handler = () => {
        if (store.colorScheme === "system") {
          setStore("mode", getSystemMode())
        }
      }
      mediaQuery.addEventListener("change", handler)
      onCleanup(() => mediaQuery.removeEventListener("change", handler))

      // 从本地存储加载保存的主题和颜色方案
      const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME_ID)
      const savedScheme = localStorage.getItem(STORAGE_KEYS.COLOR_SCHEME) as ColorScheme | null
      if (savedTheme && store.themes[savedTheme]) {
        setStore("themeId", savedTheme)
      }
      if (savedScheme) {
        setStore("colorScheme", savedScheme)
        if (savedScheme !== "system") {
          setStore("mode", savedScheme)
        }
      }
      // 缓存当前主题的变体
      const currentTheme = store.themes[store.themeId]
      if (currentTheme) {
        cacheThemeVariants(currentTheme, store.themeId)
      }
    })

    // 当主题或模式变化时应用主题 CSS
    createEffect(() => {
      const theme = store.themes[store.themeId]
      if (theme) {
        applyThemeCss(theme, store.themeId, store.mode)
      }
    })

    /**
     * 设置主题
     * 
     * @param id - 主题 ID
     */
    const setTheme = (id: string) => {
      const theme = store.themes[id]
      if (!theme) {
        console.warn(`Theme "${id}" not found`)
        return
      }
      setStore("themeId", id)
      localStorage.setItem(STORAGE_KEYS.THEME_ID, id)
      cacheThemeVariants(theme, id)
    }

    /**
     * 设置颜色方案
     * 
     * @param scheme - 颜色方案：'light' | 'dark' | 'system'
     */
    const setColorScheme = (scheme: ColorScheme) => {
      setStore("colorScheme", scheme)
      localStorage.setItem(STORAGE_KEYS.COLOR_SCHEME, scheme)
      setStore("mode", scheme === "system" ? getSystemMode() : scheme)
    }

    return {
      themeId: () => store.themeId, // 获取当前主题 ID
      colorScheme: () => store.colorScheme, // 获取当前颜色方案
      mode: () => store.mode, // 获取当前颜色模式
      themes: () => store.themes, // 获取所有可用主题
      setTheme, // 设置主题
      setColorScheme, // 设置颜色方案
      // 注册新主题
      registerTheme: (theme: DesktopTheme) => setStore("themes", theme.id, theme),
      // 预览主题
      previewTheme: (id: string) => {
        const theme = store.themes[id]
        if (!theme) return
        setStore("previewThemeId", id)
        const previewMode = store.previewScheme
          ? store.previewScheme === "system"
            ? getSystemMode()
            : store.previewScheme
          : store.mode
        applyThemeCss(theme, id, previewMode)
      },
      // 预览颜色方案
      previewColorScheme: (scheme: ColorScheme) => {
        setStore("previewScheme", scheme)
        const previewMode = scheme === "system" ? getSystemMode() : scheme
        const id = store.previewThemeId ?? store.themeId
        const theme = store.themes[id]
        if (theme) {
          applyThemeCss(theme, id, previewMode)
        }
      },
      // 提交预览
      commitPreview: () => {
        if (store.previewThemeId) {
          setTheme(store.previewThemeId)
        }
        if (store.previewScheme) {
          setColorScheme(store.previewScheme)
        }
        setStore("previewThemeId", null)
        setStore("previewScheme", null)
      },
      // 取消预览
      cancelPreview: () => {
        setStore("previewThemeId", null)
        setStore("previewScheme", null)
        const theme = store.themes[store.themeId]
        if (theme) {
          applyThemeCss(theme, store.themeId, store.mode)
        }
      },
    }
  },
})
