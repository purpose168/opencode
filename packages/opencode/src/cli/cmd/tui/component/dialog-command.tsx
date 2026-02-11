import { useDialog } from "@tui/ui/dialog" // 对话框上下文，用于控制对话框的显示和隐藏
import { DialogSelect, type DialogSelectOption, type DialogSelectRef } from "@tui/ui/dialog-select" // 选择对话框组件及其类型
import {
  createContext, // 创建上下文
  createMemo, // 创建派生值
  createSignal, // 创建响应式信号
  onCleanup, // 组件卸载时的清理钩子
  useContext, // 使用上下文
  type Accessor, // 访问器类型
  type ParentProps, // 父组件属性类型
} from "solid-js"
import { useKeyboard } from "@opentui/solid" // 键盘事件处理钩子
import { useKeybind } from "@tui/context/keybind" // 快捷键上下文
import type { KeybindsConfig } from "@opencode-ai/sdk/v2" // 快捷键配置类型

type Context = ReturnType<typeof init> // 上下文类型定义
const ctx = createContext<Context>() // 创建命令对话框上下文

export type CommandOption = DialogSelectOption & {
  keybind?: keyof KeybindsConfig // 关联的快捷键
  suggested?: boolean // 是否为推荐命令
}

function init() {
  // 创建命令注册列表的信号，存储命令选项的访问器数组
  const [registrations, setRegistrations] = createSignal<Accessor<CommandOption[]>[]>([])
  // 创建暂停计数的信号，用于控制快捷键是否可用
  const [suspendCount, setSuspendCount] = createSignal(0)
  const dialog = useDialog() // 获取对话框上下文
  const keybind = useKeybind() // 获取快捷键上下文
  
  // 创建命令选项列表的 memo
  const options = createMemo(() => {
    // 展平所有注册的命令选项
    const all = registrations().flatMap((x) => x())
    // 筛选出推荐的命令
    const suggested = all.filter((x) => x.suggested)
    // 返回命令选项列表，推荐命令放在前面并标记为 "Suggested" 分类
    return [
      ...suggested.map((x) => ({
        ...x,
        category: "Suggested", // 推荐命令分类
        value: "suggested." + x.value, // 推荐命令的值前缀
      })),
      ...all, // 所有命令
    ].map((x) => ({
      ...x,
      // 如果命令有关联的快捷键，则显示快捷键文本
      footer: x.keybind ? keybind.print(x.keybind) : undefined,
    }))
  })
  
  // 判断命令对话框是否被暂停
  const suspended = () => suspendCount() > 0

  // 全局键盘事件监听，处理命令快捷键
  useKeyboard((evt) => {
    // 如果命令对话框被暂停，则不处理
    if (suspended()) return
    // 如果对话框栈不为空，则不处理
    if (dialog.stack.length > 0) return
    // 遍历所有命令选项，检查快捷键匹配
    for (const option of options()) {
      if (option.keybind && keybind.match(option.keybind, evt)) {
        evt.preventDefault() // 阻止默认行为
        option.onSelect?.(dialog) // 执行命令的选中回调
        return
      }
    }
  })

  // 返回命令对话框的 API 对象
  const result = {
    // 触发指定名称的命令
    trigger(name: string, source?: "prompt") {
      for (const option of options()) {
        if (option.value === name) {
          option.onSelect?.(dialog, source) // 执行命令的选中回调
          return
        }
      }
    },
    // 启用或禁用命令快捷键
    keybinds(enabled: boolean) {
      // enabled 为 true 时减少暂停计数，false 时增加暂停计数
      setSuspendCount((count) => count + (enabled ? -1 : 1))
    },
    suspended, // 获取命令对话框是否被暂停
    // 显示命令对话框
    show() {
      dialog.replace(() => <DialogCommand options={options()} />)
    },
    // 注册命令选项
    register(cb: () => CommandOption[]) {
      const results = createMemo(cb) // 创建命令选项的 memo
      setRegistrations((arr) => [results, ...arr]) // 将命令选项添加到注册列表
      // 组件卸载时从注册列表中移除
      onCleanup(() => {
        setRegistrations((arr) => arr.filter((x) => x !== results))
      })
    },
    // 获取命令选项列表
    get options() {
      return options()
    },
  }
  return result
}

// 使用命令对话框上下文的钩子
export function useCommandDialog() {
  const value = useContext(ctx) // 获取命令对话框上下文
  // 如果上下文不存在，抛出错误
  if (!value) {
    throw new Error("useCommandDialog must be used within a CommandProvider")
  }
  return value
}

// 命令对话框提供者组件
export function CommandProvider(props: ParentProps) {
  const value = init() // 初始化命令对话框
  const dialog = useDialog() // 获取对话框上下文
  const keybind = useKeybind() // 获取快捷键上下文

  // 监听键盘事件，处理命令列表快捷键
  useKeyboard((evt) => {
    // 如果命令对话框被暂停，则不处理
    if (value.suspended()) return
    // 如果对话框栈不为空，则不处理
    if (dialog.stack.length > 0) return
    // 如果事件已被阻止，则不处理
    if (evt.defaultPrevented) return
    // 检查是否匹配命令列表快捷键
    if (keybind.match("command_list", evt)) {
      evt.preventDefault() // 阻止默认行为
      // 替换对话框为命令对话框
      dialog.replace(() => <DialogCommand options={value.options} />)
      return
    }
  })

  // 提供命令对话框上下文
  return <ctx.Provider value={value}>{props.children}</ctx.Provider>
}

// 命令对话框组件
function DialogCommand(props: { options: CommandOption[] }) {
  let ref: DialogSelectRef<string> // 对话框选择组件的引用
  return (
    <DialogSelect
      ref={(r) => (ref = r)} // 保存对话框选择组件的引用
      title="Commands" // 对话框标题
      // 过滤命令选项：如果有过滤器，则排除推荐命令（避免重复显示）
      options={props.options.filter((x) => !ref?.filter || !x.value.startsWith("suggested."))}
    />
  )
}
