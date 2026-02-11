// 导入服务器模块，用于获取 OpenAPI 规范
import { Server } from "../../server/server"
// 导入命令模块类型，用于类型定义
import type { CommandModule } from "yargs"

/**
 * GenerateCommand 生成命令定义
 *
 * 功能说明：
 * - 定义 "generate" 命令，用于生成 OpenAPI 规范的代码示例
 * - 从服务器获取 OpenAPI 规范
 * - 为每个 API 操作生成 JavaScript/TypeScript 代码示例
 * - 代码示例使用 @opencode-ai/sdk 客户端
 * - 将生成的规范输出到标准输出
 *
 * 使用场景：
 * - 需要生成 API 调用代码示例时
 * - 需要查看 OpenAPI 规范时
 * - 需要为 SDK 生成代码示例时
 * - 需要文档化 API 接口时
 *
 * 命令格式：
 * - opencode generate
 *
 * 输出格式：
 * - JSON 格式的 OpenAPI 规范，包含代码示例
 * - 代码示例添加到每个操作的 x-codeSamples 字段
 * - 代码示例语言为 JavaScript
 *
 * 工作流程：
 * 1. 从服务器获取 OpenAPI 规范
 * 2. 遍历所有路径和 HTTP 方法
 * 3. 为每个操作生成代码示例
 * 4. 将代码示例添加到 OpenAPI 规范
 * 5. 将规范输出到标准输出
 *
 * 注意事项：
 * - 只为有 operationId 的操作生成代码示例
 * - 代码示例使用 @opencode-ai/sdk 客户端
 * - 输出到标准输出（stdout）
 * - 等待标准输出完成后再退出进程
 */
export const GenerateCommand = {
  // 导出生成命令定义
  command: "generate", // 命令名称
  handler: async () => {
    // 命令处理函数，异步执行
    const specs = await Server.openapi() // 从服务器获取 OpenAPI 规范
    for (const item of Object.values(specs.paths)) {
      // 遍历所有路径
      for (const method of ["get", "post", "put", "delete", "patch"] as const) {
        // 遍历所有 HTTP 方法（GET、POST、PUT、DELETE、PATCH）
        const operation = item[method] // 获取当前方法的操作对象
        if (!operation?.operationId) continue // 如果操作没有 operationId，跳过此操作
        // @ts-expect-error // TypeScript 期望错误注释（因为 x-codeSamples 不是 OpenAPI 标准字段）
        operation["x-codeSamples"] = [
          // 为操作添加代码示例
          {
            lang: "js", // 代码示例语言为 JavaScript
            source: [
              // 代码示例源代码
              `import { createOpencodeClient } from "@opencode-ai/sdk"`, // 导入 SDK 客户端创建函数
              ``, // 空行
              `const client = createOpencodeClient()`, // 创建客户端实例
              `await client.${operation.operationId}({`, // 调用 API 操作
              `  ...`, // 参数占位符
              `})`, // 结束函数调用
            ].join("\n"), // 用换行符连接所有代码行
          },
        ]
      }
    }
    const json = JSON.stringify(specs, null, 2) // 将 OpenAPI 规范格式化为 JSON（缩进 2 个空格）

    // Wait for stdout to finish writing before process.exit() is called
    // 等待标准输出完成写入后再调用 process.exit()
    await new Promise<void>((resolve, reject) => {
      // 创建 Promise，等待写入完成
      process.stdout.write(json, (err) => {
        // 将 JSON 写入标准输出
        if (err)
          reject(err) // 如果写入出错，拒绝 Promise
        else resolve() // 如果写入成功，解决 Promise
      })
    })
  },
} satisfies CommandModule // 满足 CommandModule 类型
