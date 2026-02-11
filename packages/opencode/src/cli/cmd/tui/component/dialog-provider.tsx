import { createMemo, createSignal, onMount, Show } from "solid-js" // Solid.js 核心函数：创建派生值、响应式信号、挂载钩子、条件渲染
import { useSync } from "@tui/context/sync" // 同步上下文，用于管理与服务器的数据同步
import { map, pipe, sortBy } from "remeda" // Remeda 函数式编程工具库
import { DialogSelect } from "@tui/ui/dialog-select" // 选择对话框组件
import { useDialog } from "@tui/ui/dialog" // 对话框上下文，用于控制对话框的显示和隐藏
import { useSDK } from "../context/sdk" // SDK 上下文，用于访问 SDK 客户端
import { DialogPrompt } from "../ui/dialog-prompt" // 提示对话框组件
import { Link } from "../ui/link" // 链接组件
import { useTheme } from "../context/theme" // 主题上下文，用于获取主题颜色
import { TextAttributes } from "@opentui/core" // 文本属性枚举
import type { ProviderAuthAuthorization } from "@opencode-ai/sdk/v2" // 提供者授权类型
import { DialogModel } from "./dialog-model" // 模型选择对话框组件

// 提供者优先级配置，数字越小优先级越高
const PROVIDER_PRIORITY: Record<string, number> = {
  opencode: 0, // OpenCode 提供者（最高优先级）
  anthropic: 1, // Anthropic 提供者
  "github-copilot": 2, // GitHub Copilot 提供者
  openai: 3, // OpenAI 提供者
  google: 4, // Google 提供者
  openrouter: 5, // OpenRouter 提供者
}

// 创建对话框提供者选项的函数
export function createDialogProviderOptions() {
  const sync = useSync() // 获取同步上下文
  const dialog = useDialog() // 获取对话框上下文
  const sdk = useSDK() // 获取 SDK 上下文
  // 创建提供者选项列表的 memo
  const options = createMemo(() => {
    return pipe(
      sync.data.provider_next.all, // 获取所有提供者
      sortBy((x) => PROVIDER_PRIORITY[x.id] ?? 99), // 按优先级排序，未配置的提供者优先级为 99
      map((provider) => ({ // 映射为对话框选项格式
        title: provider.name, // 提供者名称
        value: provider.id, // 提供者 ID
        description: { // 提供者描述
          opencode: "(Recommended)", // OpenCode 推荐标记
          anthropic: "(Claude Max or API key)", // Anthropic 描述
        }[provider.id],
        category: provider.id in PROVIDER_PRIORITY ? "Popular" : "Other", // 分类：热门或其他
        async onSelect() { // 选中回调
          // 获取提供者的认证方法，如果没有则使用默认的 API key 方法
          const methods = sync.data.provider_auth[provider.id] ?? [
            {
              type: "api",
              label: "API key",
            },
          ]
          let index: number | null = 0 // 默认选择第一个方法
          // 如果有多个认证方法，显示选择对话框
          if (methods.length > 1) {
            index = await new Promise<number | null>((resolve) => {
              dialog.replace(
                () => (
                  <DialogSelect
                    title="Select auth method" // 对话框标题
                    options={methods.map((x, index) => ({ // 映射为选项格式
                      title: x.label,
                      value: index,
                    }))}
                    onSelect={(option) => resolve(option.value)} // 选中时解析索引
                  />
                ),
                () => resolve(null), // 取消时返回 null
              )
            })
          }
          if (index == null) return // 如果取消，直接返回
          const method = methods[index] // 获取选中的认证方法
          // 如果是 OAuth 认证方法
          if (method.type === "oauth") {
            // 调用 OAuth 授权 API
            const result = await sdk.client.provider.oauth.authorize({
              providerID: provider.id,
              method: index,
            })
            // 如果授权方式为 code，显示授权码输入对话框
            if (result.data?.method === "code") {
              dialog.replace(() => (
                <CodeMethod providerID={provider.id} title={method.label} index={index} authorization={result.data!} />
              ))
            }
            // 如果授权方式为 auto，显示自动授权对话框
            if (result.data?.method === "auto") {
              dialog.replace(() => (
                <AutoMethod providerID={provider.id} title={method.label} index={index} authorization={result.data!} />
              ))
            }
          }
          // 如果是 API key 认证方法
          if (method.type === "api") {
            return dialog.replace(() => <ApiMethod providerID={provider.id} title={method.label} />)
          }
        },
      })),
    )
  })
  return options // 返回提供者选项列表
}

// 提供者连接对话框组件
export function DialogProvider() {
  const options = createDialogProviderOptions() // 创建提供者选项列表
  return <DialogSelect title="Connect a provider" options={options()} /> // 返回对话框选择组件
}

// 自动授权方法组件的属性接口
interface AutoMethodProps {
  index: number // 认证方法索引
  providerID: string // 提供者 ID
  title: string // 认证方法标题
  authorization: ProviderAuthAuthorization // 授权信息
}

