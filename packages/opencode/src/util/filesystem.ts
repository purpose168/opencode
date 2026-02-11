import { realpathSync } from "fs"
import { exists } from "fs/promises"
import { dirname, join, relative } from "path"

export namespace Filesystem {
  /**
   * 在Windows上，使用文件系统将路径规范化为规范的大小写格式。
   * 这是必需的，因为Windows路径不区分大小写，但LSP服务器
   * 可能返回与我们发送的路径大小写不同的路径。
   */
  export function normalizePath(p: string): string {
    if (process.platform !== "win32") return p
    try {
      return realpathSync.native(p)
    } catch {
      return p
    }
  }
  export function overlaps(a: string, b: string) {
    const relA = relative(a, b)
    const relB = relative(b, a)
    return !relA || !relA.startsWith("..") || !relB || !relB.startsWith("..")
  }

  export function contains(parent: string, child: string) {
    return !relative(parent, child).startsWith("..")
  }

  export async function findUp(target: string, start: string, stop?: string) {
    let current = start
    const result = []
    while (true) {
      const search = join(current, target)
      if (await exists(search)) result.push(search)
      if (stop === current) break
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
    return result
  }

  export async function* up(options: { targets: string[]; start: string; stop?: string }) {
    const { targets, start, stop } = options
    let current = start
    while (true) {
      for (const target of targets) {
        const search = join(current, target)
        if (await exists(search)) yield search
      }
      if (stop === current) break
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
  }

  export async function globUp(pattern: string, start: string, stop?: string) {
    let current = start
    const result = []
    while (true) {
      try {
        const glob = new Bun.Glob(pattern)
        for await (const match of glob.scan({
          cwd: current,
          absolute: true,
          onlyFiles: true,
          followSymlinks: true,
          dot: true,
        })) {
          result.push(match)
        }
      } catch {
        // Skip invalid glob patterns
      }
      if (stop === current) break
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
    return result
  }
}

// Filesystem命名空间提供文件系统路径操作和搜索功能
// normalizePath函数：规范化路径大小写（Windows平台）
// 参数：
//   p: 要规范化的路径字符串
// 返回值：
//   规范化后的路径字符串
// 功能：
//   - 在非Windows平台直接返回原路径
//   - 在Windows平台使用realpathSync.native获取规范大小写
//   - 如果获取失败（如路径不存在），返回原路径
// 使用场景：
//   - 确保Windows上路径大小写一致性
//   - 解决LSP服务器返回路径大小写不匹配问题
//
// overlaps函数：检查两个路径是否重叠（一个包含另一个或相等）
// 参数：
//   a: 第一个路径
//   b: 第二个路径
// 返回值：
//   如果两个路径重叠返回true，否则返回false
// 功能：
//   - 计算a相对于b的相对路径
//   - 计算b相对于a的相对路径
//   - 如果任一相对路径不以".."开头，说明路径重叠
// 使用场景：
//   - 检查两个目录是否有包含关系
//   - 避免重复处理相同的文件或目录
//
// contains函数：检查父路径是否包含子路径
// 参数：
//   parent: 父路径
//   child: 子路径
// 返回值：
//   如果parent包含child返回true，否则返回false
// 功能：
//   - 计算child相对于parent的相对路径
//   - 如果相对路径不以".."开头，说明parent包含child
// 使用场景：
//   - 验证文件是否在指定目录下
//   - 检查路径的包含关系
//
// findUp函数：向上查找目标文件或目录
// 参数：
//   target: 要查找的目标文件或目录名
//   start: 开始查找的目录路径
//   stop: 停止查找的目录路径（可选）
// 返回值：
//   找到的所有目标路径数组
// 功能：
//   - 从start目录开始向上查找
//   - 在每一层目录中查找target
//   - 如果找到则添加到结果数组
//   - 到达stop目录或根目录时停止
// 使用场景：
//   - 查找配置文件（如package.json、tsconfig.json）
//   - 查找项目根目录
//
// up函数：向上生成目标文件或目录的异步迭代器
// 参数：
//   options: 配置对象
//     targets: 要查找的目标文件或目录名数组
//     start: 开始查找的目录路径
//     stop: 停止查找的目录路径（可选）
// 返回值：
//   异步生成器，按查找顺序生成找到的目标路径
// 功能：
//   - 从start目录开始向上查找
//   - 在每一层目录中查找所有targets
//   - 使用yield逐个返回找到的目标
//   - 到达stop目录或根目录时停止
// 使用场景：
//   - 按需处理找到的文件，避免一次性加载所有结果
//   - 流式处理向上查找的结果
//
// globUp函数：向上执行glob模式匹配
// 参数：
//   pattern: glob模式字符串
//   start: 开始查找的目录路径
//   stop: 停止查找的目录路径（可选）
// 返回值：
//   匹配的所有文件路径数组
// 功能：
//   - 从start目录开始向上查找
//   - 在每一层目录中使用Bun.Glob执行模式匹配
//   - 匹配配置：
//     - cwd: 当前工作目录
//     - absolute: 返回绝对路径
//     - onlyFiles: 只匹配文件
//     - followSymlinks: 跟随符号链接
//     - dot: 包含以.开头的文件
//   - 如果glob模式无效，跳过该目录
//   - 到达stop目录或根目录时停止
// 使用场景：
//   - 在项目层次结构中查找特定类型的文件
//   - 查找所有配置文件或源文件
