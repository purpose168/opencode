import { createMemo } from "solid-js" // Solid.js 核心函数：创建派生值，当依赖项变化时自动重新计算
// createMemo 是 Solid.js 提供的响应式原语之一
// 主要用于创建基于其他响应式数据的计算值
// 特性：
// 1. 自动追踪依赖：当依赖的响应式数据变化时，自动重新计算值
// 2. 缓存优化：只有依赖变化时才重新计算，避免不必要的重复计算
// 3. 性能提升：减少组件不必要的重新渲染
// 在此文件中用于创建目录路径的派生值，当路径或分支信息变化时自动更新

import { useSync } from "./sync" // 同步上下文钩子，用于访问同步状态数据（包括路径信息、版本控制信息等）
// useSync 是从同一目录下的 sync.tsx 文件导出的上下文钩子函数
// 功能：提供对应用同步数据的访问接口，包括：
//   - path：项目路径信息（directory、config、state、worktree）
//   - vcs：版本控制信息（如 Git 分支名称）
//   - config：应用配置信息
//   - session：会话信息
//   - provider：提供者信息等
// 使用场景：需要访问应用全局状态时调用此钩子
// 在此文件中用于获取当前项目的目录路径和版本控制分支信息

import { Global } from "@/global" // 全局配置对象，提供项目级别的配置信息（如路径配置等）
// Global 是应用的全局配置单例，包含项目级别的静态配置
// 主要属性：
//   - Path：路径配置对象，包含以下字段：
//     - home：用户主目录路径，用于路径简化替换
//     - state：应用状态目录路径
//     - config：应用配置目录路径
//     - worktree：Git worktree 路径
// 使用场景：
//   - 路径规范化处理
//   - 获取应用的配置目录
//   - 路径拼接和解析
// 在此文件中用于获取用户主目录路径（Global.Path.home），将绝对路径转换为用户友好的相对路径

/**
 * 目录路径钩子函数
 * 用于获取当前工作目录的显示路径，自动处理路径格式化和版本控制分支信息
 *
 * 功能说明：
 * 1. 获取当前工作目录的路径（优先从同步数据获取，否则使用当前工作目录）
 * 2. 将用户主目录路径替换为 ~ 符号，使显示更加简洁
 * 3. 如果存在版本控制系统（VCS）的分支信息，自动附加到路径后面
 *
 * 使用场景：
 * - 在终端界面的状态栏显示当前目录
 * - 在提示符中显示当前工作位置
 * - 在文件浏览器中显示当前路径
 *
 * 响应式特性：
 * - 使用 createMemo 创建派生值，自动追踪依赖变化
 * - 当 sync.data.path 或 sync.data.vcs 变化时自动重新计算
 * - 返回的函数调用结果会自动更新，触发相关组件重新渲染
 *
 * @returns 一个派生值函数，调用后返回格式化后的目录路径字符串
 *
 * 示例输出：
 * - 普通路径："~/projects/opencode"
 * - 带分支路径："~/projects/opencode:main"
 * - 根目录："~"
 */
export function useDirectory() {
  const sync = useSync() // 获取同步上下文实例，用于访问路径数据和版本控制信息
  // 调用 useSync 钩子获取同步状态管理器的引用
  // 返回的 sync 对象包含以下数据结构：
  //   sync.data.path.directory：当前项目的目录路径（如果有）
  //   sync.data.vcs.branch：当前 Git 分支名称（如果有）
  // 这个同步数据会在应用初始化时从服务器同步，并在运行时保持更新

  // 返回一个 createMemo 派生值，自动追踪依赖变化
  return createMemo(() => {
    // 第一步：获取目录路径
    // 优先使用同步数据中的目录路径，如果不存在则回退到当前工作目录
    const directory = sync.data.path.directory || process.cwd()
    // 说明：
    //   sync.data.path.directory：来自同步数据的项目目录，可能为 undefined
    //   process.cwd()：Node.js 内置函数，返回当前工作目录的绝对路径
    //   使用 || 运算符实现回退逻辑，确保始终有有效的目录路径
    // 典型值："/home/user/projects/opencode" 或 "/Users/user/projects/opencode"

    // 第二步：路径简化处理
    // 将用户主目录路径替换为 ~ 符号，使显示更加简洁和用户友好
    const result = directory.replace(Global.Path.home, "~")
    // 说明：
    //   directory：原始目录路径（绝对路径）
    //   Global.Path.home：用户主目录路径（如 "/home/user" 或 "C:\Users\user"）
    //   replace()：字符串替换方法，将主目录路径替换为 ~ 符号
    // 转换示例：
    //   "/home/user/projects/opencode" → "~/projects/opencode"
    //   "/home/user" → "~"
    //   "C:\Users\user\projects" → "~/projects"（Windows 路径）
    // 优势：缩短路径长度，提升可读性，符合 Unix/Linux 系统的路径显示习惯

    // 第三步：附加版本控制分支信息
    // 检查是否存在版本控制系统的分支信息，如果存在则附加到路径后面
    if (sync.data.vcs?.branch) {
      // 如果存在分支信息，返回 "路径:分支名" 格式的字符串
      // 格式说明：
      //   result：简化后的目录路径（如 "~/projects/opencode"）
      //   ":"：分隔符，用于连接路径和分支名
      //   sync.data.vcs.branch：当前 Git 分支名称（如 "main"、"develop"）
      // 示例输出："~/projects/opencode:main"
      // 用途：帮助用户快速识别当前代码所在的版本控制分支
      return result + ":" + sync.data.vcs.branch
    }

    // 如果不存在分支信息，直接返回简化后的路径
    // 示例输出："~/projects/opencode"
    return result
  })
}
