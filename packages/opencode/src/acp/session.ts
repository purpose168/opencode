/**
 * ACP 会话管理器
 * 负责创建、加载和管理 ACP (Agent Client Protocol) 会话
 */
import { RequestError, type McpServer } from "@agentclientprotocol/sdk"
import type { ACPSessionState } from "./types"
import { Log } from "@/util/log"
import type { OpencodeClient } from "@opencode-ai/sdk/v2"

const log = Log.create({ service: "acp-session-manager" })

export class ACPSessionManager {
  private sessions = new Map<string, ACPSessionState>()
  private sdk: OpencodeClient

  /**
   * 构造函数
   * @param sdk Opencode 客户端 SDK
   */
  constructor(sdk: OpencodeClient) {
    this.sdk = sdk
  }

  /**
   * 创建新的 ACP 会话
   * @param cwd 工作目录
   * @param mcpServers MCP 服务器列表
   * @param model 可选的模型配置
   * @returns 创建的会话状态
   */
  async create(cwd: string, mcpServers: McpServer[], model?: ACPSessionState["model"]): Promise<ACPSessionState> {
    const session = await this.sdk.session
      .create(
        {
          title: `ACP Session ${crypto.randomUUID()}`,
          directory: cwd,
        },
        { throwOnError: true },
      )
      .then((x) => x.data!)

    const sessionId = session.id
    const resolvedModel = model

    const state: ACPSessionState = {
      id: sessionId,
      cwd,
      mcpServers,
      createdAt: new Date(),
      model: resolvedModel,
    }
    log.info("创建会话", { state })

    this.sessions.set(sessionId, state)
    return state
  }

  /**
   * 加载现有 ACP 会话
   * @param sessionId 会话 ID
   * @param cwd 工作目录
   * @param mcpServers MCP 服务器列表
   * @param model 可选的模型配置
   * @returns 加载的会话状态
   */
  async load(
    sessionId: string,
    cwd: string,
    mcpServers: McpServer[],
    model?: ACPSessionState["model"],
  ): Promise<ACPSessionState> {
    const session = await this.sdk.session
      .get(
        {
          sessionID: sessionId,
          directory: cwd,
        },
        { throwOnError: true },
      )
      .then((x) => x.data!)

    const resolvedModel = model

    const state: ACPSessionState = {
      id: sessionId,
      cwd,
      mcpServers,
      createdAt: new Date(session.time.created),
      model: resolvedModel,
    }
    log.info("加载会话", { state })

    this.sessions.set(sessionId, state)
    return state
  }

  /**
   * 获取会话状态
   * @param sessionId 会话 ID
   * @returns 会话状态
   * @throws 如果会话不存在，抛出参数无效错误
   */
  get(sessionId: string): ACPSessionState {
    const session = this.sessions.get(sessionId)
    if (!session) {
      log.error("会话未找到", { sessionId })
      throw RequestError.invalidParams(JSON.stringify({ error: `会话未找到: ${sessionId}` }))
    }
    return session
  }

  /**
   * 获取会话模型
   * @param sessionId 会话 ID
   * @returns 会话的模型配置
   */
  getModel(sessionId: string) {
    const session = this.get(sessionId)
    return session.model
  }

  /**
   * 设置会话模型
   * @param sessionId 会话 ID
   * @param model 模型配置
   * @returns 更新后的会话状态
   */
  setModel(sessionId: string, model: ACPSessionState["model"]) {
    const session = this.get(sessionId)
    session.model = model
    this.sessions.set(sessionId, session)
    return session
  }

  /**
   * 设置会话模式
   * @param sessionId 会话 ID
   * @param modeId 模式 ID
   * @returns 更新后的会话状态
   */
  setMode(sessionId: string, modeId: string) {
    const session = this.get(sessionId)
    session.modeId = modeId
    this.sessions.set(sessionId, session)
    return session
  }
}
