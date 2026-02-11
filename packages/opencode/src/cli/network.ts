import type { Argv, InferredOptionTypes } from "yargs" // 导入yargs类型定义
import { Config } from "../config/config" // 导入配置模块

// 网络选项配置
const options = {
  port: {
    type: "number" as const, // 端口号类型
    describe: "监听端口", // 端口描述
    default: 0, // 默认端口
  },
  hostname: {
    type: "string" as const, // 主机名类型
    describe: "监听主机名", // 主机名描述
    default: "127.0.0.1", // 默认主机名
  },
  mdns: {
    type: "boolean" as const, // 布尔类型
    describe: "启用mDNS服务发现(默认主机名为0.0.0.0)", // mDNS描述
    default: false, // 默认值
  },
  cors: {
    type: "string" as const, // 字符串类型
    array: true, // 数组类型
    describe: "允许CORS的额外域名", // CORS描述
    default: [] as string[], // 默认值
  },
}

// 网络选项类型
export type NetworkOptions = InferredOptionTypes<typeof options>

// 添加网络选项到yargs
export function withNetworkOptions<T>(yargs: Argv<T>) {
  return yargs.options(options)
}

// 解析网络选项
export async function resolveNetworkOptions(args: NetworkOptions) {
  const config = await Config.global() // 获取全局配置
  const portExplicitlySet = process.argv.includes("--port") // 检查端口是否显式设置
  const hostnameExplicitlySet = process.argv.includes("--hostname") // 检查主机名是否显式设置
  const mdnsExplicitlySet = process.argv.includes("--mdns") // 检查mDNS是否显式设置
  const corsExplicitlySet = process.argv.includes("--cors") // 检查CORS是否显式设置

  const mdns = mdnsExplicitlySet ? args.mdns : (config?.server?.mdns ?? args.mdns) // 解析mDNS选项
  const port = portExplicitlySet ? args.port : (config?.server?.port ?? args.port) // 解析端口选项
  const hostname = hostnameExplicitlySet // 解析主机名选项
    ? args.hostname
    : mdns && !config?.server?.hostname
      ? "0.0.0.0"
      : (config?.server?.hostname ?? args.hostname)
  const configCors = config?.server?.cors ?? [] // 获取配置中的CORS设置
  const argsCors = Array.isArray(args.cors) ? args.cors : args.cors ? [args.cors] : [] // 获取参数中的CORS设置
  const cors = [...configCors, ...argsCors] // 合并CORS设置

  return { hostname, port, mdns, cors } // 返回解析后的网络选项
}
