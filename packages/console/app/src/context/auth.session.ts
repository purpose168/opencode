import { useSession } from "@solidjs/start/http"

/**
 * 认证会话接口
 */
export interface AuthSession {
  account?: Record<
    string,
    {
      id: string    // 账户 ID
      email: string // 电子邮件
    }
  >
  current?: string // 当前账户 ID
}

/**
 * 获取认证会话
 * @returns 认证会话对象
 */
export function useAuthSession() {
  return useSession<AuthSession>({
    password: "0".repeat(32),         // 会话密码
    name: "auth",                     // 会话名称
    maxAge: 60 * 60 * 24 * 365,        // 会话有效期（一年）
    cookie: {
      secure: false,                   // 非安全连接
      httpOnly: true,                  // 仅 HTTP 访问
    },
  })
}
