// 导入认证模块，用于管理用户凭证和认证状态
import { Auth } from "../../auth"
// 导入命令创建工具，用于定义 CLI 命令
import { cmd } from "./cmd"
// 导入交互式提示工具，用于创建用户交互界面
import * as prompts from "@clack/prompts"
// 导入 UI 工具，用于 UI 样式和布局
import { UI } from "../ui"
// 导入模型提供商模块，用于获取和管理模型提供商信息
import { ModelsDev } from "../../provider/models"
// 导入函数式编程工具，用于数据处理和转换
import { map, pipe, sortBy, values } from "remeda"
// 导入路径处理模块，用于文件路径操作
import path from "path"
// 导入操作系统模块，用于获取系统信息
import os from "os"
// 导入配置模块，用于读取和管理应用配置
import { Config } from "../../config/config"
// 导入全局模块，用于获取全局路径和配置
import { Global } from "../../global"
// 导入插件模块，用于加载和管理插件
import { Plugin } from "../../plugin"
// 导入项目实例模块，用于提供项目上下文
import { Instance } from "../../project/instance"
// 导入插件钩子类型，用于类型定义
import type { Hooks } from "@opencode-ai/plugin"

/**
 * PluginAuth 插件认证类型定义
 *
 * 功能说明：
 * - 从插件钩子中提取认证配置类型
 * - 定义插件认证方法的结构和接口
 * - 支持多种认证方式（OAuth、API Key 等）
 *
 * 使用场景：
 * - 插件需要提供自定义认证流程时
 * - 需要扩展认证方式时
 * - 需要集成第三方认证服务时
 */
type PluginAuth = NonNullable<Hooks["auth"]>

/**
 * handlePluginAuth 处理基于插件的认证流程
 *
 * 功能说明：
 * - 处理插件提供的认证方法
 * - 支持多种认证类型（OAuth、API Key）
 * - 支持交互式用户输入
 * - 自动处理授权回调
 * - 保存认证凭证到本地
 *
 * 参数说明：
 * - plugin: 插件对象，包含认证配置和方法
 * - provider: 提供商标识符，用于保存凭证
 *
 * 返回值：
 * - Promise<boolean>: 返回 true 表示认证已处理，false 表示应该使用默认处理
 *
 * 使用场景：
 * - 插件提供自定义认证流程时
 * - 需要集成第三方 OAuth 服务时
 * - 需要自定义认证输入时
 *
 * 认证流程：
 * 1. 如果插件提供多个认证方法，让用户选择
 * 2. 收集用户输入（根据认证方法的要求）
 * 3. 处理 OAuth 授权（自动或手动输入授权码）
 * 4. 处理 API Key 认证
 * 5. 保存认证凭证
 *
 * 注意事项：
 * - 支持条件提示（根据已输入内容决定是否显示某些提示）
 * - OAuth 支持自动和手动两种授权方式
 * - 认证失败会显示错误信息
 */
