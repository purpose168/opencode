import { Keybind } from "@/util/keybind" // 快捷键工具类，提供快捷键解析、匹配和格式化功能
import type { KeybindsConfig } from "@opencode-ai/sdk/v2" // OpenCode AI SDK 类型定义：快捷键配置接口
import type { ParsedKey, Renderable } from "@opentui/core" // OpenTUI 核心类型：解析后的键盘事件、可渲染组件
import { useKeyboard, useRenderer } from "@opentui/solid" // OpenTUI Solid.js 集成：键盘事件监听、渲染器访问
import { useSync } from "@tui/context/sync" // 同步上下文钩子，用于访问同步状态数据（包括配置、版本控制信息等）
import { mapValues, pipe } from "remeda" // Remeda 函数式编程工具库：管道操作、对象值映射
import { createMemo } from "solid-js" // Solid.js 核心函数：创建派生值，当依赖项变化时自动重新计算
import { createStore } from "solid-js/store" // Solid.js 状态管理：创建响应式 store
import { createSimpleContext } from "./helper" // 从 helper 模块导入创建简单上下文的方法，用于快速创建 Solid.js 上下文

// 创建快捷键上下文提供者
// 使用 createSimpleContext 工具函数快速创建一个快捷键管理上下文
// 这个上下文用于在整个应用组件树中管理键盘快捷键的解析、匹配和显示
//
// 返回值包含两个主要部分：
// - use: 用于在子组件中获取快捷键处理函数的钩子函数
// - provider: 用于在父组件中提供快捷键上下文的组件
export const { use: useKeybind, provider: KeybindProvider } = createSimpleContext({
  name: "Keybind", // 上下文的名称，用于调试和错误提示
  init: () => {
    // 获取同步上下文，用于访问配置中的快捷键设置
    const sync = useSync()

    // 创建快捷键数据的派生值
    // 当同步数据中的配置变化时自动重新计算快捷键映射
    const keybinds = createMemo(() => {
      // 使用管道操作处理快捷键配置
      // 1. 获取配置中的快捷键对象（如果不存在则使用空对象）
      // 2. 使用 mapValues 将所有快捷键字符串值解析为 Keybind 对象
      return pipe(
        sync.data.config.keybinds ?? {},
        mapValues((value) => Keybind.parse(value)),
      )
    })

    // 创建响应式 store 来管理 leader 键状态
    // leader 键是一个特殊的快捷键（前导键），用于触发复合快捷键
    const [store, setStore] = createStore({
      leader: false, // leader 键是否处于激活状态
    })

    // 获取渲染器实例，用于访问当前聚焦的组件
    const renderer = useRenderer()

    // 声明变量
    let focus: Renderable | null // 保存 leader 键激活前聚焦的组件
    let timeout: NodeJS.Timeout // leader 键超时定时器

    /**
     * Leader 键激活/取消激活处理函数
     * Leader 键是一个前导键，用于触发复合快捷键（如 Ctrl+X 后跟其他键）
     *
     * @param active - true 表示激活 leader 模式，false 表示取消激活
     */
    function leader(active: boolean) {
      // 激活 leader 模式
      if (active) {
        setStore("leader", true) // 设置 leader 状态为激活
        focus = renderer.currentFocusedRenderable // 保存当前聚焦的组件
        focus?.blur() // 移除当前组件的焦点

        // 清除之前可能存在的超时定时器
        if (timeout) clearTimeout(timeout)

        // 设置 2 秒超时：如果用户在 2 秒内没有按后续键，则自动退出 leader 模式
        timeout = setTimeout(() => {
          // 如果已经退出 leader 模式，则不做任何操作
          if (!store.leader) return

          // 自动退出 leader 模式
          leader(false)

          // 恢复之前聚焦的组件
          if (focus) {
            focus.focus()
          }
        }, 2000)
        return
      }

      // 取消激活 leader 模式
      if (!active) {
        // 如果有保存的聚焦组件，且当前没有其他组件被聚焦，则恢复焦点
        if (focus && !renderer.currentFocusedRenderable) {
          focus.focus()
        }
        // 设置 leader 状态为未激活
        setStore("leader", false)
      }
    }

    // 使用键盘事件监听
    // 监听所有键盘事件并根据当前快捷键状态进行处理
    useKeyboard(async (evt) => {
      // 如果 leader 模式未激活，且当前按键匹配 leader 快捷键
      if (!store.leader && result.match("leader", evt)) {
        leader(true) // 激活 leader 模式
        return // 处理完成，退出
      }

      // 如果 leader 模式已激活
      if (store.leader && evt.name) {
        // 使用 setImmediate 确保在当前事件循环结束后执行
        setImmediate(() => {
          // 如果之前聚焦的组件仍然是当前聚焦的组件，恢复其焦点
          if (focus && renderer.currentFocusedRenderable === focus) {
            focus.focus()
          }
          // 退出 leader 模式
          leader(false)
        })
      }
    })

    // 创建结果对象，包含快捷键相关的所有方法
    const result = {
      /**
       * 获取所有快捷键配置
       * 这是一个 getter 属性，访问时自动计算当前快捷键映射
       */
      get all() {
        return keybinds() // 返回解析后的快捷键配置对象
      },

      /**
       * 获取 leader 键的当前状态
       * 这是一个 getter 属性，反映 leader 模式是否激活
       */
      get leader() {
        return store.leader // 返回 leader 状态
      },

      /**
       * 解析键盘事件为快捷键信息
       * 将原始键盘事件转换为内部使用的快捷键表示格式
       *
       * @param evt - 解析后的键盘事件对象
       * @returns 快捷键信息对象，包含快捷键的各个属性
       */
      parse(evt: ParsedKey): Keybind.Info {
        // 处理 Ctrl+Underscore 的特殊情况（被表示为 \x1F）
        // 这个特殊字符需要特殊处理才能正确解析为 Ctrl+_
        if (evt.name === "\x1F") {
          // 将 \x1F 转换为 _，并设置 ctrl 为 true
          return Keybind.fromParsedKey({ ...evt, name: "_", ctrl: true }, store.leader)
        }
        // 普通情况：直接解析键盘事件
        return Keybind.fromParsedKey(evt, store.leader)
      },

      /**
       * 检查键盘事件是否匹配指定的快捷键配置
       *
       * @param key - 快捷键配置中的键名（如 "leader"、"copy"、"paste" 等）
       * @param evt - 解析后的键盘事件对象
       * @returns 如果匹配返回 true，否则返回 false
       */
      match(key: keyof KeybindsConfig, evt: ParsedKey) {
        // 获取指定键的快捷键配置
        const keybind = keybinds()[key]
        if (!keybind) return false // 如果没有配置该快捷键，返回 false

        // 解析当前键盘事件
        const parsed: Keybind.Info = result.parse(evt)

        // 遍历快捷键配置，检查是否有匹配的快捷键
        for (const key of keybind) {
          if (Keybind.match(key, parsed)) {
            return true // 找到匹配，返回 true
          }
        }
        // 没有找到匹配，返回 false
      },

      /**
       * 打印快捷键的字符串表示
       * 将快捷键配置转换为用户可读的字符串格式
       *
       * @param key - 快捷键配置中的键名
       * @returns 快捷键的可读字符串表示，如果未配置则返回空字符串
       */
      print(key: keyof KeybindsConfig) {
        // 获取指定键的第一个快捷键配置
        const first = keybinds()[key]?.at(0)
        if (!first) return "" // 如果没有配置，返回空字符串

        // 将快捷键转换为字符串
        const result = Keybind.toString(first)
        // 如果快捷键中包含 <leader> 占位符，替换为实际的 leader 快捷键字符串
        return result.replace("<leader>", Keybind.toString(keybinds().leader![0]!))
      },
    }

    // 返回结果对象，包含所有快捷键相关的方法和状态
    return result
  },
})
