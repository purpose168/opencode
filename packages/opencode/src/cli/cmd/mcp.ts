// 导入命令创建工具
import { cmd } from "./cmd"
// 导入 MCP SDK 客户端
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
// 导入可流式 HTTP 客户端传输
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
// 导入交互式提示工具
import * as prompts from "@clack/prompts"
// 导入 UI 工具
import { UI } from "../ui"
// 导入 MCP 模块
import { MCP } from "../../mcp"
// 导入 MCP 认证模块
import { McpAuth } from "../../mcp/auth"
// 导入 MCP OAuth 提供者
import { McpOAuthProvider } from "../../mcp/oauth-provider"
// 导入配置模块
import { Config } from "../../config/config"
// 导入实例管理模块
import { Instance } from "../../project/instance"
// 导入安装信息模块
import { Installation } from "../../installation"
// 导入路径模块
import path from "path"
// 导入全局常量
import { Global } from "../../global"

/**
 * getAuthStatusIcon 获取认证状态图标函数
 *
 * 功能说明：
 * - 根据认证状态返回对应的图标
 * - 使用 Unicode 字符表示不同的状态
 *
 * 参数说明：
 * - status：认证状态（MCP.AuthStatus 类型）
 *
 * 返回值：
 * - string：状态图标字符串
 *
 * 状态图标映射：
 * - authenticated: ✓（绿色勾号）
 * - expired: ⚠（黄色警告符号）
 * - not_authenticated: ○（空心圆圈）
 */
function getAuthStatusIcon(status: MCP.AuthStatus): string {
  // 根据状态返回图标
  switch (status) {
    case "authenticated":
      // 已认证
      return "✓"
    case "expired":
      // 已过期
      return "⚠"
    case "not_authenticated":
      // 未认证
      return "○"
  }
}

/**
 * getAuthStatusText 获取认证状态文本函数
 *
 * 功能说明：
 * - 根据认证状态返回对应的文本描述
 * - 用于显示详细的认证状态信息
 *
 * 参数说明：
 * - status：认证状态（MCP.AuthStatus 类型）
 *
 * 返回值：
 * - string：状态文本字符串
 *
 * 状态文本映射：
 * - authenticated: authenticated
 * - expired: expired
 * - not_authenticated: not authenticated
 */
function getAuthStatusText(status: MCP.AuthStatus): string {
  // 根据状态返回文本
  switch (status) {
    case "authenticated":
      // 已认证
      return "authenticated"
    case "expired":
      // 已过期
      return "expired"
    case "not_authenticated":
      // 未认证
      return "not authenticated"
  }
}

/**
 * McpCommand MCP 命令定义
 *
 * 功能说明：
 * - 定义 "mcp" 命令，用于管理 MCP（模型上下文协议）服务器
 * - 包含子命令：add（添加）、list（列表）、auth（认证）、logout（登出）、debug（调试）
 * - 要求必须指定子命令
 *
 * 使用场景：
 * - 需要添加 MCP 服务器时
 * - 需要查看 MCP 服务器列表时
 * - 需要对 MCP 服务器进行 OAuth 认证时
 * - 需要登出 MCP 服务器时
 * - 需要调试 MCP 连接时
 *
 * 命令格式：
 * - opencode mcp add
 * - opencode mcp list
 * - opencode mcp auth [name]
 * - opencode mcp logout [name]
 * - opencode mcp debug <name>
 *
 * 注意事项：
 * - 必须指定子命令
 * - 使用 demandCommand() 强制要求子命令
 */
export const McpCommand = cmd({
  // 导出 MCP 命令定义
  command: "mcp", // 命令名称
  builder: (yargs) =>
    // 命令构建器
    yargs
      .command(McpAddCommand) // 添加 add 子命令
      .command(McpListCommand) // 添加 list 子命令
      .command(McpAuthCommand) // 添加 auth 子命令
      .command(McpLogoutCommand) // 添加 logout 子命令
      .command(McpDebugCommand) // 添加 debug 子命令
      .demandCommand(), // 要求必须指定子命令
  async handler() {}, // 空处理函数（由子命令处理）
})

/**
 * McpListCommand MCP 列表命令定义
 *
 * 功能说明：
 * - 定义 "list" 子命令，用于列出所有 MCP 服务器及其状态
 * - 显示每个服务器的连接状态、OAuth 状态和配置信息
 * - 支持别名 "ls"
 *
 * 使用场景：
 * - 需要查看已配置的 MCP 服务器列表时
 * - 需要检查 MCP 服务器连接状态时
 * - 需要查看 MCP 服务器配置信息时
 *
 * 命令格式：
 * - opencode mcp list
 * - opencode mcp ls
 *
 * 显示信息：
 * - 服务器名称
 * - 连接状态（not initialized、connected、disabled、needs authentication、needs client registration、failed）
 * - OAuth 状态提示（如果支持 OAuth）
 * - 服务器类型提示（remote 或 local）
 *
 * 注意事项：
 * - 如果没有配置 MCP 服务器，显示警告消息
 * - 使用 Instance.provide 初始化应用环境
 * - 使用 UI.Style.TEXT_DIM 设置文本样式
 */
