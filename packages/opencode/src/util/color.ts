export namespace Color {
  export function isValidHex(hex?: string): hex is string {
    if (!hex) return false
    return /^#[0-9a-fA-F]{6}$/.test(hex)
  }

  export function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return { r, g, b }
  }

  export function hexToAnsiBold(hex?: string): string | undefined {
    if (!isValidHex(hex)) return undefined
    const { r, g, b } = hexToRgb(hex)
    return `\x1b[38;2;${r};${g};${b}m\x1b[1m`
  }
}

// Color命名空间提供颜色处理和转换功能
// isValidHex函数：验证十六进制颜色值是否有效
// 参数：
//   hex: 可选的十六进制颜色字符串（格式：#RRGGBB）
// 返回值：
//   如果是有效的十六进制颜色值，返回true；否则返回false
// 功能：
//   - 检查字符串是否为空
//   - 使用正则表达式验证格式是否符合#RRGGBB
//   - R、G、B必须是0-9、a-f或A-F的字符
//
// hexToRgb函数：将十六进制颜色值转换为RGB对象
// 参数：
//   hex: 十六进制颜色字符串（格式：#RRGGBB）
// 返回值：
//   包含r、g、b三个属性的对象，每个值为0-255的整数
// 功能：
//   - 从字符串中提取红色分量（第2-3位）
//   - 从字符串中提取绿色分量（第4-5位）
//   - 从字符串中提取蓝色分量（第6-7位）
//   - 将每个分量从十六进制转换为十进制
//
// hexToAnsiBold函数：将十六进制颜色值转换为ANSI粗体颜色代码
// 参数：
//   hex: 可选的十六进制颜色字符串（格式：#RRGGBB）
// 返回值：
//   ANSI转义序列字符串，用于在终端显示粗体彩色文本；如果输入无效则返回undefined
// 功能：
//   - 验证输入的十六进制颜色值是否有效
//   - 将十六进制颜色转换为RGB值
//   - 生成ANSI 24位真彩色转义序列（\x1b[38;2;R;G;Bm）
//   - 添加粗体样式转义序列（\x1b[1m）
//   - 可用于终端输出彩色粗体文本
