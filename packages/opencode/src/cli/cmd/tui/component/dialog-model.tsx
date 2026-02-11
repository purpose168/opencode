import { createMemo, createSignal } from "solid-js" // Solid.js 核心函数：创建派生值和响应式信号
import { useLocal } from "@tui/context/local" // 本地配置上下文，用于访问本地设置
import { useSync } from "@tui/context/sync" // 同步上下文，用于管理与服务器的数据同步
import { map, pipe, flatMap, entries, filter, sortBy, take } from "remeda" // Remeda 函数式编程工具库
import { DialogSelect, type DialogSelectRef } from "@tui/ui/dialog-select" // 选择对话框组件及其类型
import { useDialog } from "@tui/ui/dialog" // 对话框上下文，用于控制对话框的显示和隐藏
import { createDialogProviderOptions, DialogProvider } from "./dialog-provider" // 对话框提供者相关组件和工具函数
import { Keybind } from "@/util/keybind" // 快捷键工具
import * as fuzzysort from "fuzzysort" // 模糊搜索库

// 判断是否已连接到提供者的钩子
export function useConnected() {
  const sync = useSync() // 获取同步上下文
  // 创建派生值：判断是否已连接（至少有一个提供者已连接，或者 opencode 提供者有非零成本的模型）
  return createMemo(() =>
    sync.data.provider.some(
      (x) => x.id !== "opencode" || Object.values(x.models).some((y) => y.cost?.input !== 0),
    ),
  )
}

