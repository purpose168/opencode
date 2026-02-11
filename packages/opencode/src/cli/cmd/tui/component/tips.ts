// 提示词数据数组
// 这些提示会在 "Did You Know" 组件中随机显示，帮助用户了解 OpenCode 的功能
// 每个字符串代表一个提示，支持使用 {highlight}...{/highlight} 标签来高亮显示关键内容

export const TIPS = [
  // 基础功能提示
  "输入 {highlight}@{/highlight} 后跟文件名，可以模糊搜索并将文件附加到您的提示中。",
  "以 {highlight}!{/highlight} 开头的消息可以直接运行 shell 命令（例如 {highlight}!ls -la{/highlight}）。",
  "按 {highlight}Tab{/highlight} 键在 Build（完整访问）和 Plan（只读）智能体之间切换。",
  "使用 {highlight}/undo{/highlight} 可以恢复上一条消息以及 OpenCode 所做的任何文件更改。",
  "使用 {highlight}/redo{/highlight} 可以还原之前撤销的消息和文件更改。",
  "运行 {highlight}/share{/highlight} 可以在 opencode.ai 创建指向您对话的公开链接。",
  "将图片拖放到终端中，可以将其作为提示的上下文内容。",
  "按 {highlight}Ctrl+V{/highlight} 可以直接从剪贴板粘贴图片到提示中。",
  "按 {highlight}Ctrl+X E{/highlight} 或 {highlight}/editor{/highlight} 可以在外部编辑器中编写消息。",
  "运行 {highlight}/init{/highlight} 可以根据您的代码库结构自动生成项目规则。",

  // 模型和主题切换
  "运行 {highlight}/models{/highlight} 或 {highlight}Ctrl+X M{/highlight} 可以查看和切换可用的 AI 模型。",
  "使用 {highlight}/theme{/highlight} 或 {highlight}Ctrl+X T{/highlight} 可以预览和切换 50+ 个内置主题。",

  // 会话管理
  "按 {highlight}Ctrl+X N{/highlight} 或 {highlight}/new{/highlight} 可以开始新的对话会话。",
  "使用 {highlight}/sessions{/highlight} 或 {highlight}Ctrl+X L{/highlight} 可以列出并继续之前的对话。",
  "运行 {highlight}/compact{/highlight} 可以在接近上下文限制时总结长会话。",
  "按 {highlight}Ctrl+X X{/highlight} 或 {highlight}/export{/highlight} 可以将对话保存为 Markdown 格式。",
  "按 {highlight}Ctrl+X Y{/highlight} 可以将助手最后一条消息复制到剪贴板。",
  "按 {highlight}Ctrl+P{/highlight} 可以查看所有可用的操作和命令。",

  // 提供者连接
  "运行 {highlight}/connect{/highlight} 可以为 75+ 个支持的 LLM 提供者添加 API 密钥。",
  "默认的前导键是 {highlight}Ctrl+X{/highlight}，与其他键组合可以快速执行操作。",

  // 导航和切换
  "按 {highlight}F{/highlight} 键可以在最近使用的模型之间快速切换。",
  "按 {highlight}Ctrl+X B{/highlight} 可以显示/隐藏侧边栏面板。",
  "使用 {highlight}PageUp{/highlight}/{highlight}PageDown{/highlight} 可以在对话历史中导航。",
  "按 {highlight}Ctrl+G{/highlight} 或 {highlight}Home{/highlight} 可以跳转到对话的开头。",
  "按 {highlight}Ctrl+Alt+G{/highlight} 或 {highlight}End{/highlight} 可以跳转到最新的消息。",

  // 输入和编辑
  "按 {highlight}Shift+Enter{/highlight} 或 {highlight}Ctrl+J{/highlight} 可以在提示中换行。",
  "输入时按 {highlight}Ctrl+C{/highlight} 可以清空输入框。",
  "按 {highlight}Escape{/highlight} 可以停止 AI 的中间响应。",

  // 智能体使用
  "切换到 {highlight}Plan{/highlight} 智能体可以在不进行实际更改的情况下获得建议。",
  "在提示中使用 {highlight}@<agent-name>{/highlight} 可以调用专门的子智能体。",
  "按 {highlight}Ctrl+X Right/Left{/highlight} 可以在父会话和子会话之间切换。",

  // 配置文件
  "在项目根目录创建 {highlight}opencode.json{/highlight} 可以设置项目特定配置。",
  "将配置放在 {highlight}~/.config/opencode/opencode.json{/highlight} 可以设置全局配置。",
  "在配置中添加 {highlight}$schema{/highlight} 可以在编辑器中获得自动补全。",
  "在配置中配置 {highlight}model{/highlight} 可以设置默认模型。",
  "通过 {highlight}keybinds{/highlight} 部分可以在配置中覆盖任何快捷键。",
  "将任何快捷键设置为 {highlight}none{/highlight} 可以完全禁用它。",

  // MCP 服务器配置
  "在 {highlight}mcp{/highlight} 配置部分配置本地或远程 MCP 服务器。",
  "OpenCode 自动处理需要身份验证的远程 MCP 服务器的 OAuth 流程。",

  // 自定义命令和智能体
  "将 {highlight}.md{/highlight} 文件添加到 {highlight}.opencode/command/{/highlight} 可以定义可重用的自定义提示。",
  "在自定义命令中使用 {highlight}$ARGUMENTS{/highlight}、{highlight}$1{/highlight}、{highlight}$2{/highlight} 来实现动态输入。",
  "在命令中使用反引号来注入 shell 输出（例如 {highlight}`git status`{/highlight}）。",
  "将 {highlight}.md{/highlight} 文件添加到 {highlight}.opencode/agent/{/highlight} 可以创建专门的 AI 角色。",
  "为 {highlight}edit{/highlight}、{highlight}bash{/highlight} 和 {highlight}webfetch{/highlight} 工具配置每个智能体的权限。",
  '使用类似 {highlight}"git *": "allow"{/highlight} 的模式进行细粒度的 bash 权限控制。',
  '设置 {highlight}"rm -rf *": "deny"{/highlight} 可以阻止破坏性命令。',
  '配置 {highlight}"git push": "ask"{/highlight} 可以在推送前要求确认。',

  // 格式化器配置
  "OpenCode 使用 prettier、gofmt、ruff 等工具自动格式化文件。",
  '在配置中设置 {highlight}"formatter": false{/highlight} 可以禁用所有自动格式化。',
  "在配置中使用文件扩展名定义自定义格式化命令。",
  "OpenCode 使用 LSP 服务器进行智能代码分析。",

  // 自定义工具和插件
  "在 {highlight}.opencode/tool/{/highlight} 中创建 {highlight}.ts{/highlight} 文件可以定义新的 LLM 工具。",
  "工具定义可以调用用 Python、Go 等语言编写的脚本。",
  "将 {highlight}.ts{/highlight} 文件添加到 {highlight}.opencode/plugin/{/highlight} 可以添加事件钩子。",
  "使用插件可以在会话完成时发送操作系统通知。",
  "创建插件可以防止 OpenCode 读取敏感文件。",

  // CLI 使用
  "使用 {highlight}opencode run{/highlight} 进行非交互式脚本编写。",
  "使用 {highlight}opencode run --continue{/highlight} 可以恢复上一个会话。",
  "使用 {highlight}opencode run -f file.ts{/highlight} 可以通过 CLI 附加文件。",
  "在脚本中使用 {highlight}--format json{/highlight} 获取机器可读的输出。",
  "运行 {highlight}opencode serve{/highlight} 可以获得 OpenCode 的无头 API 访问。",
  "使用 {highlight}opencode run --attach{/highlight} 可以连接到正在运行的服务器以获得更快的运行速度。",
  "运行 {highlight}opencode upgrade{/highlight} 可以更新到最新版本。",
  "运行 {highlight}opencode auth list{/highlight} 可以查看所有配置的提供者。",
  "运行 {highlight}opencode agent create{/highlight} 可以引导创建智能体。",

  // GitHub 集成
  "在 GitHub 问题/PR 中使用 {highlight}/opencode{/highlight} 可以触发 AI 操作。",
  "运行 {highlight}opencode github install{/highlight} 可以设置 GitHub 工作流。",
  "在问题上评论 {highlight}/opencode fix this{/highlight} 可以自动创建 PR。",
  "在 PR 代码行上评论 {highlight}/oc{/highlight} 可以进行针对性的代码审查。",

  // 主题配置
  '使用 {highlight}"theme": "system"{/highlight} 可以匹配终端的颜色。',
  "在 {highlight}.opencode/themes/{/highlight} 目录中创建 JSON 主题文件。",
  "主题支持明暗两种模式的变体。",
  "在自定义主题中引用 ANSI 颜色 0-255。",

  // 高级配置
  "使用 {highlight}{env:VAR_NAME}{/highlight} 语法在配置中引用环境变量。",
  "使用 {highlight}{file:path}{/highlight} 在配置值中包含文件内容。",
  "在配置中使用 {highlight}instructions{/highlight} 加载额外的规则文件。",
  "将智能体的 {highlight}temperature{/highlight} 从 0.0（专注）设置为 1.0（创造性）。",
  "配置 {highlight}maxSteps{/highlight} 可以限制每次请求的智能体迭代次数。",
  '设置 {highlight}"tools": {"bash": false}{/highlight} 可以禁用特定工具。',
  '使用 {highlight}"mcp_*": false{/highlight} 可以禁用来自 MCP 服务器的所有工具。',
  "在智能体配置中覆盖全局工具设置。",
  '设置 {highlight}"share": "auto"{/highlight} 可以自动共享所有会话。',
  '设置 {highlight}"share": "disabled"{/highlight} 可以禁止任何会话共享。',
  "运行 {highlight}/unshare{/highlight} 可以从公开访问中移除会话。",

  // 权限设置
  "权限 {highlight}doom_loop{/highlight} 防止无限的工具调用循环。",
  "权限 {highlight}external_directory{/highlight} 保护项目外的文件。",

  // 调试和帮助
  "运行 {highlight}opencode debug config{/highlight} 可以排查配置问题。",
  "使用 {highlight}--print-logs{/highlight} 标志可以在 stderr 中查看详细日志。",
  "按 {highlight}Ctrl+X G{/highlight} 或 {highlight}/timeline{/highlight} 可以跳转到特定消息。",
  "按 {highlight}Ctrl+X H{/highlight} 可以切换消息中代码块的可见性。",
  "按 {highlight}Ctrl+X S{/highlight} 或 {highlight}/status{/highlight} 可以查看系统状态信息。",
  "启用 {highlight}tui.scroll_acceleration{/highlight} 可以获得类似 macOS 的平滑滚动。",
  "通过命令面板（{highlight}Ctrl+P{/highlight}）切换用户名在聊天中的显示。",

  // 容器和高级功能
  "运行 {highlight}docker run -it --rm ghcr.io/sst/opencode{/highlight} 可以以容器化方式使用。",
  "使用 {highlight}/connect{/highlight} 配合 OpenCode Zen 可以使用经过策划和测试的模型。",
  "将项目的 {highlight}AGENTS.md{/highlight} 文件提交到 Git 以便团队共享。",
  "使用 {highlight}/review{/highlight} 可以审查未提交的更改、分支或 PR。",
  "运行 {highlight}/help{/highlight} 或 {highlight}Ctrl+X H{/highlight} 可以显示帮助对话框。",
  "使用 {highlight}/details{/highlight} 可以切换工具执行细节的可见性。",
  "使用 {highlight}/rename{/highlight} 可以重命名当前会话。",
  "按 {highlight}Ctrl+Z{/highlight} 可以暂停终端并返回到 shell。",
]
