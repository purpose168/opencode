import { BusEvent } from "@/bus/bus-event" // 导入总线事件类，用于定义和创建事件
import z from "zod" // 导入 Zod 库，用于数据验证和类型定义

/**
 * TuiEvent TUI 事件命名空间
 *
 * 功能说明：
 * - 定义 TUI（终端用户界面）相关的事件类型
 * - 使用 Zod 进行数据验证和类型定义
 * - 支持提示追加、命令执行、通知显示等事件
 * - 事件通过总线（Bus）进行分发和监听
 *
 * 使用场景：
 * - 需要在 TUI 界面中触发特定操作时
 * - 需要在不同组件之间传递事件时
 * - 需要验证事件数据类型时
 * - 需要实现事件驱动的架构时
 *
 * 注意事项：
 * - 所有事件都使用 BusEvent.define 方法定义
 * - 事件名称使用点号分隔的命名空间格式
 * - 事件数据使用 Zod 进行验证
 * - 事件通过 SDK 的 event.on 方法监听
 */
export const TuiEvent = {
  // 导出 TUI 事件命名空间
  /**
   * PromptAppend 提示追加事件
   *
   * 功能说明：
   * - 向提示输入框追加文本内容
   * - 用于在 TUI 界面中向提示框添加文本
   * - 可以用于自动填充提示内容
   * - 可以用于实现快捷输入功能
   *
   * 使用场景：
   * - 需要向提示框追加文本时
   * - 需要自动填充提示内容时
   * - 需要实现快捷输入功能时
   * - 需要从外部向 TUI 界面输入文本时
   *
   * 事件属性：
   * - text: 要追加的文本内容（字符串类型）
   */
  PromptAppend: BusEvent.define("tui.prompt.append", z.object({ text: z.string() })), // 定义提示追加事件，验证文本内容为字符串

  /**
   * CommandExecute 命令执行事件
   *
   * 功能说明：
   * - 触发 TUI 命令对话框中的命令执行
   * - 支持预定义的命令列表和自定义命令
   * - 命令执行后会触发相应的操作
   * - 可以通过快捷键或命令对话框触发
   *
   * 使用场景：
   * - 需要执行 TUI 命令时
   * - 需要通过快捷键触发命令时
   * - 需要从外部触发 TUI 命令时
   * - 需要实现自动化操作时
   *
   * 预定义命令列表：
   * - session.list: 切换会话
   * - session.new: 新建会话
   * - session.share: 分享会话
   * - session.interrupt: 中断会话
   * - session.compact: 压缩会话
   * - session.page.up: 向上翻页
   * - session.page.down: 向下翻页
   * - session.half.page.up: 向上翻半页
   * - session.half.page.down: 向下翻半页
   * - session.first: 第一条消息
   * - session.last: 最后一条消息
   * - prompt.clear: 清除提示
   * - prompt.submit: 提交提示
   * - agent.cycle: 循环切换代理
   *
   * 事件属性：
   * - command: 要执行的命令（预定义命令或自定义命令字符串）
   */
  CommandExecute: BusEvent.define(
    // 定义命令执行事件
    "tui.command.execute", // 事件名称
    z.object({
      // 验证事件数据为对象
      command: z.union([
        // 命令可以是预定义枚举或自定义字符串
        z.enum([
          // 预定义命令枚举
          "session.list", // 切换会话
          "session.new", // 新建会话
          "session.share", // 分享会话
          "session.interrupt", // 中断会话
          "session.compact", // 压缩会话
          "session.page.up", // 向上翻页
          "session.page.down", // 向下翻页
          "session.half.page.up", // 向上翻半页
          "session.half.page.down", // 向下翻半页
          "session.first", // 第一条消息
          "session.last", // 最后一条消息
          "prompt.clear", // 清除提示
          "prompt.submit", // 提交提示
          "agent.cycle", // 循环切换代理
        ]),
        z.string(), // 自定义命令字符串
      ]),
    }),
  ),

  /**
   * ToastShow 通知显示事件
   *
   * 功能说明：
   * - 在 TUI 界面中显示通知消息
   * - 支持多种通知类型（信息、成功、警告、错误）
   * - 可以设置通知的显示时长
   * - 可以设置通知的标题和消息内容
   *
   * 使用场景：
   * - 需要向用户显示信息时
   * - 需要显示操作结果时
   * - 需要显示错误或警告时
   * - 需要显示成功提示时
   *
   * 通知类型：
   * - info: 信息通知（蓝色）
   * - success: 成功通知（绿色）
   * - warning: 警告通知（黄色）
   * - error: 错误通知（红色）
   *
   * 事件属性：
   * - title: 可选的通知标题（字符串类型）
   * - message: 通知消息内容（字符串类型，必需）
   * - variant: 通知类型（枚举：info、success、warning、error）
   * - duration: 可选的通知显示时长（毫秒，默认 5000 毫秒）
   */
  ToastShow: BusEvent.define(
    // 定义通知显示事件
    "tui.toast.show", // 事件名称
    z.object({
      // 验证事件数据为对象
      title: z.string().optional(), // 可选的通知标题（字符串类型）
      message: z.string(), // 通知消息内容（字符串类型，必需）
      variant: z.enum(["info", "success", "warning", "error"]), // 通知类型（枚举：info、success、warning、error）
      duration: z.number().default(5000).optional().describe("Duration in milliseconds"), // 可选的通知显示时长（毫秒，默认 5000 毫秒）
    }),
  ),
}
