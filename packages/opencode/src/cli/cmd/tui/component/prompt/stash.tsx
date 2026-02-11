import path from "path" // 路径处理模块，用于文件路径操作
import { Global } from "@/global" // 全局配置模块，提供应用状态路径等全局信息
import { onMount } from "solid-js" // Solid.js 生命周期钩子，组件挂载时执行
import { createStore, produce } from "solid-js/store" // Solid.js 状态管理，createStore 创建响应式状态，produce 用于不可变更新
import { clone } from "remeda" // 深度克隆工具，用于对象复制
import { createSimpleContext } from "../../context/helper" // 简化版 Context 创建工具
import { appendFile, writeFile } from "fs/promises" // Node.js 文件系统 Promise API，用于文件写入操作
import type { PromptInfo } from "./history" // 提示词信息类型定义

export type StashEntry = {
  input: string // 输入文本
  parts: PromptInfo["parts"] // 提示词部分（文件、代理、文本等）
  timestamp: number // 时间戳，用于记录暂存时间
}

const MAX_STASH_ENTRIES = 50 // 暂存最大条目数限制，超过此数量将自动删除最早的记录

export const { use: usePromptStash, provider: PromptStashProvider } = createSimpleContext({
  name: "PromptStash", // Context 名称，用于调试和标识
  init: () => {
    // 创建暂存文件对象，使用 JSONL 格式（每行一个 JSON 对象）
    const stashFile = Bun.file(path.join(Global.Path.state, "prompt-stash.jsonl"))
    
    // 组件挂载时初始化暂存列表
    onMount(async () => {
      // 读取文件内容，如果文件不存在或读取失败则返回空字符串
      const text = await stashFile.text().catch(() => "")
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
        .filter((line): line is StashEntry => line !== null) // 过滤掉无效行，并类型守卫确保剩余项为 StashEntry 类型
        .slice(-MAX_STASH_ENTRIES) // 只保留最后 MAX_STASH_ENTRIES 条记录

      // 将解析后的暂存列表设置到 store 中
      setStore("entries", lines)

      // 如果存在有效记录，重写文件以自我修复损坏的数据
      // 这确保文件中只包含有效的 JSON 行
      if (lines.length > 0) {
        const content = lines.map((line) => JSON.stringify(line)).join("\n") + "\n"
        writeFile(stashFile.name!, content).catch(() => {}) // 写入失败时静默忽略
      }
    })

    // 创建响应式 store，用于管理暂存列表状态
    const [store, setStore] = createStore({
      entries: [] as StashEntry[], // 暂存条目数组
    })

    return {
      // 获取暂存列表
      list() {
        return store.entries
      },
      // 添加新的暂存条目
      push(entry: Omit<StashEntry, "timestamp">) {
        // 克隆输入对象并添加时间戳
        const stash = clone({ ...entry, timestamp: Date.now() })
        let trimmed = false // 标记是否删除了旧记录
        
        // 更新 store
        setStore(
          produce((draft) => {
            // 将新记录添加到暂存列表末尾
            draft.entries.push(stash)
            // 如果超过最大条目数，删除最早的记录
            if (draft.entries.length > MAX_STASH_ENTRIES) {
              draft.entries = draft.entries.slice(-MAX_STASH_ENTRIES)
              trimmed = true
            }
          }),
        )

        // 如果删除了旧记录，需要重写整个文件
        if (trimmed) {
          const content = store.entries.map((line) => JSON.stringify(line)).join("\n") + "\n"
          writeFile(stashFile.name!, content).catch(() => {})
          return
        }

        // 否则直接追加新记录到文件末尾
        appendFile(stashFile.name!, JSON.stringify(stash) + "\n").catch(() => {})
      },
      // 弹出并返回最后一个暂存条目
      pop() {
        // 如果暂存列表为空，返回 undefined
        if (store.entries.length === 0) return undefined
        // 获取最后一个条目
        const entry = store.entries[store.entries.length - 1]
        // 从 store 中移除最后一个条目
        setStore(
          produce((draft) => {
            draft.entries.pop()
          }),
        )
        // 重写文件以反映移除操作
        const content =
          store.entries.length > 0 ? store.entries.map((line) => JSON.stringify(line)).join("\n") + "\n" : ""
        writeFile(stashFile.name!, content).catch(() => {})
        return entry
      },
      // 删除指定索引的暂存条目
      remove(index: number) {
        // 检查索引是否有效
        if (index < 0 || index >= store.entries.length) return
        // 从 store 中移除指定索引的条目
        setStore(
          produce((draft) => {
            draft.entries.splice(index, 1)
          }),
        )
        // 重写文件以反映删除操作
        const content =
          store.entries.length > 0 ? store.entries.map((line) => JSON.stringify(line)).join("\n") + "\n" : ""
        writeFile(stashFile.name!, content).catch(() => {})
      },
    }
  },
})
