import { RGBA, SyntaxStyle, type TerminalColors } from "@opentui/core" // OpenTUI 核心库，提供终端界面渲染所需的核心类型和工具
// - SyntaxStyle：语法高亮样式类，用于定义代码语法的高亮显示规则
// - RGBA：红绿蓝透明度颜色值类，用于表示和操作颜色值（0-1 浮点范围）
// - type TerminalColors：终端调色板类型定义，描述终端的颜色配置信息

import path from "path" // Node.js 路径处理模块，用于处理文件路径的拼接、解析和规范化
// path 模块提供了许多用于处理文件和目录路径的实用函数

import { createEffect, createMemo } from "solid-js" // Solid.js 响应式状态管理和生命周期函数
// - createEffect：创建副作用函数，当依赖项变化时自动执行，用于响应式数据的同步和副作用处理
// - createMemo：创建派生值函数，当依赖项变化时自动重新计算，用于复杂计算结果的缓存和复用
// - onMount：挂载函数，在组件首次渲染后执行，用于初始化逻辑

import { useSync } from "@tui/context/sync" // 同步上下文钩子，用于访问同步状态数据（包括配置、智能体、模型、提供者、会话等）
// useSync 提供了对应用核心数据的访问接口，是数据流的核心枢纽

import { createSimpleContext } from "./helper" // 从 helper 模块导入创建简单上下文的方法，用于快速创建 Solid.js 上下文
// 这个方法封装了常见的上下文创建模式，减少样板代码，提高开发效率

// 导入所有内置主题配置文件（JSON 格式）
// 每个主题文件包含该主题的所有颜色配置、语法高亮规则等定义
// 使用 Bun 的 JSON 导入语法确保类型安全和正确的类型推断
import aura from "./theme/aura.json" with { type: "json" } // Aura 主题：现代柔和的渐变色彩主题
import ayu from "./theme/ayu.json" with { type: "json" } // Ayu 主题：快速、现代的亮色主题
import catppuccinFrappe from "./theme/catppuccin-frappe.json" with { type: "json" } // Catppuccin Frappe 主题：Catppuccin 的中等亮度变体
import catppuccinMacchiato from "./theme/catppuccin-macchiato.json" with { type: "json" } // Catppuccin Macchiato 主题：Catppuccin 的柔和变体
import catppuccin from "./theme/catppuccin.json" with { type: "json" } // Catppuccin 主题：柔和的粉彩色系主题
import cobalt2 from "./theme/cobalt2.json" with { type: "json" } // Cobalt2 主题：经典的 Sublime Text 风格主题
import cursor from "./theme/cursor.json" with { type: "json" } // Cursor 主题：AI 代码编辑器的官方主题
import dracula from "./theme/dracula.json" with { type: "json" } // Dracula 主题：深色系的经典编程主题
import everforest from "./theme/everforest.json" with { type: "json" } // Everforest 主题：自然森林风格的护眼主题
import flexoki from "./theme/flexoki.json" with { type: "json" } // Flexoki 主题：灵活的阅读友好主题
import github from "./theme/github.json" with { type: "json" } // GitHub 主题：GitHub 风格的亮色主题
import gruvbox from "./theme/gruvbox.json" with { type: "json" } // Gruvbox 主题：复古风格的暖色主题
import kanagawa from "./theme/kanagawa.json" with { type: "json" } // Kanagawa 主题：日本传统色彩风格的主题
import lucentOrng from "./theme/lucent-orng.json" with { type: "json" } // Lucent Orng 主题：透明的橙色主题变体
import material from "./theme/material.json" with { type: "json" } // Material 主题：Google Material Design 风格主题
import matrix from "./theme/matrix.json" with { type: "json" } // Matrix 主题：黑客帝国风格的绿色主题
import mercury from "./theme/mercury.json" with { type: "json" } // Mercury 主题：简洁的现代风格主题
import monokai from "./theme/monokai.json" with { type: "json" } // Monokai 主题：经典的深色编程主题
import nightowl from "./theme/nightowl.json" with { type: "json" } // Night Owl 主题：适合夜间编程的护眼主题
import nord from "./theme/nord.json" with { type: "json" } // Nord 主题：北极光色彩的冷色调主题
import onedark from "./theme/one-dark.json" with { type: "json" } // One Dark 主题：Atom 编辑器的经典深色主题
import opencode from "./theme/opencode.json" with { type: "json" } // OpenCode 主题：应用的品牌主题，蓝色系主调
import orng from "./theme/orng.json" with { type: "json" } // Orng 主题：橙色系强调的主题
import palenight from "./theme/palenight.json" with { type: "json" } // Palenight 主题：优雅的紫色调主题
import rosepine from "./theme/rosepine.json" with { type: "json" } // Rosé Pine 主题：柔和的粉色调主题
import solarized from "./theme/solarized.json" with { type: "json" } // Solarized 主题：高度可读的太阳神主题
import synthwave84 from "./theme/synthwave84.json" with { type: "json" } // Synthwave '84 主题：复古波浪风格的霓虹主题
import tokyonight from "./theme/tokyonight.json" with { type: "json" } // Tokyo Night 主题：东京夜景风格的深色主题
import vercel from "./theme/vercel.json" with { type: "json" } // Vercel 主题：Vercel 风格的简洁主题
import vesper from "./theme/vesper.json" with { type: "json" } // Vesper 主题：精致的深色主题
import zenburn from "./theme/zenburn.json" with { type: "json" } // Zenburn 主题：禅修风格的低对比度主题

import { useKV } from "./kv" // 键值存储上下文钩子，用于持久化存储主题模式设置
// useKV 提供了对键值存储的访问，用于保存用户的主题偏好设置

