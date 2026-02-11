/**
 * 默认主题配置
 * 
 * 该文件导入并导出所有默认主题，
 * 包括 OC-1、Tokyo Night、Dracula 等流行主题
 */
import type { DesktopTheme } from "./types"
import oc1ThemeJson from "./themes/oc-1.json"
import tokyoThemeJson from "./themes/tokyonight.json"
import draculaThemeJson from "./themes/dracula.json"
import monokaiThemeJson from "./themes/monokai.json"
import solarizedThemeJson from "./themes/solarized.json"
import nordThemeJson from "./themes/nord.json"
import catppuccinThemeJson from "./themes/catppuccin.json"
import ayuThemeJson from "./themes/ayu.json"
import oneDarkProThemeJson from "./themes/onedarkpro.json"
import shadesOfPurpleThemeJson from "./themes/shadesofpurple.json"

/**
 * OC-1 主题
 */
export const oc1Theme = oc1ThemeJson as DesktopTheme

/**
 * Tokyo Night 主题
 */
export const tokyonightTheme = tokyoThemeJson as DesktopTheme

/**
 * Dracula 主题
 */
export const draculaTheme = draculaThemeJson as DesktopTheme

/**
 * Monokai 主题
 */
export const monokaiTheme = monokaiThemeJson as DesktopTheme

/**
 * Solarized 主题
 */
export const solarizedTheme = solarizedThemeJson as DesktopTheme

/**
 * Nord 主题
 */
export const nordTheme = nordThemeJson as DesktopTheme

/**
 * Catppuccin 主题
 */
export const catppuccinTheme = catppuccinThemeJson as DesktopTheme

/**
 * Ayu 主题
 */
export const ayuTheme = ayuThemeJson as DesktopTheme

/**
 * One Dark Pro 主题
 */
export const oneDarkProTheme = oneDarkProThemeJson as DesktopTheme

/**
 * Shades of Purple 主题
 */
export const shadesOfPurpleTheme = shadesOfPurpleThemeJson as DesktopTheme

/**
 * 默认主题集合
 * 
 * 包含所有可用的默认主题，以主题 ID 为键
 */
export const DEFAULT_THEMES: Record<string, DesktopTheme> = {
  "oc-1": oc1Theme, // OC-1 主题
  tokyonight: tokyonightTheme, // Tokyo Night 主题
  dracula: draculaTheme, // Dracula 主题
  monokai: monokaiTheme, // Monokai 主题
  solarized: solarizedTheme, // Solarized 主题
  nord: nordTheme, // Nord 主题
  catppuccin: catppuccinTheme, // Catppuccin 主题
  ayu: ayuTheme, // Ayu 主题
  onedarkpro: oneDarkProTheme, // One Dark Pro 主题
  shadesofpurple: shadesOfPurpleTheme, // Shades of Purple 主题
}
