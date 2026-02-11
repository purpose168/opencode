/**
 * 数据上下文
 * 用于在组件树中共享应用数据，包括会话、消息、文件差异等
 */
import type { Message, Session, Part, FileDiff, SessionStatus, PermissionRequest } from "@opencode-ai/sdk/v2"
import { createSimpleContext } from "./helper"
import { PreloadMultiFileDiffResult } from "@pierre/diffs/ssr"

/**
 * 应用数据类型
 * 包含会话、消息、文件差异等数据
 */
type Data = {
  /** 会话列表 */
  session: Session[]
  /** 会话状态映射 */
  session_status: {
    [sessionID: string]: SessionStatus
  }
  /** 会话文件差异映射 */
  session_diff: {
    [sessionID: string]: FileDiff[]
  }
  /** 会话文件差异预加载结果映射 */
  session_diff_preload?: {
    [sessionID: string]: PreloadMultiFileDiffResult<any>[]
  }
  /** 权限请求映射 */
  permission?: {
    [sessionID: string]: PermissionRequest[]
  }
  /** 消息映射 */
  message: {
    [sessionID: string]: Message[]
  }
  /** 消息部分映射 */
  part: {
    [messageID: string]: Part[]
  }
}

/**
 * 权限响应函数类型
 * 用于处理权限请求的响应
 */
export type PermissionRespondFn = (input: {
  /** 会话 ID */
  sessionID: string
  /** 权限请求 ID */
  permissionID: string
  /** 响应类型：once（仅一次）、always（总是）、reject（拒绝） */
  response: "once" | "always" | "reject"
}) => void

/**
 * 数据上下文
 * 提供应用数据的共享功能
 */
export const { 
  /** 使用数据上下文的钩子 */
  use: useData, 
  /** 数据上下文提供者 */
  provider: DataProvider 
} = createSimpleContext({
  /** 上下文名称 */
  name: "Data",
  /**
   * 初始化函数
   * @param props 初始化属性
   * @param props.data 应用数据
   * @param props.directory 目录路径
   * @param props.onPermissionRespond 权限响应函数
   */
  init: (props: { 
    /** 应用数据 */
    data: Data; 
    /** 目录路径 */
    directory: string; 
    /** 权限响应函数 */
    onPermissionRespond?: PermissionRespondFn 
  }) => {
    return {
      /**
       * 获取应用数据存储
       */
      get store() {
        return props.data
      },
      /**
       * 获取目录路径
       */
      get directory() {
        return props.directory
      },
      /**
       * 响应权限请求
       */
      respondToPermission: props.onPermissionRespond,
    }
  },
})
