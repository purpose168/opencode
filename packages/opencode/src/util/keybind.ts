import type { ParsedKey } from "@opentui/core"
import { isDeepEqual } from "remeda"

export namespace Keybind {
  /**
   * 从OpenTUI的ParsedKey派生的快捷键信息，包含我们自定义的`leader`字段。
   * 这确保了类型兼容性，并在编译时捕获缺失的字段。
   */
  export type Info = Pick<ParsedKey, "name" | "ctrl" | "meta" | "shift" | "super"> & {
    leader: boolean // 我们的自定义字段
  }

  export function match(a: Info, b: Info): boolean {
    // Normalize super field (undefined and false are equivalent)
    const normalizedA = { ...a, super: a.super ?? false }
    const normalizedB = { ...b, super: b.super ?? false }
    return isDeepEqual(normalizedA, normalizedB)
  }

  /**
   * 将OpenTUI的ParsedKey转换为我们的Keybind.Info格式。
   * 此辅助函数确保所有必需字段都存在，并避免手动创建对象。
   */
  export function fromParsedKey(key: ParsedKey, leader = false): Info {
    return {
      name: key.name,
      ctrl: key.ctrl,
      meta: key.meta,
      shift: key.shift,
      super: key.super ?? false,
      leader,
    }
  }

  export function toString(info: Info): string {
    const parts: string[] = []

    if (info.ctrl) parts.push("ctrl")
    if (info.meta) parts.push("alt")
    if (info.super) parts.push("super")
    if (info.shift) parts.push("shift")
    if (info.name) {
      if (info.name === "delete") parts.push("del")
      else parts.push(info.name)
    }

    let result = parts.join("+")

    if (info.leader) {
      result = result ? `<leader> ${result}` : `<leader>`
    }

    return result
  }

  export function parse(key: string): Info[] {
    if (key === "none") return []

    return key.split(",").map((combo) => {
      // Handle <leader> syntax by replacing with leader+
      const normalized = combo.replace(/<leader>/g, "leader+")
      const parts = normalized.toLowerCase().split("+")
      const info: Info = {
        ctrl: false,
        meta: false,
        shift: false,
        leader: false,
        name: "",
      }

      for (const part of parts) {
        switch (part) {
          case "ctrl":
            info.ctrl = true
            break
          case "alt":
          case "meta":
          case "option":
            info.meta = true
            break
          case "super":
            info.super = true
            break
          case "shift":
            info.shift = true
            break
          case "leader":
            info.leader = true
            break
          case "esc":
            info.name = "escape"
            break
          default:
            info.name = part
            break
        }
      }

      return info
    })
  }
}

// Keybind命名空间提供快捷键处理和转换功能
// Info类型：快捷键信息类型
// 继承自ParsedKey的部分字段（name、ctrl、meta、shift、super）
// 添加自定义字段：
//   leader: 布尔值，表示是否为leader键
// 功能：
//   - 确保与OpenTUI的ParsedKey类型兼容
//   - 在编译时捕获缺失的字段
//   - 扩展OpenTUI的快捷键定义以支持leader键
//
// match函数：比较两个快捷键信息是否匹配
// 参数：
//   a: 第一个快捷键信息
//   b: 第二个快捷键信息
// 返回值：
//   如果两个快捷键匹配返回true，否则返回false
// 功能：
//   - 规范化super字段（undefined和false被视为等价）
//   - 使用isDeepEqual进行深度比较
//   - 确保快捷键组合的精确匹配
// 使用场景：
//   - 检查用户按键是否匹配绑定的快捷键
//   - 比较快捷键配置是否相同
//
// fromParsedKey函数：将OpenTUI的ParsedKey转换为Keybind.Info格式
// 参数：
//   key: OpenTUI的ParsedKey对象
//   leader: 是否为leader键，默认为false
// 返回值：
//   Keybind.Info对象
// 功能：
//   - 从ParsedKey提取name、ctrl、meta、shift字段
//   - 规范化super字段（undefined转为false）
//   - 添加leader字段
//   - 确保所有必需字段都存在
// 使用场景：
//   - 将OpenTUI的按键事件转换为内部快捷键格式
//   - 避免手动创建快捷键对象
//
// toString函数：将快捷键信息转换为字符串表示
// 参数：
//   info: 快捷键信息对象
// 返回值：
//   快捷键的字符串表示（如"ctrl+shift+a"或"<leader> a"）
// 功能：
//   - 按顺序组合修饰键：ctrl、alt、super、shift
//   - 添加主键名称（delete转换为del）
//   - 如果是leader键，添加<leader>前缀
// 使用场景：
//   - 在UI中显示快捷键
//   - 生成快捷键的文档说明
//
// parse函数：解析快捷键字符串为快捷键信息数组
// 参数：
//   key: 快捷键字符串（可包含多个组合，用逗号分隔）
// 返回值：
//   快捷键信息数组
// 功能：
//   - 如果输入为"none"，返回空数组
//   - 支持多个快捷键组合（逗号分隔）
//   - 支持<leader>语法（转换为leader+）
//   - 解析修饰键：ctrl、alt/meta/option、super、shift、leader
//   - 处理特殊键名：esc转换为escape
//   - 使用小写进行不区分大小写的匹配
// 支持的快捷键格式：
//   - "ctrl+a"：Ctrl+A
//   - "ctrl+shift+a"：Ctrl+Shift+A
//   - "<leader> a"：Leader键后跟A
//   - "ctrl+a,ctrl+b"：Ctrl+A或Ctrl+B
// 使用场景：
//   - 从配置文件解析快捷键
//   - 将用户输入的快捷键字符串转换为内部格式
