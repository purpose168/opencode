/**
 * 颜色工具函数
 * 
 * 该文件包含了各种颜色转换和生成的工具函数，
 * 支持 HEX、RGB、OKLCH 等颜色空间之间的转换，
 * 以及颜色缩放、混合等操作
 */
import type { HexColor, OklchColor } from "./types"

/**
 * 将 HEX 颜色转换为 RGB 颜色
 * 
 * @param hex - HEX 格式的颜色字符串，例如 "#FF0000"
 * @returns RGB 颜色对象，包含 r、g、b 三个属性，值范围为 0-1
 */
export function hexToRgb(hex: HexColor): { r: number; g: number; b: number } {
  const h = hex.replace("#", "")
  // 处理缩写形式的 HEX 颜色，例如 "#FFF" 转换为 "#FFFFFF"
  const full = h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h

  const num = parseInt(full, 16) // 将十六进制字符串转换为数字
  return {
    r: ((num >> 16) & 255) / 255, // 提取红色通道
    g: ((num >> 8) & 255) / 255, // 提取绿色通道
    b: (num & 255) / 255, // 提取蓝色通道
  }
}

/**
 * 将 RGB 颜色转换为 HEX 颜色
 * 
 * @param r - 红色通道值，范围为 0-1
 * @param g - 绿色通道值，范围为 0-1
 * @param b - 蓝色通道值，范围为 0-1
 * @returns HEX 格式的颜色字符串，例如 "#FF0000"
 */
