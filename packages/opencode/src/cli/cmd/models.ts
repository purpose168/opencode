import { EOL } from "os" // 导入操作系统换行符常量
import type { Argv } from "yargs" // 导入 yargs 的 Argv 类型定义
import { Instance } from "../../project/instance" // 导入实例管理模块
import { ModelsDev } from "../../provider/models" // 导入模型开发模块
import { Provider } from "../../provider/provider" // 导入提供者模块
import { UI } from "../ui" // 导入 UI 工具
import { cmd } from "./cmd" // 导入命令创建工具

/**
 * ModelsCommand 模型命令定义
 *
 * 功能说明：
 * - 定义 "models" 命令，用于列出所有可用的模型
 * - 支持按提供者（provider）筛选模型
 * - 支持详细输出模式（包含元数据如成本）
 * - 支持刷新模型缓存
 *
 * 使用场景：
 * - 需要查看所有可用模型时
 * - 需要查看特定提供者的模型时
 * - 需要查看模型的详细信息（如成本）时
 * - 需要刷新模型缓存时
 *
 * 命令格式：
 * - opencode models
 * - opencode models <provider>
 * - opencode models --verbose
 * - opencode models --refresh
 *
 * 参数说明：
 * - provider（可选参数）：提供者 ID，用于筛选模型
 * - --verbose（可选选项）：使用更详细的模型输出（包含元数据如成本）
 * - --refresh（可选选项）：从 models.dev 刷新模型缓存
 *
 * 输出格式：
 * - 默认格式：provider/modelID（每行一个）
 * - 详细格式：provider/modelID + 模型元数据（JSON 格式）
 *
 * 注意事项：
 * - 使用 Instance.provide 初始化应用环境
 * - 提供者按字母顺序排序（opencode 提供者优先）
 * - 模型按字母顺序排序
 * - 使用 process.stdout.write 直接输出到标准输出
 */
export const ModelsCommand = cmd({
  // 导出模型命令定义
  command: "models [provider]", // 命令名称和位置参数
  describe: "列出所有可用模型", // 命令描述：列出所有可用模型
  builder: (yargs: Argv) => {
    // 命令构建器
    return yargs
      .positional("provider", {
        // 定义位置参数 "provider"
        describe: "用于筛选模型的提供者 ID", // 参数描述：用于筛选模型的提供者 ID
        type: "string", // 参数类型：字符串
        array: false, // 是否为数组：否
      })
      .option("verbose", {
        // 定义选项 "verbose"
        describe: "使用更详细的模型输出（包含元数据如成本）", // 选项描述：使用更详细的模型输出（包含元数据如成本）
        type: "boolean", // 选项类型：布尔值
      })
      .option("refresh", {
        // 定义选项 "refresh"
        describe: "从 models.dev 刷新模型缓存", // 选项描述：从 models.dev 刷新模型缓存
        type: "boolean", // 选项类型：布尔值
      })
  },
  handler: async (args) => {
    // 命令处理函数，异步执行
    if (args.refresh) {
      // 如果需要刷新缓存
      await ModelsDev.refresh() // 刷新模型缓存
      UI.println(UI.Style.TEXT_SUCCESS_BOLD + "模型缓存已刷新" + UI.Style.TEXT_NORMAL) // 显示成功消息
    }

    await Instance.provide({
      // 初始化应用环境
      directory: process.cwd(), // 在当前目录中执行
      async fn() {
        // 异步执行函数
        const providers = await Provider.list() // 获取所有提供者

        function printModels(providerID: string, verbose?: boolean) {
          // 打印模型的函数
          const provider = providers[providerID] // 获取指定提供者
          const sortedModels = Object.entries(provider.models).sort(([a], [b]) => a.localeCompare(b)) // 按字母顺序排序模型
          for (const [modelID, model] of sortedModels) {
            // 遍历所有模型
            process.stdout.write(`${providerID}/${modelID}`) // 输出提供者/模型ID
            process.stdout.write(EOL) // 输出换行符
            if (verbose) {
              // 如果需要详细输出
              process.stdout.write(JSON.stringify(model, null, 2)) // 输出模型元数据（JSON 格式，缩进 2 个空格）
              process.stdout.write(EOL) // 输出换行符
            }
          }
        }

        if (args.provider) {
          // 如果指定了提供者
          const provider = providers[args.provider] // 获取指定提供者
          if (!provider) {
            // 如果提供者不存在
            UI.error(`未找到提供者：${args.provider}`) // 显示错误消息
            return // 返回
          }

          printModels(args.provider, args.verbose) // 打印指定提供者的模型
          return // 返回
        }

        const providerIDs = Object.keys(providers).sort((a, b) => {
          // 对提供者 ID 进行排序
          const aIsOpencode = a.startsWith("opencode") // 判断 a 是否为 opencode 提供者
          const bIsOpencode = b.startsWith("opencode") // 判断 b 是否为 opencode 提供者
          if (aIsOpencode && !bIsOpencode) return -1 // 如果 a 是 opencode 而 b 不是，a 排在前面
          if (!aIsOpencode && bIsOpencode) return 1 // 如果 b 是 opencode 而 a 不是，b 排在前面
          return a.localeCompare(b) // 否则按字母顺序排序
        })

        for (const providerID of providerIDs) {
          // 遍历所有提供者
          printModels(providerID, args.verbose) // 打印每个提供者的模型
        }
      },
    })
  },
})