async function handlePluginAuth(plugin: { auth: PluginAuth }, provider: string): Promise<boolean> {
  // 定义异步函数，处理插件认证流程
  let index = 0 // 初始化方法索引为 0
  if (plugin.auth.methods.length > 1) {
    // 如果插件提供多个认证方法
    const method = await prompts.select({
      // 让用户选择认证方法
      message: "登录方法", // 提示消息：登录方法
      options: [
        // 选项列表
        ...plugin.auth.methods.map((x, index) => ({
          // 映射所有认证方法为选项
          label: x.label, // 选项标签
          value: index.toString(), // 选项值为索引字符串
        })),
      ],
    })
    if (prompts.isCancel(method)) throw new UI.CancelledError() // 如果用户取消，抛出取消错误
    index = parseInt(method) // 将选中的索引转换为整数
  }
  const method = plugin.auth.methods[index] // 获取选中的认证方法

  // Handle prompts for all auth types
  // 处理所有认证类型的提示
  await new Promise((resolve) => setTimeout(resolve, 10)) // 等待 10 毫秒，确保 UI 渲染完成
  const inputs: Record<string, string> = {} // 初始化输入记录对象
  if (method.prompts) {
    // 如果认证方法需要用户输入
    for (const prompt of method.prompts) {
      // 遍历所有提示
      if (prompt.condition && !prompt.condition(inputs)) {
        // 如果有条件且条件不满足
        continue // 跳过此提示
      }
      if (prompt.type === "select") {
        // 如果提示类型为选择
        const value = await prompts.select({
          // 显示选择提示
          message: prompt.message, // 提示消息
          options: prompt.options, // 选项列表
        })
        if (prompts.isCancel(value)) throw new UI.CancelledError() // 如果用户取消，抛出取消错误
        inputs[prompt.key] = value // 将用户选择的值保存到输入记录
      } else {
        // 如果提示类型为文本输入
        const value = await prompts.text({
          // 显示文本输入提示
          message: prompt.message, // 提示消息
          placeholder: prompt.placeholder, // 占位符文本
          validate: prompt.validate ? (v) => prompt.validate!(v ?? "") : undefined, // 验证函数（如果有）
        })
        if (prompts.isCancel(value)) throw new UI.CancelledError() // 如果用户取消，抛出取消错误
        inputs[prompt.key] = value // 将用户输入的值保存到输入记录
      }
    }
  }

  if (method.type === "oauth") {
    // 如果认证类型为 OAuth
    const authorize = await method.authorize(inputs) // 调用认证方法的授权函数，传入用户输入

    if (authorize.url) {
      // 如果授权需要访问 URL
      prompts.log.info("访问：" + authorize.url) // 显示授权 URL
    }

    if (authorize.method === "auto") {
      // 如果授权方式为自动
      if (authorize.instructions) {
        // 如果有授权说明
        prompts.log.info(authorize.instructions) // 显示授权说明
      }
      const spinner = prompts.spinner() // 创建加载动画
      spinner.start("等待授权...") // 开始加载动画，显示等待授权消息
      const result = await authorize.callback() // 等待授权回调
      if (result.type === "failed") {
        // 如果授权失败
        spinner.stop("授权失败", 1) // 停止加载动画，显示失败消息
      }
      if (result.type === "success") {
        // 如果授权成功
        const saveProvider = result.provider ?? provider // 确定要保存凭证的提供商（使用返回的提供商或原始提供商）
        if ("refresh" in result) {
          // 如果结果包含刷新令牌（OAuth 认证）
          const { type: _, provider: __, refresh, access, expires, ...extraFields } = result // 解构结果，提取认证信息
          await Auth.set(saveProvider, {
            // 保存认证凭证
            type: "oauth", // 认证类型为 OAuth
            refresh, // 刷新令牌
            access, // 访问令牌
            expires, // 过期时间
            ...extraFields, // 其他额外字段
          })
        }
        if ("key" in result) {
          // 如果结果包含 API Key（某些 OAuth 返回 API Key）
          await Auth.set(saveProvider, {
            // 保存认证凭证
            type: "api", // 认证类型为 API
            key: result.key, // API Key
          })
        }
        spinner.stop("登录成功") // 停止加载动画，显示登录成功消息
      }
    }

    if (authorize.method === "code") {
      // 如果授权方式为手动输入授权码
      const code = await prompts.text({
        // 提示用户输入授权码
        message: "在此粘贴授权码：", // 提示消息：在此粘贴授权码
        validate: (x) => (x && x.length > 0 ? undefined : "必填"), // 验证输入不为空
      })
      if (prompts.isCancel(code)) throw new UI.CancelledError() // 如果用户取消，抛出取消错误
      const result = await authorize.callback(code) // 调用授权回调，传入授权码
      if (result.type === "failed") {
        // 如果授权失败
        prompts.log.error("授权失败") // 显示错误消息
      }
      if (result.type === "success") {
        // 如果授权成功
        const saveProvider = result.provider ?? provider // 确定要保存凭证的提供商
        if ("refresh" in result) {
          // 如果结果包含刷新令牌（OAuth 认证）
          const { type: _, provider: __, refresh, access, expires, ...extraFields } = result // 解构结果，提取认证信息
          await Auth.set(saveProvider, {
            // 保存认证凭证
            type: "oauth", // 认证类型为 OAuth
            refresh, // 刷新令牌
            access, // 访问令牌
            expires, // 过期时间
            ...extraFields, // 其他额外字段
          })
        }
        if ("key" in result) {
          // 如果结果包含 API Key
          await Auth.set(saveProvider, {
            // 保存认证凭证
            type: "api", // 认证类型为 API
            key: result.key, // API Key
          })
        }
        prompts.log.success("登录成功") // 显示成功消息
      }
    }

    prompts.outro("完成") // 显示结束消息
    return true // 返回 true，表示认证已处理
  }

  if (method.type === "api") {
    // 如果认证类型为 API Key
    if (method.authorize) {
      // 如果认证方法有授权函数
      const result = await method.authorize(inputs) // 调用授权函数，传入用户输入
      if (result.type === "failed") {
        // 如果授权失败
        prompts.log.error("授权失败") // 显示错误消息
      }
      if (result.type === "success") {
        // 如果授权成功
        const saveProvider = result.provider ?? provider // 确定要保存凭证的提供商
        await Auth.set(saveProvider, {
          // 保存认证凭证
          type: "api", // 认证类型为 API
          key: result.key, // API Key
        })
        prompts.log.success("登录成功") // 显示成功消息
      }
      prompts.outro("完成") // 显示结束消息
      return true // 返回 true，表示认证已处理
    }
  }

  return false // 返回 false，表示应该使用默认处理
}

