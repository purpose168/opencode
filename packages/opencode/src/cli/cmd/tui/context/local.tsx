import { batch, createEffect, createMemo } from "solid-js" // Solid.js 核心函数和类型
import { createStore } from "solid-js/store" // Solid.js 状态管理：创建响应式 store，用于管理复杂的状态对象，支持嵌套属性的响应式更新
// - batch：批量更新函数，将多个状态更新合并为一次渲染，避免中间状态导致的重复渲染
// - createEffect：创建副作用函数，当依赖项变化时自动执行，用于响应式数据的同步和副作用处理
// - createMemo：创建派生值函数，当依赖项变化时自动重新计算，用于复杂计算结果的缓存和复用
import { Global } from "@/global" // 全局配置对象，提供项目级别的配置信息（如路径配置、应用设置等）
import { Provider } from "@/provider/provider" // 提供者模块，提供模型解析和提供者相关的功能
import { iife } from "@/util/iife" // 立即执行函数表达式工具，用于创建闭包作用域和延迟初始化
import { RGBA } from "@opentui/core" // OpenTUI 核心颜色类型，用于处理 RGBA 颜色值的创建和转换
import { useSync } from "@tui/context/sync" // 同步上下文钩子，用于访问同步状态数据（包括配置、智能体、模型、提供者等信息）
import { useTheme } from "@tui/context/theme" // 主题上下文钩子，用于访问当前主题的颜色配置（如次要色、强调色、成功色等）
import path from "path" // Node.js 路径处理模块，用于处理文件路径的拼接、解析和规范化
import { uniqueBy } from "remeda" // Remeda 函数式编程工具库的数组去重函数，用于根据指定属性对数组进行去重
import { useToast } from "../ui/toast" // 提示组件钩子，用于显示临时通知消息（如警告、成功、信息等）
import { useArgs } from "./args" // 命令行参数上下文钩子，用于访问通过命令行传递的配置参数
import { createSimpleContext } from "./helper" // 从 helper 模块导入创建简单上下文的方法，用于快速创建 Solid.js 上下文
import { useSDK } from "./sdk" // SDK 上下文钩子，用于访问 OpenCode SDK 客户端实例