export const McpListCommand = cmd({
  // 导出 MCP 列表命令定义
  command: "list", // 命令名称
  aliases: ["ls"], // 命令别名
  describe: "列出 MCP 服务器及其状态", // 命令描述：列出 MCP 服务器及其状态
  async handler() {
    // 命令处理函数，异步执行
    await Instance.provide({
      // 初始化应用环境
      directory: process.cwd(), // 在当前目录中执行
      async fn() {
        // 异步执行函数
        UI.empty() // 清空 UI
        prompts.intro("MCP 服务器") // 显示标题

        const config = await Config.get() // 获取配置
        const mcpServers = config.mcp ?? {} // 获取 MCP 服务器配置
        const statuses = await MCP.status() // 获取所有服务器状态

        if (Object.keys(mcpServers).length === 0) {
          // 如果没有配置 MCP 服务器
          prompts.log.warn("未配置 MCP 服务器") // 显示警告消息
          prompts.outro("使用以下命令添加服务器：opencode mcp add") // 显示提示消息
          return // 返回
        }

        for (const [name, serverConfig] of Object.entries(mcpServers)) {
          // 遍历所有 MCP 服务器
          const status = statuses[name] // 获取服务器状态
          const hasOAuth = serverConfig.type === "remote" && !!serverConfig.oauth // 判断是否支持 OAuth
          const hasStoredTokens = await MCP.hasStoredTokens(name) // 判断是否存储了令牌

          let statusIcon: string // 状态图标
          let statusText: string // 状态文本
          let hint = "" // 提示文本

          if (!status) {
            // 如果未初始化
            statusIcon = "○" // 空心圆圈
            statusText = "未初始化" // 未初始化
          } else if (status.status === "connected") {
            // 如果已连接
            statusIcon = "✓" // 绿色勾号
            statusText = "已连接" // 已连接
            if (hasOAuth && hasStoredTokens) {
              // 如果支持 OAuth 且已存储令牌
              hint = " (OAuth)" // 显示 OAuth 提示
            }
          } else if (status.status === "disabled") {
            // 如果已禁用
            statusIcon = "○" // 空心圆圈
            statusText = "已禁用" // 已禁用
          } else if (status.status === "needs_auth") {
            // 如果需要认证
            statusIcon = "⚠" // 黄色警告符号
            statusText = "需要认证" // 需要认证
          } else if (status.status === "needs_client_registration") {
            // 如果需要客户端注册
            statusIcon = "✗" // 红色叉号
            statusText = "需要客户端注册" // 需要客户端注册
            hint = "\n    " + status.error // 显示错误信息
          } else {
            // 其他状态（失败）
            statusIcon = "✗" // 红色叉号
            statusText = "失败" // 失败
            hint = "\n    " + status.error // 显示错误信息
          }

          const typeHint = serverConfig.type === "remote" ? serverConfig.url : serverConfig.command.join(" ") // 获取类型提示（URL 或命令）
          prompts.log.info(
            // 显示服务器信息
            `${statusIcon} ${name} ${UI.Style.TEXT_DIM}${statusText}${hint}\n    ${UI.Style.TEXT_DIM}${typeHint}`,
          )
        }

        prompts.outro(`${Object.keys(mcpServers).length} server(s)`) // 显示服务器总数
      },
    })
  },
})

/**
 * McpAuthCommand MCP 认证命令定义
 *
 * 功能说明：
 * - 定义 "auth" 子命令，用于对支持 OAuth 的 MCP 服务器进行认证
 * - 支持指定服务器名称或通过交互式选择服务器
 * - 检查当前认证状态，支持重新认证
 * - 支持动态客户端注册和预注册客户端
 *
 * 使用场景：
 * - 需要对 MCP 服务器进行 OAuth 认证时
 * - 需要重新认证已过期的凭证时
 * - 需要更新 MCP 服务器的认证凭证时
 *
 * 命令格式：
 * - opencode mcp auth
 * - opencode mcp auth <name>
 *
 * 参数说明：
 * - name（可选参数）：MCP 服务器名称，如果不指定则通过交互式选择
 *
 * 认证流程：
 * 1. 初始化应用环境
 * 2. 获取所有支持 OAuth 的 MCP 服务器
 * 3. 如果未指定服务器名称，显示交互式选择列表
 * 4. 检查服务器是否支持 OAuth
 * 5. 检查当前认证状态
 * 6. 如果已认证，询问是否重新认证
 * 7. 如果已过期，自动重新认证
 * 8. 执行 OAuth 认证流程
 * 9. 显示认证结果
 *
 * 注意事项：
 * - 只有远程服务器（remote）支持 OAuth
 * - 如果服务器不支持 OAuth，显示错误消息
 * - 认证成功后凭证会自动存储
 * - 支持动态客户端注册和预注册客户端
 */
