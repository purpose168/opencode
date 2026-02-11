import type { Argv } from "yargs"
import { Instance } from "../../project/instance"
import { Project } from "../../project/project"
import { Session } from "../../session"
import { Storage } from "../../storage/storage"
import { bootstrap } from "../bootstrap"
import { cmd } from "./cmd"

// 会话统计信息接口，定义了统计数据的结构
interface SessionStats {
  totalSessions: number // 总会话数
  totalMessages: number // 总消息数
  totalCost: number // 总成本
  totalTokens: {
    // 令牌统计
    input: number // 输入令牌数
    output: number // 输出令牌数
    reasoning: number // 推理令牌数
    cache: {
      // 缓存令牌统计
      read: number // 缓存读取令牌数
      write: number // 缓存写入令牌数
    }
  }
  toolUsage: Record<string, number> // 工具使用情况，键为工具名，值为使用次数
  modelUsage: Record<
    // 模型使用情况
    string,
    {
      messages: number // 该模型的消息数
      tokens: {
        input: number // 该模型的输入令牌数
        output: number // 该模型的输出令牌数
      }
      cost: number // 该模型的总成本
    }
  >
  dateRange: {
    // 时间范围
    earliest: number // 最早时间戳
    latest: number // 最晚时间戳
  }
  days: number // 统计天数
  costPerDay: number // 日均成本
  tokensPerSession: number // 平均每会话令牌数
  medianTokensPerSession: number // 中位数每会话令牌数
}

// 导出统计命令
export const StatsCommand = cmd({
  command: "stats", // 命令名称
  describe: "显示令牌使用量和成本统计信息", // 命令描述
  builder: (yargs: Argv) => {
    // 构建命令行参数
    return yargs
      .option("days", {
        describe: "显示最近N天的统计信息(默认:全部时间)",
        type: "number",
      })
      .option("tools", {
        describe: "显示的工具数量(默认:全部)",
        type: "number",
      })
      .option("models", {
        describe: "显示模型统计信息(默认:隐藏)。传递数字显示前N个,否则显示全部",
      })
      .option("project", {
        describe: "按项目筛选(默认:全部项目,空字符串:当前项目)",
        type: "string",
      })
  },
  handler: async (args) => {
    // 命令处理函数
    await bootstrap(process.cwd(), async () => {
      // 聚合会话统计数据
      const stats = await aggregateSessionStats(args.days, args.project)

      // 确定模型显示限制
      let modelLimit: number | undefined
      if (args.models === true) {
        modelLimit = Infinity // 显示全部模型
      } else if (typeof args.models === "number") {
        modelLimit = args.models // 显示前N个模型
      }

      // 显示统计结果
      displayStats(stats, args.tools, modelLimit)
    })
  },
})

// 获取当前项目信息
async function getCurrentProject(): Promise<Project.Info> {
  return Instance.project
}

// 获取所有会话信息
async function getAllSessions(): Promise<Session.Info[]> {
  const sessions: Session.Info[] = []

  // 列出所有项目键
  const projectKeys = await Storage.list(["project"])
  // 并行读取所有项目信息
  const projects = await Promise.all(projectKeys.map((key) => Storage.read<Project.Info>(key)))

  // 遍历每个项目
  for (const project of projects) {
    if (!project) continue

    // 列出该项目下的所有会话键
    const sessionKeys = await Storage.list(["session", project.id])
    // 并行读取所有会话信息
    const projectSessions = await Promise.all(sessionKeys.map((key) => Storage.read<Session.Info>(key)))

    // 收集有效的会话信息
    for (const session of projectSessions) {
      if (session) {
        sessions.push(session)
      }
    }
  }

  return sessions
}

