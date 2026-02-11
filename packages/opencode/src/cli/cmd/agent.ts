import * as prompts from "@clack/prompts" // 导入交互式提示工具，用于用户输入和选择
import fs from "fs/promises" // 导入文件系统操作模块，用于文件和目录操作
import matter from "gray-matter" // 导入前置元数据处理模块，用于解析和生成 Markdown 文件的 frontmatter
import { EOL } from "os" // 导入操作系统换行符，用于跨平台换行处理
import path from "path" // 导入路径处理模块，用于解析和拼接文件路径
import type { Argv } from "yargs" // 导入命令行参数类型定义
import { Agent } from "../../agent/agent" // 导入智能体模块，用于生成和管理智能体配置
import { Global } from "../../global" // 导入全局配置模块，用于访问全局配置路径
import { Instance } from "../../project/instance" // 导入项目实例模块，用于访问项目配置和工作目录
import { Provider } from "../../provider/provider" // 导入提供商模块，用于解析模型格式
import { UI } from "../ui" // 导入 UI 工具，用于显示错误信息和处理取消操作
import { cmd } from "./cmd" // 导入命令创建工具，用于定义 CLI 命令

/**
 * AgentMode 智能体模式类型定义
 *
 * 功能说明：
 * - 定义智能体的三种运行模式
 * - all: 通用模式，可以同时作为主智能体和子智能体使用
 * - primary: 主智能体模式，作为主要/主智能体运行
 * - subagent: 子智能体模式，可以被其他智能体作为子智能体调用
 *
 * 使用场景：
 * - 需要定义智能体的运行角色时
 * - 需要限制智能体的功能范围时
 * - 需要构建智能体层次结构时
 */
type AgentMode = "all" | "primary" | "subagent" // 定义智能体模式类型

/**
 * AVAILABLE_TOOLS 可用工具列表常量
 *
 * 功能说明：
 * - 定义所有可用的智能体工具名称
 * - 用于工具选择和配置
 * - 可以通过命令行参数指定要启用的工具
 *
 * 工具说明：
 * - bash: 执行 bash 命令
 * - read: 读取文件内容
 * - write: 写入文件内容
 * - edit: 编辑文件内容
 * - list: 列出目录内容
 * - glob: 使用 glob 模式查找文件
 * - grep: 搜索文件内容
 * - webfetch: 获取网页内容
 * - task: 执行任务
 * - todowrite: 写入待办事项
 * - todoread: 读取待办事项
 */
const AVAILABLE_TOOLS = [
  // 定义可用工具列表
  "bash", // 执行 bash 命令
  "read", // 读取文件内容
  "write", // 写入文件内容
  "edit", // 编辑文件内容
  "list", // 列出目录内容
  "glob", // 使用 glob 模式查找文件
  "grep", // 搜索文件内容
  "webfetch", // 获取网页内容
  "task", // 执行任务
  "todowrite", // 写入待办事项
  "todoread", // 读取待办事项
]

/**
 * AgentCreateCommand 创建智能体命令定义
 *
 * 功能说明：
 * - 定义 "create" 命令，用于创建新的智能体配置文件
 * - 支持通过命令行参数指定智能体路径、描述、模式和工具
 * - 支持交互式输入，用户可以通过提示输入智能体信息
 * - 使用 LLM 生成智能体配置（系统提示词）
 * - 支持选择智能体模式（all、primary、subagent）
 * - 支持选择要启用的工具
 * - 自动创建智能体配置文件（Markdown 格式，包含 frontmatter）
 * - 支持全局和项目级别的智能体
 *
 * 使用场景：
 * - 需要创建新的智能体时
 * - 需要定义特定功能的智能体时
 * - 需要配置智能体工具和模式时
 * - 需要在全局或项目中添加智能体时
 *
 * 命令格式：
 * - opencode agent create [--path <directory>] [--description <text>] [--mode <mode>] [--tools <tools>] [--model <model>]
 * - 示例：opencode agent create --path ~/agents --description "代码审查智能体" --mode primary --tools bash,read,write
 *
 * 参数说明：
 * - path: 智能体文件生成目录（可选参数）
 * - description: 智能体描述（可选参数），说明智能体应该做什么
 * - mode: 智能体模式（可选参数），可选值：all、primary、subagent
 * - tools: 启用的工具列表（可选参数），逗号分隔，默认启用所有工具
 * - model: 使用的模型（可选参数），格式为 provider/model，别名为 -m
 *
 * 工作流程：
 * 1. 解析命令行参数
 * 2. 判断是否为完全非交互模式（所有参数都已指定）
 * 3. 确定智能体文件路径（全局或项目级别）
 * 4. 获取智能体描述（命令行参数或交互式输入）
 * 5. 使用 LLM 生成智能体配置
 * 6. 选择要启用的工具（命令行参数或交互式选择）
 * 7. 选择智能体模式（命令行参数或交互式选择）
 * 8. 构建工具配置
 * 9. 构建前置元数据（frontmatter）
 * 10. 写入智能体配置文件
 * 11. 显示成功消息或文件路径
 *
 * 注意事项：
 * - 如果文件已存在，会提示错误并退出（非交互模式）或显示错误消息（交互模式）
 * - 使用 gray-matter 生成 frontmatter 格式的 Markdown 文件
 * - 智能体配置包含描述、模式、工具等信息
 * - 支持指定模型来生成智能体配置
 */