export const McpAuthCommand = cmd({
  // 导出 MCP 认证命令定义
  command: "auth [name]", // 命令名称和位置参数
  describe: "对支持 OAuth 的 MCP 服务器进行认证", // 命令描述：对支持 OAuth 的 MCP 服务器进行认证
  builder: (yargs) =>
    // 命令构建器
    yargs
      .positional("name", {
        // 定义位置参数 "name"
        describe: "MCP 服务器名称", // 参数描述：MCP 服务器名称
        type: "string", // 参数类型：字符串
      })
      .command(McpAuthListCommand), // 添加 list 子命令
  async handler(args) {
    // 命令处理函数，异步执行
    await Instance.provide({
      // 初始化应用环境
      directory: process.cwd(), // 在当前目录中执行
      async fn() {
        // 异步执行函数
        UI.empty() // 清空 UI
        prompts.intro("MCP OAuth 认证") // 显示标题

        const config = await Config.get() // 获取配置
        const mcpServers = config.mcp ?? {} // 获取 MCP 服务器配置

        // 获取支持 OAuth 的服务器（远程服务器且未显式禁用 OAuth）
        const oauthServers = Object.entries(mcpServers).filter(
          ([_, cfg]) => cfg.type === "remote" && cfg.oauth !== false,
        )

        if (oauthServers.length === 0) {
          // 如果没有支持 OAuth 的服务器
          prompts.log.warn("未配置支持 OAuth 的 MCP 服务器") // 显示警告消息
          prompts.log.info("远程 MCP 服务器默认支持 OAuth。在 opencode.json 中添加远程服务器：") // 显示提示消息
          prompts.log.info(`
  "mcp": {
    "my-server": {
      "type": "remote",
      "url": "https://example.com/mcp"
    }
  }`) // 显示配置示例
          prompts.outro("完成") // 显示结束消息
          return // 返回
        }

        let serverName = args.name // 服务器名称
        if (!serverName) {
          // 如果未指定服务器名称
          // 构建带认证状态的选项
          const options = await Promise.all(
            oauthServers.map(async ([name, cfg]) => {
              // 遍历所有支持 OAuth 的服务器
              const authStatus = await MCP.getAuthStatus(name) // 获取认证状态
              const icon = getAuthStatusIcon(authStatus) // 获取状态图标
              const statusText = getAuthStatusText(authStatus) // 获取状态文本
              const url = cfg.type === "remote" ? cfg.url : "" // 获取 URL
              return {
                // 返回选项对象
                label: `${icon} ${name} (${statusText})`, // 选项标签
                value: name, // 选项值
                hint: url, // 选项提示
              }
            }),
          )

          const selected = await prompts.select({
            // 显示选择提示
            message: "选择要认证的 MCP 服务器", // 提示消息
            options, // 选项列表
          })
          if (prompts.isCancel(selected)) throw new UI.CancelledError() // 如果取消，抛出错误
          serverName = selected // 设置服务器名称
        }

        const serverConfig = mcpServers[serverName] // 获取服务器配置
        if (!serverConfig) {
          // 如果服务器不存在
          prompts.log.error(`未找到 MCP 服务器：${serverName}`) // 显示错误消息
          prompts.outro("完成") // 显示结束消息
          return // 返回
        }

        if (serverConfig.type !== "remote" || serverConfig.oauth === false) {
          // 如果服务器不支持 OAuth
          prompts.log.error(`MCP 服务器 ${serverName} 不支持 OAuth（OAuth 已禁用）`) // 显示错误消息
          prompts.outro("完成") // 显示结束消息
          return // 返回
        }

        // 检查是否已认证
        const authStatus = await MCP.getAuthStatus(serverName) // 获取认证状态
        if (authStatus === "authenticated") {
          // 如果已认证
          const confirm = await prompts.confirm({
            // 显示确认提示
            message: `${serverName} 已有有效凭证。是否重新认证？`, // 提示消息
          })
          if (prompts.isCancel(confirm) || !confirm) {
            // 如果取消或拒绝
            prompts.outro("已取消") // 显示取消消息
            return // 返回
          }
        } else if (authStatus === "expired") {
          // 如果凭证已过期
          prompts.log.warn(`${serverName} 的凭证已过期。正在重新认证...`) // 显示警告消息
        }

        const spinner = prompts.spinner() // 创建加载动画
        spinner.start("正在启动 OAuth 流程...") // 启动加载动画

        try {
          // 尝试认证
          const status = await MCP.authenticate(serverName) // 执行认证

          if (status.status === "connected") {
            // 如果认证成功
            spinner.stop("认证成功！") // 停止加载动画
          } else if (status.status === "needs_client_registration") {
            // 如果需要客户端注册
            spinner.stop("认证失败", 1) // 停止加载动画
            prompts.log.error(status.error) // 显示错误消息
            prompts.log.info("将 clientId 添加到您的 MCP 服务器配置中：") // 显示提示消息
            prompts.log.info(`
  "mcp": {
    "${serverName}": {
      "type": "remote",
      "url": "${serverConfig.url}",
      "oauth": {
        "clientId": "your-client-id",
        "clientSecret": "your-client-secret"
      }
    }
  }`) // 显示配置示例
          } else if (status.status === "failed") {
            // 如果认证失败
            spinner.stop("认证失败", 1) // 停止加载动画
            prompts.log.error(status.error) // 显示错误消息
          } else {
            // 其他状态
            spinner.stop("意外状态：" + status.status, 1) // 停止加载动画
          }
        } catch (error) {
          // 捕获错误
          spinner.stop("认证失败", 1) // 停止加载动画
          prompts.log.error(error instanceof Error ? error.message : String(error)) // 显示错误消息
        }

        prompts.outro("完成") // 显示结束消息
      },
    })
  },
})

