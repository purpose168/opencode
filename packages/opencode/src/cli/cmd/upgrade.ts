import * as prompts from "@clack/prompts" // 导入提示工具
import type { Argv } from "yargs" // 导入yargs的类型定义
import { Installation } from "../../installation" // 导入安装管理模块
import { UI } from "../ui" // 导入UI工具

// 升级命令定义
export const UpgradeCommand = {
  command: "upgrade [target]", // 命令名称，支持可选的目标版本参数
  describe: "升级OpenCode到最新版本或指定版本", // 命令描述
  builder: (yargs: Argv) => {
    return yargs
      .positional("target", {
        describe: "要升级到的版本，例如 '0.1.48' 或 'v0.1.48'", // 位置参数描述
        type: "string",
      })
      .option("method", {
        alias: "m", // 参数别名
        describe: "使用的安装方式", // 参数描述
        type: "string",
        choices: ["curl", "npm", "pnpm", "bun", "brew"], // 可选的安装方式
      })
  },
  // 命令处理函数
  handler: async (args: { target?: string; method?: string }) => {
    UI.empty() // 清空UI
    UI.println(UI.logo("  ")) // 打印logo
    UI.empty() // 清空UI
    prompts.intro("升级") // 显示升级提示
    const detectedMethod = await Installation.method() // 检测安装方式
    const method = (args.method as Installation.Method) ?? detectedMethod // 使用指定的安装方式或检测到的安装方式

    // 处理未知安装方式的情况
    if (method === "unknown") {
      prompts.log.error(`OpenCode已安装到 ${process.execPath}，可能由包管理器管理`) // 错误提示
      const install = await prompts.select({
        message: "仍然安装？", // 提示信息
        options: [
          { label: "是", value: true },
          { label: "否", value: false },
        ],
        initialValue: false,
      })
      if (!install) {
        prompts.outro("完成") // 结束提示
        return
      }
    }

    prompts.log.info("使用方式: " + method) // 显示使用的安装方式
    const target = args.target ? args.target.replace(/^v/, "") : await Installation.latest() // 获取目标版本

    // 检查是否已经是最新版本
    if (Installation.VERSION === target) {
      prompts.log.warn(`OpenCode升级已跳过: ${target} 已经安装`) // 警告提示
      prompts.outro("完成") // 结束提示
      return
    }

    prompts.log.info(`从 ${Installation.VERSION} 升级到 ${target}`) // 显示升级信息
    const spinner = prompts.spinner()
    spinner.start("正在升级...") // 启动加载动画
    const err = await Installation.upgrade(method, target).catch((err) => err) // 执行升级

    // 处理升级错误
    if (err) {
      spinner.stop("升级失败", 1) // 停止加载动画
      if (err instanceof Installation.UpgradeFailedError)
        prompts.log.error(err.data.stderr) // 显示错误信息
      else if (err instanceof Error) prompts.log.error(err.message) // 显示错误信息
      prompts.outro("完成") // 结束提示
      return
    }

    spinner.stop("升级完成") // 停止加载动画
    prompts.outro("完成") // 结束提示
  },
}
