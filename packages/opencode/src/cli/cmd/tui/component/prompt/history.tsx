import path from "path" // 路径处理模块，用于文件路径操作
import { Global } from "@/global" // 全局配置模块，提供应用状态路径等全局信息
import { onMount } from "solid-js" // Solid.js 生命周期钩子，组件挂载时执行
import { createStore, produce } from "solid-js/store" // Solid.js 状态管理，createStore 创建响应式状态，produce 用于不可变更新
import { clone } from "remeda" // 深度克隆工具，用于对象复制
import { createSimpleContext } from "../../context/helper" // 简化版 Context 创建工具
import { appendFile, writeFile } from "fs/promises" // Node.js 文件系统 Promise API，用于文件写入操作
import type { AgentPart, FilePart, TextPart } from "@opencode-ai/sdk/v2" // SDK 类型定义，用于消息部分的类型约束

export type PromptInfo = {
  input: string // 用户输入的提示词文本
  mode?: "normal" | "shell" // 输入模式：normal 为普通模式，shell 为 Shell 命令模式
  parts: (
    | Omit<FilePart, "id" | "messageID" | "sessionID"> // 文件部分类型，排除自动生成的 ID 字段
    | Omit<AgentPart, "id" | "messageID" | "sessionID"> // 代理部分类型，排除自动生成的 ID 字段
    | (Omit<TextPart, "id" | "messageID" | "sessionID"> & { // 文本部分类型，排除自动生成的 ID 字段，并扩展源信息
        source?: { // 可选的源信息，记录文本的来源位置
          text: { // 文本位置信息
            start: number // 起始位置
            end: number // 结束位置
            value: string // 原始文本值
          }
        }
      })
  )[] // 提示词相关的所有部分组成的数组
}

const MAX_HISTORY_ENTRIES = 50 // 历史记录最大条目数限制，超过此数量将自动删除最早的记录

export const { use: usePromptHistory, provider: PromptHistoryProvider } = createSimpleContext({
  name: "PromptHistory", // Context 名称，用于调试和标识
  init: () => {
    // 创建历史记录文件对象，使用 JSONL 格式（每行一个 JSON 对象）
    const historyFile = Bun.file(path.join(Global.Path.state, "prompt-history.jsonl"))
    
    // 组件挂载时初始化历史记录
    onMount(async () => {
      // 读取文件内容，如果文件不存在或读取失败则返回空字符串
      const text = await historyFile.text().catch(() => "")
      // 按行分割文件内容，过滤空行
      const lines = text
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try {
            // 尝试将每行解析为 JSON 对象
            return JSON.parse(line)
          } catch {
            // 解析失败返回 null，表示该行无效
            return null
          }
        })
        .filter((line): line is PromptInfo => line !== null) // 过滤掉无效行，并类型守卫确保剩余项为 PromptInfo 类型
        .slice(-MAX_HISTORY_ENTRIES) // 只保留最后 MAX_HISTORY_ENTRIES 条记录

      // 将解析后的历史记录设置到 store 中
      setStore("history", lines)

      // 如果存在有效记录，重写文件以自我修复损坏的数据
      // 这确保文件中只包含有效的 JSON 行
      if (lines.length > 0) {
        const content = lines.map((line) => JSON.stringify(line)).join("\n") + "\n"
        writeFile(historyFile.name!, content).catch(() => {}) // 写入失败时静默忽略
      }
    })

    // 创建响应式 store，用于管理历史记录状态
    const [store, setStore] = createStore({
      index: 0, // 当前历史记录索引，0 表示最新位置（无历史记录选中）
      history: [] as PromptInfo[], // 历史记录数组
    })

    return {
      // 在历史记录中导航，direction 为 1 表示向后（更旧），-1 表示向前（更新）
      move(direction: 1 | -1, input: string) {
        // 如果没有历史记录，直接返回
        if (!store.history.length) return undefined
        // 获取当前索引对应的历史记录
        const current = store.history.at(store.index)
        if (!current) return undefined
        // 如果当前输入与历史记录不同且不为空，则不执行导航（用户正在编辑新内容）
        if (current.input !== input && input.length) return
        
        // 更新索引位置
        setStore(
          produce((draft) => {
            const next = store.index + direction
            // 检查索引是否超出范围
            if (Math.abs(next) > store.history.length) return
            // 不允许索引为正数（正数表示超出最新位置）
            if (next > 0) return
            draft.index = next
          }),
        )
        
        // 如果索引回到 0，返回空输入（表示用户回到最新状态）
        if (store.index === 0)
          return {
            input: "",
            parts: [],
          }
        // 返回当前索引对应的历史记录
        return store.history.at(store.index)
      },
      // 添加新的提示词到历史记录
      append(item: PromptInfo) {
        // 克隆输入对象以避免引用问题
        const entry = clone(item)
        let trimmed = false // 标记是否删除了旧记录
        
        // 更新 store
        setStore(
          produce((draft) => {
            // 将新记录添加到历史记录末尾
            draft.history.push(entry)
            // 如果超过最大条目数，删除最早的记录
            if (draft.history.length > MAX_HISTORY_ENTRIES) {
              draft.history = draft.history.slice(-MAX_HISTORY_ENTRIES)
              trimmed = true
            }
            // 重置索引到 0（最新位置）
            draft.index = 0
          }),
        )

        // 如果删除了旧记录，需要重写整个文件
        if (trimmed) {
          const content = store.history.map((line) => JSON.stringify(line)).join("\n") + "\n"
          writeFile(historyFile.name!, content).catch(() => {})
          return
        }

        // 否则直接追加新记录到文件末尾
        appendFile(historyFile.name!, JSON.stringify(entry) + "\n").catch(() => {})
      },
    }
  },
})