import { useRenderer } from "@opentui/solid" // OpenTUI 渲染器上下文钩子，用于访问终端渲染器实例
// useRenderer 提供了对终端渲染器的访问，可以获取终端的颜色调色板等信息

import { createStore, produce } from "solid-js/store" // Solid.js 高级状态管理
// - createStore：创建响应式状态存储，用于管理复杂的数据结构，支持嵌套属性的响应式更新
// - produce：基于 Immer 的状态更新工具，允许以不可变的方式更新嵌套数据

import { Global } from "@/global" // 全局配置对象，提供项目级别的配置信息（如路径配置、应用设置等）
// Global 包含应用的全局配置，如状态目录路径、配置目录路径等

import { Filesystem } from "@/util/filesystem" // 文件系统工具，用于在目录层级中查找文件
// Filesystem.up() 方法用于从当前目录向上遍历查找指定名称的目录

// 主题颜色类型定义
// 描述了主题中所有可用的颜色配置字段及其类型
type ThemeColors = {
  // ==================== 基础颜色（用于 UI 元素） ====================
  primary: RGBA // 主要交互颜色：用于按钮、链接、高亮等主要交互元素
  secondary: RGBA // 次要交互颜色：用于次要按钮、图标等辅助元素
  accent: RGBA // 强调颜色：用于特别强调的元素，如选中状态
  error: RGBA // 错误颜色：用于显示错误、危险、删除等状态
  warning: RGBA // 警告颜色：用于显示警告、注意、提示等状态
  success: RGBA // 成功颜色：用于显示成功、完成、正向反馈等状态
  info: RGBA // 信息颜色：用于显示信息、提示、说明等状态

  // ==================== 文字颜色 ====================
  text: RGBA // 主要文字颜色：用于正文内容、标准文字显示
  textMuted: RGBA // 次要文字颜色：用于辅助说明、禁用状态、注释等
  selectedListItemText: RGBA // 列表项选中文字颜色：用于下拉列表、选择框等的选中项文字

  // ==================== 背景颜色（从浅到深的层级） ====================
  background: RGBA // 主背景颜色：用于主界面、主要内容区域的背景
  backgroundPanel: RGBA // 面板背景颜色：用于侧边栏、面板、弹窗等的背景
  backgroundElement: RGBA // 元素背景颜色：用于输入框、按钮等元素内部背景
  backgroundMenu: RGBA // 菜单背景颜色：用于下拉菜单、右键菜单的背景

  // ==================== 边框颜色 ====================
  border: RGBA // 标准边框颜色：用于分隔线、普通边框
  borderActive: RGBA // 激活边框颜色：用于聚焦状态、选中状态的边框
  borderSubtle: RGBA // 微妙边框颜色：用于非常淡的边框、分隔线

  // ==================== 代码差异对比颜色（Git Diff） ====================
  diffAdded: RGBA // 添加行颜色：用于显示新增代码行的文字颜色
  diffRemoved: RGBA // 删除行颜色：用于显示删除代码行的文字颜色
  diffContext: RGBA // 上下文行颜色：用于显示未修改代码行的文字颜色
  diffHunkHeader: RGBA // 代码块头部颜色：用于显示差异块头部的文字颜色
  diffHighlightAdded: RGBA // 高亮添加行颜色：用于显示用户新增行的文字颜色
  diffHighlightRemoved: RGBA // 高亮删除行颜色：用于显示用户删除行的文字颜色
  diffAddedBg: RGBA // 添加行背景颜色：用于显示新增代码行的背景色
  diffRemovedBg: RGBA // 删除行背景颜色：用于显示删除代码行的背景色
  diffContextBg: RGBA // 上下文行背景颜色：用于显示未修改代码行的背景色
  diffLineNumber: RGBA // 行号颜色：用于差异视图中的行号显示
  diffAddedLineNumberBg: RGBA // 添加行号背景颜色：用于新增行的行号背景
  diffRemovedLineNumberBg: RGBA // 删除行号背景颜色：用于删除行的行号背景

  // ==================== Markdown 渲染颜色 ====================
  markdownText: RGBA // Markdown 正文颜色：用于渲染 Markdown 文本内容
  markdownHeading: RGBA // Markdown 标题颜色：用于渲染各级标题（H1-H6）
  markdownLink: RGBA // Markdown 链接颜色：用于渲染链接的可见部分
  markdownLinkText: RGBA // Markdown 链接文字颜色：用于渲染链接的可点击文字
  markdownCode: RGBA // Markdown 行内代码颜色：用于渲染行内代码块
  markdownBlockQuote: RGBA // Markdown 引用颜色：用于渲染引用块（> 开头的行）
  markdownEmph: RGBA // Markdown 强调颜色：用于渲染斜体强调文字
  markdownStrong: RGBA // Markdown 加粗颜色：用于渲染粗体强调文字
  markdownHorizontalRule: RGBA // Markdown 分割线颜色：用于渲染水平分割线
  markdownListItem: RGBA // Markdown 列表项颜色：用于渲染无序列表项符号
  markdownListEnumeration: RGBA // Markdown 编号列表颜色：用于渲染有序列表编号
  markdownImage: RGBA // Markdown 图片颜色：用于渲染图片占位符
  markdownImageText: RGBA // Markdown 图片替代文字颜色：用于渲染图片的替代文字
  markdownCodeBlock: RGBA // Markdown 代码块颜色：用于渲染代码块的语言标识

  // ==================== 代码语法高亮颜色 ====================
  syntaxComment: RGBA // 注释颜色：用于代码中的注释内容
  syntaxKeyword: RGBA // 关键字颜色：用于编程语言关键字（如 if、for、function 等）
  syntaxFunction: RGBA // 函数颜色：用于函数名、方法名
  syntaxVariable: RGBA // 变量颜色：用于变量名、参数名
  syntaxString: RGBA // 字符串颜色：用于字符串字面量
  syntaxNumber: RGBA // 数字颜色：用于数字字面量
  syntaxType: RGBA // 类型颜色：用于类型定义、类型注解
  syntaxOperator: RGBA // 运算符颜色：用于运算符（如 +、-、*、/ 等）
  syntaxPunctuation: RGBA // 标点符号颜色：用于标点符号（如括号、逗号等）
}

