import { RGBA } from "@opentui/core" // 导入 RGBA 颜色类，用于处理颜色操作

/**
 * Terminal 终端工具命名空间
 *
 * 功能说明：
 * - 提供查询终端颜色的功能
 * - 支持获取终端背景色、前景色和调色板颜色
 * - 使用 OSC (Operating System Command) 转义序列查询终端颜色
 * - 支持判断终端是深色还是浅色主题
 *
 * 使用场景：
 * - 需要根据终端主题自动调整界面配色时
 * - 需要获取终端的实际颜色值时
 * - 需要实现与终端主题一致的颜色方案时
 *
 * 注意事项：
 * - OSC 4 (调色板) 查询在 tmux 中可能无法工作（响应被过滤）
 * - OSC 10/11 (前景色/背景色) 在大多数环境中都可以工作
 * - 需要标准输入 (stdin) 是 TTY 模式
 * - 查询超时时间为 1 秒
 */
export namespace Terminal {
  // 终端工具命名空间
  export type Colors = Awaited<ReturnType<typeof colors>> // Colors 类型为 colors 函数返回值的 Awaited 类型

  /**
   * colors 查询终端颜色
   *
   * 功能说明：
   * - 查询终端的背景色、前景色和调色板颜色（0-15）
   * - 使用 OSC 转义序列检索实际的终端颜色值
   * - 支持多种颜色格式：rgb:、#、rgb()
   * - 查询失败的颜色将返回 null 或空数组
   *
   * 使用场景：
   * - 需要获取终端的实际颜色值时
   * - 需要根据终端颜色调整界面配色时
   * - 需要实现与终端主题一致的颜色方案时
   *
   * 注意事项：
   * - OSC 4 (调色板) 查询在 tmux 中可能无法工作（响应被过滤）
   * - OSC 10/11 (前景色/背景色) 在大多数环境中都可以工作
   * - 需要标准输入 (stdin) 是 TTY 模式
   * - 查询超时时间为 1 秒
   *
   * 返回值：
   * - 返回一个对象，包含 background（背景色）、foreground（前景色）和 colors（调色板颜色数组）
   * - 如果查询失败，相应的颜色值为 null 或空数组
   */
  export async function colors(): Promise<{
    background: RGBA | null // 背景色，查询失败时为 null
    foreground: RGBA | null // 前景色，查询失败时为 null
    colors: RGBA[] // 调色板颜色数组（索引 0-15），查询失败时为空数组
  }> {
    // 异步函数，返回包含背景色、前景色和调色板颜色数组的对象
    if (!process.stdin.isTTY) return { background: null, foreground: null, colors: [] } // 如果标准输入不是 TTY 模式，返回空结果

    return new Promise((resolve) => {
      // 创建 Promise 用于异步处理
      let background: RGBA | null = null // 背景色，初始为 null
      let foreground: RGBA | null = null // 前景色，初始为 null
      const paletteColors: RGBA[] = [] // 调色板颜色数组，初始为空
      let timeout: NodeJS.Timeout // 超时定时器

      const cleanup = () => {
        // 清理函数，用于恢复终端状态
        process.stdin.setRawMode(false) // 关闭原始模式
        process.stdin.removeListener("data", handler) // 移除数据事件监听器
        clearTimeout(timeout) // 清除超时定时器
      }

      const parseColor = (colorStr: string): RGBA | null => {
        // 解析颜色字符串为 RGBA 对象
        if (colorStr.startsWith("rgb:")) {
          // 如果是 rgb: 格式（如 rgb:ffff/ffff/ffff）
          const parts = colorStr.substring(4).split("/") // 分割颜色部分
          return RGBA.fromInts(
            // 从整数创建 RGBA 对象
            parseInt(parts[0], 16) >> 8, // 将 16 位转换为 8 位（红色分量）
            parseInt(parts[1], 16) >> 8, // 将 16 位转换为 8 位（绿色分量）
            parseInt(parts[2], 16) >> 8, // 将 16 位转换为 8 位（蓝色分量）
            255, // alpha 值为 255（完全不透明）
          )
        }
        if (colorStr.startsWith("#")) {
          // 如果是十六进制格式（如 #ffffff）
          return RGBA.fromHex(colorStr) // 从十六进制字符串创建 RGBA 对象
        }
        if (colorStr.startsWith("rgb(")) {
          // 如果是 rgb() 格式（如 rgb(255, 255, 255)）
          const parts = colorStr.substring(4, colorStr.length - 1).split(",") // 分割颜色部分
          return RGBA.fromInts(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]), 255) // 从整数创建 RGBA 对象
        }
        return null // 无法解析的颜色格式，返回 null
      }

      const handler = (data: Buffer) => {
        // 数据事件处理函数，用于处理终端响应
        const str = data.toString() // 将 Buffer 转换为字符串

        // Match OSC 11 (background color) // 匹配 OSC 11（背景色）
        const bgMatch = str.match(/\x1b]11;([^\x07\x1b]+)/) // 匹配背景色响应
        if (bgMatch) {
          // 如果匹配到背景色
          background = parseColor(bgMatch[1]) // 解析背景色
        }

        // Match OSC 10 (foreground color) // 匹配 OSC 10（前景色）
        const fgMatch = str.match(/\x1b]10;([^\x07\x1b]+)/) // 匹配前景色响应
        if (fgMatch) {
          // 如果匹配到前景色
          foreground = parseColor(fgMatch[1]) // 解析前景色
        }

