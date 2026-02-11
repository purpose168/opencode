/**
 * 路径工具
 * 
 * 提供路径处理相关的工具函数
 */

/**
 * 获取路径中的文件名
 * 
 * @param path - 路径字符串
 * @returns 文件名，为空字符串如果路径无效
 */
export function getFilename(path: string | undefined) {
  if (!path) return ""
  const trimmed = path.replace(/[\/]+$/, "") // 移除末尾的斜杠
  const parts = trimmed.split("/") // 分割路径
  return parts[parts.length - 1] ?? "" // 返回最后一部分
}

/**
 * 获取路径中的目录部分
 * 
 * @param path - 路径字符串
 * @returns 目录路径，为空字符串如果路径无效
 */
export function getDirectory(path: string | undefined) {
  if (!path) return ""
  const parts = path.split("/") // 分割路径
  return parts.slice(0, parts.length - 1).join("/") + "/" // 返回除最后一部分外的所有部分
}

/**
 * 获取文件扩展名
 * 
 * @param path - 路径字符串
 * @returns 文件扩展名，为空字符串如果路径无效
 */
export function getFileExtension(path: string | undefined) {
  if (!path) return ""
  const parts = path.split(".") // 分割路径
  return parts[parts.length - 1] // 返回最后一部分
}