// 完整主题类型定义
// 在 ThemeColors 的基础上添加额外的元数据字段
type Theme = ThemeColors & {
  _hasSelectedListItemText: boolean // 标记主题是否明确定义了 selectedListItemText 颜色
  thinkingOpacity: number // 思考状态（thinking）的透明度值，用于 AI 思考时的淡入淡出效果
}

/**
 * 计算选中状态下的前景色
 * 根据主题配置和背景颜色计算最适合的前景色，确保可读性
 *
 * @param theme - 目标主题对象
 * @returns 计算后的前景色（RGBA 格式）
 */
export function selectedForeground(theme: Theme): RGBA {
  // 如果主题明确定义了 selectedListItemText，直接使用该颜色
  if (theme._hasSelectedListItemText) {
    return theme.selectedListItemText
  }

  // 对于透明背景（a === 0），根据主色调计算对比度
  if (theme.background.a === 0) {
    // 使用亮度公式计算背景亮度（人类视觉感知权重）
    const { r, g, b } = theme.primary
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b

    // 亮度大于 0.5 使用黑色文字，否则使用白色文字
    return luminance > 0.5 ? RGBA.fromInts(0, 0, 0) : RGBA.fromInts(255, 255, 255)
  }

  // 默认回退到背景色
  return theme.background
}

// 类型别名定义（用于主题 JSON 配置）
type HexColor = `#${string}` // 十六进制颜色格式，如 #FF5733
type RefName = string // 颜色引用名称，用于引用同一主题中的其他颜色
type Variant = {
  dark: HexColor | RefName // 暗色模式的颜色值或引用
  light: HexColor | RefName // 亮色模式的颜色值或引用
}
type ColorValue = HexColor | RefName | Variant | RGBA // 颜色值的联合类型，支持多种格式

// 主题 JSON 配置结构类型
type ThemeJson = {
  $schema?: string // JSON Schema 地址，用于编辑器验证
  defs?: Record<string, HexColor | RefName> // 颜色定义映射，可以预先定义常用颜色
  theme: Omit<Record<keyof ThemeColors, ColorValue>, "selectedListItemText" | "backgroundMenu" | "thinkingOpacity"> & {
    // 主题颜色定义，继承 ThemeColors 的所有字段（排除三个特殊字段）
    selectedListItemText?: ColorValue // 可选的列表选中项文字颜色
    backgroundMenu?: ColorValue // 可选的菜单背景颜色
    thinkingOpacity?: number // 可选的思考状态透明度
  }
}

// 默认主题注册表
// 包含所有内置主题的名称和配置对象映射
export const DEFAULT_THEMES: Record<string, ThemeJson> = {
  aura, // Aura 主题
  ayu, // Ayu 主题
  catppuccin, // Catppuccin 主题
  ["catppuccin-frappe"]: catppuccinFrappe, // Catppuccin Frappe 主题（带破折号的名称需要括号语法）
  ["catppuccin-macchiato"]: catppuccinMacchiato, // Catppuccin Macchiato 主题
  cobalt2, // Cobalt2 主题
  cursor, // Cursor 主题
  dracula, // Dracula 主题
  everforest, // Everforest 主题
  flexoki, // Flexoki 主题
  github, // GitHub 主题
  gruvbox, // Gruvbox 主题
  kanagawa, // Kanagawa 主题
  material, // Material 主题
  matrix, // Matrix 主题
  mercury, // Mercury 主题
  monokai, // Monokai 主题
  nightowl, // Night Owl 主题
  nord, // Nord 主题
  ["one-dark"]: onedark, // One Dark 主题
  opencode, // OpenCode 主题
  orng, // Orng 主题
  ["lucent-orng"]: lucentOrng, // Lucent Orng 主题
  palenight, // Palenight 主题
  rosepine, // Rosé Pine 主题
  solarized, // Solarized 主题
  synthwave84, // Synthwave '84 主题
  tokyonight, // Tokyo Night 主题
  vesper, // Vesper 主题
  vercel, // Vercel 主题
  zenburn, // Zenburn 主题
}

/**
 * 解析主题配置
 * 将主题 JSON 配置转换为完整的主题对象，解析所有颜色引用和模式变体
 *
 * @param theme - 主题 JSON 配置对象
 * @param mode - 当前模式（"dark" 或 "light"）
 * @returns 解析后的完整主题对象
 */