        // Match OSC 4 (palette colors) // 匹配 OSC 4（调色板颜色）
        const paletteMatches = str.matchAll(/\x1b]4;(\d+);([^\x07\x1b]+)/g) // 匹配所有调色板颜色响应
        for (const match of paletteMatches) {
          // 遍历所有匹配的调色板颜色
          const index = parseInt(match[1]) // 获取调色板索引
          const color = parseColor(match[2]) // 解析颜色
          if (color) paletteColors[index] = color // 如果颜色解析成功，添加到调色板数组
        }

        // Return immediately if we have all 16 palette colors // 如果已经获取到所有 16 个调色板颜色，立即返回
        if (paletteColors.filter((c) => c !== undefined).length === 16) {
          // 检查是否所有 16 个颜色都已获取
          cleanup() // 清理资源
          resolve({ background, foreground, colors: paletteColors }) // 解析 Promise，返回颜色结果
        }
      }

      process.stdin.setRawMode(true) // 启用原始模式，允许直接读取输入
      process.stdin.on("data", handler) // 添加数据事件监听器

      // Query background (OSC 11) // 查询背景色（OSC 11）
      process.stdout.write("\x1b]11;?\x07") // 发送 OSC 11 查询背景色
      // Query foreground (OSC 10) // 查询前景色（OSC 10）
      process.stdout.write("\x1b]10;?\x07") // 发送 OSC 10 查询前景色
      // Query palette colors 0-15 (OSC 4) // 查询调色板颜色 0-15（OSC 4）
      for (let i = 0; i < 16; i++) {
        // 遍历 16 个调色板颜色
        process.stdout.write(`\x1b]4;${i};?\x07`) // 发送 OSC 4 查询调色板颜色
      }

      timeout = setTimeout(() => {
        // 设置超时定时器（1 秒）
        cleanup() // 清理资源
        resolve({ background, foreground, colors: paletteColors }) // 解析 Promise，返回当前颜色结果
      }, 1000) // 超时时间为 1000 毫秒（1 秒）
    })
  }

  /**
   * getTerminalBackgroundColor 获取终端背景颜色类型
   *
   * 功能说明：
   * - 查询终端背景色并判断是深色还是浅色主题
   * - 使用相对亮度公式计算背景色的亮度
   * - 根据亮度阈值判断是深色还是浅色
   * - 如果无法获取背景色，默认返回 "dark"
   *
   * 使用场景：
   * - 需要根据终端主题自动调整界面配色时
   * - 需要实现与终端主题一致的颜色方案时
   * - 需要为深色或浅色主题选择不同的配色时
   *
   * 注意事项：
   * - 使用相对亮度公式：0.299 * R + 0.587 * G + 0.114 * B
   * - 亮度阈值为 0.5，大于 0.5 为浅色，否则为深色
   * - 如果无法获取背景色，默认返回 "dark"
   *
   * 返回值：
   * - 返回 "dark" 表示深色主题
   * - 返回 "light" 表示浅色主题
   */
  export async function getTerminalBackgroundColor(): Promise<"dark" | "light"> {
    // 异步函数，返回 "dark" 或 "light"
    const result = await colors() // 查询终端颜色
    if (!result.background) return "dark" // 如果无法获取背景色，默认返回 "dark"

    const { r, g, b } = result.background // 获取背景色的 RGB 分量
    // Calculate luminance using relative luminance formula // 使用相对亮度公式计算亮度
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255 // 相对亮度公式：0.299 * R + 0.587 * G + 0.114 * B，然后除以 255 归一化

    // Determine if dark or light based on luminance threshold // 根据亮度阈值判断是深色还是浅色
    return luminance > 0.5 ? "light" : "dark" // 亮度大于 0.5 为浅色，否则为深色
  }
}
