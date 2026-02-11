/**
 * 编码和哈希工具
 * 
 * 提供 Base64 编码/解码、哈希计算和校验和生成功能
 */

/**
 * Base64 编码（URL 安全）
 * 
 * @param value - 要编码的字符串
 * @returns URL 安全的 Base64 编码字符串
 */
export function base64Encode(value: string) {
  const bytes = new TextEncoder().encode(value) // 将字符串转换为 UTF-8 字节
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("") // 转换为二进制字符串
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "") // 编码并替换为 URL 安全字符
}

/**
 * Base64 解码（URL 安全）
 * 
 * @param value - 要解码的 URL 安全 Base64 字符串
 * @returns 解码后的字符串
 */
export function base64Decode(value: string) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/")) // 替换回标准 Base64 字符并解码
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0)) // 转换为字节数组
  return new TextDecoder().decode(bytes) // 解码为字符串
}

/**
 * 计算字符串的哈希值
 * 
 * @param content - 要哈希的字符串
 * @param algorithm - 哈希算法，默认为 "SHA-256"
 * @returns 十六进制哈希字符串
 */
export async function hash(content: string, algorithm = "SHA-256"): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content) // 将字符串转换为 UTF-8 字节
  const hashBuffer = await crypto.subtle.digest(algorithm, data) // 计算哈希
  const hashArray = Array.from(new Uint8Array(hashBuffer)) // 转换为字节数组
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("") // 转换为十六进制字符串
  return hashHex
}

/**
 * 计算字符串的校验和
 * 
 * 使用 FNV-1a 哈希算法的变体
 * 
 * @param content - 要计算校验和的字符串
 * @returns 校验和字符串，或 undefined（如果内容为空）
 */
export function checksum(content: string): string | undefined {
  if (!content) return undefined
  let hash = 0x811c9dc5 // FNV-1a 初始哈希值
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i) // 异或当前字符的 ASCII 码
    hash = Math.imul(hash, 0x01000193) // 乘以 FNV 质数
  }
  return (hash >>> 0).toString(36) // 转换为无符号整数并以 36 进制表示
}
