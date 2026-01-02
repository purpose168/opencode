<p align="center">
  <a href="https://opencode.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="OpenCode 标志">
    </picture>
  </a>
</p>
<p align="center">开源AI编码智能体。</p>
<p align="center">
  <a href="https://opencode.ai/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/opencode-ai"><img alt="npm" src="https://img.shields.io/npm/v/opencode-ai?style=flat-square" /></a>
  <a href="https://github.com/sst/opencode/actions/workflows/publish.yml"><img alt="构建状态" src="https://img.shields.io/github/actions/workflow/status/sst/opencode/publish.yml?style=flat-square&branch=dev" /></a>
</p>

[![OpenCode 终端界面](packages/web/src/assets/lander/screenshot.png)](https://opencode.ai)

---

### 安装

```bash
# YOLO 快速安装
curl -fsSL https://opencode.ai/install | bash

# 包管理器安装
npm i -g opencode-ai@latest        # 或使用 bun/pnpm/yarn
scoop bucket add extras; scoop install extras/opencode  # Windows
choco install opencode             # Windows
brew install opencode              # macOS 和 Linux
paru -S opencode-bin               # Arch Linux
mise use -g opencode               # 任何操作系统
nix run nixpkgs#opencode           # 或使用 github:sst/opencode 获取最新开发分支
```

> [!TIP]
> 安装前请移除 0.1.x 之前的旧版本。

### 桌面应用 (BETA)

OpenCode 也提供桌面应用版本。可直接从 [发布页面](https://github.com/sst/opencode/releases) 或 [opencode.ai/download](https://opencode.ai/download) 下载。

| 平台                  | 下载文件                              |
| --------------------- | ------------------------------------- |
| macOS (Apple Silicon) | `opencode-desktop-darwin-aarch64.dmg` |
| macOS (Intel)         | `opencode-desktop-darwin-x64.dmg`     |
| Windows               | `opencode-desktop-windows-x64.exe`    |
| Linux                 | `.deb`, `.rpm`, 或 AppImage           |

```bash
# macOS (Homebrew)
brew install --cask opencode-desktop
```

#### 安装目录

安装脚本会按照以下优先级顺序选择安装路径：

1. `$OPENCODE_INSTALL_DIR` - 自定义安装目录
2. `$XDG_BIN_DIR` - 符合XDG基本目录规范的路径
3. `$HOME/bin` - 标准用户二进制目录（如果存在或可创建）
4. `$HOME/.opencode/bin` - 默认回退路径

```bash
# 示例
OPENCODE_INSTALL_DIR=/usr/local/bin curl -fsSL https://opencode.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://opencode.ai/install | bash
```

### 智能体（Agents）

OpenCode 包含两个可切换的内置智能体，您可以使用 `Tab` 键在它们之间切换。

- **build** - 默认智能体，具有完整访问权限，适用于开发工作
- **plan** - 只读智能体，用于分析和代码探索
  - 默认拒绝文件编辑
  - 执行 bash 命令前会请求权限
  - 非常适合探索不熟悉的代码库或规划更改

此外，还包含一个 **general** 子智能体，用于复杂搜索和多步骤任务。
它在内部使用，您可以在消息中使用 `@general` 调用它。

了解更多关于 [智能体](https://opencode.ai/docs/agents) 的信息。

### 文档

要了解更多关于如何配置OpenCode的信息，请[**查看我们的文档**](https://opencode.ai/docs)。

### 贡献

如果您有兴趣为OpenCode做贡献，请在提交拉取请求前阅读我们的[贡献文档](./CONTRIBUTING.md)。

### 基于OpenCode构建

如果您正在开发与OpenCode相关的项目，并在项目名称中使用了'opencode'（例如'opencode-dashboard'或'opencode-mobile'），请在您的README中添加说明，澄清该项目并非由OpenCode团队构建，也与我们没有任何关联。

### 常见问题（FAQ）

#### 这与Claude Code有什么不同？

在功能方面，它与Claude Code非常相似。以下是主要区别：

- 100%开源
- 不依赖于任何提供商。虽然我们推荐通过[OpenCode Zen](https://opencode.ai/zen)提供的模型，但OpenCode可以与Claude、OpenAI、Google甚至本地模型一起使用。随着模型的发展，它们之间的差距将缩小，价格也会下降，因此不绑定特定提供商非常重要。
- 开箱即用的LSP（语言服务器协议）支持
- 专注于TUI（终端用户界面）。OpenCode由neovim用户和[terminal.shop](https://terminal.shop)的创建者构建；我们将突破终端中可能实现的极限。
- 客户端/服务器架构。例如，这可以让OpenCode在您的计算机上运行，而您可以通过移动应用远程控制它。这意味着TUI前端只是可能的客户端之一。

#### 另一个仓库是什么？

另一个名称相似的仓库与本项目没有任何关系。您可以[在这里阅读背后的故事](https://x.com/thdxr/status/1933561254481666466)。

---

**加入我们的社区** [Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