/**
 * McpAuthListCommand MCP 认证列表命令定义
 *
 * 功能说明：
 * - 定义 "list" 子命令，用于列出所有支持 OAuth 的 MCP 服务器及其认证状态
 * - 显示每个服务器的认证状态（authenticated、expired、not authenticated）
 * - 支持别名 "ls"
 *
 * 使用场景：
 * - 需要查看支持 OAuth 的 MCP 服务器列表时
 * - 需要检查 MCP 服务器的认证状态时
 * - 需要查看哪些服务器的凭证已过期时
 *
 * 命令格式：
 * - opencode mcp auth list
 * - opencode mcp auth ls
 *
 * 显示信息：
 * - 服务器名称
 * - 认证状态（authenticated、expired、not authenticated）
 * - 服务器 URL
 *
 * 注意事项：
 * - 只显示支持 OAuth 的服务器（远程服务器且未显式禁用 OAuth）
 * - 如果没有支持 OAuth 的服务器，显示警告消息
 * - 使用 Instance.provide 初始化应用环境
 * - 使用 UI.Style.TEXT_DIM 设置文本样式
 */
export const McpAuthListCommand = cmd({
  // 导出 MCP 认证列表命令定义
  command: "list", // 命令名称
  aliases: ["ls"], // 命令别名
  describe: "列出支持 OAuth 的 MCP 服务器及其认证状态", // 命令描述：列出支持 OAuth 的 MCP 服务器及其认证状态
  async handler() {
    // 命令处理函数，异步执行
    await Instance.provide({
      // 初始化应用环境
      directory: process.cwd(), // 在当前目录中执行
      async fn() {
        // 异步执行函数
        UI.empty() // 清空 UI
        prompts.intro("MCP OAuth 状态") // 显示标题

        const config = await Config.get() // 获取配置
        const mcpServers = config.mcp ?? {} // 获取 MCP 服务器配置

        // 获取支持 OAuth 的服务器
        const oauthServers = Object.entries(mcpServers).filter(
          ([_, cfg]) => cfg.type === "remote" && cfg.oauth !== false,
        )

        if (oauthServers.length === 0) {
          // 如果没有支持 OAuth 的服务器
          prompts.log.warn("未配置支持 OAuth 的 MCP 服务器") // 显示警告消息
          prompts.outro("完成") // 显示结束消息
          return // 返回
        }

        for (const [name, serverConfig] of oauthServers) {
          // 遍历所有支持 OAuth 的服务器
          const authStatus = await MCP.getAuthStatus(name) // 获取认证状态
          const icon = getAuthStatusIcon(authStatus) // 获取状态图标
          const statusText = getAuthStatusText(authStatus) // 获取状态文本
          const url = serverConfig.type === "remote" ? serverConfig.url : "" // 获取 URL

          prompts.log.info(`${icon} ${name} ${UI.Style.TEXT_DIM}${statusText}\n    ${UI.Style.TEXT_DIM}${url}`) // 显示服务器信息
        }

        prompts.outro(`${oauthServers.length} OAuth-capable server(s)`) // 显示服务器总数
      },
    })
  },
})

/**
 * McpLogoutCommand MCP 登出命令定义
 *
 * 功能说明：
 * - 定义 "logout" 子命令，用于移除 MCP 服务器的 OAuth 凭证
 * - 支持指定服务器名称或通过交互式选择服务器
 * - 显示已存储的凭证类型（tokens、client registration 或两者都有）
 *
 * 使用场景：
 * - 需要移除 MCP 服务器的 OAuth 凭证时
 * - 需要清除过期的认证信息时
 * - 需要重新认证服务器时
 *
 * 命令格式：
 * - opencode mcp logout
 * - opencode mcp logout <name>
 *
 * 参数说明：
 * - name（可选参数）：MCP 服务器名称，如果不指定则通过交互式选择
 *
 * 登出流程：
 * 1. 初始化应用环境
 * 2. 获取所有已存储的 OAuth 凭证
 * 3. 如果未指定服务器名称，显示交互式选择列表
 * 4. 检查服务器是否存在凭证
 * 5. 移除服务器的 OAuth 凭证
 * 6. 显示成功消息
 *
 * 注意事项：
 * - 如果没有存储的凭证，显示警告消息
 * - 如果服务器不存在凭证，显示错误消息
 * - 凭证移除后需要重新认证才能访问服务器
 */
