import { Hono } from "hono"
import { DurableObject } from "cloudflare:workers"
import { randomUUID } from "node:crypto"
import { jwtVerify, createRemoteJWKSet } from "jose"
import { createAppAuth } from "@octokit/auth-app"
import { Octokit } from "@octokit/rest"
import { Resource } from "sst"

/**
 * 环境变量类型定义
 */
type Env = {
  SYNC_SERVER: DurableObjectNamespace<SyncServer>
  Bucket: R2Bucket
  WEB_DOMAIN: string
}

/**
 * 同步服务器持久对象
 * 处理WebSocket连接、数据存储和消息发布
 */
export class SyncServer extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
  }
  
  /**
   * 处理WebSocket连接请求
   */
  async fetch() {
    console.log("SyncServer 订阅")

    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    this.ctx.acceptWebSocket(server)

    // 发送现有会话数据
    const data = await this.ctx.storage.list()
    Array.from(data.entries())
      .filter(([key, _]) => key.startsWith("session/"))
      .map(([key, content]) => server.send(JSON.stringify({ key, content })))

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  /**
   * 处理WebSocket消息
   */
  async webSocketMessage(ws, message) {}

  /**
   * 处理WebSocket关闭
   */
  async webSocketClose(ws, code, reason, wasClean) {
    ws.close(code, "持久对象正在关闭WebSocket")
  }

  /**
   * 发布消息到所有订阅者
   * @param key 消息键
   * @param content 消息内容
   */
  async publish(key: string, content: any) {
    const sessionID = await this.getSessionID()
    if (
      !key.startsWith(`session/info/${sessionID}`) &&
      !key.startsWith(`session/message/${sessionID}/`) &&
      !key.startsWith(`session/part/${sessionID}/`)
    )
      return new Response("错误: 无效的键", { status: 400 })

    // 存储消息
    await this.env.Bucket.put(`share/${key}.json`, JSON.stringify(content), {
      httpMetadata: {
        contentType: "application/json",
      },
    })
    await this.ctx.storage.put(key, content)
    const clients = this.ctx.getWebSockets()
    console.log("SyncServer 发布", key, "到", clients.length, "个订阅者")
    for (const client of clients) {
      client.send(JSON.stringify({ key, content }))
    }
  }

  /**
   * 创建或获取会话分享密钥
   * @param sessionID 会话ID
   * @returns 分享密钥
   */
  public async share(sessionID: string) {
    let secret = await this.getSecret()
    if (secret) return secret
    secret = randomUUID()

    await this.ctx.storage.put("secret", secret)
    await this.ctx.storage.put("sessionID", sessionID)

    return secret
  }

  /**
   * 获取所有会话数据
   * @returns 会话数据数组
   */
  public async getData() {
    const data = (await this.ctx.storage.list()) as Map<string, any>
    return Array.from(data.entries())
      .filter(([key, _]) => key.startsWith("session/"))
      .map(([key, content]) => ({ key, content }))
  }

  /**
   * 验证分享密钥
   * @param secret 待验证的密钥
   */
  public async assertSecret(secret: string) {
    if (secret !== (await this.getSecret())) throw new Error("无效的密钥")
  }

  /**
   * 获取分享密钥
   */
  private async getSecret() {
    return this.ctx.storage.get<string>("secret")
  }

  /**
   * 获取会话ID
   */
  private async getSessionID() {
    return this.ctx.storage.get<string>("sessionID")
  }

  /**
   * 清除会话数据
   */
  async clear() {
    const sessionID = await this.getSessionID()
    const list = await this.env.Bucket.list({
      prefix: `session/message/${sessionID}/`,
      limit: 1000,
    })
    for (const item of list.objects) {
      await this.env.Bucket.delete(item.key)
    }
    await this.env.Bucket.delete(`session/info/${sessionID}`)
    await this.ctx.storage.deleteAll()
  }

  /**
   * 获取ID的简短版本（最后8个字符）
   * @param id 完整ID
   * @returns 简短ID
   */
  static shortName(id: string) {
    return id.substring(id.length - 8)
  }
}