/**
 * AuthCommand 认证管理命令定义
 *
 * 功能说明：
 * - 定义 "auth" 命令，用于管理用户凭证
 * - 包含子命令：login（登录）、logout（登出）、list（列出凭证）
 * - 要求必须指定子命令
 *
 * 使用场景：
 * - 需要登录到模型提供商时
 * - 需要登出已登录的提供商时
 * - 需要查看已保存的凭证时
 *
 * 命令格式：
 * - opencode auth login [provider]
 * - opencode auth logout
 * - opencode auth list
 *
 * 子命令：
 * - login: 登录到提供商
 * - logout: 从提供商登出
 * - list: 列出所有已保存的凭证
 *
 * 注意事项：
 * - 必须指定子命令
 * - 使用 demandCommand() 强制要求子命令
 */
export const AuthCommand = cmd({
  // 导出认证管理命令定义
  command: "auth", // 命令名称
  describe: "管理凭证", // 命令描述：管理凭证
  builder: (
    yargs, // 命令构建器，用于定义命令参数和选项
  ) => yargs.command(AuthLoginCommand).command(AuthLogoutCommand).command(AuthListCommand).demandCommand(), // 添加子命令并要求必须指定子命令
  async handler() {}, // 空处理函数（子命令会覆盖此函数）
})

/**
 * AuthListCommand 列出认证命令定义
 *
 * 功能说明：
 * - 定义 "list" 命令，用于列出所有已保存的凭证
 * - 显示凭证文件路径
 * - 显示每个提供商的名称和认证类型
 * - 显示通过环境变量配置的提供商
 *
 * 使用场景：
 * - 需要查看已登录的提供商时
 * - 需要查看认证配置时
 * - 需要调试认证问题时
 *
 * 命令格式：
 * - opencode auth list
 * - opencode auth ls（别名）
 *
 * 输出格式：
 * - 凭证文件路径
 * - 每个提供商一行，格式为：提供商名称 (认证类型)
 * - 环境变量配置的提供商单独显示
 *
 * 注意事项：
 * - 凭证文件路径会使用 ~ 表示用户主目录
 * - 环境变量配置的提供商与凭证文件中的提供商分开显示
 */
export const AuthListCommand = cmd({
  // 导出列出认证命令定义
  command: "list", // 命令名称
  aliases: ["ls"], // 命令别名
  describe: "列出提供商", // 命令描述：列出提供商
  async handler() {
    // 命令处理函数，异步执行
    UI.empty() // 清空 UI
    const authPath = path.join(Global.Path.data, "auth.json") // 构建认证文件路径
    const homedir = os.homedir() // 获取用户主目录
    const displayPath = authPath.startsWith(homedir) ? authPath.replace(homedir, "~") : authPath // 如果路径在用户主目录下，使用 ~ 替换
    prompts.intro(`凭证 ${UI.Style.TEXT_DIM}${displayPath}`) // 显示凭证文件路径
    const results = Object.entries(await Auth.all()) // 获取所有凭证并转换为键值对数组
    const database = await ModelsDev.get() // 获取模型提供商数据库

    for (const [providerID, result] of results) {
      // 遍历所有凭证
      const name = database[providerID]?.name || providerID // 获取提供商名称（使用数据库中的名称或提供商 ID）
      prompts.log.info(`${name} ${UI.Style.TEXT_DIM}${result.type}`) // 显示提供商名称和认证类型
    }

    prompts.outro(`${results.length} 个凭证`) // 显示凭证总数

    // Environment variables section
    // 环境变量部分
    const activeEnvVars: Array<{ provider: string; envVar: string }> = [] // 初始化环境变量数组

    for (const [providerID, provider] of Object.entries(database)) {
      // 遍历所有提供商
      for (const envVar of provider.env) {
        // 遍历提供商的所有环境变量
        if (process.env[envVar]) {
          // 如果环境变量已设置
          activeEnvVars.push({
            // 添加到环境变量数组
            provider: provider.name || providerID, // 提供商名称
            envVar, // 环境变量名
          })
        }
      }
    }

    if (activeEnvVars.length > 0) {
      // 如果有已设置的环境变量
      UI.empty() // 清空 UI
      prompts.intro("环境变量") // 显示环境变量标题

      for (const { provider, envVar } of activeEnvVars) {
        // 遍历所有环境变量
        prompts.log.info(`${provider} ${UI.Style.TEXT_DIM}${envVar}`) // 显示提供商名称和环境变量名
      }

      prompts.outro(`${activeEnvVars.length} 个环境变量`) // 显示环境变量总数（单复数处理）
    }
  },
})