// 创建本地配置上下文提供者
// 使用 createSimpleContext 工具函数快速创建一个本地配置管理上下文
// 这个上下文用于在整个应用组件树中管理本地状态，包括智能体管理、模型管理、MCP 服务器管理等
//
// 返回值包含两个主要部分：
// - use: 用于在子组件中获取本地配置操作函数的钩子函数
// - provider: 用于在父组件中提供本地配置上下文的组件
export const { use: useLocal, provider: LocalProvider } = createSimpleContext({
  name: "Local", // 上下文的名称，用于调试和错误提示
  init: () => {
    // 获取同步上下文和 SDK 上下文
    const sync = useSync() // 用于访问同步数据，包括智能体、模型、提供者、配置等
    const sdk = useSDK() // 用于访问 SDK 客户端，执行各种 API 操作
    const toast = useToast() // 用于显示提示消息

    /**
     * 检查模型配置是否有效
     * 验证指定的 providerID 和 modelID 是否对应一个真实存在的模型
     *
     * @param model - 要验证的模型对象，包含 providerID 和 modelID
     * @returns 如果模型存在且有效返回 true，否则返回 false
     */
    function isModelValid(model: { providerID: string; modelID: string }) {
      // 在提供者列表中查找指定的提供者
      const provider = sync.data.provider.find((x) => x.id === model.providerID)
      // 检查提供者是否存在以及模型映射中是否包含指定的模型 ID
      return !!provider?.models[model.modelID]
    }

    /**
     * 获取第一个有效的模型
     * 依次检查传入的模型函数列表，返回第一个有效的模型配置
     *
     * @param modelFns - 可变数量的模型函数，每个函数返回一个模型配置或 undefined
     * @returns 第一个有效的模型配置，如果都不有效则返回 undefined
     */
    function getFirstValidModel(...modelFns: (() => { providerID: string; modelID: string } | undefined)[]) {
      // 遍历所有模型函数
      for (const modelFn of modelFns) {
        const model = modelFn() // 调用函数获取模型配置
        if (!model) continue // 如果模型不存在，继续检查下一个
        if (isModelValid(model)) return model // 如果模型有效，返回该模型
      }
    }

    // 智能体管理模块
    // 使用 IIFE（立即执行函数表达式）创建闭包，包含智能体的所有管理功能
    const agent = iife(() => {
      // 创建智能体列表的派生值，过滤掉子智能体和隐藏的智能体
      const agents = createMemo(() => sync.data.agent.filter((x) => x.mode !== "subagent" && !x.hidden))

      // 创建智能体存储的响应式 store
      const [agentStore, setAgentStore] = createStore<{
        current: string // 当前选中的智能体名称
      }>({
        current: agents()[0].name, // 默认选中第一个智能体
      })

      // 获取主题上下文用于访问颜色配置
      const { theme } = useTheme()

      // 创建颜色数组的派生值，用于为不同的智能体分配不同的颜色
      const colors = createMemo(() => [
        theme.secondary, // 次要色
        theme.accent, // 强调色
        theme.success, // 成功色
        theme.warning, // 警告色
        theme.primary, // 主色
        theme.error, // 错误色
      ])

      // 返回智能体管理的操作接口
      return {
        /**
         * 获取所有可用智能体列表
         * @returns 过滤后的智能体数组
         */
        list() {
          return agents()
        },

        /**
         * 获取当前选中的智能体
         * @returns 当前智能体对象
         */
        current() {
          return agents().find((x) => x.name === agentStore.current)!
        },

        /**
         * 设置当前智能体
         * @param name - 要切换到的智能体名称
         */
        set(name: string) {
          // 检查智能体是否存在
          if (!agents().some((x) => x.name === name))
            // 如果不存在，显示警告提示
            return toast.show({
              variant: "warning",
              message: `Agent not found: ${name}`,
              duration: 3000,
            })
          // 设置当前智能体
          setAgentStore("current", name)
        },

        /**
         * 在智能体列表中移动选中状态
         * 支持循环导航（首尾相连）
         *
         * @param direction - 移动方向，1 表示向下，-1 表示向上
         */
        move(direction: 1 | -1) {
          // 使用 batch 批量更新，避免中间状态导致的重复渲染
          batch(() => {
            // 计算下一个智能体的索引
            let next = agents().findIndex((x) => x.name === agentStore.current) + direction
            // 处理边界情况，实现循环导航
            if (next < 0) next = agents().length - 1 // 向上越界，跳转到最后一个
            if (next >= agents().length) next = 0 // 向下越界，跳转到第一个
            // 获取下一个智能体并设置
            const value = agents()[next]
            setAgentStore("current", value.name)
          })
        },

        /**
         * 获取智能体的显示颜色
         * 如果智能体配置了自定义颜色则使用配置的颜色，否则使用分配的颜色
         *
         * @param name - 智能体名称
         * @returns 智能体对应的 RGBA 颜色对象
         */
        color(name: string) {
          // 在智能体列表中查找指定智能体
          const agent = agents().find((x) => x.name === name)
          // 如果智能体配置了自定义颜色，直接返回
          if (agent?.color) return RGBA.fromHex(agent.color)
          // 否则，根据智能体在列表中的索引分配颜色
          const index = agents().findIndex((x) => x.name === name)
          if (index === -1) return colors()[0] // 如果找不到，返回默认颜色
          return colors()[index % colors().length] // 使用取模确保颜色循环使用
        },
      }
    })

    // 模型管理模块
    // 使用 IIFE（立即执行函数表达式）创建闭包，包含模型的所有管理功能
    const model = iife(() => {
      // 创建模型存储的响应式 store
      const [modelStore, setModelStore] = createStore<{
        ready: boolean // 数据是否已就绪
        model: Record<
          // 各智能体当前选中的模型配置
          string, // 智能体名称
          {
            providerID: string // 提供者 ID
            modelID: string // 模型 ID
          }
        >
        recent: {
          // 最近使用的模型列表
          providerID: string
          modelID: string
        }[]
        favorite: {
          // 收藏的模型列表
          providerID: string
          modelID: string
        }[]
        variant: Record<string, string | undefined> // 模型变体配置
      }>({
        ready: false, // 初始状态为未就绪
        model: {}, // 初始模型配置为空
        recent: [], // 初始最近使用列表为空
        favorite: [], // 初始收藏列表为空
        variant: {}, // 初始变体配置为空
      })

      // 构建模型配置文件的完整路径
      const file = Bun.file(path.join(Global.Path.state, "model.json"))

      /**
       * 保存模型配置到文件
       * 将最近使用、收藏和变体配置持久化保存
       */
      function save() {
        Bun.write(
          file,
          JSON.stringify({
            recent: modelStore.recent,
            favorite: modelStore.favorite,
            variant: modelStore.variant,
          }),
        )
      }

      // 异步加载模型配置文件
      file
        .json() // 读取并解析 JSON 文件
        .then((x) => {
          // 加载最近使用列表（确保是数组类型）
          if (Array.isArray(x.recent)) setModelStore("recent", x.recent)
          // 加载收藏列表（确保是数组类型）
          if (Array.isArray(x.favorite)) setModelStore("favorite", x.favorite)
          // 加载变体配置（确保是对象类型）
          if (typeof x.variant === "object" && x.variant !== null) setModelStore("variant", x.variant)
        })
        .catch(() => {
          // 如果加载失败（如文件不存在），静默忽略
          // 配置将保持默认空值状态
        })
        .finally(() => {
          // 无论成功或失败，都将就绪状态设置为 true
          setModelStore("ready", true)
        })

      // 获取命令行参数上下文
      const args = useArgs()

      /**
       * 创建后备模型的派生值
       * 按优先级依次检查以下来源：
       * 1. 命令行参数中指定的模型
       * 2. 配置文件中的默认模型
       * 3. 最近使用过的有效模型
       * 4. 提供者的第一个可用模型
       *
       * @returns 有效的模型配置对象，如果都不存在则返回 undefined
       */
      const fallbackModel = createMemo(() => {
        // 检查命令行参数中是否指定了模型
        if (args.model) {
          const { providerID, modelID } = Provider.parseModel(args.model)
          if (isModelValid({ providerID, modelID })) {
            return { providerID, modelID }
          }
        }

        // 检查配置文件中是否指定了默认模型
        if (sync.data.config.model) {
          const { providerID, modelID } = Provider.parseModel(sync.data.config.model)
          if (isModelValid({ providerID, modelID })) {
            return { providerID, modelID }
          }
        }

        // 检查最近使用列表中是否有有效模型
        for (const item of modelStore.recent) {
          if (isModelValid(item)) {
            return item
          }
        }

        // 获取第一个提供者的默认模型
        const provider = sync.data.provider[0]
        if (!provider) return undefined // 如果没有提供者，返回 undefined
        const defaultModel = sync.data.provider_default[provider.id] // 提供者的默认模型
        const firstModel = Object.values(provider.models)[0] // 提供者的第一个模型
        const model = defaultModel ?? firstModel?.id // 使用默认模型或第一个模型
        if (!model) return undefined // 如果没有可用模型，返回 undefined
        return { providerID: provider.id, modelID: model }
      })

      /**
       * 创建当前模型的派生值
       * 按优先级依次检查：
       * 1. 当前智能体保存的模型配置
       * 2. 智能体默认模型配置
       * 3. 后备模型配置
       *
       * @returns 当前应该使用的模型配置
       */
      const currentModel = createMemo(() => {
        const a = agent.current() // 获取当前智能体
        return (
          // 使用 getFirstValidModel 按优先级获取有效模型
          getFirstValidModel(
            () => modelStore.model[a.name], // 检查智能体保存的模型配置
            () => a.model, // 检查智能体默认模型配置
            fallbackModel, // 使用后备模型
          ) ?? undefined
        )
      })

      // 返回模型管理的操作接口
      return {
        // 获取当前模型的派生值
        current: currentModel,

        /**
         * 获取模型配置的就绪状态
         * @returns 如果数据已加载完成返回 true
         */
        get ready() {
          return modelStore.ready
        },

        /**
         * 获取最近使用的模型列表
         * @returns 最近使用模型的数组
         */
        recent() {
          return modelStore.recent
        },

        /**
         * 获取收藏的模型列表
         * @returns 收藏模型的数组
         */
        favorite() {
          return modelStore.favorite
        },

        /**
         * 创建解析后的模型信息的派生值
         * 将模型 ID 转换为用户可读的名称和提供商信息
         *
         * @returns 包含 provider 名称、model 名称和 reasoning 能力标识的对象
         */
        parsed: createMemo(() => {
          const value = currentModel() // 获取当前模型配置
          if (!value) {
            // 如果没有模型，返回占位文本
            return {
              provider: "Connect a provider",
              model: "No provider selected",
              reasoning: false,
            }
          }
          // 查找提供者信息和模型信息
          const provider = sync.data.provider.find((x) => x.id === value.providerID)
          const info = provider?.models[value.modelID]
          return {
            provider: provider?.name ?? value.providerID, // 提供者名称或 ID
            model: info?.name ?? value.modelID, // 模型名称或 ID
            reasoning: info?.capabilities?.reasoning ?? false, // 是否支持推理能力
          }
        }),

        /**
         * 在最近使用的模型列表中循环切换
         *
         * @param direction - 切换方向，1 表示下一个，-1 表示上一个
         */
        cycle(direction: 1 | -1) {
          const current = currentModel() // 获取当前模型
          if (!current) return // 如果没有当前模型，直接返回
          const recent = modelStore.recent // 获取最近使用列表
          // 查找当前模型在列表中的索引
          const index = recent.findIndex((x) => x.providerID === current.providerID && x.modelID === current.modelID)
          if (index === -1) return // 如果不在列表中，直接返回

          // 计算下一个索引（支持循环）
          let next = index + direction
          if (next < 0) next = recent.length - 1 // 向上越界
          if (next >= recent.length) next = 0 // 向下越界
          const val = recent[next] // 获取下一个模型
          if (!val) return // 如果无效，直接返回

          // 设置当前智能体的模型配置
          setModelStore("model", agent.current().name, { ...val })
        },

        /**
         * 在收藏的模型列表中循环切换
         *
         * @param direction - 切换方向，1 表示下一个，-1 表示上一个
         */
        cycleFavorite(direction: 1 | -1) {
          // 过滤出有效的收藏模型
          const favorites = modelStore.favorite.filter((item) => isModelValid(item))
          if (!favorites.length) {
            // 如果没有收藏模型，显示提示
            toast.show({
              variant: "info",
              message: "Add a favorite model to use this shortcut",
              duration: 3000,
            })
            return
          }

          const current = currentModel() // 获取当前模型
          let index = -1 // 当前模型在收藏列表中的索引
          if (current) {
            // 如果有当前模型，查找它在收藏列表中的位置
            index = favorites.findIndex((x) => x.providerID === current.providerID && x.modelID === current.modelID)
          }

          // 计算下一个要切换到的索引
          if (index === -1) {
            // 如果当前模型不在收藏列表中，根据方向选择
            index = direction === 1 ? 0 : favorites.length - 1
          } else {
            // 在收藏列表中移动
            index += direction
            // 处理边界，实现循环
            if (index < 0) index = favorites.length - 1
            if (index >= favorites.length) index = 0
          }

          const next = favorites[index] // 获取下一个收藏模型
          if (!next) return // 如果无效，直接返回

          // 设置当前智能体的模型配置
          setModelStore("model", agent.current().name, { ...next })

          // 更新最近使用列表
          const uniq = uniqueBy([next, ...modelStore.recent], (x) => `${x.providerID}/${x.modelID}`)
          if (uniq.length > 10) uniq.pop() // 保持最多 10 个最近使用
          setModelStore(
            "recent",
            uniq.map((x) => ({ providerID: x.providerID, modelID: x.modelID })),
          )
          save() // 保存配置
        },

        /**
         * 设置当前智能体的模型
         *
         * @param model - 要设置的模型配置
         * @param options - 可选配置项
         * @param options.recent - 是否添加到最近使用列表
         */
        set(model: { providerID: string; modelID: string }, options?: { recent?: boolean }) {
          batch(() => {
            // 检查模型是否有效
            if (!isModelValid(model)) {
              toast.show({
                message: `Model ${model.providerID}/${model.modelID} is not valid`,
                variant: "warning",
                duration: 3000,
              })
              return
            }

            // 设置当前智能体的模型
            setModelStore("model", agent.current().name, model)

            // 如果需要，添加到最近使用列表
            if (options?.recent) {
              const uniq = uniqueBy([model, ...modelStore.recent], (x) => `${x.providerID}/${x.modelID}`)
              if (uniq.length > 10) uniq.pop() // 保持最多 10 个最近使用
              setModelStore(
                "recent",
                uniq.map((x) => ({ providerID: x.providerID, modelID: x.modelID })),
              )
              save() // 保存配置
            }
          })
        },

        /**
         * 切换模型的收藏状态
         * 如果已收藏则移除，否则添加
         *
         * @param model - 要切换收藏状态的模型配置
         */
        toggleFavorite(model: { providerID: string; modelID: string }) {
          batch(() => {
            // 检查模型是否有效
            if (!isModelValid(model)) {
              toast.show({
                message: `Model ${model.providerID}/${model.modelID} is not valid`,
                variant: "warning",
                duration: 3000,
              })
              return
            }

            // 检查模型是否已收藏
            const exists = modelStore.favorite.some(
              (x) => x.providerID === model.providerID && x.modelID === model.modelID,
            )

            // 根据当前收藏状态计算新的收藏列表
            const next = exists
              ? modelStore.favorite.filter(
                  // 已收藏，移除
                  (x) => x.providerID !== model.providerID || x.modelID !== model.modelID,
                )
              : [model, ...modelStore.favorite] // 未收藏，添加到列表开头

            // 更新收藏列表
            setModelStore(
              "favorite",
              next.map((x) => ({ providerID: x.providerID, modelID: x.modelID })),
            )
            save() // 保存配置
          })
        },

        /**
         * 模型变体管理
         * 用于管理同一模型的不同变体配置
         */
        variant: {
          /**
           * 获取当前模型的激活变体
           * @returns 当前变体名称，如果未设置则返回 undefined
           */
          current() {
            const m = currentModel()
            if (!m) return undefined
            const key = `${m.providerID}/${m.modelID}` // 构建变体配置键
            return modelStore.variant[key] // 返回变体配置
          },

          /**
           * 获取当前模型可用变体列表
           * @returns 可用变体名称数组
           */
          list() {
            const m = currentModel()
            if (!m) return [] // 如果没有当前模型，返回空数组
            const provider = sync.data.provider.find((x) => x.id === m.providerID)
            const info = provider?.models[m.modelID]
            if (!info?.variants) return [] // 如果没有变体配置，返回空数组
            return Object.keys(info.variants) // 返回变体名称列表
          },

          /**
           * 设置当前模型的变体
           *
           * @param value - 要设置的变体名称，undefined 表示清除变体设置
           */
          set(value: string | undefined) {
            const m = currentModel()
            if (!m) return // 如果没有当前模型，直接返回
            const key = `${m.providerID}/${m.modelID}` // 构建变体配置键
            setModelStore("variant", key, value) // 设置变体配置
            save() // 保存配置
          },

          /**
           * 在变体列表中循环切换
           * 如果当前没有设置变体，切换到第一个变体
           * 如果当前是最后一个变体，清除变体设置
           */
          cycle() {
            const variants = this.list() // 获取可用变体列表
            if (variants.length === 0) return // 如果没有变体，直接返回
            const current = this.current() // 获取当前变体
            if (!current) {
              // 如果没有当前变体，切换到第一个变体
              this.set(variants[0])
              return
            }
            const index = variants.indexOf(current) // 查找当前变体的索引
            if (index === -1 || index === variants.length - 1) {
              // 如果找不到或已是最后一个，清除变体设置
              this.set(undefined)
              return
            }
            // 切换到下一个变体
            this.set(variants[index + 1])
          },
        },
      }
    })

    /**
     * MCP 服务器管理模块
     * 提供 MCP 服务器的启用/禁用状态查询和切换功能
     */
    const mcp = {
      /**
       * 检查 MCP 服务器是否已启用
       *
       * @param name - MCP 服务器名称
       * @returns 如果服务器已连接返回 true
       */
      isEnabled(name: string) {
        const status = sync.data.mcp[name]
        return status?.status === "connected"
      },

      /**
       * 切换 MCP 服务器的启用状态
       *
       * @param name - MCP 服务器名称
       */
      async toggle(name: string) {
        const status = sync.data.mcp[name]
        if (status?.status === "connected") {
          // 如果已连接，断开 MCP 服务器
          await sdk.client.mcp.disconnect({ name })
        } else {
          // 否则，连接 MCP 服务器（处理禁用、失败等状态）
          await sdk.client.mcp.connect({ name })
        }
      },
    }

    // 自动更新模型：当智能体变化时更新模型配置
    createEffect(() => {
      const value = agent.current() // 获取当前智能体
      if (value.model) {
        // 如果智能体配置了模型，检查模型有效性
        if (isModelValid(value.model))
          // 如果模型有效，设置当前模型
          model.set({
            providerID: value.model.providerID,
            modelID: value.model.modelID,
          })
        else
          // 如果模型无效，显示警告提示
          toast.show({
            variant: "warning",
            message: `Agent ${value.name}'s configured model ${value.model.providerID}/${value.model.modelID} is not valid`,
            duration: 3000,
          })
      }
    })

    // 返回包含所有管理模块的最终结果对象
    const result = {
      model, // 模型管理模块
      agent, // 智能体管理模块
      mcp, // MCP 服务器管理模块
    }
    return result
  },
})