function resolveTheme(theme: ThemeJson, mode: "dark" | "light") {
  // 提取颜色定义映射，用于解析颜色引用
  const defs = theme.defs ?? {}

  /**
   * 递归解析颜色值
   * 支持多种颜色格式的解析和引用链的展开
   *
   * @param c - 颜色值（可能是十六进制、引用、变体或 RGBA 对象）
   * @returns 解析后的 RGBA 颜色对象
   */
  function resolveColor(c: ColorValue): RGBA {
    // 如果已经是 RGBA 对象，直接返回
    if (c instanceof RGBA) return c

    // 处理字符串类型的颜色值
    if (typeof c === "string") {
      // 特殊值处理
      if (c === "transparent" || c === "none") return RGBA.fromInts(0, 0, 0, 0)

      // 十六进制颜色格式（如 #FF5733）
      if (c.startsWith("#")) return RGBA.fromHex(c)

      // 引用解析：先查找 defs 中的定义
      if (defs[c] != null) {
        return resolveColor(defs[c])
      }
      // 再查找 theme 中的定义
      else if (theme.theme[c as keyof ThemeColors] !== undefined) {
        return resolveColor(theme.theme[c as keyof ThemeColors]!)
      }
      // 引用未找到，抛出错误
      else {
        throw new Error(`Color reference "${c}" not found in defs or theme`)
      }
    }

    // 处理 ANSI 颜色码（数字类型）
    if (typeof c === "number") {
      return ansiToRgba(c)
    }

    // 处理变体类型（明暗模式）
    return resolveColor(c[mode])
  }

  // 解析主题中的所有颜色（排除特殊字段）
  const resolved = Object.fromEntries(
    Object.entries(theme.theme)
      .filter(([key]) => key !== "selectedListItemText" && key !== "backgroundMenu" && key !== "thinkingOpacity")
      .map(([key, value]) => {
        return [key, resolveColor(value as ColorValue)]
      }),
  ) as Partial<ThemeColors>

  // 单独处理 selectedListItemText（可选字段）
  const hasSelectedListItemText = theme.theme.selectedListItemText !== undefined
  if (hasSelectedListItemText) {
    resolved.selectedListItemText = resolveColor(theme.theme.selectedListItemText!)
  } else {
    // 向后兼容：如果未定义，使用背景色
    resolved.selectedListItemText = resolved.background
  }

  // 单独处理 backgroundMenu（可选字段）
  if (theme.theme.backgroundMenu !== undefined) {
    resolved.backgroundMenu = resolveColor(theme.theme.backgroundMenu)
  } else {
    // 回退到 backgroundElement
    resolved.backgroundMenu = resolved.backgroundElement
  }

  // 处理 thinkingOpacity（可选字段，默认 0.6）
  const thinkingOpacity = theme.theme.thinkingOpacity ?? 0.6

  // 返回完整的主题对象
  return {
    ...resolved,
    _hasSelectedListItemText: hasSelectedListItemText,
    thinkingOpacity,
  } as Theme
}

/**
 * ANSI 颜色码转 RGBA
 * 将终端 ANSI 颜色码转换为 RGBA 格式
 *
 * @param code - ANSI 颜色码（0-255）
 * @returns 转换后的 RGBA 颜色对象
 */
function ansiToRgba(code: number): RGBA {
  // 标准 ANSI 16 色（0-15）
  if (code < 16) {
    const ansiColors = [
      "#000000", // 0: 黑色
      "#800000", // 1: 红色
      "#008000", // 2: 绿色
      "#808000", // 3: 黄色
      "#000080", // 4: 蓝色
      "#800080", // 5: 洋红色
      "#008080", // 6: 青色
      "#c0c0c0", // 7: 亮灰色（白色）
      "#808080", // 8: 暗灰色（亮黑色）
      "#ff0000", // 9: 亮红色
      "#00ff00", // 10: 亮绿色
      "#ffff00", // 11: 亮黄色
      "#0000ff", // 12: 亮蓝色
      "#ff00ff", // 13: 亮洋红色
      "#00ffff", // 14: 亮青色
      "#ffffff", // 15: 亮白色
    ]
    return RGBA.fromHex(ansiColors[code] ?? "#000000")
  }

  // 6x6x6 颜色立方体（16-231）
  // 格式：16 + 36*r + 6*g + b，其中 r,g,b ∈ [0,5]
  if (code < 232) {
    const index = code - 16
    const b = index % 6
    const g = Math.floor(index / 6) % 6
    const r = Math.floor(index / 36)

    // 计算每个通道的值（0 或 55-255）
    const val = (x: number) => (x === 0 ? 0 : x * 40 + 55)
    return RGBA.fromInts(val(r), val(g), val(b))
  }

  // 灰度渐变色（232-255）
  // 8, 18, 28, ..., 238（每级递增 10）
  if (code < 256) {
    const gray = (code - 232) * 10 + 8
    return RGBA.fromInts(gray, gray, gray)
  }

  // 无效颜色码的回退处理
  return RGBA.fromInts(0, 0, 0)
}