const AgentCreateCommand = cmd({
  // 导出创建智能体命令定义
  command: "create", // 命令名称
  describe: "创建新的智能体", // 命令描述：创建新的智能体
  builder: (
    yargs: Argv, // 命令构建器，用于定义命令参数和选项
  ) =>
    yargs
      .option("path", {
        // 定义选项 path
        type: "string", // 选项类型为字符串
        describe: "生成智能体文件的目录路径", // 选项描述：生成智能体文件的目录路径
      })
      .option("description", {
        // 定义选项 description
        type: "string", // 选项类型为字符串
        describe: "智能体应该做什么", // 选项描述：智能体应该做什么
      })
      .option("mode", {
        // 定义选项 mode
        type: "string", // 选项类型为字符串
        describe: "智能体模式", // 选项描述：智能体模式
        choices: ["all", "primary", "subagent"] as const, // 可选值：all、primary、subagent
      })
      .option("tools", {
        // 定义选项 tools
        type: "string", // 选项类型为字符串
        describe: `启用的工具列表，逗号分隔（默认：全部）。可用工具："${AVAILABLE_TOOLS.join(", ")}"`, // 选项描述：启用的工具列表，逗号分隔（默认：全部）
      })
      .option("model", {
        // 定义选项 model
        type: "string", // 选项类型为字符串
        alias: ["m"], // 选项别名为 -m
        describe: "要使用的模型，格式为 provider/model", // 选项描述：要使用的模型，格式为 provider/model
      }),
  async handler(args) {
    // 命令处理函数，异步执行
    await Instance.provide({
      // 使用项目实例管理器提供项目上下文
      directory: process.cwd(), // 设置工作目录为当前目录
      async fn() {
        // 定义异步执行函数
        const cliPath = args.path // 获取命令行参数中的路径
        const cliDescription = args.description // 获取命令行参数中的描述
        const cliMode = args.mode as AgentMode | undefined // 获取命令行参数中的模式
        const cliTools = args.tools // 获取命令行参数中的工具列表

        const isFullyNonInteractive = cliPath && cliDescription && cliMode && cliTools !== undefined // 判断是否为完全非交互模式（所有参数都已指定）

        if (!isFullyNonInteractive) {
          // 如果不是完全非交互模式
          UI.empty() // 清空 UI
          prompts.intro("Create agent") // 显示欢迎信息
        }

        const project = Instance.project // 获取项目实例

        // Determine scope/path 确定作用域/路径
        let targetPath: string // 定义目标路径变量
        if (cliPath) {
          // 如果指定了命令行路径
          targetPath = path.join(cliPath, "agent") // 使用命令行路径，拼接 agent 子目录
        } else {
          // 如果没有指定命令行路径
          let scope: "global" | "project" = "global" // 定义作用域变量，默认为全局
          if (project.vcs === "git") {
            // 如果项目使用 Git 版本控制
            const scopeResult = await prompts.select({
              // 显示选择提示
              message: "位置", // 提示消息
              options: [
                // 选项列表
                {
                  label: "当前项目", // 选项标签
                  value: "project" as const, // 选项值
                  hint: Instance.worktree, // 选项提示：工作树路径
                },
                {
                  label: "全局", // 选项标签
                  value: "global" as const, // 选项值
                  hint: Global.Path.config, // 选项提示：全局配置路径
                },
              ],
            })
            if (prompts.isCancel(scopeResult)) throw new UI.CancelledError() // 如果用户取消，抛出取消错误
            scope = scopeResult // 设置作用域
          }
          targetPath = path.join(
            // 拼接目标路径
            scope === "global" ? Global.Path.config : path.join(Instance.worktree, ".opencode"), // 根据作用域选择全局或项目路径
            "agent", // 拼接 agent 子目录
          )
        }

        // Get description 获取描述
        let description: string // 定义描述变量
        if (cliDescription) {
          // 如果指定了命令行描述
          description = cliDescription // 使用命令行描述
        } else {
          // 如果没有指定命令行描述
          const query = await prompts.text({
            // 显示文本输入提示
            message: "描述", // 提示消息
            placeholder: "这个智能体应该做什么？", // 占位符文本
            validate: (x) => (x && x.length > 0 ? undefined : "必填"), // 验证输入，不能为空
          })
          if (prompts.isCancel(query)) throw new UI.CancelledError() // 如果用户取消，抛出取消错误
          description = query // 设置描述
        }

        // Generate agent 生成智能体
        const spinner = prompts.spinner() // 创建加载动画
        spinner.start("正在生成智能体配置...") // 开始加载动画，显示提示信息
        const model = args.model ? Provider.parseModel(args.model) : undefined // 解析模型参数（如果指定）
        const generated = await Agent.generate({ description, model }).catch((error) => {
          // 生成智能体配置，捕获错误
          spinner.stop(`LLM 生成智能体失败：${error.message}`, 1) // 停止加载动画，显示错误信息
          if (isFullyNonInteractive) process.exit(1) // 如果是非交互模式，退出进程
          throw new UI.CancelledError() // 抛出取消错误
        })
        spinner.stop(`智能体 ${generated.identifier} 已生成`) // 停止加载动画，显示成功信息

        // Select tools 选择工具
        let selectedTools: string[] // 定义选中的工具列表
        if (cliTools !== undefined) {
          // 如果指定了命令行工具列表
          selectedTools = cliTools ? cliTools.split(",").map((t) => t.trim()) : AVAILABLE_TOOLS // 解析逗号分隔的工具列表，或使用所有工具
        } else {
          // 如果没有指定命令行工具列表
          const result = await prompts.multiselect({
            // 显示多选提示
            message: "选择要启用的工具", // 提示消息
            options: AVAILABLE_TOOLS.map((tool) => ({
              // 生成选项列表
              label: tool, // 选项标签
              value: tool, // 选项值
            })),
            initialValues: AVAILABLE_TOOLS, // 初始选中所有工具
          })
          if (prompts.isCancel(result)) throw new UI.CancelledError() // 如果用户取消，抛出取消错误
          selectedTools = result // 设置选中的工具
        }

        // Get mode 获取模式
        let mode: AgentMode // 定义模式变量
        if (cliMode) {
          // 如果指定了命令行模式
          mode = cliMode // 使用命令行模式
        } else {
          // 如果没有指定命令行模式
          const modeResult = await prompts.select({
            // 显示选择提示
            message: "智能体模式", // 提示消息
            options: [
              // 选项列表
              {
                label: "全部", // 选项标签
                value: "all" as const, // 选项值
                hint: "可以同时作为主智能体和子智能体使用", // 选项提示
              },
              {
                label: "主智能体", // 选项标签
                value: "primary" as const, // 选项值
                hint: "作为主要/主智能体运行", // 选项提示
              },
              {
                label: "子智能体", // 选项标签
                value: "subagent" as const, // 选项值
                hint: "可以被其他智能体作为子智能体调用", // 选项提示
              },
            ],
            initialValue: "all" as const, // 初始选中 "all"
          })
          if (prompts.isCancel(modeResult)) throw new UI.CancelledError() // 如果用户取消，抛出取消错误
          mode = modeResult // 设置模式
        }

        // Build tools config 构建工具配置
        const tools: Record<string, boolean> = {} // 定义工具配置对象
        for (const tool of AVAILABLE_TOOLS) {
          // 遍历所有可用工具
          if (!selectedTools.includes(tool)) {
            // 如果工具未被选中
            tools[tool] = false // 设置工具为禁用
          }
        }

        // Build frontmatter 构建前置元数据
        const frontmatter: {
          // 定义前置元数据类型
          description: string // 描述
          mode: AgentMode // 模式
          tools?: Record<string, boolean> // 工具配置（可选）
        } = {
          description: generated.whenToUse, // 使用生成的使用场景描述
          mode, // 设置模式
        }
        if (Object.keys(tools).length > 0) {
          // 如果有工具配置
          frontmatter.tools = tools // 添加工具配置
        }

        // Write file 写入文件
        const content = matter.stringify(generated.systemPrompt, frontmatter) // 使用 gray-matter 生成 Markdown 内容，包含前置元数据
        const filePath = path.join(targetPath, `${generated.identifier}.md`) // 拼接文件路径

        await fs.mkdir(targetPath, { recursive: true }) // 创建目标目录（递归创建）

        const file = Bun.file(filePath) // 获取文件对象
        if (await file.exists()) {
          // 如果文件已存在
          if (isFullyNonInteractive) {
            // 如果是非交互模式
            console.error(`错误：智能体文件已存在：${filePath}`) // 打印错误信息
            process.exit(1) // 退出进程
          }
          prompts.log.error(`智能体文件已存在：${filePath}`) // 显示错误消息
          throw new UI.CancelledError() // 抛出取消错误
        }

        await Bun.write(filePath, content) // 写入文件内容

        if (isFullyNonInteractive) {
          // 如果是非交互模式
          console.log(filePath) // 打印文件路径
        } else {
          // 如果是交互模式
          prompts.log.success(`智能体已创建：${filePath}`) // 显示成功消息
          prompts.outro("完成") // 显示结束语
        }
      },
    })
  },
})