export async function aggregateSessionStats(days?: number, projectFilter?: string): Promise<SessionStats> {
  const sessions = await getAllSessions()
  const MS_IN_DAY = 24 * 60 * 60 * 1000 // 一天的毫秒数

  const cutoffTime = (() => {
    if (days === undefined) return 0 // 不限制时间
    if (days === 0) {
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      return now.getTime() // 从今天开始
    }
    return Date.now() - days * MS_IN_DAY // 计算截止时间
  })()

  const windowDays = (() => {
    if (days === undefined) return // 全部时间
    if (days === 0) return 1 // 今天
    return days // 指定天数
  })()

  // 根据截止时间筛选会话
  let filteredSessions = cutoffTime > 0 ? sessions.filter((session) => session.time.updated >= cutoffTime) : sessions

  // 根据项目筛选会话
  if (projectFilter !== undefined) {
    if (projectFilter === "") {
      // 空字符串表示当前项目
      const currentProject = await getCurrentProject()
      filteredSessions = filteredSessions.filter((session) => session.projectID === currentProject.id)
    } else {
      // 指定项目ID
      filteredSessions = filteredSessions.filter((session) => session.projectID === projectFilter)
    }
  }

  // 初始化统计对象
  const stats: SessionStats = {
    totalSessions: filteredSessions.length,
    totalMessages: 0,
    totalCost: 0,
    totalTokens: {
      input: 0,
      output: 0,
      reasoning: 0,
      cache: {
        read: 0,
        write: 0,
      },
    },
    toolUsage: {},
    modelUsage: {},
    dateRange: {
      earliest: Date.now(),
      latest: Date.now(),
    },
    days: 0,
    costPerDay: 0,
    tokensPerSession: 0,
    medianTokensPerSession: 0,
  }

  // 大数据集警告
  if (filteredSessions.length > 1000) {
    console.log(`检测到大数据集(${filteredSessions.length}个会话)。这可能需要一些时间...`)
  }

  // 如果没有会话，直接返回
  if (filteredSessions.length === 0) {
    stats.days = windowDays ?? 0
    return stats
  }

  // 初始化时间范围
  let earliestTime = Date.now()
  let latestTime = 0

  // 存储每个会话的总令牌数，用于计算中位数
  const sessionTotalTokens: number[] = []

  // 批量处理会话，避免一次性加载过多数据
  const BATCH_SIZE = 20
  for (let i = 0; i < filteredSessions.length; i += BATCH_SIZE) {
    const batch = filteredSessions.slice(i, i + BATCH_SIZE)

    // 并行处理当前批次中的每个会话
    const batchPromises = batch.map(async (session) => {
      // 获取会话的所有消息
      const messages = await Session.messages({ sessionID: session.id })

      // 初始化会话级别的统计变量
      let sessionCost = 0
      let sessionTokens = { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } }
      let sessionToolUsage: Record<string, number> = {}
      let sessionModelUsage: Record<
        string,
        {
          messages: number
          tokens: {
            input: number
            output: number
          }
          cost: number
        }
      > = {}

      // 遍历每条消息
      for (const message of messages) {
        // 只统计助手消息的成本和令牌
        if (message.info.role === "assistant") {
          sessionCost += message.info.cost || 0

          // 使用提供商ID和模型ID作为唯一键
          const modelKey = `${message.info.providerID}/${message.info.modelID}`
          if (!sessionModelUsage[modelKey]) {
            sessionModelUsage[modelKey] = {
              messages: 0,
              tokens: { input: 0, output: 0 },
              cost: 0,
            }
          }
          sessionModelUsage[modelKey].messages++
          sessionModelUsage[modelKey].cost += message.info.cost || 0

          // 统计令牌使用情况
          if (message.info.tokens) {
            sessionTokens.input += message.info.tokens.input || 0
            sessionTokens.output += message.info.tokens.output || 0
            sessionTokens.reasoning += message.info.tokens.reasoning || 0
            sessionTokens.cache.read += message.info.tokens.cache?.read || 0
            sessionTokens.cache.write += message.info.tokens.cache?.write || 0

            // 模型输出令牌包含输出令牌和推理令牌
            sessionModelUsage[modelKey].tokens.input += message.info.tokens.input || 0
            sessionModelUsage[modelKey].tokens.output +=
              (message.info.tokens.output || 0) + (message.info.tokens.reasoning || 0)
          }
        }

        // 统计工具使用情况
        for (const part of message.parts) {
          if (part.type === "tool" && part.tool) {
            sessionToolUsage[part.tool] = (sessionToolUsage[part.tool] || 0) + 1
          }
        }
      }

      // 返回会话的统计结果
      return {
        messageCount: messages.length,
        sessionCost,
        sessionTokens,
        sessionTotalTokens: sessionTokens.input + sessionTokens.output + sessionTokens.reasoning,
        sessionToolUsage,
        sessionModelUsage,
        earliestTime: cutoffTime > 0 ? session.time.updated : session.time.created,
        latestTime: session.time.updated,
      }
    })

    // 等待当前批次的所有会话处理完成
    const batchResults = await Promise.all(batchPromises)

    // 聚合批次结果到总统计中
    for (const result of batchResults) {
      earliestTime = Math.min(earliestTime, result.earliestTime)
      latestTime = Math.max(latestTime, result.latestTime)
      sessionTotalTokens.push(result.sessionTotalTokens)

      stats.totalMessages += result.messageCount
      stats.totalCost += result.sessionCost
      stats.totalTokens.input += result.sessionTokens.input
      stats.totalTokens.output += result.sessionTokens.output
      stats.totalTokens.reasoning += result.sessionTokens.reasoning
      stats.totalTokens.cache.read += result.sessionTokens.cache.read
      stats.totalTokens.cache.write += result.sessionTokens.cache.write

      // 聚合工具使用统计
      for (const [tool, count] of Object.entries(result.sessionToolUsage)) {
        stats.toolUsage[tool] = (stats.toolUsage[tool] || 0) + count
      }

      // 聚合模型使用统计
      for (const [model, usage] of Object.entries(result.sessionModelUsage)) {
        if (!stats.modelUsage[model]) {
          stats.modelUsage[model] = {
            messages: 0,
            tokens: { input: 0, output: 0 },
            cost: 0,
          }
        }
        stats.modelUsage[model].messages += usage.messages
        stats.modelUsage[model].tokens.input += usage.tokens.input
        stats.modelUsage[model].tokens.output += usage.tokens.output
        stats.modelUsage[model].cost += usage.cost
      }
    }
  }

  // 计算时间范围
  const rangeDays = Math.max(1, Math.ceil((latestTime - earliestTime) / MS_IN_DAY))
  const effectiveDays = windowDays ?? rangeDays
  stats.dateRange = {
    earliest: earliestTime,
    latest: latestTime,
  }
  stats.days = effectiveDays
  stats.costPerDay = stats.totalCost / effectiveDays

  // 计算平均每会话令牌数
  const totalTokens = stats.totalTokens.input + stats.totalTokens.output + stats.totalTokens.reasoning
  stats.tokensPerSession = filteredSessions.length > 0 ? totalTokens / filteredSessions.length : 0

  // 计算中位数每会话令牌数
  sessionTotalTokens.sort((a, b) => a - b)
  const mid = Math.floor(sessionTotalTokens.length / 2)
  stats.medianTokensPerSession =
    sessionTotalTokens.length === 0
      ? 0
      : sessionTotalTokens.length % 2 === 0
        ? (sessionTotalTokens[mid - 1] + sessionTotalTokens[mid]) / 2
        : sessionTotalTokens[mid]

  return stats
}

