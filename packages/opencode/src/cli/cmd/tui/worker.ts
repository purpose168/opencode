import { upgrade } from "@/cli/upgrade" // 导入升级功能
import { Installation } from "@/installation" // 导入安装管理模块
import { InstanceBootstrap } from "@/project/bootstrap" // 导入实例引导模块
import { Instance } from "@/project/instance" // 导入实例管理模块
import { Server } from "@/server/server" // 导入服务器模块
import { Log } from "@/util/log" // 导入日志工具
import { Rpc } from "@/util/rpc" // 导入RPC工具
import type { BunWebSocketData } from "hono/bun" // 导入Bun WebSocket数据类型

// 初始化日志系统
await Log.init({
  print: process.argv.includes("--print-logs"), // 是否打印日志
  dev: Installation.isLocal(), // 是否为开发环境
  level: (() => {
    if (Installation.isLocal()) return "DEBUG" // 本地开发环境使用DEBUG级别
    return "INFO" // 生产环境使用INFO级别
  })(),
})

// 处理未处理的Promise拒绝
process.on("unhandledRejection", (e) => {
  Log.Default.error("拒绝", {
    e: e instanceof Error ? e.message : e,
  })
})

// 处理未捕获的异常
process.on("uncaughtException", (e) => {
  Log.Default.error("异常", {
    e: e instanceof Error ? e.message : e,
  })
})

// 服务器实例
let server: Bun.Server<BunWebSocketData>

// RPC接口定义
export const rpc = {
  // 启动服务器
  async server(input: { port: number; hostname: string; mdns?: boolean }) {
    if (server) await server.stop(true) // 如果服务器已存在,先停止
    try {
      server = Server.listen(input) // 启动服务器
      return {
        url: server.url.toString(), // 返回服务器URL
      }
    } catch (e) {
      console.error(e) // 输出错误
      throw e // 抛出异常
    }
  },
  // 检查升级
  async checkUpgrade(input: { directory: string }) {
    await Instance.provide({
      directory: input.directory, // 工作目录
      init: InstanceBootstrap, // 初始化引导器
      fn: async () => {
        await upgrade().catch(() => {}) // 执行升级检查
      },
    })
  },
  // 关闭工作进程
  async shutdown() {
    Log.Default.info("工作进程正在关闭") // 记录关闭日志
    await Instance.disposeAll() // 清理所有实例
    // TODO: 这里应该等待完成,但WebSocket连接导致挂起,需要重新审查
    server.stop(true) // 停止服务器
  },
}

Rpc.listen(rpc) // 监听RPC调用