export function rgbToHex(r: number, g: number, b: number): HexColor {
  // 将单个通道值转换为十六进制字符串
  const toHex = (v: number) => {
    const clamped = Math.max(0, Math.min(1, v)) // 限制值范围在 0-1 之间
    const int = Math.round(clamped * 255) // 转换为 0-255 范围的整数
    return int.toString(16).padStart(2, "0") // 转换为十六进制并补零
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}` // 组合成完整的 HEX 颜色字符串
}

/**
 * 将线性 RGB 转换为 sRGB
 * 
 * @param c - 线性 RGB 值，范围为 0-1
 * @returns sRGB 值，范围为 0-1
 */
function linearToSrgb(c: number): number {
  if (c <= 0.0031308) return c * 12.92
  return 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

/**
 * 将 sRGB 转换为线性 RGB
 * 
 * @param c - sRGB 值，范围为 0-1
 * @returns 线性 RGB 值，范围为 0-1
 */
function srgbToLinear(c: number): number {
  if (c <= 0.04045) return c / 12.92
  return Math.pow((c + 0.055) / 1.055, 2.4)
}

/**
 * 将 RGB 颜色转换为 OKLCH 颜色
 * 
 * @param r - 红色通道值，范围为 0-1
 * @param g - 绿色通道值，范围为 0-1
 * @param b - 蓝色通道值，范围为 0-1
 * @returns OKLCH 颜色对象，包含 l（亮度）、c（色度）、h（色相）三个属性
 */
export function rgbToOklch(r: number, g: number, b: number): OklchColor {
  // 将 sRGB 转换为线性 RGB
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)

  // 转换到 LMS 空间
  const l_ = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const m_ = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const s_ = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

  // 取立方根
  const l = Math.cbrt(l_)
  const m = Math.cbrt(m_)
  const s = Math.cbrt(s_)

  // 转换到 OKLab 空间
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bOk = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s

  // 转换到 OKLCH 空间
  const C = Math.sqrt(a * a + bOk * bOk) // 计算色度
  let H = Math.atan2(bOk, a) * (180 / Math.PI) // 计算色相
  if (H < 0) H += 360 // 确保色相在 0-360 范围内

  return { l: L, c: C, h: H }
}

/**
 * 将 OKLCH 颜色转换为 RGB 颜色
 * 
 * @param oklch - OKLCH 颜色对象，包含 l（亮度）、c（色度）、h（色相）三个属性
 * @returns RGB 颜色对象，包含 r、g、b 三个属性，值范围为 0-1
 */
export function oklchToRgb(oklch: OklchColor): { r: number; g: number; b: number } {
  const { l: L, c: C, h: H } = oklch

  // 将 OKLCH 转换为 OKLab
  const a = C * Math.cos((H * Math.PI) / 180)
  const b = C * Math.sin((H * Math.PI) / 180)

  // 转换到 LMS 空间
  const l = L + 0.3963377774 * a + 0.2158037573 * b
  const m = L - 0.1055613458 * a - 0.0638541728 * b
  const s = L - 0.0894841775 * a - 1.291485548 * b

  // 立方
  const l3 = l * l * l
  const m3 = m * m * m
  const s3 = s * s * s

  // 转换到线性 RGB
  const lr = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
  const lg = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
  const lb = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3

  // 转换到 sRGB
  return {
    r: linearToSrgb(lr),
    g: linearToSrgb(lg),
    b: linearToSrgb(lb),
  }
}

/**
 * 将 HEX 颜色转换为 OKLCH 颜色
 * 
 * @param hex - HEX 格式的颜色字符串，例如 "#FF0000"
 * @returns OKLCH 颜色对象，包含 l（亮度）、c（色度）、h（色相）三个属性
 */
export function hexToOklch(hex: HexColor): OklchColor {
  const { r, g, b } = hexToRgb(hex) // 先转换为 RGB
  return rgbToOklch(r, g, b) // 再转换为 OKLCH
}

/**
 * 将 OKLCH 颜色转换为 HEX 颜色
 * 
 * @param oklch - OKLCH 颜色对象，包含 l（亮度）、c（色度）、h（色相）三个属性
 * @returns HEX 格式的颜色字符串，例如 "#FF0000"
 */
export function oklchToHex(oklch: OklchColor): HexColor {
  const { r, g, b } = oklchToRgb(oklch) // 先转换为 RGB
  return rgbToHex(r, g, b) // 再转换为 HEX
}

/**
 * 生成颜色缩放系列
 * 
 * @param seed - 种子颜色，HEX 格式的颜色字符串
 * @param isDark - 是否为暗色主题
 * @returns 包含 12 个颜色的数组，从浅到深（或从深到浅）的渐变系列
 */
export function generateScale(seed: HexColor, isDark: boolean): HexColor[] {
  const base = hexToOklch(seed) // 将种子颜色转换为 OKLCH
  const scale: HexColor[] = []

  // 亮度步骤，根据主题类型调整
  const lightSteps = isDark
    ? [0.15, 0.18, 0.22, 0.26, 0.32, 0.38, 0.46, 0.56, base.l, base.l - 0.05, 0.75, 0.93]
    : [0.99, 0.97, 0.94, 0.9, 0.85, 0.79, 0.72, 0.64, base.l, base.l + 0.05, 0.45, 0.25]

  // 色度乘数，根据主题类型调整
  const chromaMultipliers = isDark
    ? [0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.85, 1, 1, 0.9, 0.6]
    : [0.1, 0.15, 0.25, 0.35, 0.45, 0.55, 0.7, 0.85, 1, 1, 0.95, 0.85]

  // 生成 12 个颜色
  for (let i = 0; i < 12; i++) {
    scale.push(
      oklchToHex({
        l: lightSteps[i], // 应用亮度步骤
        c: base.c * chromaMultipliers[i], // 应用色度乘数
        h: base.h, // 保持原始色相
      }),
    )
  }

  return scale
}

/**
 * 生成中性颜色缩放系列
 * 
 * @param seed - 种子颜色，HEX 格式的颜色字符串
 * @param isDark - 是否为暗色主题
 * @returns 包含 12 个中性颜色的数组，从浅到深（或从深到浅）的渐变系列
 */
export function generateNeutralScale(seed: HexColor, isDark: boolean): HexColor[] {
  const base = hexToOklch(seed) // 将种子颜色转换为 OKLCH
  const scale: HexColor[] = []
  const neutralChroma = Math.min(base.c, 0.02) // 限制色度，确保颜色为中性

  // 亮度步骤，根据主题类型调整
  const lightSteps = isDark
    ? [0.13, 0.16, 0.2, 0.24, 0.28, 0.33, 0.4, 0.52, 0.58, 0.66, 0.82, 0.96]
    : [0.995, 0.98, 0.96, 0.94, 0.91, 0.88, 0.84, 0.78, 0.62, 0.56, 0.46, 0.2]

  // 生成 12 个中性颜色
  for (let i = 0; i < 12; i++) {
    scale.push(
      oklchToHex({
        l: lightSteps[i], // 应用亮度步骤
        c: neutralChroma, // 使用中性色度
        h: base.h, // 保持原始色相
      }),
    )
  }

  return scale
}

/**
 * 生成透明度缩放系列
 * 
 * @param scale - 基础颜色数组
 * @param isDark - 是否为暗色主题
 * @returns 包含 12 个透明度渐变颜色的数组
 */
export function generateAlphaScale(scale: HexColor[], isDark: boolean): HexColor[] {
  // 透明度值，根据主题类型调整
  const alphas = isDark
    ? [0.02, 0.04, 0.08, 0.12, 0.16, 0.2, 0.26, 0.36, 0.44, 0.52, 0.76, 0.96]
    : [0.01, 0.03, 0.06, 0.09, 0.12, 0.15, 0.2, 0.28, 0.48, 0.56, 0.64, 0.88]

  // 为每个颜色应用透明度
  return scale.map((hex, i) => {
    const { r, g, b } = hexToRgb(hex) // 将 HEX 转换为 RGB
    const a = alphas[i] // 获取当前透明度值

    const bg = isDark ? 0 : 1 // 背景颜色，暗色为黑色，亮色为白色
    // 计算混合后的 RGB 值
    const blendedR = r * a + bg * (1 - a)
    const blendedG = g * a + bg * (1 - a)
    const blendedB = b * a + bg * (1 - a)

    return rgbToHex(blendedR, blendedG, blendedB) // 转换回 HEX
  })
}

/**
 * 混合两种颜色
 * 
 * @param color1 - 第一种颜色，HEX 格式的颜色字符串
 * @param color2 - 第二种颜色，HEX 格式的颜色字符串
 * @param amount - 混合比例，范围为 0-1，0 表示完全使用 color1，1 表示完全使用 color2
 * @returns 混合后的颜色，HEX 格式的颜色字符串
 */
export function mixColors(color1: HexColor, color2: HexColor, amount: number): HexColor {
  const c1 = hexToOklch(color1) // 将第一种颜色转换为 OKLCH
  const c2 = hexToOklch(color2) // 将第二种颜色转换为 OKLCH

  // 在 OKLCH 空间中线性插值
  return oklchToHex({
    l: c1.l + (c2.l - c1.l) * amount, // 亮度插值
    c: c1.c + (c2.c - c1.c) * amount, // 色度插值
    h: c1.h + (c2.h - c1.h) * amount, // 色相插值
  })
}

/**
 * 使颜色变亮
 * 
 * @param color - 原始颜色，HEX 格式的颜色字符串
 * @param amount - 变亮的程度，范围为 0-1
 * @returns 变亮后的颜色，HEX 格式的颜色字符串
 */
export function lighten(color: HexColor, amount: number): HexColor {
  const oklch = hexToOklch(color) // 将颜色转换为 OKLCH
  return oklchToHex({
    ...oklch,
    l: Math.min(1, oklch.l + amount), // 增加亮度，限制在 1 以内
  })
}

/**
 * 使颜色变暗
 * 
 * @param color - 原始颜色，HEX 格式的颜色字符串
 * @param amount - 变暗的程度，范围为 0-1
 * @returns 变暗后的颜色，HEX 格式的颜色字符串
 */
export function darken(color: HexColor, amount: number): HexColor {
  const oklch = hexToOklch(color) // 将颜色转换为 OKLCH
  return oklchToHex({
    ...oklch,
    l: Math.max(0, oklch.l - amount), // 减少亮度，限制在 0 以上
  })
}

/**
 * 为颜色添加透明度
 * 
 * @param color - 原始颜色，HEX 格式的颜色字符串
 * @param alpha - 透明度值，范围为 0-1
 * @returns RGBA 格式的颜色字符串，例如 "rgba(255, 0, 0, 0.5)"
 */
export function withAlpha(color: HexColor, alpha: number): string {
  const { r, g, b } = hexToRgb(color) // 将 HEX 转换为 RGB
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`
}