export const McpLogoutCommand = cmd({
  // 导出 MCP 登出命令定义
  command: "logout [name]", // 命令名称和位置参数
  describe: "移除 MCP 服务器的 OAuth 凭证", // 命令描述：移除 MCP 服务器的 OAuth 凭证
  builder: (yargs) =>
    // 命令构建器
    yargs.positional("name", {
      // 定义位置参数 "name"
      describe: "MCP 服务器名称", // 参数描述：MCP 服务器名称
      type: "string", // 参数类型：字符串
    }),
  async handler(args) {
    // 命令处理函数，异步执行
    await Instance.provide({
      // 初始化应用环境
      directory: process.cwd(), // 在当前目录中执行
      async fn() {
        // 异步执行函数
        UI.empty() // 清空 UI
        prompts.intro("MCP OAuth 登出") // 显示标题

        const authPath = path.join(Global.Path.data, "mcp-auth.json") // 构建认证文件路径
        const credentials = await McpAuth.all() // 获取所有凭证
        const serverNames = Object.keys(credentials) // 获取服务器名称列表

        if (serverNames.length === 0) {
          // 如果没有存储的凭证
          prompts.log.warn("未存储 MCP OAuth 凭证") // 显示警告消息
          prompts.outro("完成") // 显示结束消息
          return // 返回
        }

        let serverName = args.name // 服务器名称
        if (!serverName) {
          // 如果未指定服务器名称
          const selected = await prompts.select({
            // 显示选择提示
            message: "选择要登出的 MCP 服务器", // 提示消息
            options: serverNames.map((name) => {
              // 遍历所有服务器
              const entry = credentials[name] // 获取凭证条目
              const hasTokens = !!entry.tokens // 判断是否有令牌
              const hasClient = !!entry.clientInfo // 判断是否有客户端信息
              let hint = "" // 提示文本
              if (hasTokens && hasClient)
                hint = "tokens + client" // 两者都有
              else if (hasTokens)
                hint = "tokens" // 只有令牌
              else if (hasClient) hint = "client registration" // 只有客户端注册
              return {
                // 返回选项对象
                label: name, // 选项标签
                value: name, // 选项值
                hint, // 选项提示
              }
            }),
          })
          if (prompts.isCancel(selected)) throw new UI.CancelledError() // 如果取消，抛出错误
          serverName = selected // 设置服务器名称
        }

        if (!credentials[serverName]) {
          // 如果服务器不存在凭证
          prompts.log.error(`未找到以下服务器的凭证：${serverName}`) // 显示错误消息
          prompts.outro("完成") // 显示结束消息
          return // 返回
        }

        await MCP.removeAuth(serverName) // 移除服务器的认证信息
        prompts.log.success(`已移除 ${serverName} 的 OAuth 凭证`) // 显示成功消息
        prompts.outro("完成") // 显示结束消息
      },
    })
  },
})

/**
 * McpAddCommand MCP 添加命令定义
 *
 * 功能说明：
 * - 定义 "add" 子命令，用于添加新的 MCP 服务器
 * - 支持添加本地服务器（通过命令运行）和远程服务器（通过 URL 连接）
 * - 支持为远程服务器配置 OAuth 认证
 * - 支持预注册客户端和动态客户端注册
 *
 * 使用场景：
 * - 需要添加新的 MCP 服务器时
 * - 需要配置本地 MCP 服务器时
 * - 需要配置远程 MCP 服务器时
 * - 需要为远程服务器配置 OAuth 认证时
 *
 * 命令格式：
 * - opencode mcp add
 *
 * 添加流程：
 * 1. 清空 UI 并显示标题
 * 2. 输入 MCP 服务器名称
 * 3. 选择服务器类型（Local 或 Remote）
 * 4. 如果是本地服务器：
 *    - 输入要运行的命令
 *    - 显示配置信息
 * 5. 如果是远程服务器：
 *    - 输入服务器 URL
 *    - 询问是否需要 OAuth 认证
 *    - 如果需要 OAuth：
 *      - 询问是否有预注册的客户端 ID
 *      - 如果有，输入客户端 ID 和可选的客户端密钥
 *      - 如果没有，使用动态客户端注册
 *    - 如果不需要 OAuth：
 *      - 测试连接
 *    - 显示配置信息
 * 6. 显示成功消息
 *
 * 注意事项：
 * - 服务器名称不能为空
 * - 远程服务器的 URL 必须有效
 * - OAuth 认证支持预注册客户端和动态客户端注册
 * - 配置信息需要手动添加到 opencode.json 文件中
 */