/**
 * AuthLoginCommand 登录命令定义
 *
 * 功能说明：
 * - 定义 "login" 命令，用于登录到模型提供商
 * - 支持通过 URL 登录（使用 well-known 配置）
 * - 支持交互式选择提供商
 * - 支持插件提供的自定义认证流程
 * - 支持自定义提供商
 * - 自动处理 OAuth 和 API Key 认证
 *
 * 使用场景：
 * - 需要登录到模型提供商时
 * - 需要添加新的凭证时
 * - 需要使用自定义提供商时
 *
 * 命令格式：
 * - opencode auth login [url]
 * - opencode auth login（交互式选择提供商）
 *
 * 参数说明：
 * - url: OpenCode 认证提供商 URL（可选参数）
 *
 * 工作流程：
 * 1. 如果提供了 URL，使用 well-known 配置登录
 * 2. 刷新模型提供商数据库
 * 3. 加载应用配置（过滤禁用的提供商）
 * 4. 显示提供商列表（按优先级排序）
 * 5. 让用户选择提供商
 * 6. 检查是否有插件提供自定义认证
 * 7. 处理特殊提供商（Amazon Bedrock、OpenCode、Vercel、Cloudflare）
 * 8. 提示用户输入 API Key
 * 9. 保存凭证
 *
 * 注意事项：
 * - Amazon Bedrock 使用标准 AWS 环境变量配置
 * - Cloudflare AI Gateway 使用环境变量配置
 * - OpenCode 和 Vercel 显示 API Key 创建链接
 * - 自定义提供商需要在 opencode.json 中配置
 */
