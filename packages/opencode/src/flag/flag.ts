export namespace Flag {
  // 自动分享标志
  export const OPENCODE_AUTO_SHARE = truthy("OPENCODE_AUTO_SHARE")
  // Git bash路径
  export const OPENCODE_GIT_BASH_PATH = process.env["OPENCODE_GIT_BASH_PATH"]
  // 配置文件路径
  export const OPENCODE_CONFIG = process.env["OPENCODE_CONFIG"]
  // 配置目录路径
  export const OPENCODE_CONFIG_DIR = process.env["OPENCODE_CONFIG_DIR"]
  // 配置内容
  export const OPENCODE_CONFIG_CONTENT = process.env["OPENCODE_CONFIG_CONTENT"]
  // 禁用自动更新标志
  export const OPENCODE_DISABLE_AUTOUPDATE = truthy("OPENCODE_DISABLE_AUTOUPDATE")
  // 禁用清理标志
  export const OPENCODE_DISABLE_PRUNE = truthy("OPENCODE_DISABLE_PRUNE")
  // 禁用终端标题标志
  export const OPENCODE_DISABLE_TERMINAL_TITLE = truthy("OPENCODE_DISABLE_TERMINAL_TITLE")
  // 权限设置
  export const OPENCODE_PERMISSION = process.env["OPENCODE_PERMISSION"]
  // 禁用默认插件标志
  export const OPENCODE_DISABLE_DEFAULT_PLUGINS = truthy("OPENCODE_DISABLE_DEFAULT_PLUGINS")
  // 禁用LSP下载标志
  export const OPENCODE_DISABLE_LSP_DOWNLOAD = truthy("OPENCODE_DISABLE_LSP_DOWNLOAD")
  // 启用实验性模型标志
  export const OPENCODE_ENABLE_EXPERIMENTAL_MODELS = truthy("OPENCODE_ENABLE_EXPERIMENTAL_MODELS")
  // 禁用自动压缩标志
  export const OPENCODE_DISABLE_AUTOCOMPACT = truthy("OPENCODE_DISABLE_AUTOCOMPACT")
  // 禁用模型列表获取标志
  export const OPENCODE_DISABLE_MODELS_FETCH = truthy("OPENCODE_DISABLE_MODELS_FETCH")
  // 模拟VCS设置
  export const OPENCODE_FAKE_VCS = process.env["OPENCODE_FAKE_VCS"]
  // 客户端类型(默认为cli)
  export const OPENCODE_CLIENT = process.env["OPENCODE_CLIENT"] ?? "cli"

  // 实验性功能标志
  export const OPENCODE_EXPERIMENTAL = truthy("OPENCODE_EXPERIMENTAL")
  // 实验性文件监视器标志
  export const OPENCODE_EXPERIMENTAL_FILEWATCHER = truthy("OPENCODE_EXPERIMENTAL_FILEWATCHER")
  // 禁用实验性文件监视器标志
  export const OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER = truthy("OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER")
  // 实验性图标发现标志
  export const OPENCODE_EXPERIMENTAL_ICON_DISCOVERY =
    OPENCODE_EXPERIMENTAL || truthy("OPENCODE_EXPERIMENTAL_ICON_DISCOVERY")
  // 禁用选择时复制标志
  export const OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT = truthy("OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT")
  // 启用EXA标志
  export const OPENCODE_ENABLE_EXA =
    truthy("OPENCODE_ENABLE_EXA") || OPENCODE_EXPERIMENTAL || truthy("OPENCODE_EXPERIMENTAL_EXA")
  // 实验性bash最大输出长度
  export const OPENCODE_EXPERIMENTAL_BASH_MAX_OUTPUT_LENGTH = number("OPENCODE_EXPERIMENTAL_BASH_MAX_OUTPUT_LENGTH")
  // 实验性bash默认超时时间(毫秒)
  export const OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS = number("OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS")
  // 实验性输出最大token数
  export const OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX = number("OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX")
  // 实验性输出格式化标志
  export const OPENCODE_EXPERIMENTAL_OXFMT = OPENCODE_EXPERIMENTAL || truthy("OPENCODE_EXPERIMENTAL_OXFMT")
  // 实验性LSP类型标志
  export const OPENCODE_EXPERIMENTAL_LSP_TY = truthy("OPENCODE_EXPERIMENTAL_LSP_TY")
  // 实验性LSP工具标志
  export const OPENCODE_EXPERIMENTAL_LSP_TOOL = OPENCODE_EXPERIMENTAL || truthy("OPENCODE_EXPERIMENTAL_LSP_TOOL")

  // 判断环境变量是否为真值
  function truthy(key: string) {
    const value = process.env[key]?.toLowerCase()
    return value === "true" || value === "1"
  }

  // 从环境变量获取数值
  function number(key: string) {
    const value = process.env[key]
    if (!value) return undefined
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
  }
}