export const McpAddCommand = cmd({
  // 导出 MCP 添加命令定义
  command: "add", // 命令名称
  describe: "添加 MCP 服务器", // 命令描述：添加 MCP 服务器
  async handler() {
    // 命令处理函数，异步执行
    UI.empty() // 清空 UI
    prompts.intro("添加 MCP 服务器") // 显示标题

    const name = await prompts.text({
      // 输入服务器名称
      message: "输入 MCP 服务器名称", // 提示消息
      validate: (x) => (x && x.length > 0 ? undefined : "必填"), // 验证：不能为空
    })
    if (prompts.isCancel(name)) throw new UI.CancelledError() // 如果取消，抛出错误

    const type = await prompts.select({
      // 选择服务器类型
      message: "选择 MCP 服务器类型", // 提示消息
      options: [
        // 选项列表
        {
          label: "本地", // 选项标签
          value: "local", // 选项值
          hint: "运行本地命令", // 选项提示
        },
        {
          label: "远程", // 选项标签
          value: "remote", // 选项值
          hint: "连接到远程 URL", // 选项提示
        },
      ],
    })
    if (prompts.isCancel(type)) throw new UI.CancelledError() // 如果取消，抛出错误

    if (type === "local") {
      // 如果是本地服务器
      const command = await prompts.text({
        // 输入命令
        message: "输入要运行的命令", // 提示消息
        placeholder: "e.g., opencode x @modelcontextprotocol/server-filesystem", // 占位符
        validate: (x) => (x && x.length > 0 ? undefined : "必填"), // 验证：不能为空
      })
      if (prompts.isCancel(command)) throw new UI.CancelledError() // 如果取消，抛出错误

      prompts.log.info(`本地 MCP 服务器 "${name}" 已配置命令：${command}`) // 显示配置信息
      prompts.outro("MCP 服务器添加成功") // 显示成功消息
      return // 返回
    }

    if (type === "remote") {
      // 如果是远程服务器
      const url = await prompts.text({
        // 输入 URL
        message: "输入 MCP 服务器 URL", // 提示消息
        placeholder: "e.g., https://example.com/mcp", // 占位符
        validate: (x) => {
          // 验证 URL
          if (!x) return "必填" // 不能为空
          if (x.length === 0) return "必填" // 不能为空
          const isValid = URL.canParse(x) // 验证 URL 格式
          return isValid ? undefined : "无效的 URL" // 返回验证结果
        },
      })
      if (prompts.isCancel(url)) throw new UI.CancelledError() // 如果取消，抛出错误

      const useOAuth = await prompts.confirm({
        // 询问是否需要 OAuth 认证
        message: "此服务器是否需要 OAuth 认证？", // 提示消息
        initialValue: false, // 初始值：否
      })
      if (prompts.isCancel(useOAuth)) throw new UI.CancelledError() // 如果取消，抛出错误

      if (useOAuth) {
        // 如果需要 OAuth 认证
        const hasClientId = await prompts.confirm({
          // 询问是否有预注册的客户端 ID
          message: "您是否有预注册的客户端 ID？", // 提示消息
          initialValue: false, // 初始值：否
        })
        if (prompts.isCancel(hasClientId)) throw new UI.CancelledError() // 如果取消，抛出错误

        if (hasClientId) {
          // 如果有预注册的客户端 ID
          const clientId = await prompts.text({
            // 输入客户端 ID
            message: "输入客户端 ID", // 提示消息
            validate: (x) => (x && x.length > 0 ? undefined : "必填"), // 验证：不能为空
          })
          if (prompts.isCancel(clientId)) throw new UI.CancelledError() // 如果取消，抛出错误

          const hasSecret = await prompts.confirm({
            // 询问是否有客户端密钥
            message: "您是否有客户端密钥？", // 提示消息
            initialValue: false, // 初始值：否
          })
          if (prompts.isCancel(hasSecret)) throw new UI.CancelledError() // 如果取消，抛出错误

          let clientSecret: string | undefined // 客户端密钥（可选）
          if (hasSecret) {
            // 如果有客户端密钥
            const secret = await prompts.password({
              // 输入客户端密钥（密码输入）
              message: "输入客户端密钥", // 提示消息
            })
            if (prompts.isCancel(secret)) throw new UI.CancelledError() // 如果取消，抛出错误
            clientSecret = secret // 设置客户端密钥
          }

          prompts.log.info(`远程 MCP 服务器 "${name}" 已配置 OAuth（客户端 ID：${clientId}）`) // 显示配置信息
          prompts.log.info("将此配置添加到您的 opencode.json：") // 显示提示消息
          prompts.log.info(`
  "mcp": {
    "${name}": {
      "type": "remote",
      "url": "${url}",
      "oauth": {
        "clientId": "${clientId}"${clientSecret ? `,\n        "clientSecret": "${clientSecret}"` : ""}
      }
    }
  }`) // 显示配置示例
        } else {
          // 如果没有预注册的客户端 ID
          prompts.log.info(`远程 MCP 服务器 "${name}" 已配置 OAuth（动态注册）`) // 显示配置信息
          prompts.log.info("将此配置添加到您的 opencode.json：") // 显示提示消息
          prompts.log.info(`
  "mcp": {
    "${name}": {
      "type": "remote",
      "url": "${url}",
      "oauth": {}
    }
  }`) // 显示配置示例
        }
      } else {
        // 如果不需要 OAuth 认证
        const client = new Client({
          // 创建 MCP 客户端
          name: "opencode", // 客户端名称
          version: "1.0.0", // 客户端版本
        })
        const transport = new StreamableHTTPClientTransport(new URL(url)) // 创建 HTTP 传输
        await client.connect(transport) // 连接到服务器
        prompts.log.info(`远程 MCP 服务器 "${name}" 已配置 URL：${url}`) // 显示配置信息
      }
    }

    prompts.outro("MCP 服务器添加成功") // 显示成功消息
  },
})