/**
 * API路由应用
 */
export default new Hono<{ Bindings: Env }>()
  .get("/", (c) => c.text("你好，世界！"))
  
  /**
   * 创建分享
   */
  .post("/share_create", async (c) => {
    const body = await c.req.json<{ sessionID: string }>()
    const sessionID = body.sessionID
    const short = SyncServer.shortName(sessionID)
    const id = c.env.SYNC_SERVER.idFromName(short)
    const stub = c.env.SYNC_SERVER.get(id)
    const secret = await stub.share(sessionID)
    return c.json({
      secret,
      url: `https://${c.env.WEB_DOMAIN}/s/${short}`,
    })
  })
  
  /**
   * 删除分享
   */
  .post("/share_delete", async (c) => {
    const body = await c.req.json<{ sessionID: string; secret: string }>()
    const sessionID = body.sessionID
    const secret = body.secret
    const id = c.env.SYNC_SERVER.idFromName(SyncServer.shortName(sessionID))
    const stub = c.env.SYNC_SERVER.get(id)
    await stub.assertSecret(secret)
    await stub.clear()
    return c.json({})
  })
  
  /**
   * 管理员删除分享
   */
  .post("/share_delete_admin", async (c) => {
    const body = await c.req.json<{ sessionShortName: string; adminSecret: string }>()
    const sessionShortName = body.sessionShortName
    const adminSecret = body.adminSecret
    if (adminSecret !== Resource.ADMIN_SECRET.value) throw new Error("无效的管理员密钥")
    const id = c.env.SYNC_SERVER.idFromName(sessionShortName)
    const stub = c.env.SYNC_SERVER.get(id)
    await stub.clear()
    return c.json({})
  })
  
  /**
   * 同步分享数据
   */
  .post("/share_sync", async (c) => {
    const body = await c.req.json<{
      sessionID: string
      secret: string
      key: string
      content: any
    }>()
    const name = SyncServer.shortName(body.sessionID)
    const id = c.env.SYNC_SERVER.idFromName(name)
    const stub = c.env.SYNC_SERVER.get(id)
    await stub.assertSecret(body.secret)
    await stub.publish(body.key, body.content)
    return c.json({})
  })
  
  /**
   * 轮询分享数据（WebSocket连接）
   */
  .get("/share_poll", async (c) => {
    const upgradeHeader = c.req.header("Upgrade")
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return c.text("错误: 需要Upgrade头", { status: 426 })
    }
    const id = c.req.query("id")
    console.log("share_poll", id)
    if (!id) return c.text("错误: 需要分享ID", { status: 400 })
    const stub = c.env.SYNC_SERVER.get(c.env.SYNC_SERVER.idFromName(id))
    return stub.fetch(c.req.raw)
  })
  
  /**
   * 获取分享数据
   */
  .get("/share_data", async (c) => {
    const id = c.req.query("id")
    console.log("share_data", id)
    if (!id) return c.text("错误: 需要分享ID", { status: 400 })
    const stub = c.env.SYNC_SERVER.get(c.env.SYNC_SERVER.idFromName(id))
    const data = await stub.getData()

    let info
    const messages: Record<string, any> = {}
    data.forEach((d) => {
      const [root, type, ...splits] = d.key.split("/")
      if (root !== "session") return
      if (type === "info") {
        info = d.content
        return
      }
      if (type === "message") {
        messages[d.content.id] = {
          parts: [],
          ...d.content,
        }
      }
      if (type === "part") {
        messages[d.content.messageID].parts.push(d.content)
      }
    })

    return c.json({ info, messages })
  })
  /**
   * 用于GitHub Action，通过OIDC令牌获取GitHub安装访问令牌
   */
  .post("/exchange_github_app_token", async (c) => {
    const EXPECTED_AUDIENCE = "opencode-github-action"
    const GITHUB_ISSUER = "https://token.actions.githubusercontent.com"
    const JWKS_URL = `${GITHUB_ISSUER}/.well-known/jwks`

    // 获取Authorization头
    const token = c.req.header("Authorization")?.replace(/^Bearer /, "")
    if (!token) return c.json({ error: "需要Authorization头" }, { status: 401 })

    // 验证令牌
    const JWKS = createRemoteJWKSet(new URL(JWKS_URL))
    let owner, repo
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: GITHUB_ISSUER,
        audience: EXPECTED_AUDIENCE,
      })
      const sub = payload.sub // e.g. 'repo:my-org/my-repo:ref:refs/heads/main'
      const parts = sub.split(":")[1].split("/")
      owner = parts[0]
      repo = parts[1]
    } catch (err) {
      console.error("令牌验证失败:", err)
      return c.json({ error: "无效或过期的令牌" }, { status: 403 })
    }

    // 创建应用JWT令牌
    const auth = createAppAuth({
      appId: Resource.GITHUB_APP_ID.value,
      privateKey: Resource.GITHUB_APP_PRIVATE_KEY.value,
    })
    const appAuth = await auth({ type: "app" })

    // 查询安装
    const octokit = new Octokit({ auth: appAuth.token })
    const { data: installation } = await octokit.apps.getRepoInstallation({
      owner,
      repo,
    })

    // 获取安装令牌
    const installationAuth = await auth({
      type: "installation",
      installationId: installation.id,
    })

    return c.json({ token: installationAuth.token })
  })
  /**
   * 用于GitHub Action，通过用户PAT令牌获取GitHub安装访问令牌（用于本地测试`opencode github run`）
   */
  .post("/exchange_github_app_token_with_pat", async (c) => {
    const body = await c.req.json<{ owner: string; repo: string }>()
    const owner = body.owner
    const repo = body.repo

    try {
      // 获取Authorization头
      const authHeader = c.req.header("Authorization")
      const token = authHeader?.replace(/^Bearer /, "")
      if (!token) throw new Error("需要Authorization头")

      // 验证权限
      const userClient = new Octokit({ auth: token })
      const { data: repoData } = await userClient.repos.get({ owner, repo })
      if (!repoData.permissions.admin && !repoData.permissions.push && !repoData.permissions.maintain)
        throw new Error("用户没有写入权限")

      // 获取安装令牌
      const auth = createAppAuth({
        appId: Resource.GITHUB_APP_ID.value,
        privateKey: Resource.GITHUB_APP_PRIVATE_KEY.value,
      })
      const appAuth = await auth({ type: "app" })

      // 查询安装
      const appClient = new Octokit({ auth: appAuth.token })
      const { data: installation } = await appClient.apps.getRepoInstallation({
        owner,
        repo,
      })

      // 获取安装令牌
      const installationAuth = await auth({
        type: "installation",
        installationId: installation.id,
      })

      return c.json({ token: installationAuth.token })
    } catch (e: any) {
      let error = e
      if (e instanceof Error) {
        error = e.message
      }

      return c.json({ error }, { status: 401 })
    }
  })
  /**
   * 用于opencode CLI检查GitHub应用是否已安装
   */
  .get("/get_github_app_installation", async (c) => {
    const owner = c.req.query("owner")
    const repo = c.req.query("repo")

    const auth = createAppAuth({
      appId: Resource.GITHUB_APP_ID.value,
      privateKey: Resource.GITHUB_APP_PRIVATE_KEY.value,
    })
    const appAuth = await auth({ type: "app" })

    // 查询安装
    const octokit = new Octokit({ auth: appAuth.token })
    let installation
    try {
      const ret = await octokit.apps.getRepoInstallation({ owner, repo })
      installation = ret.data
    } catch (err) {
      if (err instanceof Error && err.message.includes("Not Found")) {
        // 未安装
      } else {
        throw err
      }
    }

    return c.json({ installation })
  })
  /**
   * 处理404请求
   */
  .all("*", (c) => c.text("未找到"))