/**
 * AgentListCommand 列出智能体命令定义
 *
 * 功能说明：
 * - 定义 "list" 命令，用于列出所有可用的智能体
 * - 从全局和项目目录中查找智能体配置文件
 * - 显示智能体名称、模式和权限配置
 * - 按原生智能体优先、名称字母顺序排序
 *
 * 使用场景：
 * - 需要查看所有可用智能体时
 * - 需要了解智能体配置时
 * - 需要调试智能体加载问题时
 *
 * 命令格式：
 * - opencode agent list
 *
 * 输出格式：
 * - 每个智能体一行，格式为：智能体名称 (模式)
 * - 下一行显示权限配置（JSON 格式）
 *
 * 工作流程：
 * 1. 初始化项目实例
 * 2. 列出所有可用智能体
 * 3. 按原生智能体优先、名称字母顺序排序
 * 4. 输出智能体信息到标准输出
 *
 * 注意事项：
 * - 原生智能体排在前面
 * - 权限配置以 JSON 格式显示
 * - 使用操作系统换行符确保跨平台兼容性
 */
const AgentListCommand = cmd({
  // 导出列出智能体命令定义
  command: "list", // 命令名称
  describe: "列出所有可用的智能体", // 命令描述：列出所有可用的智能体
  async handler() {
    // 命令处理函数，异步执行
    await Instance.provide({
      // 使用项目实例管理器提供项目上下文
      directory: process.cwd(), // 设置工作目录为当前目录
      async fn() {
        // 定义异步执行函数
        const agents = await Agent.list() // 列出所有可用智能体
        const sortedAgents = agents.sort((a, b) => {
          // 对智能体进行排序
          if (a.native !== b.native) {
            // 如果原生状态不同
            return a.native ? -1 : 1 // 原生智能体排在前面
          }
          return a.name.localeCompare(b.name) // 按名称字母顺序排序
        })

        for (const agent of sortedAgents) {
          // 遍历排序后的智能体列表
          process.stdout.write(`${agent.name} (${agent.mode})` + EOL) // 输出智能体名称和模式
          process.stdout.write(`  ${JSON.stringify(agent.permission, null, 2)}` + EOL) // 输出权限配置（JSON 格式，缩进 2 空格）
        }
      },
    })
  },
})

/**
 * AgentCommand 智能体管理命令定义
 *
 * 功能说明：
 * - 定义 "agent" 命令，用于管理智能体
 * - 包含子命令：create（创建智能体）、list（列出智能体）
 * - 要求必须指定子命令
 *
 * 使用场景：
 * - 需要创建新智能体时
 * - 需要列出所有可用智能体时
 * - 需要管理智能体配置时
 *
 * 命令格式：
 * - opencode agent create [options]
 * - opencode agent list
 *
 * 子命令：
 * - create: 创建新的智能体
 * - list: 列出所有可用的智能体
 *
 * 注意事项：
 * - 必须指定子命令
 * - 使用 demandCommand() 强制要求子命令
 */
export const AgentCommand = cmd({
  // 导出智能体管理命令定义
  command: "agent", // 命令名称
  describe: "管理智能体", // 命令描述：管理智能体
  builder: (yargs) => yargs.command(AgentCreateCommand).command(AgentListCommand).demandCommand(), // 添加子命令并要求必须指定子命令
  async handler() {}, // 空处理函数（子命令会覆盖此函数）
})