/**
 * McpDebugCommand MCP 调试命令定义
 *
 * 功能说明：
 * - 定义 "debug" 子命令，用于调试 MCP 服务器的 OAuth 连接
 * - 显示服务器的认证状态、凭证信息和连接测试结果
 * - 测试 HTTP 连接和 OAuth 流程
 * - 显示详细的调试信息
 *
 * 使用场景：
 * - 需要诊断 MCP 服务器连接问题时
 * - 需要检查 OAuth 认证状态时
 * - 需要测试服务器连接时
 * - 需要查看凭证过期时间时
 *
 * 命令格式：
 * - opencode mcp debug <name>
 *
 * 参数说明：
 * - name（必需参数）：MCP 服务器名称
 *
 * 调试流程：
 * 1. 初始化应用环境
 * 2. 获取服务器配置
 * 3. 检查服务器是否存在
 * 4. 检查服务器是否为远程服务器
 * 5. 检查服务器是否支持 OAuth
 * 6. 显示服务器名称和 URL
 * 7. 显示认证状态
 * 8. 显示凭证信息（访问令牌、刷新令牌、过期时间等）
 * 9. 显示客户端信息（客户端 ID、密钥过期时间等）
 * 10. 测试 HTTP 连接
 * 11. 检查 WWW-Authenticate 头
 * 12. 如果返回 401，测试 OAuth 流程
 * 13. 显示连接测试结果
 * 14. 显示调试完成消息
 *
 * 注意事项：
 * - 只能调试远程服务器
 * - 如果服务器不支持 OAuth，显示警告消息
 * - 如果服务器不存在，显示错误消息
 * - 测试 OAuth 流程时不会完成授权
 */
