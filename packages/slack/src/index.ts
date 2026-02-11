// 导入 Slack Bolt 应用框架
import { App } from "@slack/bolt"
// 导入 Opencode SDK 相关类型和函数
import { createOpencode, type ToolPart } from "@opencode-ai/sdk"

// 创建 Slack 应用实例
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
})

// 输出机器人配置信息
console.log("🔧 机器人配置:")
console.log("- Bot token 存在:", !!process.env.SLACK_BOT_TOKEN)
console.log("- Signing secret 存在:", !!process.env.SLACK_SIGNING_SECRET)
console.log("- App token 存在:", !!process.env.SLACK_APP_TOKEN)

// 启动 Opencode 服务器
console.log("🚀 正在启动 opencode 服务器...")
const opencode = await createOpencode({
  port: 0,
})
console.log("✅ Opencode 服务器已就绪")

// 创建会话映射，用于跟踪每个 Slack 线程对应的 Opencode 会话
const sessions = new Map<string, { client: any; server: any; sessionId: string; channel: string; thread: string }>()

// 订阅 Opencode 事件流，监听工具更新
;(async () => {
  const events = await opencode.client.event.subscribe()
  for await (const event of events.stream) {
    if (event.type === "message.part.updated") {
      const part = event.properties.part
      if (part.type === "tool") {
        // 查找此工具更新对应的会话
        for (const [sessionKey, session] of sessions.entries()) {
          if (session.sessionId === part.sessionID) {
            handleToolUpdate(part, session.channel, session.thread)
            break
          }
        }
      }
    }
  }
})()

// 处理工具更新，将工具状态发送到 Slack 线程
async function handleToolUpdate(part: ToolPart, channel: string, thread: string) {
  if (part.state.status !== "completed") return
  const toolMessage = `*${part.tool}* - ${part.state.title}`
  await app.client.chat
    .postMessage({
      channel,
      thread_ts: thread,
      text: toolMessage,
    })
    .catch(() => {})
}

// 使用中间件记录所有 Slack 事件
app.use(async ({ next, context }) => {
  console.log("📡 原始 Slack 事件:", JSON.stringify(context, null, 2))
  await next()
})

// 处理消息事件
app.message(async ({ message, say }) => {
  console.log("📨 收到消息事件:", JSON.stringify(message, null, 2))

  // 跳过没有文本内容或有子类型的消息
  if (message.subtype || !("text" in message) || !message.text) {
    console.log("⏭️ 跳过消息 - 无文本或有子类型")
    return
  }

  console.log("✅ 正在处理消息:", message.text)

  const channel = message.channel
  const thread = (message as any).thread_ts || message.ts
  const sessionKey = `${channel}-${thread}`

  // 检查是否已存在会话
  let session = sessions.get(sessionKey)

  if (!session) {
    // 创建新的 Opencode 会话
    console.log("🆕 正在创建新的 opencode 会话...")
    const { client, server } = opencode

    const createResult = await client.session.create({
      body: { title: `Slack thread ${thread}` },
    })

    if (createResult.error) {
      console.error("❌ 创建会话失败:", createResult.error)
      await say({
        text: "抱歉，我在创建会话时遇到了问题。请重试。",
        thread_ts: thread,
      })
      return
    }

    console.log("✅ 已创建 opencode 会话:", createResult.data.id)

    // 保存会话信息
    session = { client, server, sessionId: createResult.data.id, channel, thread }
    sessions.set(sessionKey, session)

    // 分享会话 URL
    const shareResult = await client.session.share({ path: { id: createResult.data.id } })
    if (!shareResult.error && shareResult.data) {
      const sessionUrl = shareResult.data.share?.url!
      console.log("🔗 会话已分享:", sessionUrl)
      await app.client.chat.postMessage({ channel, thread_ts: thread, text: sessionUrl })
    }
  }

  // 发送消息到 Opencode
  console.log("📝 正在发送到 opencode:", message.text)
  const result = await session.client.session.prompt({
    path: { id: session.sessionId },
    body: { parts: [{ type: "text", text: message.text }] },
  })

  console.log("📤 Opencode 响应:", JSON.stringify(result, null, 2))

  if (result.error) {
    console.error("❌ 发送消息失败:", result.error)
    await say({
      text: "抱歉，我在处理您的消息时遇到了问题。请重试。",
      thread_ts: thread,
    })
    return
  }

  const response = result.data

  // 构建响应文本
  const responseText =
    response.info?.content ||
    response.parts
      ?.filter((p: any) => p.type === "text")
      .map((p: any) => p.text)
      .join("\n") ||
    "我收到了您的消息，但没有收到响应。"

  console.log("💬 正在发送响应:", responseText)

  // 发送主响应（工具更新将通过实时事件到达）
  await say({ text: responseText, thread_ts: thread })
})

// 处理测试命令
app.command("/test", async ({ command, ack, say }) => {
  await ack()
  console.log("🧪 收到测试命令:", JSON.stringify(command, null, 2))
  await say("🤖 机器人正常工作！我能清楚地听到您的声音。")
})

// 启动 Slack 应用
await app.start()
console.log("⚡️ Slack 机器人正在运行！")