// 创建主题上下文提供者
// 使用 createSimpleContext 工具函数快速创建一个主题管理上下文
// 这个上下文用于在整个应用组件树中管理主题状态、样式配置和主题切换功能
//
// 返回值包含两个主要部分：
// - use: 用于在子组件中获取主题操作函数的钩子函数
// - provider: 用于在父组件中提供主题上下文的组件
export const { use: useTheme, provider: ThemeProvider } = createSimpleContext({
  name: "Theme", // 上下文的名称，用于调试和错误提示
  init: (props: { mode: "dark" | "light" }) => {
    // 获取同步上下文和键值存储上下文
    const sync = useSync() // 用于访问配置中的主题设置
    const kv = useKV() // 用于保存和读取用户的主题偏好

    // 创建主题状态存储
    const [store, setStore] = createStore({
      themes: DEFAULT_THEMES, // 所有可用主题的映射
      mode: kv.get("theme_mode", props.mode) as "dark" | "light", // 当前主题模式，优先使用保存的设置
      active: (sync.data.config.theme ?? kv.get("theme", "opencode")) as string, // 当前激活的主题
      ready: false, // 主题是否就绪（系统主题需要获取终端调色板）
    })

    // 创建副作用：加载自定义主题
    createEffect(() => {
      getCustomThemes()
        .then((custom) => {
          // 将自定义主题合并到主题列表
          setStore(
            produce((draft) => {
              Object.assign(draft.themes, custom)
            }),
          )
        })
        .catch(() => {
          // 加载失败时回退到默认主题
          setStore("active", "opencode")
        })
        .finally(() => {
          // 如果不是系统主题，标记为就绪
          if (store.active !== "system") {
            setStore("ready", true)
          }
        })
    })

    // 获取渲染器实例，用于访问终端调色板
    const renderer = useRenderer()

    // 异步获取终端调色板并生成系统主题
    renderer
      .getPalette({
        size: 16, // 请求 16 色调色板（ANSI 标准颜色）
      })
      .then((colors) => {
        // 检查调色板是否有效
        if (!colors.palette[0]) {
          // 调色板无效的处理
          if (store.active === "system") {
            setStore(
              produce((draft) => {
                draft.active = "opencode" // 回退到默认主题
                draft.ready = true
              }),
            )
          }
          return
        }

        // 生成并注册系统主题
        setStore(
          produce((draft) => {
            draft.themes.system = generateSystem(colors, store.mode)
            // 如果当前激活的是系统主题，标记为就绪
            if (store.active === "system") {
              draft.ready = true
            }
          }),
        )
      })

    // 创建解析后的主题值的派生值
    const values = createMemo(() => {
      // 解析当前激活的主题，如果不存在则回退到 opencode 主题
      return resolveTheme(store.themes[store.active] ?? store.themes.opencode, store.mode)
    })

    // 创建语法高亮样式的派生值
    const syntax = createMemo(() => generateSyntax(values()))
    // 创建柔和语法高亮样式的派生值
    const subtleSyntax = createMemo(() => generateSubtleSyntax(values()))

    // 返回主题管理的操作接口
    return {
      // 主题颜色值的代理对象，支持点号访问
      theme: new Proxy(values(), {
        get(_target, prop) {
          // @ts-expect-error: Proxy 的类型推断问题，忽略类型检查
          return values()[prop]
        },
      }),

      // 获取当前激活的主题名称
      get selected() {
        return store.active
      },

      // 获取所有可用主题的映射
      all() {
        return store.themes
      },

      // 获取语法高亮样式
      syntax,

      // 获取柔和语法高亮样式
      subtleSyntax,

      // 获取当前主题模式
      mode() {
        return store.mode
      },

      // 设置主题模式（dark/light）
      setMode(mode: "dark" | "light") {
        setStore("mode", mode)
        kv.set("theme_mode", mode) // 持久化保存
      },

      // 设置当前主题
      set(theme: string) {
        setStore("active", theme)
        kv.set("theme", theme) // 持久化保存
      },

      // 获取主题就绪状态
      get ready() {
        return store.ready
      },
    }
  },
})

// 自定义主题文件匹配模式
const CUSTOM_THEME_GLOB = new Bun.Glob("themes/*.json")

/**
 * 加载自定义主题
 * 从配置目录和项目目录中扫描并加载自定义主题文件
 *
 * @returns 包含所有自定义主题的映射对象
 */
async function getCustomThemes() {
  // 确定搜索目录列表
  const directories = [
    Global.Path.config, // 全局配置目录
    ...(await Array.fromAsync(
      // 从当前工作目录向上遍历查找 .opencode 目录
      Filesystem.up({
        targets: [".opencode"],
        start: process.cwd(),
      }),
    )),
  ]

  const result: Record<string, ThemeJson> = {}

  // 遍历所有目录查找主题文件
  for (const dir of directories) {
    for await (const item of CUSTOM_THEME_GLOB.scan({
      absolute: true, // 返回绝对路径
      followSymlinks: true, // 跟随符号链接
      dot: true, // 包含隐藏文件
      cwd: dir, // 在指定目录中搜索
    })) {
      // 从文件路径提取主题名称
      const name = path.basename(item, ".json")
      // 读取并解析主题 JSON 文件
      result[name] = await Bun.file(item).json()
    }
  }

  return result
}

/**
 * 生成系统主题
 * 根据终端调色板自动生成匹配的主题配置
 *
 * @param colors - 终端调色板颜色信息
 * @param mode - 当前主题模式
 * @returns 生成的主题配置对象
 */
