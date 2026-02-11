import { Global } from "@/global" // 全局配置对象，提供项目级别的配置信息（如路径配置等）
import { createSignal, type Setter } from "solid-js" // Solid.js 核心函数和类型
// - createSignal：创建响应式信号，用于管理简单的状态值
// - type Setter：信号设置器的类型定义，用于更新信号值的函数类型
import path from "path" // Node.js 路径处理模块，用于处理文件路径的拼接和解析
import { createStore } from "solid-js/store" // Solid.js 状态管理：创建响应式 store，用于管理复杂的状态对象
import { createSimpleContext } from "./helper" // 从 helper 模块导入创建简单上下文的方法，用于快速创建 Solid.js 上下文

// 创建键值存储上下文提供者
// 使用 createSimpleContext 工具函数快速创建一个键值存储管理上下文
// 这个上下文用于在整个应用组件树中管理持久化的键值对数据
// 数据会从 kv.json 文件中加载，并在更改时自动保存回文件
//
// 返回值包含两个主要部分：
// - use: 用于在子组件中获取键值存储操作函数的钩子函数
// - provider: 用于在父组件中提供键值存储上下文的组件
export const { use: useKV, provider: KVProvider } = createSimpleContext({
  name: "KV", // 上下文的名称，用于调试和错误提示
  init: () => {
    // 创建就绪状态信号
    // 用于跟踪键值存储是否已经完成初始化（从文件加载数据）
    const [ready, setReady] = createSignal(false)

    // 创建键值存储的响应式 store
    // 使用 Record<string, any> 类型定义，允许存储任意类型的键值对数据
    // 这个 store 会自动追踪所有键值的变化，并触发相关组件的重新渲染
    const [kvStore, setKvStore] = createStore<Record<string, any>>()

    // 构建键值存储文件的完整路径
    // 使用全局配置中的状态目录路径拼接 kv.json 文件名
    // 这个文件用于持久化存储所有的键值对数据
    const file = Bun.file(path.join(Global.Path.state, "kv.json"))

    // 异步加载键值存储数据
    // 从 kv.json 文件中读取数据并初始化 store
    file
      .json() // 读取文件并解析为 JSON 对象
      .then((x) => {
        // 数据加载成功后，更新 store 的值
        setKvStore(x)
      })
      .catch(() => {
        // 如果加载失败（如文件不存在），静默忽略错误
        // store 将保持为空对象，不影响应用正常运行
      })
      .finally(() => {
        // 无论成功或失败，都将就绪状态设置为 true
        // 表示初始化过程已完成，可以开始提供键值存储服务
        setReady(true)
      })

    // 创建结果对象，包含所有键值存储的操作方法
    const result = {
      /**
       * 获取键值存储的就绪状态
       * 这是一个 getter 属性，反映数据是否已经从文件加载完成
       *
       * @returns 如果数据已加载完成返回 true，否则返回 false
       */
      get ready() {
        return ready()
      },

      /**
       * 创建命名的信号对（getter 和 setter）
       * 这是一个便捷方法，用于创建与特定键关联的响应式信号
       * 当键不存在时，会使用默认值初始化该键
       *
       * @template T - 值的类型参数
       * @param name - 键名，用于标识要操作的键值对
       * @param defaultValue - 默认值，如果键不存在时使用此值初始化
       * @returns 包含 getter 函数和 setter 函数的元组，可以用于 Solid.js 的 useSignal 等场景
       */
      signal<T>(name: string, defaultValue: T) {
        // 如果键不存在于 store 中，使用默认值初始化该键
        if (!kvStore[name]) setKvStore(name, defaultValue)

        // 返回一个包含 getter 和 setter 的元组
        // getter 函数用于获取当前值
        // setter 函数用于更新值（支持直接值或函数式更新）
        return [
          function () {
            // 获取函数：返回指定键的当前值
            return result.get(name)
          },
          function setter(next: Setter<T>) {
            // 设置函数：更新指定键的值
            result.set(name, next)
          },
        ] as const
      },

      /**
       * 获取指定键的值
       * 如果键不存在，返回提供的默认值（如果未提供默认值则返回 undefined）
       *
       * @param key - 要获取值的键名
       * @param defaultValue - 可选的默认值，当键不存在时返回此值
       * @returns 键对应的值，如果键不存在则返回默认值或 undefined
       */
      get(key: string, defaultValue?: any) {
        // 使用空值合并运算符，如果 kvStore[key] 为 null 或 undefined，则使用默认值
        return kvStore[key] ?? defaultValue
      },

      /**
       * 设置指定键的值
       * 更新 store 中的值，并将更改持久化保存到 kv.json 文件
       *
       * @param key - 要设置的键名
       * @param value - 要设置的值，可以是任意类型
       */
      set(key: string, value: any) {
        // 更新 store 中的值，触发响应式更新
        setKvStore(key, value)
        // 将整个 store 序列化为 JSON 字符串并写入文件
        // 使用 2 空格缩进使 JSON 文件具有良好的可读性
        Bun.write(file, JSON.stringify(kvStore, null, 2))
      },
    }

    // 返回结果对象，包含所有键值存储的操作方法
    // 这个对象将在整个应用组件树中共享，提供统一的键值存储访问接口
    return result
  },
})