// 显示统计信息函数
// 参数:
//   stats - 会话统计数据对象
//   toolLimit - 显示的工具数量限制(可选)
//   modelLimit - 显示的模型数量限制(可选)
export function displayStats(stats: SessionStats, toolLimit?: number, modelLimit?: number) {
  const width = 56 // 表格宽度

  // 渲染表格行的辅助函数
  // 参数:
  //   label - 标签文本
  //   value - 值文本
  // 返回格式化后的行字符串
  function renderRow(label: string, value: string): string {
    const availableWidth = width - 1 // 可用宽度(减去边框)
    const paddingNeeded = availableWidth - label.length - value.length // 计算需要的填充空格数
    const padding = Math.max(0, paddingNeeded) // 确保填充不为负数
    return `│${label}${" ".repeat(padding)}${value} │` // 返回格式化的行
  }

  // 显示概览部分
  console.log("┌────────────────────────────────────────────────────────┐")
  console.log("│                       概览                               │")
  console.log("├────────────────────────────────────────────────────────┤")
  console.log(renderRow("会话数", stats.totalSessions.toLocaleString()))
  console.log(renderRow("消息数", stats.totalMessages.toLocaleString()))
  console.log(renderRow("天数", stats.days.toString()))
  console.log("└────────────────────────────────────────────────────────┘")
  console.log()

  // 显示成本与令牌部分
  console.log("┌────────────────────────────────────────────────────────┐")
  console.log("│                    成本与令牌                           │")
  console.log("├────────────────────────────────────────────────────────┤")
  const cost = isNaN(stats.totalCost) ? 0 : stats.totalCost // 处理无效的总成本
  const costPerDay = isNaN(stats.costPerDay) ? 0 : stats.costPerDay // 处理无效的日均成本
  const tokensPerSession = isNaN(stats.tokensPerSession) ? 0 : stats.tokensPerSession // 处理无效的每会话令牌数
  console.log(renderRow("总成本", `$${cost.toFixed(2)}`))
  console.log(renderRow("日均成本", `$${costPerDay.toFixed(2)}`))
  console.log(renderRow("平均令牌/会话", formatNumber(Math.round(tokensPerSession))))
  const medianTokensPerSession = isNaN(stats.medianTokensPerSession) ? 0 : stats.medianTokensPerSession // 处理无效的中位数
  console.log(renderRow("中位数令牌/会话", formatNumber(Math.round(medianTokensPerSession))))
  console.log(renderRow("输入令牌", formatNumber(stats.totalTokens.input)))
  console.log(renderRow("输出令牌", formatNumber(stats.totalTokens.output)))
  console.log(renderRow("缓存读取", formatNumber(stats.totalTokens.cache.read)))
  console.log(renderRow("缓存写入", formatNumber(stats.totalTokens.cache.write)))
  console.log("└────────────────────────────────────────────────────────┘")
  console.log()

  // 显示模型使用情况(如果设置了限制且有数据)
  if (modelLimit !== undefined && Object.keys(stats.modelUsage).length > 0) {
    // 按消息数降序排序模型
    const sortedModels = Object.entries(stats.modelUsage).sort(([, a], [, b]) => b.messages - a.messages)
    // 根据限制筛选要显示的模型
    const modelsToDisplay = modelLimit === Infinity ? sortedModels : sortedModels.slice(0, modelLimit)

    console.log("┌────────────────────────────────────────────────────────┐")
    console.log("│                      模型使用                           │")
    console.log("├────────────────────────────────────────────────────────┤")

    // 遍历显示每个模型的详细信息
    for (const [model, usage] of modelsToDisplay) {
      console.log(`│ ${model.padEnd(54)} │`)
      console.log(renderRow("  消息数", usage.messages.toLocaleString()))
      console.log(renderRow("  输入令牌", formatNumber(usage.tokens.input)))
      console.log(renderRow("  输出令牌", formatNumber(usage.tokens.output)))
      console.log(renderRow("  成本", `$${usage.cost.toFixed(4)}`))
      console.log("├────────────────────────────────────────────────────────┤")
    }
    // 向上移动光标一行，用底部边框替换最后一个分隔线
    process.stdout.write("\x1B[1A")
    console.log("└────────────────────────────────────────────────────────┘")
  }
  console.log()

  // 显示工具使用情况(如果有数据)
  if (Object.keys(stats.toolUsage).length > 0) {
    // 按使用次数降序排序工具
    const sortedTools = Object.entries(stats.toolUsage).sort(([, a], [, b]) => b - a)
    // 根据限制筛选要显示的工具
    const toolsToDisplay = toolLimit ? sortedTools.slice(0, toolLimit) : sortedTools

    console.log("┌────────────────────────────────────────────────────────┐")
    console.log("│                      工具使用                           │")
    console.log("├────────────────────────────────────────────────────────┤")

    const maxCount = Math.max(...toolsToDisplay.map(([, count]) => count)) // 获取最大使用次数
    const totalToolUsage = Object.values(stats.toolUsage).reduce((a, b) => a + b, 0) // 计算总使用次数

    // 遍历显示每个工具的使用情况
    for (const [tool, count] of toolsToDisplay) {
      const barLength = Math.max(1, Math.floor((count / maxCount) * 20)) // 计算条形长度(最大20)
      const bar = "█".repeat(barLength) // 生成条形图
      const percentage = ((count / totalToolUsage) * 100).toFixed(1) // 计算百分比

      const maxToolLength = 18 // 工具名称最大长度
      const truncatedTool = tool.length > maxToolLength ? tool.substring(0, maxToolLength - 2) + ".." : tool // 截断过长的工具名
      const toolName = truncatedTool.padEnd(maxToolLength) // 填充工具名到固定长度

      const content = ` ${toolName} ${bar.padEnd(20)} ${count.toString().padStart(3)} (${percentage.padStart(4)}%)`
      const padding = Math.max(0, width - content.length - 1) // 计算填充空格
      console.log(`│${content}${" ".repeat(padding)} │`)
    }
    console.log("└────────────────────────────────────────────────────────┘")
  }
  console.log()
}

// 格式化数字函数，将大数字转换为更易读的格式
// 参数:
//   num - 要格式化的数字
// 返回: 格式化后的字符串(如: 1.5M, 2.3K, 123)
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M" // 百万级别，显示为M
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K" // 千级别，显示为K
  }
  return num.toString() // 小于1000，直接显示
}
