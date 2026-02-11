import { Log } from "../util/log"
import { OAUTH_CALLBACK_PATH, OAUTH_CALLBACK_PORT } from "./oauth-provider"

const log = Log.create({ service: "mcp.oauth-callback" }) // 创建OAuth回调服务日志记录器

// OAuth授权成功页面HTML模板
const HTML_SUCCESS = `<!DOCTYPE html>
<html>
<head>
  <title>OpenCode - 授权成功</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: #eee; }
    .container { text-align: center; padding: 2rem; }
    h1 { color: #4ade80; margin-bottom: 1rem; }
    p { color: #aaa; }
  </style>
</head>
<body>
  <div class="container">
    <h1>授权成功</h1>
    <p>您可以关闭此窗口并返回 OpenCode。</p>
  </div>
  <script>setTimeout(() => window.close(), 2000);</script>
</body>
</html>`

// OAuth授权失败页面HTML模板
const HTML_ERROR = (error: string) => `<!DOCTYPE html>
<html>
<head>
  <title>OpenCode - 授权失败</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: #eee; }
    .container { text-align: center; padding: 2rem; }
    h1 { color: #f87171; margin-bottom: 1rem; }
    p { color: #aaa; }
    .error { color: #fca5a5; font-family: monospace; margin-top: 1rem; padding: 1rem; background: rgba(248,113,113,0.1); border-radius: 0.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>授权失败</h1>
    <p>授权过程中发生错误。</p>
    <div class="error">${error}</div>
  </div>
</body>
</html>`

// 待处理的OAuth认证请求接口定义
interface PendingAuth {
  resolve: (code: string) => void // 成功回调函数,接收授权代码
  reject: (error: Error) => void // 失败回调函数,接收错误信息
  timeout: ReturnType<typeof setTimeout> // 超时定时器
}

// MCP OAuth回调命名空间,管理OAuth认证回调服务器
export namespace McpOAuthCallback {
  let server: ReturnType<typeof Bun.serve> | undefined // HTTP服务器实例
  const pendingAuths = new Map<string, PendingAuth>() // 待处理的OAuth认证请求映射表

  const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000 // OAuth回调超时时间:5分钟

  // 确保OAuth回调服务器正在运行,如果未运行则启动
  export async function ensureRunning(): Promise<void> {
    if (server) return

    const running = await isPortInUse()
    if (running) {
      log.info("OAuth回调服务器已在另一个实例上运行", { port: OAUTH_CALLBACK_PORT })
      return
    }

    // 启动HTTP服务器处理OAuth回调请求
    server = Bun.serve({
      port: OAUTH_CALLBACK_PORT,
      fetch(req) {
        const url = new URL(req.url)

        // 检查请求路径是否为OAuth回调路径
        if (url.pathname !== OAUTH_CALLBACK_PATH) {
          return new Response("未找到", { status: 404 })
        }

        // 从URL查询参数中提取OAuth相关信息
        const code = url.searchParams.get("code") // 授权代码
        const state = url.searchParams.get("state") // 状态参数(用于CSRF防护)
        const error = url.searchParams.get("error") // 错误代码
        const errorDescription = url.searchParams.get("error_description") // 错误描述

        log.info("收到OAuth回调", { hasCode: !!code, state, error })

        // 强制要求状态参数存在,防止CSRF攻击
        if (!state) {
          const errorMsg = "缺少必需的状态参数 - 可能存在CSRF攻击"
          log.error("OAuth回调缺少状态参数", { url: url.toString() })
          return new Response(HTML_ERROR(errorMsg), {
            status: 400,
            headers: { "Content-Type": "text/html" },
          })
        }

        // 处理OAuth错误响应
        if (error) {
          const errorMsg = errorDescription || error
          if (pendingAuths.has(state)) {
            const pending = pendingAuths.get(state)!
            clearTimeout(pending.timeout)
            pendingAuths.delete(state)
            pending.reject(new Error(errorMsg))
          }
          return new Response(HTML_ERROR(errorMsg), {
            headers: { "Content-Type": "text/html" },
          })
        }

        // 检查是否提供了授权代码
        if (!code) {
          return new Response(HTML_ERROR("未提供授权代码"), {
            status: 400,
            headers: { "Content-Type": "text/html" },
          })
        }

        // 验证状态参数是否有效
        if (!pendingAuths.has(state)) {
          const errorMsg = "无效或已过期的状态参数 - 可能存在CSRF攻击"
          log.error("OAuth回调使用无效状态参数", { state, pendingStates: Array.from(pendingAuths.keys()) })
          return new Response(HTML_ERROR(errorMsg), {
            status: 400,
            headers: { "Content-Type": "text/html" },
          })
        }

        // 成功处理OAuth回调
        const pending = pendingAuths.get(state)!

        clearTimeout(pending.timeout)
        pendingAuths.delete(state)
        pending.resolve(code)

        return new Response(HTML_SUCCESS, {
          headers: { "Content-Type": "text/html" },
        })
      },
    })

    log.info("OAuth回调服务器已启动", { port: OAUTH_CALLBACK_PORT })
  }

  // 等待OAuth回调并返回授权代码
  export function waitForCallback(oauthState: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // 设置超时定时器,防止长时间等待
      const timeout = setTimeout(() => {
        if (pendingAuths.has(oauthState)) {
          pendingAuths.delete(oauthState)
          reject(new Error("OAuth回调超时 - 授权耗时过长"))
        }
      }, CALLBACK_TIMEOUT_MS)

      // 将待处理的认证请求存储到映射表中
      pendingAuths.set(oauthState, { resolve, reject, timeout })
    })
  }

  // 取消指定MCP服务器的待处理OAuth认证
  export function cancelPending(mcpName: string): void {
    const pending = pendingAuths.get(mcpName)
    if (pending) {
      clearTimeout(pending.timeout)
      pendingAuths.delete(mcpName)
      pending.reject(new Error("授权已取消"))
    }
  }

  // 检查OAuth回调端口是否已被占用
  export async function isPortInUse(): Promise<boolean> {
    return new Promise((resolve) => {
      // 尝试连接到OAuth回调端口,检查是否已被占用
      Bun.connect({
        hostname: "127.0.0.1",
        port: OAUTH_CALLBACK_PORT,
        socket: {
          open(socket) {
            // 连接成功,说明端口已被占用
            socket.end()
            resolve(true)
          },
          error() {
            // 连接失败,说明端口未被占用
            resolve(false)
          },
          data() {},
          close() {},
        },
      }).catch(() => {
        // 连接异常,说明端口未被占用
        resolve(false)
      })
    })
  }

  // 停止OAuth回调服务器并清理所有待处理的认证请求
  export async function stop(): Promise<void> {
    if (server) {
      server.stop()
      server = undefined
      log.info("OAuth回调服务器已停止")
    }

    // 清理所有待处理的OAuth认证请求
    for (const [name, pending] of pendingAuths) {
      clearTimeout(pending.timeout)
      pending.reject(new Error("OAuth回调服务器已停止"))
    }
    pendingAuths.clear()
  }

  // 检查OAuth回调服务器是否正在运行
  export function isRunning(): boolean {
    return server !== undefined
  }
}
