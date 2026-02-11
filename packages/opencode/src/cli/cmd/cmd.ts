// 导入命令模块类型，用于定义 CLI 命令的类型结构
import type { CommandModule } from "yargs"

/**
 * WithDoubleDash 双破折号类型定义
 *
 * 功能说明：
 * - 定义一个泛型类型，用于支持双破折号参数
 * - 扩展原始类型 T，添加可选的 "--" 字段
 * - 用于处理命令行参数中的双破折号选项
 *
 * 类型参数：
 * - T: 原始类型，要扩展的基础类型
 *
 * 使用场景：
 * - 需要处理带有双破折号的命令行参数时
 * - 需要扩展命令类型以支持额外参数时
 *
 * 示例：
 * - WithDoubleDash<{ name: string }> = { name: string; "--"?: string[] }
 * - 表示一个包含 name 属性和可选 "--" 数组的对象
 */
type WithDoubleDash<T> = T & { "--"?: string[] } // 定义泛型类型，扩展类型 T 并添加可选的 "--" 字段（字符串数组）

/**
 * cmd 命令创建函数
 *
 * 功能说明：
 * - 创建一个命令定义函数
 * - 接受一个 CommandModule 对象作为输入
 * - 返回相同的 CommandModule 对象
 * - 支持泛型类型，允许自定义命令参数和返回类型
 *
 * 类型参数：
 * - T: 命令参数类型
 * - U: 双破折号参数类型
 *
 * 参数说明：
 * - input: CommandModule<T, WithDoubleDash<U>>，命令模块对象，包含命令配置和处理函数
 *
 * 返回值：
 * - CommandModule<T, WithDoubleDash<U>>：返回与输入相同的命令模块对象
 *
 * 使用场景：
 * - 需要创建 CLI 命令时
 * - 需要定义命令参数和选项时
 * - 需要支持双破折号参数时
 *
 * 注意事项：
 * - 这是一个类型安全的命令创建函数
 * - 不修改输入对象，直接返回
 * - 支持泛型类型，提供类型推断
 */
export function cmd<T, U>(input: CommandModule<T, WithDoubleDash<U>>) {
  // 导出命令创建函数，接受泛型参数 T 和 U
  return input // 直接返回输入对象（不进行任何修改）
}
