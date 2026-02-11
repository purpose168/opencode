import { sep } from "node:path" // 导入路径分隔符

export namespace FileIgnore {
  // 默认忽略的文件夹集合
  const FOLDERS = new Set([
    "node_modules",
    "bower_components",
    ".pnpm-store",
    "vendor",
    ".npm",
    "dist",
    "build",
    "out",
    ".next",
    "target",
    "bin",
    "obj",
    ".git",
    ".svn",
    ".hg",
    ".vscode",
    ".idea",
    ".turbo",
    ".output",
    "desktop",
    ".sst",
    ".cache",
    ".webkit-cache",
    "__pycache__",
    ".pytest_cache",
    "mypy_cache",
    ".history",
    ".gradle",
  ])

  // 默认忽略的文件模式
  const FILES = [
    "**/*.swp",
    "**/*.swo",

    "**/*.pyc",

    // OS
    "**/.DS_Store",
    "**/Thumbs.db",

    // Logs & temp
    "**/logs/**",
    "**/tmp/**",
    "**/temp/**",
    "**/*.log",

    // Coverage/test outputs
    "**/coverage/**",
    "**/.nyc_output/**",
  ]

  // 将文件模式转换为Glob对象
  const FILE_GLOBS = FILES.map((p) => new Bun.Glob(p))

  // 所有忽略模式(文件夹和文件)
  export const PATTERNS = [...FILES, ...FOLDERS]

  // 检查文件路径是否匹配忽略模式
  export function match(
    filepath: string,
    opts?: {
      extra?: Bun.Glob[] // 额外的忽略模式
      whitelist?: Bun.Glob[] // 白名单模式(即使匹配忽略模式也不忽略)
    },
  ) {
    // 先检查白名单,如果匹配则不忽略
    for (const glob of opts?.whitelist || []) {
      if (glob.match(filepath)) return false
    }

    // 检查路径中的任何部分是否匹配忽略的文件夹
    const parts = filepath.split(sep)
    for (let i = 0; i < parts.length; i++) {
      if (FOLDERS.has(parts[i])) return true
    }

    // 检查文件路径是否匹配忽略的文件模式
    const extra = opts?.extra || []
    for (const glob of [...FILE_GLOBS, ...extra]) {
      if (glob.match(filepath)) return true
    }

    return false
  }
}