export const AuthLoginCommand = cmd({
  // 导出登录命令定义
  command: "login [url]", // 命令名称，接受可选的 URL 参数
  describe: "登录到提供商", // 命令描述：登录到提供商
  builder: (
    yargs, // 命令构建器，用于定义命令参数和选项
  ) =>
    yargs.positional("url", {
      // 定义位置参数 url
      describe: "OpenCode 认证提供商", // 参数描述：OpenCode 认证提供商
      type: "string", // 参数类型为字符串
    }),
  async handler(args) {
    // 命令处理函数，异步执行
    await Instance.provide({
      // 使用项目实例管理器提供项目上下文
      directory: process.cwd(), // 设置工作目录为当前目录
      async fn() {
        // 定义异步执行函数
        UI.empty() // 清空 UI
        prompts.intro("添加凭证") // 显示添加凭证标题
        if (args.url) {
          // 如果提供了 URL 参数
          const wellknown = await fetch(`${args.url}/.well-known/opencode`).then((x) => x.json() as any) // 获取 well-known 配置
          prompts.log.info(`Running \`${wellknown.auth.command.join(" ")}\``) // 显示要执行的命令
          const proc = Bun.spawn({
            // 执行认证命令
            cmd: wellknown.auth.command, // 命令数组
            stdout: "pipe", // 标准输出管道
          })
          const exit = await proc.exited // 等待命令执行完成
          if (exit !== 0) {
            // 如果命令执行失败
            prompts.log.error("失败") // 显示错误消息
            prompts.outro("完成") // 显示结束消息
            return // 返回
          }
          const token = await new Response(proc.stdout).text() // 从标准输出读取令牌
          await Auth.set(args.url, {
            // 保存凭证
            type: "wellknown", // 认证类型为 well-known
            key: wellknown.auth.env, // 环境变量名
            token: token.trim(), // 令牌（去除前后空格）
          })
          prompts.log.success("已登录到 " + args.url) // 显示成功消息
          prompts.outro("完成") // 显示结束消息
          return // 返回
        }
        await ModelsDev.refresh().catch(() => {}) // 刷新模型提供商数据库（忽略错误）

        const config = await Config.get() // 获取应用配置

        const disabled = new Set(config.disabled_providers ?? []) // 获取禁用的提供商集合
        const enabled = config.enabled_providers ? new Set(config.enabled_providers) : undefined // 获取启用的提供商集合（如果有）

        const providers = await ModelsDev.get().then((x) => {
          // 获取模型提供商数据库并过滤
          const filtered: Record<string, (typeof x)[string]> = {} // 初始化过滤后的提供商对象
          for (const [key, value] of Object.entries(x)) {
            // 遍历所有提供商
            if ((enabled ? enabled.has(key) : true) && !disabled.has(key)) {
              // 如果提供商未被禁用且（没有启用列表或在启用列表中）
              filtered[key] = value // 添加到过滤后的提供商对象
            }
          }
          return filtered // 返回过滤后的提供商
        })

        const priority: Record<string, number> = {
          // 定义提供商优先级
          opencode: 0, // OpenCode 优先级最高
          anthropic: 1, // Anthropic 第二
          "github-copilot": 2, // GitHub Copilot 第三
          openai: 3, // OpenAI 第四
          google: 4, // Google 第五
          openrouter: 5, // OpenRouter 第六
          vercel: 6, // Vercel 第七
        }
        let provider = await prompts.autocomplete({
          // 显示自动完成提示，让用户选择提供商
          message: "选择提供商", // 提示消息：选择提供商
          maxItems: 8, // 最多显示 8 个选项
          options: [
            // 选项列表
            ...pipe(
              // 使用函数式编程管道处理提供商列表
              providers, // 输入提供商对象
              values(), // 获取所有值
              sortBy(
                // 排序
                (x) => priority[x.id] ?? 99, // 按优先级排序（未定义的优先级为 99）
                (x) => x.name ?? x.id, // 按名称排序
              ),
              map((x) => ({
                // 映射为选项对象
                label: x.name, // 选项标签
                value: x.id, // 选项值为提供商 ID
                hint: {
                  // 提示信息
                  opencode: "推荐", // OpenCode 提示：推荐
                  anthropic: "Claude Max 或 API Key", // Anthropic 提示：Claude Max 或 API Key
                }[x.id], // 根据提供商 ID 获取提示
              })),
            ),
            {
              value: "other", // 其他选项
              label: "其他", // 选项标签：其他
            },
          ],
        })

        if (prompts.isCancel(provider)) throw new UI.CancelledError() // 如果用户取消，抛出取消错误

        const plugin = await Plugin.list().then((x) => x.find((x) => x.auth?.provider === provider)) // 查找提供自定义认证的插件
        if (plugin && plugin.auth) {
          // 如果找到插件且插件提供认证
          const handled = await handlePluginAuth({ auth: plugin.auth }, provider) // 调用插件认证处理函数
          if (handled) return // 如果认证已处理，返回
        }

        if (provider === "other") {
          // 如果用户选择了其他提供商
          provider = await prompts.text({
            // 提示用户输入提供商 ID
            message: "输入提供商 ID", // 提示消息：输入提供商 ID
            validate: (x) => (x && x.match(/^[0-9a-z-]+$/) ? undefined : "仅允许小写字母、数字和连字符"), // 验证输入格式（只允许小写字母、数字和连字符）
          })
          if (prompts.isCancel(provider)) throw new UI.CancelledError() // 如果用户取消，抛出取消错误
          provider = provider.replace(/^@ai-sdk\//, "") // 移除 @ai-sdk/ 前缀（如果有）
          if (prompts.isCancel(provider)) throw new UI.CancelledError() // 如果用户取消，抛出取消错误

          // Check if a plugin provides auth for this custom provider
          // 检查是否有插件为此自定义提供商提供认证
          const customPlugin = await Plugin.list().then((x) => x.find((x) => x.auth?.provider === provider)) // 查找提供自定义认证的插件
          if (customPlugin && customPlugin.auth) {
            // 如果找到插件且插件提供认证
            const handled = await handlePluginAuth({ auth: customPlugin.auth }, provider) // 调用插件认证处理函数
            if (handled) return // 如果认证已处理，返回
          }

          prompts.log.warn(`这只会为 ${provider} 存储凭证 - 你需要在 opencode.json 中配置它，查看文档获取示例。`) // 警告：这只会为提供商存储凭证，需要在 opencode.json 中配置，查看文档获取示例
        }

        if (provider === "amazon-bedrock") {
          // 如果提供商为 Amazon Bedrock
          prompts.log.info(
            "Amazon Bedrock 可以使用标准 AWS 环境变量配置，如 AWS_BEARER_TOKEN_BEDROCK、AWS_PROFILE 或 AWS_ACCESS_KEY_ID",
          ) // Amazon Bedrock 可以使用标准 AWS 环境变量配置，如 AWS_BEARER_TOKEN_BEDROCK、AWS_PROFILE 或 AWS_ACCESS_KEY_ID
          prompts.outro("完成") // 显示结束消息
          return // 返回
        }

        if (provider === "opencode") {
          // 如果提供商为 OpenCode
          prompts.log.info("在 https://opencode.ai/auth 创建 API Key") // 显示 API Key 创建链接
        }

        if (provider === "vercel") {
          // 如果提供商为 Vercel
          prompts.log.info("你可以在 https://vercel.link/ai-gateway-token 创建 API Key") // 显示 API Key 创建链接
        }

        if (["cloudflare", "cloudflare-ai-gateway"].includes(provider)) {
          // 如果提供商为 Cloudflare 或 Cloudflare AI Gateway
          prompts.log.info(
            "Cloudflare AI Gateway 可以使用 CLOUDFLARE_GATEWAY_ID、CLOUDFLARE_ACCOUNT_ID 和 CLOUDFLARE_API_TOKEN 环境变量配置。了解更多：https://opencode.ai/docs/providers/#cloudflare-ai-gateway",
          ) // Cloudflare AI Gateway 可以使用 CLOUDFLARE_GATEWAY_ID、CLOUDFLARE_ACCOUNT_ID 和 CLOUDFLARE_API_TOKEN 环境变量配置。了解更多：https://opencode.ai/docs/providers/#cloudflare-ai-gateway
        }

        const key = await prompts.password({
          // 提示用户输入 API Key（密码输入）
          message: "输入你的 API Key", // 提示消息：输入你的 API Key
          validate: (x) => (x && x.length > 0 ? undefined : "必填"), // 验证输入不为空
        })
        if (prompts.isCancel(key)) throw new UI.CancelledError() // 如果用户取消，抛出取消错误
        await Auth.set(provider, {
          // 保存凭证
          type: "api", // 认证类型为 API
          key, // API Key
        })

        prompts.outro("完成") // 显示结束消息
      },
    })
  },
})

/**
 * AuthLogoutCommand 登出命令定义
 *
 * 功能说明：
 * - 定义 "logout" 命令，用于从提供商登出
 * - 列出所有已保存的凭证
 * - 让用户选择要删除的凭证
 * - 删除选中的凭证
 *
 * 使用场景：
 * - 需要从提供商登出时
 * - 需要删除已保存的凭证时
 * - 需要清理凭证时
 *
 * 命令格式：
 * - opencode auth logout
 *
 * 工作流程：
 * 1. 获取所有已保存的凭证
 * 2. 显示凭证列表（提供商名称和认证类型）
 * 3. 让用户选择要删除的凭证
 * 4. 删除选中的凭证
 * 5. 显示成功消息
 *
 * 注意事项：
 * - 如果没有凭证，显示错误消息
 * - 凭证删除后无法恢复
 */
export const AuthLogoutCommand = cmd({
  // 导出登出命令定义
  command: "logout", // 命令名称
  describe: "从已配置的提供商登出", // 命令描述：从已配置的提供商登出
  async handler() {
    // 命令处理函数，异步执行
    UI.empty() // 清空 UI
    const credentials = await Auth.all().then((x) => Object.entries(x)) // 获取所有凭证并转换为键值对数组
    prompts.intro("删除凭证") // 显示删除凭证标题
    if (credentials.length === 0) {
      // 如果没有凭证
      prompts.log.error("未找到凭证") // 显示错误消息
      return // 返回
    }
    const database = await ModelsDev.get() // 获取模型提供商数据库
    const providerID = await prompts.select({
      // 显示选择提示，让用户选择要删除的凭证
      message: "选择提供商", // 提示消息：选择提供商
      options: credentials.map(([key, value]) => ({
        // 映射凭证为选项
        label: (database[key]?.name || key) + UI.Style.TEXT_DIM + " (" + value.type + ")", // 选项标签：提供商名称 (认证类型)
        value: key, // 选项值为提供商 ID
      })),
    })
    if (prompts.isCancel(providerID)) throw new UI.CancelledError() // 如果用户取消，抛出取消错误
    await Auth.remove(providerID) // 删除凭证
    prompts.outro("登出成功") // 显示成功消息
  },
})