function generateSystem(colors: TerminalColors, mode: "dark" | "light"): ThemeJson {
  // 提取背景色和前景色
  const bg = RGBA.fromHex(colors.defaultBackground ?? colors.palette[0]!)
  const fg = RGBA.fromHex(colors.defaultForeground ?? colors.palette[7]!)
  // 过滤并转换调色板颜色为 RGBA 格式
  const palette = colors.palette.filter((x) => x !== null).map((x) => RGBA.fromHex(x))
  // 判断是否为暗色模式
  const isDark = mode == "dark"

  // 基于终端背景色生成灰度色阶
  const grays = generateGrayScale(bg, isDark)
  // 生成次要文字颜色
  const textMuted = generateMutedTextColor(bg, isDark)

  // ANSI 颜色引用映射
  const ansiColors = {
    black: palette[0],
    red: palette[1],
    green: palette[2],
    yellow: palette[3],
    blue: palette[4],
    magenta: palette[5],
    cyan: palette[6],
    white: palette[7],
  }

  // 返回完整的主题配置
  return {
    theme: {
      // 基础颜色配置
      primary: ansiColors.cyan,
      secondary: ansiColors.magenta,
      accent: ansiColors.cyan,

      // 状态颜色
      error: ansiColors.red,
      warning: ansiColors.yellow,
      success: ansiColors.green,
      info: ansiColors.cyan,

      // 文字颜色
      text: fg,
      textMuted,
      selectedListItemText: bg,

      // 背景颜色
      background: bg,
      backgroundPanel: grays[2],
      backgroundElement: grays[3],
      backgroundMenu: grays[3],

      // 边框颜色
      borderSubtle: grays[6],
      border: grays[7],
      borderActive: grays[8],

      // 差异对比颜色
      diffAdded: ansiColors.green,
      diffRemoved: ansiColors.red,
      diffContext: grays[7],
      diffHunkHeader: grays[7],
      diffHighlightAdded: ansiColors.green,
      diffHighlightRemoved: ansiColors.red,
      diffAddedBg: grays[2],
      diffRemovedBg: grays[2],
      diffContextBg: grays[1],
      diffLineNumber: grays[6],
      diffAddedLineNumberBg: grays[3],
      diffRemovedLineNumberBg: grays[3],

      // Markdown 颜色
      markdownText: fg,
      markdownHeading: fg,
      markdownLink: ansiColors.blue,
      markdownLinkText: ansiColors.cyan,
      markdownCode: ansiColors.green,
      markdownBlockQuote: ansiColors.yellow,
      markdownEmph: ansiColors.yellow,
      markdownStrong: fg,
      markdownHorizontalRule: grays[7],
      markdownListItem: ansiColors.blue,
      markdownListEnumeration: ansiColors.cyan,
      markdownImage: ansiColors.blue,
      markdownImageText: ansiColors.cyan,
      markdownCodeBlock: fg,

      // 语法颜色
      syntaxComment: textMuted,
      syntaxKeyword: ansiColors.magenta,
      syntaxFunction: ansiColors.blue,
      syntaxVariable: fg,
      syntaxString: ansiColors.green,
      syntaxNumber: ansiColors.yellow,
      syntaxType: ansiColors.cyan,
      syntaxOperator: ansiColors.cyan,
      syntaxPunctuation: fg,
    },
  }
}

/**
 * 生成灰度色阶
 * 基于背景色生成一系列灰度颜色，用于 UI 元素的层次表现
 *
 * @param bg - 背景色
 * @param isDark - 是否为暗色模式
 * @returns 包含 12 级灰度的映射对象
 */
function generateGrayScale(bg: RGBA, isDark: boolean): Record<number, RGBA> {
  const grays: Record<number, RGBA> = {}

  // 将 RGBA 浮点值（0-1）转换为 0-255 整数
  const bgR = bg.r * 255
  const bgG = bg.g * 255
  const bgB = bg.b * 255

  // 计算背景色的亮度
  const luminance = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB

  // 生成 12 级灰度
  for (let i = 1; i <= 12; i++) {
    const factor = i / 12.0 // 因子从 1/12 到 1

    let grayValue: number
    let newR: number
    let newG: number
    let newB: number

    if (isDark) {
      // 暗色模式下的灰度生成
      if (luminance < 10) {
        // 非常暗的背景：灰度值逐渐增加
        grayValue = Math.floor(factor * 0.4 * 255)
        newR = grayValue
        newG = grayValue
        newB = grayValue
      } else {
        // 较亮的暗色背景：在背景基础上增加亮度
        const newLum = luminance + (255 - luminance) * factor * 0.4
        const ratio = newLum / luminance
        newR = Math.min(bgR * ratio, 255)
        newG = Math.min(bgG * ratio, 255)
        newB = Math.min(bgB * ratio, 255)
      }
    } else {
      // 亮色模式下的灰度生成
      if (luminance > 245) {
        // 非常亮的背景：灰度值逐渐减少
        grayValue = Math.floor(255 - factor * 0.4 * 255)
        newR = grayValue
        newG = grayValue
        newB = grayValue
      } else {
        // 较暗的亮色背景：在背景基础上降低亮度
        const newLum = luminance * (1 - factor * 0.4)
        const ratio = newLum / luminance
        newR = Math.max(bgR * ratio, 0)
        newG = Math.max(bgG * ratio, 0)
        newB = Math.max(bgB * ratio, 0)
      }
    }

    // 保存生成的灰度颜色
    grays[i] = RGBA.fromInts(Math.floor(newR), Math.floor(newG), Math.floor(newB))
  }

  return grays
}

/**
 * 生成次要文字颜色
 * 基于背景色生成适合的次要文字颜色，确保可读性
 *
 * @param bg - 背景色
 * @param isDark - 是否为暗色模式
 * @returns 计算后的次要文字颜色
 */
function generateMutedTextColor(bg: RGBA, isDark: boolean): RGBA {
  // 将 RGBA 浮点值转换为整数
  const bgR = bg.r * 255
  const bgG = bg.g * 255
  const bgB = bg.b * 255

  // 计算背景亮度
  const bgLum = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB

  let grayValue: number

  if (isDark) {
    // 暗色模式：次要文字需要较亮
    if (bgLum < 10) {
      // 非常暗的背景：使用固定亮度（#b4b4b4）
      grayValue = 180
    } else {
      // 较亮的暗色背景：根据亮度调整
      grayValue = Math.min(Math.floor(160 + bgLum * 0.3), 200)
    }
  } else {
    // 亮色模式：次要文字需要较暗
    if (bgLum > 245) {
      // 非常亮的背景：使用固定亮度（#4b4b4b）
      grayValue = 75
    } else {
      // 较暗的亮色背景：根据亮度调整
      grayValue = Math.max(Math.floor(100 - (255 - bgLum) * 0.2), 60)
    }
  }

  return RGBA.fromInts(grayValue, grayValue, grayValue)
}

/**
 * 生成语法高亮样式
 * 根据主题颜色生成完整的代码语法高亮配置
 *
 * @param theme - 目标主题对象
 * @returns 语法高亮样式对象
 */
