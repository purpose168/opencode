import { $ } from "bun"

/**
 * 侧车二进制文件配置
 * 包含不同平台的侧车二进制文件信息
 */
export const SIDECAR_BINARIES: Array<{ 
  rustTarget: string; // Rust 目标平台
  ocBinary: string; // OpenCode 二进制文件名
  assetExt: string; // 资产文件扩展名
}> = [
  {
    rustTarget: "aarch64-apple-darwin",
    ocBinary: "opencode-darwin-arm64",
    assetExt: "zip",
  },
  {
    rustTarget: "x86_64-apple-darwin",
    ocBinary: "opencode-darwin-x64",
    assetExt: "zip",
  },
  {
    rustTarget: "x86_64-pc-windows-msvc",
    ocBinary: "opencode-windows-x64",
    assetExt: "zip",
  },
  {
    rustTarget: "x86_64-unknown-linux-gnu",
    ocBinary: "opencode-linux-x64",
    assetExt: "tar.gz",
  },
  {
    rustTarget: "aarch64-unknown-linux-gnu",
    ocBinary: "opencode-linux-arm64",
    assetExt: "tar.gz",
  },
]

/**
 * Rust 目标平台
 * 从环境变量 RUST_TARGET 获取
 */
export const RUST_TARGET = Bun.env.RUST_TARGET

/**
 * 获取当前侧车配置
 * 根据目标平台获取对应的侧车配置信息
 * @param target 目标平台（可选），默认使用 RUST_TARGET 环境变量
 * @returns 侧车配置对象
 * @throws 如果未设置 RUST_TARGET，则抛出错误
 * @throws 如果找不到对应的侧车配置，则抛出错误
 */
export function getCurrentSidecar(target = RUST_TARGET) {
  if (!target && !RUST_TARGET) throw new Error("RUST_TARGET 未设置")

  const binaryConfig = SIDECAR_BINARIES.find((b) => b.rustTarget === target)
  if (!binaryConfig) throw new Error(`Rust 目标平台 '${RUST_TARGET}' 的侧车配置不可用`)

  return binaryConfig
}

/**
 * 复制二进制文件到侧车文件夹
 * 将指定的二进制文件复制到 Tauri 侧车文件夹
 * @param source 源二进制文件路径
 * @param target 目标平台（可选），默认使用 RUST_TARGET 环境变量
 */
export async function copyBinaryToSidecarFolder(source: string, target = RUST_TARGET) {
  // 创建侧车文件夹（如果不存在）
  await $`mkdir -p src-tauri/sidecars`
  
  // 目标文件路径
  // 格式：src-tauri/sidecars/opencode-cli-${target}[.exe]
  // 根据平台自动添加 .exe 扩展名
  const dest = `src-tauri/sidecars/opencode-cli-${target}${process.platform === "win32" ? ".exe" : ""}`
  
  // 复制文件
  await $`cp ${source} ${dest}`

  // 打印复制信息
  console.log(`已将 ${source} 复制到 ${dest}`)
}