export const McpDebugCommand = cmd({
  // 导出 MCP 调试命令定义
  command: "debug <name>", // 命令名称和位置参数
  describe: "调试 MCP 服务器的 OAuth 连接", // 命令描述：调试 MCP 服务器的 OAuth 连接
  builder: (yargs) =>
    // 命令构建器
    yargs.positional("name", {
      // 定义位置参数 "name"
      describe: "MCP 服务器名称", // 参数描述：MCP 服务器名称
      type: "string", // 参数类型：字符串
      demandOption: true, // 必需参数
    }),
  async handler(args) {
    // 命令处理函数，异步执行
    await Instance.provide({
      // 初始化应用环境
      directory: process.cwd(), // 在当前目录中执行
      async fn() {
        // 异步执行函数
        UI.empty() // 清空 UI
        prompts.intro("MCP OAuth 调试") // 显示标题

        const config = await Config.get() // 获取配置
        const mcpServers = config.mcp ?? {} // 获取 MCP 服务器配置
        const serverName = args.name // 服务器名称

        const serverConfig = mcpServers[serverName] // 获取服务器配置
        if (!serverConfig) {
          // 如果服务器不存在
          prompts.log.error(`未找到 MCP 服务器：${serverName}`) // 显示错误消息
          prompts.outro("完成") // 显示结束消息
          return // 返回
        }

        if (serverConfig.type !== "remote") {
          // 如果不是远程服务器
          prompts.log.error(`MCP 服务器 ${serverName} 不是远程服务器`) // 显示错误消息
          prompts.outro("完成") // 显示结束消息
          return // 返回
        }

        if (serverConfig.oauth === false) {
          // 如果 OAuth 已显式禁用
          prompts.log.warn(`MCP 服务器 ${serverName} 已显式禁用 OAuth`) // 显示警告消息
          prompts.outro("完成") // 显示结束消息
          return // 返回
        }

        prompts.log.info(`服务器：${serverName}`) // 显示服务器名称
        prompts.log.info(`URL：${serverConfig.url}`) // 显示服务器 URL

        // 检查存储的认证状态
        const authStatus = await MCP.getAuthStatus(serverName) // 获取认证状态
        prompts.log.info(`认证状态：${getAuthStatusIcon(authStatus)} ${getAuthStatusText(authStatus)}`) // 显示认证状态

        const entry = await McpAuth.get(serverName) // 获取认证条目
        if (entry?.tokens) {
          // 如果有令牌
          prompts.log.info(`  访问令牌：${entry.tokens.accessToken.substring(0, 20)}...`) // 显示访问令牌（前 20 个字符）
          if (entry.tokens.expiresAt) {
            // 如果有过期时间
            const expiresDate = new Date(entry.tokens.expiresAt * 1000) // 转换过期时间为日期
            const isExpired = entry.tokens.expiresAt < Date.now() / 1000 // 判断是否已过期
            prompts.log.info(`  过期时间：${expiresDate.toISOString()} ${isExpired ? "(已过期)" : ""}`) // 显示过期时间
          }
          if (entry.tokens.refreshToken) {
            // 如果有刷新令牌
            prompts.log.info(`  刷新令牌：存在`) // 显示刷新令牌状态
          }
        }
        if (entry?.clientInfo) {
          // 如果有客户端信息
          prompts.log.info(`  客户端 ID：${entry.clientInfo.clientId}`) // 显示客户端 ID
          if (entry.clientInfo.clientSecretExpiresAt) {
            // 如果有密钥过期时间
            const expiresDate = new Date(entry.clientInfo.clientSecretExpiresAt * 1000) // 转换过期时间为日期
            prompts.log.info(`  客户端密钥过期时间：${expiresDate.toISOString()}`) // 显示密钥过期时间
          }
        }

        const spinner = prompts.spinner() // 创建加载动画
        spinner.start("正在测试连接...") // 启动加载动画

        // 首先测试基本的 HTTP 连接
        try {
          // 尝试连接
          const response = await fetch(serverConfig.url, {
            // 发送 HTTP 请求
            method: "POST", // 请求方法
            headers: {
              // 请求头
              "Content-Type": "application/json", // 内容类型
              Accept: "application/json, text/event-stream", // 接受的类型
            },
            body: JSON.stringify({
              // 请求体
              jsonrpc: "2.0", // JSON-RPC 版本
              method: "initialize", // 方法名称
              params: {
                // 参数
                protocolVersion: "2024-11-05", // 协议版本
                capabilities: {}, // 能力
                clientInfo: { name: "opencode-debug", version: Installation.VERSION }, // 客户端信息
              },
              id: 1, // 请求 ID
            }),
          })

          spinner.stop(`HTTP 响应：${response.status} ${response.statusText}`) // 停止加载动画

          // 检查 WWW-Authenticate 头
          const wwwAuth = response.headers.get("www-authenticate") // 获取 WWW-Authenticate 头
          if (wwwAuth) {
            // 如果存在
            prompts.log.info(`WWW-Authenticate：${wwwAuth}`) // 显示 WWW-Authenticate 头
          }

          if (response.status === 401) {
            // 如果返回 401 未授权
            prompts.log.warn("服务器返回 401 未授权") // 显示警告消息

            // 尝试发现 OAuth 元数据
            const oauthConfig = typeof serverConfig.oauth === "object" ? serverConfig.oauth : undefined // 获取 OAuth 配置
            const authProvider = new McpOAuthProvider(
              // 创建 OAuth 提供者
              serverName, // 服务器名称
              serverConfig.url, // 服务器 URL
              {
                // OAuth 配置
                clientId: oauthConfig?.clientId, // 客户端 ID
                clientSecret: oauthConfig?.clientSecret, // 客户端密钥
                scope: oauthConfig?.scope, // 作用域
              },
              {
                // 回调配置
                onRedirect: async () => {}, // 重定向回调
              },
            )

            prompts.log.info("正在测试 OAuth 流程（不完成授权）...") // 显示提示消息

            // 尝试创建带有认证提供者的传输以触发发现
            const transport = new StreamableHTTPClientTransport(new URL(serverConfig.url), {
              // 创建 HTTP 传输
              authProvider, // 认证提供者
            })

            try {
              // 尝试连接
              const client = new Client({
                // 创建客户端
                name: "opencode-debug", // 客户端名称
                version: Installation.VERSION, // 客户端版本
              })
              await client.connect(transport) // 连接到服务器
              prompts.log.success("连接成功（已认证）") // 显示成功消息
              await client.close() // 关闭客户端
            } catch (error) {
              // 捕获错误
              if (error instanceof UnauthorizedError) {
                // 如果是未授权错误
                prompts.log.info(`OAuth 流程已触发：${error.message}`) // 显示 OAuth 流程触发消息

                // 检查是否会尝试动态注册
                const clientInfo = await authProvider.clientInformation() // 获取客户端信息
                if (clientInfo) {
                  // 如果有客户端信息
                  prompts.log.info(`客户端 ID 可用：${clientInfo.client_id}`) // 显示客户端 ID
                } else {
                  // 如果没有客户端信息
                  prompts.log.info("无客户端 ID - 将尝试动态注册") // 显示动态注册提示
                }
              } else {
                // 其他错误
                prompts.log.error(`连接错误：${error instanceof Error ? error.message : String(error)}`) // 显示连接错误
              }
            }
          } else if (response.status >= 200 && response.status < 300) {
            // 如果返回成功状态码
            prompts.log.success("服务器响应成功（无需认证或已认证）") // 显示成功消息
            const body = await response.text() // 获取响应体
            try {
              // 尝试解析 JSON
              const json = JSON.parse(body) // 解析 JSON
              if (json.result?.serverInfo) {
                // 如果有服务器信息
                prompts.log.info(`服务器信息：${JSON.stringify(json.result.serverInfo)}`) // 显示服务器信息
              }
            } catch {
              // 不是 JSON，忽略
            }
          } else {
            // 其他状态码
            prompts.log.warn(`意外状态：${response.status}`) // 显示警告消息
            const body = await response.text().catch(() => "") // 获取响应体
            if (body) {
              // 如果有响应体
              prompts.log.info(`响应体：${body.substring(0, 500)}`) // 显示响应体（前 500 个字符）
            }
          }
        } catch (error) {
          // 捕获错误
          spinner.stop("连接失败", 1) // 停止加载动画
          prompts.log.error(`错误：${error instanceof Error ? error.message : String(error)}`) // 显示错误消息
        }

        prompts.outro("调试完成") // 显示调试完成消息
      },
    })
  },
})
