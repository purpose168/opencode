import { createMemo, createSignal } from "solid-js" // Solid.js 核心函数：创建派生值和响应式信号
import { useLocal } from "@tui/context/local" // 本地配置上下文，用于访问本地设置
import { useSync } from "@tui/context/sync" // 同步上下文，用于管理与服务器的数据同步
import { map, pipe, entries, sortBy } from "remeda" // Remeda 函数式编程工具库
import { DialogSelect, type DialogSelectRef, type DialogSelectOption } from "@tui/ui/dialog-select" // 选择对话框组件及其类型
import { useTheme } from "../context/theme" // 主题上下文，用于获取主题颜色
import { Keybind } from "@/util/keybind" // 快捷键工具
import { TextAttributes } from "@opentui/core" // 文本属性枚举
import { useSDK } from "@tui/context/sdk" // SDK 上下文，用于访问 SDK 客户端

// MCP 状态显示组件
function Status(props: { enabled: boolean; loading: boolean }) {
  const { theme } = useTheme() // 获取主题配置
  // 如果正在加载，显示加载状态
  if (props.loading) {
    return <span style={{ fg: theme.textMuted }}>⋯ Loading</span>
  }
  // 如果已启用，显示启用状态（绿色加粗）
  if (props.enabled) {
    return <span style={{ fg: theme.success, attributes: TextAttributes.BOLD }}>✓ Enabled</span>
  }
  // 否则显示禁用状态
  return <span style={{ fg: theme.textMuted }}>○ Disabled</span>
}

// MCP 对话框组件
export function DialogMcp() {
  const local = useLocal() // 获取本地配置上下文
  const sync = useSync() // 获取同步上下文
  const sdk = useSDK() // 获取 SDK 上下文
  const [, setRef] = createSignal<DialogSelectRef<unknown>>() // 创建对话框选择组件的引用
  const [loading, setLoading] = createSignal<string | null>(null) // 创建加载状态信号，记录当前正在操作的 MCP 名称

  // 创建 MCP 选项列表的 memo
  const options = createMemo(() => {
    // 跟踪同步数据和加载状态，以便在它们变化时触发重新渲染
    const mcpData = sync.data.mcp // 获取 MCP 数据
    const loadingMcp = loading() // 获取当前正在加载的 MCP 名称

    // 使用函数式编程管道处理 MCP 数据
    return pipe(
      mcpData ?? {}, // 如果 MCP 数据不存在，使用空对象
      entries(), // 将对象转换为键值对数组
      sortBy(([name]) => name), // 按 MCP 名称排序
      map(([name, status]) => ({ // 映射为对话框选项格式
        value: name, // MCP 名称作为选项值
        title: name, // MCP 名称作为选项标题
        description: status.status === "failed" ? "failed" : status.status, // 显示状态描述
        footer: <Status enabled={local.mcp.isEnabled(name)} loading={loadingMcp === name} />, // 显示启用/禁用状态
        category: undefined, // 不使用分类
      })),
    )
  })

  // 创建快捷键配置的 memo
  const keybinds = createMemo(() => [
    {
      keybind: Keybind.parse("space")[0], // 空格键快捷键
      title: "toggle", // 快捷键标题
      onTrigger: async (option: DialogSelectOption<string>) => {
        // 如果已有操作正在进行，则阻止切换
        if (loading() !== null) return

        setLoading(option.value) // 设置加载状态
        try {
          await local.mcp.toggle(option.value) // 切换 MCP 的启用/禁用状态
          // 从服务器刷新 MCP 状态
          const status = await sdk.client.mcp.status()
          if (status.data) {
            sync.set("mcp", status.data) // 更新同步数据
          } else {
            console.error("Failed to refresh MCP status: no data returned") // 记录错误
          }
        } catch (error) {
          console.error("Failed to toggle MCP:", error) // 记录错误
        } finally {
          setLoading(null) // 清除加载状态
        }
      },
    },
  ])

  // 返回对话框选择组件
  return (
    <DialogSelect
      ref={setRef} // 设置组件引用
      title="MCPs" // 对话框标题
      options={options()} // MCP 选项列表
      keybind={keybinds()} // 快捷键配置
      onSelect={(option) => {
        // 选中时不关闭对话框，只有在按下 Escape 键时才关闭
      }}
    />
  )
}