// 模型选择对话框组件
export function DialogModel(props: { providerID?: string }) {
  const local = useLocal() // 获取本地配置上下文
  const sync = useSync() // 获取同步上下文
  const dialog = useDialog() // 获取对话框上下文
  const [ref, setRef] = createSignal<DialogSelectRef<unknown>>() // 创建对话框选择组件的引用
  const [query, setQuery] = createSignal("") // 创建查询字符串信号，用于过滤选项

  const connected = useConnected() // 获取连接状态
  const providers = createDialogProviderOptions() // 创建对话框提供者选项

  // 判断是否显示额外选项（收藏和最近使用）
  const showExtra = createMemo(() => {
    if (!connected()) return false // 如果未连接，不显示额外选项
    if (props.providerID) return false // 如果指定了提供者 ID，不显示额外选项
    return true
  })

  // 创建模型选项列表的 memo
  const options = createMemo(() => {
    const q = query() // 获取查询字符串
    const favorites = showExtra() ? local.model.favorite() : [] // 获取收藏的模型列表
    const recents = local.model.recent() // 获取最近使用的模型列表

    // 过滤最近使用的模型，排除已收藏的模型
    const recentList = showExtra()
      ? recents.filter(
          (item) => !favorites.some((fav) => fav.providerID === item.providerID && fav.modelID === item.modelID),
        )
      : []

    // 创建收藏模型选项列表
    const favoriteOptions = favorites.flatMap((item) => {
      const provider = sync.data.provider.find((x) => x.id === item.providerID) // 查找提供者
      if (!provider) return [] // 如果提供者不存在，返回空数组
      const model = provider.models[item.modelID] // 获取模型信息
      if (!model) return [] // 如果模型不存在，返回空数组
      return [
        {
          key: item, // 使用收藏项作为键
          value: {
            providerID: provider.id, // 提供者 ID
            modelID: model.id, // 模型 ID
          },
          title: model.name ?? item.modelID, // 模型名称或 ID
          description: provider.name, // 提供者名称
          category: "Favorites", // 分类：收藏
          disabled: provider.id === "opencode" && model.id.includes("-nano"), // 禁用 opencode 的 nano 模型
          footer: model.cost?.input === 0 && provider.id === "opencode" ? "Free" : undefined, // 显示免费标记
          onSelect: () => {
            dialog.clear() // 清除对话框
            local.model.set(
              {
                providerID: provider.id,
                modelID: model.id,
              },
              { recent: true }, // 标记为最近使用
            )
          },
        },
      ]
    })

    // 创建最近使用模型选项列表
    const recentOptions = recentList.flatMap((item) => {
      const provider = sync.data.provider.find((x) => x.id === item.providerID) // 查找提供者
      if (!provider) return [] // 如果提供者不存在，返回空数组
      const model = provider.models[item.modelID] // 获取模型信息
      if (!model) return [] // 如果模型不存在，返回空数组
      return [
        {
          key: item, // 使用最近使用项作为键
          value: {
            providerID: provider.id, // 提供者 ID
            modelID: model.id, // 模型 ID
          },
          title: model.name ?? item.modelID, // 模型名称或 ID
          description: provider.name, // 提供者名称
          category: "Recent", // 分类：最近使用
          disabled: provider.id === "opencode" && model.id.includes("-nano"), // 禁用 opencode 的 nano 模型
          footer: model.cost?.input === 0 && provider.id === "opencode" ? "Free" : undefined, // 显示免费标记
          onSelect: () => {
            dialog.clear() // 清除对话框
            local.model.set(
              {
                providerID: provider.id,
                modelID: model.id,
              },
              { recent: true }, // 标记为最近使用
            )
          },
        },
      ]
    })

    // 创建提供者模型选项列表
    const providerOptions = pipe(
      sync.data.provider, // 获取所有提供者
      sortBy(
        (provider) => provider.id !== "opencode", // opencode 提供者优先
        (provider) => provider.name, // 按名称排序
      ),
      flatMap((provider) =>
        pipe(
          provider.models, // 获取提供者的所有模型
          entries(), // 将模型对象转换为键值对数组
          filter(([_, info]) => info.status !== "deprecated"), // 过滤掉已废弃的模型
          filter(([_, info]) => (props.providerID ? info.providerID === props.providerID : true)), // 如果指定了提供者 ID，则只显示该提供者的模型
          map(([model, info]) => {
            const value = {
              providerID: provider.id,
              modelID: model,
            }
            return {
              value, // 模型值
              title: info.name ?? model, // 模型名称或 ID
              description: favorites.some(
                (item) => item.providerID === value.providerID && item.modelID === value.modelID,
              )
                ? "(Favorite)" // 如果已收藏，显示标记
                : undefined,
              category: connected() ? provider.name : undefined, // 如果已连接，显示提供者名称作为分类
              disabled: provider.id === "opencode" && model.includes("-nano"), // 禁用 opencode 的 nano 模型
              footer: info.cost?.input === 0 && provider.id === "opencode" ? "Free" : undefined, // 显示免费标记
              onSelect() {
                dialog.clear() // 清除对话框
                local.model.set(
                  {
                    providerID: provider.id,
                    modelID: model,
                  },
                  { recent: true }, // 标记为最近使用
                )
              },
            }
          }),
          filter((x) => {
            const value = x.value
            const inFavorites = favorites.some(
              (item) => item.providerID === value.providerID && item.modelID === value.modelID,
            )
            if (inFavorites) return false // 过滤掉已收藏的模型
            const inRecents = recentList.some(
              (item) => item.providerID === value.providerID && item.modelID === value.modelID,
            )
            if (inRecents) return false // 过滤掉最近使用的模型
            return true
          }),
          sortBy(
            (x) => x.footer !== "Free", // 免费模型优先
            (x) => x.title, // 按名称排序
          ),
        ),
      ),
    )

    // 创建热门提供者选项列表（仅在未连接时显示）
    const popularProviders = !connected()
      ? pipe(
          providers(), // 获取提供者选项
          map((option) => {
            return {
              ...option,
              category: "Popular providers", // 分类：热门提供者
            }
          }),
          take(6), // 只取前 6 个热门提供者
        )
      : []

    // 如果有查询字符串，对每个部分分别应用模糊过滤，保持部分顺序
    if (q) {
      const filteredFavorites = fuzzysort.go(q, favoriteOptions, { keys: ["title"] }).map((x) => x.obj) // 过滤收藏模型
      const filteredRecents = fuzzysort
        .go(q, recentOptions, { keys: ["title"] }) // 过滤最近使用模型
        .map((x) => x.obj)
        .slice(0, 5) // 最多显示 5 个最近使用模型
      const filteredProviders = fuzzysort.go(q, providerOptions, { keys: ["title", "category"] }).map((x) => x.obj) // 过滤提供者模型
      const filteredPopular = fuzzysort.go(q, popularProviders, { keys: ["title"] }).map((x) => x.obj) // 过滤热门提供者
      return [...filteredFavorites, ...filteredRecents, ...filteredProviders, ...filteredPopular] // 返回过滤后的选项列表
    }

    // 如果没有查询字符串，返回所有选项
    return [...favoriteOptions, ...recentOptions, ...providerOptions, ...popularProviders]
  })

  // 创建提供者信息的 memo
  const provider = createMemo(() =>
    props.providerID ? sync.data.provider.find((x) => x.id === props.providerID) : null,
  )

  // 创建对话框标题的 memo
  const title = createMemo(() => {
    if (provider()) return provider()!.name // 如果有提供者，显示提供者名称
    return "Select model" // 否则显示默认标题
  })

  // 返回对话框选择组件
  return (
    <DialogSelect
      keybind={[
        {
          keybind: Keybind.parse("ctrl+a")[0], // Ctrl+A 快捷键
          title: connected() ? "Connect provider" : "View all providers", // 快捷键标题
          onTrigger() {
            dialog.replace(() => <DialogProvider />) // 替换对话框为提供者选择对话框
          },
        },
        {
          keybind: Keybind.parse("ctrl+f")[0], // Ctrl+F 快捷键
          title: "Favorite", // 快捷键标题
          disabled: !connected(), // 如果未连接，禁用此快捷键
          onTrigger: (option) => {
            local.model.toggleFavorite(option.value as { providerID: string; modelID: string }) // 切换收藏状态
          },
        },
      ]}
      ref={setRef} // 设置组件引用
      onFilter={setQuery} // 设置过滤查询回调
      skipFilter={true} // 跳过默认过滤，使用自定义模糊搜索
      title={title()} // 对话框标题
      current={local.model.current()} // 当前选中的模型
      options={options()} // 模型选项列表
    />
  )
}
