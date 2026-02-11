// 导入 SDK 中的客户端和服务器创建函数
import { createOpencodeClient, createOpencodeServer } from "@opencode-ai/sdk"

// 创建 opencode 服务器实例
const server = await createOpencodeServer()
// 创建 opencode 客户端实例，连接到服务器
const client = createOpencodeClient({ baseUrl: server.url })

// 使用 glob 模式匹配 packages/core 目录下的所有 .ts 文件
const input = await Array.fromAsync(new Bun.Glob("packages/core/*.ts").scan())

// 定义任务数组，用于存储异步任务
const tasks: Promise<void>[] = []
// 遍历所有匹配的文件
for await (const file of input) {
  console.log("正在处理", file)
  // 为每个文件创建一个新的会话
  const session = await client.session.create()
  tasks.push(
    // 发送提示请求，要求为文件中的每个公共函数编写测试
    client.session.prompt({
      path: { id: session.data.id },
      body: {
        parts: [
          {
            type: "file",
            mime: "text/plain",
            url: `file://${file}`,
          },
          {
            type: "text",
            text: `为此文件中的每个公共函数编写测试。`,
          },
        ],
      },
    }),
  )
  console.log("完成", file)
}

// 使用 Promise.all 并行处理所有文件
await Promise.all(
  input.map(async (file) => {
    // 为每个文件创建一个新的会话
    const session = await client.session.create()
    console.log("正在处理", file)
    // 发送提示请求，要求为文件中的每个公共函数编写测试
    await client.session.prompt({
      path: { id: session.data.id },
      body: {
        parts: [
          {
            type: "file",
            mime: "text/plain",
            url: `file://${file}`,
          },
          {
            type: "text",
            text: `为此文件中的每个公共函数编写测试。`,
          },
        ],
      },
    })
    console.log("完成", file)
  }),
)