// 自动授权方法组件
function AutoMethod(props: AutoMethodProps) {
  const { theme } = useTheme() // 获取主题配置
  const sdk = useSDK() // 获取 SDK 上下文
  const dialog = useDialog() // 获取对话框上下文
  const sync = useSync() // 获取同步上下文

  // 组件挂载时执行 OAuth 回调
  onMount(async () => {
    // 调用 OAuth 回调 API
    const result = await sdk.client.provider.oauth.callback({
      providerID: props.providerID,
      method: props.index,
    })
    if (result.error) {
      dialog.clear() // 如果有错误，清除对话框
      return
    }
    await sdk.client.instance.dispose() // 销毁 SDK 实例
    await sync.bootstrap() // 重新初始化同步数据
    dialog.replace(() => <DialogModel providerID={props.providerID} />) // 替换为模型选择对话框
  })

  // 返回授权信息显示界面
  return (
    <box paddingLeft={2} paddingRight={2} gap={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          {props.title} {/* 认证方法标题 */}
        </text>
        <text fg={theme.textMuted}>esc</text> {/* 取消提示 */}
      </box>
      <box gap={1}>
        <Link href={props.authorization.url} fg={theme.primary} /> {/* 授权链接 */}
        <text fg={theme.textMuted}>{props.authorization.instructions}</text> {/* 授权说明 */}
      </box>
      <text fg={theme.textMuted}>Waiting for authorization...</text> {/* 等待授权提示 */}
    </box>
  )
}

// 授权码方法组件的属性接口
interface CodeMethodProps {
  index: number // 认证方法索引
  title: string // 认证方法标题
  providerID: string // 提供者 ID
  authorization: ProviderAuthAuthorization // 授权信息
}

// 授权码方法组件
function CodeMethod(props: CodeMethodProps) {
  const { theme } = useTheme() // 获取主题配置
  const sdk = useSDK() // 获取 SDK 上下文
  const sync = useSync() // 获取同步上下文
  const dialog = useDialog() // 获取对话框上下文
  const [error, setError] = createSignal(false) // 创建错误状态信号

  // 返回授权码输入对话框
  return (
    <DialogPrompt
      title={props.title} // 对话框标题
      placeholder="Authorization code" // 输入框占位符
      onConfirm={async (value) => { // 确认回调
        // 调用 OAuth 回调 API，传入授权码
        const { error } = await sdk.client.provider.oauth.callback({
          providerID: props.providerID,
          method: props.index,
          code: value,
        })
        if (!error) { // 如果没有错误
          await sdk.client.instance.dispose() // 销毁 SDK 实例
          await sync.bootstrap() // 重新初始化同步数据
          dialog.replace(() => <DialogModel providerID={props.providerID} />) // 替换为模型选择对话框
          return
        }
        setError(true) // 设置错误状态
      }}
      description={() => ( // 对话框描述
        <box gap={1}>
          <text fg={theme.textMuted}>{props.authorization.instructions}</text> {/* 授权说明 */}
          <Link href={props.authorization.url} fg={theme.primary} /> {/* 授权链接 */}
          <Show when={error()}> {/* 如果有错误，显示错误信息 */}
            <text fg={theme.error}>Invalid code</text>
          </Show>
        </box>
      )}
    />
  )
}

// API key 方法组件的属性接口
interface ApiMethodProps {
  providerID: string // 提供者 ID
  title: string // 认证方法标题
}

// API key 方法组件
function ApiMethod(props: ApiMethodProps) {
  const dialog = useDialog() // 获取对话框上下文
  const sdk = useSDK() // 获取 SDK 上下文
  const sync = useSync() // 获取同步上下文
  const { theme } = useTheme() // 获取主题配置

  // 返回 API key 输入对话框
  return (
    <DialogPrompt
      title={props.title} // 对话框标题
      placeholder="API key" // 输入框占位符
      description={ // 对话框描述
        props.providerID === "opencode" ? ( // 如果是 OpenCode 提供者，显示特殊说明
          <box gap={1}>
            <text fg={theme.textMuted}>
              OpenCode Zen gives you access to all the best coding models at the cheapest prices with a single API key.
            </text>
            <text fg={theme.text}>
              Go to <span style={{ fg: theme.primary }}>https://opencode.ai/zen</span> to get a key
            </text>
          </box>
        ) : undefined
      }
      onConfirm={async (value) => { // 确认回调
        if (!value) return // 如果输入为空，直接返回
        // 设置认证信息
        sdk.client.auth.set({
          providerID: props.providerID,
          auth: {
            type: "api",
            key: value,
          },
        })
        await sdk.client.instance.dispose() // 销毁 SDK 实例
        await sync.bootstrap() // 重新初始化同步数据
        dialog.replace(() => <DialogModel providerID={props.providerID} />) // 替换为模型选择对话框
      }}
    />
  )
}