function generateSyntax(theme: Theme) {
  return SyntaxStyle.fromTheme(getSyntaxRules(theme))
}

/**
 * 生成柔和语法高亮样式
 * 在标准语法高亮基础上应用透明度效果，用于次要信息显示
 *
 * @param theme - 目标主题对象
 * @returns 柔和语法高亮样式对象
 */
function generateSubtleSyntax(theme: Theme) {
  const rules = getSyntaxRules(theme)
  return SyntaxStyle.fromTheme(
    rules.map((rule) => {
      // 如果规则有前景色，添加透明度
      if (rule.style.foreground) {
        const fg = rule.style.foreground
        return {
          ...rule,
          style: {
            ...rule.style,
            foreground: RGBA.fromInts(
              Math.round(fg.r * 255),
              Math.round(fg.g * 255),
              Math.round(fg.b * 255),
              Math.round(theme.thinkingOpacity * 255),
            ),
          },
        }
      }
      return rule
    }),
  )
}

/**
 * 获取语法高亮规则列表
 * 定义了所有编程语言元素的颜色和样式配置
 *
 * @param theme - 目标主题对象
 * @returns 语法高亮规则数组
 */
function getSyntaxRules(theme: Theme) {
  return [
    // ==================== 基础规则 ====================
    {
      scope: ["default"],
      style: {
        foreground: theme.text,
      },
    },
    {
      scope: ["prompt"],
      style: {
        foreground: theme.accent,
      },
    },
    {
      scope: ["extmark.file"],
      style: {
        foreground: theme.warning,
        bold: true,
      },
    },
    {
      scope: ["extmark.agent"],
      style: {
        foreground: theme.secondary,
        bold: true,
      },
    },
    {
      scope: ["extmark.paste"],
      style: {
        foreground: theme.background,
        background: theme.warning,
        bold: true,
      },
    },

    // ==================== 注释规则 ====================
    {
      scope: ["comment"],
      style: {
        foreground: theme.syntaxComment,
        italic: true,
      },
    },
    {
      scope: ["comment.documentation"],
      style: {
        foreground: theme.syntaxComment,
        italic: true,
      },
    },

    // ==================== 字符串和数字规则 ====================
    {
      scope: ["string", "symbol"],
      style: {
        foreground: theme.syntaxString,
      },
    },
    {
      scope: ["number", "boolean"],
      style: {
        foreground: theme.syntaxNumber,
      },
    },
    {
      scope: ["character.special"],
      style: {
        foreground: theme.syntaxString,
      },
    },

    // ==================== 关键字规则 ====================
    {
      scope: ["keyword.return", "keyword.conditional", "keyword.repeat", "keyword.coroutine"],
      style: {
        foreground: theme.syntaxKeyword,
        italic: true,
      },
    },
    {
      scope: ["keyword.type"],
      style: {
        foreground: theme.syntaxType,
        bold: true,
        italic: true,
      },
    },
    {
      scope: ["keyword.function", "function.method"],
      style: {
        foreground: theme.syntaxFunction,
      },
    },
    {
      scope: ["keyword"],
      style: {
        foreground: theme.syntaxKeyword,
        italic: true,
      },
    },
    {
      scope: ["keyword.import"],
      style: {
        foreground: theme.syntaxKeyword,
      },
    },
    {
      scope: ["operator", "keyword.operator", "punctuation.delimiter"],
      style: {
        foreground: theme.syntaxOperator,
      },
    },
    {
      scope: ["keyword.conditional.ternary"],
      style: {
        foreground: theme.syntaxOperator,
      },
    },
    {
      scope: ["keyword.modifier"],
      style: {
        foreground: theme.syntaxKeyword,
        italic: true,
      },
    },
    {
      scope: ["keyword.exception"],
      style: {
        foreground: theme.syntaxKeyword,
        italic: true,
      },
    },
    {
      scope: ["keyword.directive"],
      style: {
        foreground: theme.syntaxKeyword,
        italic: true,
      },
    },
    {
      scope: ["keyword.export"],
      style: {
        foreground: theme.syntaxKeyword,
      },
    },

    // ==================== 变量和函数规则 ====================
    {
      scope: ["variable", "variable.parameter", "function.method.call", "function.call"],
      style: {
        foreground: theme.syntaxVariable,
      },
    },
    {
      scope: ["variable.member", "function", "constructor"],
      style: {
        foreground: theme.syntaxFunction,
      },
    },
    {
      scope: ["variable.parameter", "parameter"],
      style: {
        foreground: theme.syntaxVariable,
      },
    },
    {
      scope: ["variable.builtin", "type.builtin", "function.builtin", "module.builtin", "constant.builtin"],
      style: {
        foreground: theme.error,
      },
    },
    {
      scope: ["variable.super"],
      style: {
        foreground: theme.error,
      },
    },

    // ==================== 类型和常量规则 ====================
    {
      scope: ["type", "module"],
      style: {
        foreground: theme.syntaxType,
      },
    },
    {
      scope: ["constant"],
      style: {
        foreground: theme.syntaxNumber,
      },
    },
    {
      scope: ["property"],
      style: {
        foreground: theme.syntaxVariable,
      },
    },
    {
      scope: ["class"],
      style: {
        foreground: theme.syntaxType,
      },
    },
    {
      scope: ["type.definition"],
      style: {
        foreground: theme.syntaxType,
        bold: true,
      },
    },
    {
      scope: ["namespace"],
      style: {
        foreground: theme.syntaxType,
      },
    },
    {
      scope: ["field"],
      style: {
        foreground: theme.syntaxVariable,
      },
    },

    // ==================== 标点符号规则 ====================
    {
      scope: ["punctuation", "punctuation.bracket"],
      style: {
        foreground: theme.syntaxPunctuation,
      },
    },
    {
      scope: ["punctuation.special"],
      style: {
        foreground: theme.syntaxOperator,
      },
    },

    // ==================== 字符串特殊规则 ====================
    {
      scope: ["string.escape", "string.regexp"],
      style: {
        foreground: theme.syntaxKeyword,
      },
    },
    {
      scope: ["string.special", "string.special.url"],
      style: {
        foreground: theme.markdownLink,
        underline: true,
      },
    },
    {
      scope: ["character"],
      style: {
        foreground: theme.syntaxString,
      },
    },
    {
      scope: ["float"],
      style: {
        foreground: theme.syntaxNumber,
      },
    },

    // ==================== Markdown 标题规则 ====================
    {
      scope: ["markup.heading"],
      style: {
        foreground: theme.markdownHeading,
        bold: true,
      },
    },
    {
      scope: ["markup.heading.1"],
      style: {
        foreground: theme.markdownHeading,
        bold: true,
      },
    },
    {
      scope: ["markup.heading.2"],
      style: {
        foreground: theme.markdownHeading,
        bold: true,
      },
    },
    {
      scope: ["markup.heading.3"],
      style: {
        foreground: theme.markdownHeading,
        bold: true,
      },
    },
    {
      scope: ["markup.heading.4"],
      style: {
        foreground: theme.markdownHeading,
        bold: true,
      },
    },
    {
      scope: ["markup.heading.5"],
      style: {
        foreground: theme.markdownHeading,
        bold: true,
      },
    },
    {
      scope: ["markup.heading.6"],
      style: {
        foreground: theme.markdownHeading,
        bold: true,
      },
    },

    // ==================== Markdown 其他规则 ====================
    {
      scope: ["markup.bold", "markup.strong"],
      style: {
        foreground: theme.markdownStrong,
        bold: true,
      },
    },
    {
      scope: ["markup.italic"],
      style: {
        foreground: theme.markdownEmph,
        italic: true,
      },
    },
    {
      scope: ["markup.list"],
      style: {
        foreground: theme.markdownListItem,
      },
    },
    {
      scope: ["markup.quote"],
      style: {
        foreground: theme.markdownBlockQuote,
        italic: true,
      },
    },
    {
      scope: ["markup.raw", "markup.raw.block"],
      style: {
        foreground: theme.markdownCode,
      },
    },
    {
      scope: ["markup.raw.inline"],
      style: {
        foreground: theme.markdownCode,
        background: theme.background,
      },
    },
    {
      scope: ["markup.link"],
      style: {
        foreground: theme.markdownLink,
        underline: true,
      },
    },
    {
      scope: ["markup.link.label"],
      style: {
        foreground: theme.markdownLinkText,
        underline: true,
      },
    },
    {
      scope: ["markup.link.url"],
      style: {
        foreground: theme.markdownLink,
        underline: true,
      },
    },
    {
      scope: ["label"],
      style: {
        foreground: theme.markdownLinkText,
      },
    },
    {
      scope: ["spell", "nospell"],
      style: {
        foreground: theme.text,
      },
    },
    {
      scope: ["conceal"],
      style: {
        foreground: theme.textMuted,
      },
    },
    {
      scope: ["markup.strikethrough"],
      style: {
        foreground: theme.textMuted,
      },
    },
    {
      scope: ["markup.underline"],
      style: {
        foreground: theme.text,
        underline: true,
      },
    },
    {
      scope: ["markup.list.checked"],
      style: {
        foreground: theme.success,
      },
    },
    {
      scope: ["markup.list.unchecked"],
      style: {
        foreground: theme.textMuted,
      },
    },

    // ==================== 差异对比规则 ====================
    {
      scope: ["diff.plus"],
      style: {
        foreground: theme.diffAdded,
        background: theme.diffAddedBg,
      },
    },
    {
      scope: ["diff.minus"],
      style: {
        foreground: theme.diffRemoved,
        background: theme.diffRemovedBg,
      },
    },
    {
      scope: ["diff.delta"],
      style: {
        foreground: theme.diffContext,
        background: theme.diffContextBg,
      },
    },

    // ==================== 注释错误和警告规则 ====================
    {
      scope: ["comment.error"],
      style: {
        foreground: theme.error,
        italic: true,
        bold: true,
      },
    },
    {
      scope: ["comment.warning"],
      style: {
        foreground: theme.warning,
        italic: true,
        bold: true,
      },
    },
    {
      scope: ["comment.todo", "comment.note"],
      style: {
        foreground: theme.info,
        italic: true,
        bold: true,
      },
    },

    // ==================== HTML/XML 标签规则 ====================
    {
      scope: ["tag"],
      style: {
        foreground: theme.error,
      },
    },
    {
      scope: ["tag.attribute"],
      style: {
        foreground: theme.syntaxKeyword,
      },
    },
    {
      scope: ["tag.delimiter"],
      style: {
        foreground: theme.syntaxOperator,
      },
    },

    // ==================== 注解规则 ====================
    {
      scope: ["attribute", "annotation"],
      style: {
        foreground: theme.warning,
      },
    },

    // ==================== 错误和警告规则 ====================
    {
      scope: ["error"],
      style: {
        foreground: theme.error,
        bold: true,
      },
    },
    {
      scope: ["warning"],
      style: {
        foreground: theme.warning,
        bold: true,
      },
    },
    {
      scope: ["info"],
      style: {
        foreground: theme.info,
      },
    },
    {
      scope: ["debug"],
      style: {
        foreground: theme.textMuted,
      },
    },
  ]
}
