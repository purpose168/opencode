# 为 OpenCode 做贡献

我们希望让您能够轻松地为 OpenCode 做贡献。以下是最常见的被合并的更改类型：

- Bug 修复
- 额外的 LSP / 格式化程序
- LLM 性能改进
- 支持新的提供商
- 修复特定环境的问题
- 缺失的标准行为
- 文档改进

然而，任何 UI 或核心产品功能在实现前都必须经过核心团队的设计审查。

如果您不确定 PR 是否会被接受，请随时咨询维护者或查找带有以下标签的问题：

- [`help wanted`](https://github.com/sst/opencode/issues?q=is%3Aissue%20state%3Aopen%20label%3Ahelp-wanted)
- [`good first issue`](https://github.com/sst/opencode/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22good%20first%20issue%22)
- [`bug`](https://github.com/sst/opencode/issues?q=is%3Aissue%20state%3Aopen%20label%3Abug)
- [`perf`](https://github.com/sst/opencode/issues?q=is%3Aopen%20is%3Aissue%20label%3A%22perf%22)

> [!NOTE]
> 忽略这些规则的 PR 可能会被关闭。

想要处理一个问题？留下评论，维护者可能会将其分配给您，除非我们已经在处理它。

## 开发 OpenCode

- 要求：Bun 1.3+
- 从仓库根目录安装依赖并启动开发服务器：

  ```bash
  bun install
  bun dev
  ```

### 在不同目录中运行

默认情况下，`bun dev` 在 `packages/opencode` 目录中运行 OpenCode。要在不同的目录或仓库中运行它：

```bash
bun dev <directory>
```

要在 opencode 仓库本身的根目录中运行 OpenCode：

```bash
bun dev .
```

### 构建 "localcode"

要编译独立可执行文件：

```bash
./packages/opencode/script/build.ts --single
```

然后运行它：

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

将 `<platform>` 替换为您的平台（例如，`darwin-arm64`，`linux-x64`）。

- 核心部分：
  - `packages/opencode`：OpenCode 核心业务逻辑和服务器。
  - `packages/opencode/src/cli/cmd/tui/`：TUI 代码，使用 [opentui](https://github.com/sst/opentui) 用 SolidJS 编写
  - `packages/plugin`：`@opencode-ai/plugin` 的源代码

> [!NOTE]
> 如果您对 API 或 SDK 进行了更改（例如 `packages/opencode/src/server/server.ts`），请运行 `./script/generate.ts` 重新生成 SDK 和相关文件。

请尝试遵循 [风格指南](./STYLE_GUIDE.md)

### 设置调试器

Bun 调试目前还不够完善。我们希望本指南能帮助您设置并避免一些痛点。

调试 OpenCode 最可靠的方法是通过 `bun run --inspect=<url> dev ...` 在终端中手动运行它，并通过该 URL 附加调试器。其他方法可能会导致断点映射不正确，至少在 VSCode 中是这样（因人而异）。

注意事项：

- 如果您想运行 OpenCode TUI 并在服务器代码中触发断点，您可能需要运行 `bun dev spawn` 而不是通常的 `bun dev`。这是因为 `bun dev` 在工作线程中运行服务器，断点可能无法在那里工作。
- 如果 `spawn` 对您不起作用，您可以单独调试服务器：
  - 调试服务器：`bun run --inspect=ws://localhost:6499/ ./src/index.ts serve --port 4096`，
    然后使用 `opencode attach http://localhost:4096` 附加 TUI
  - 调试 TUI：`bun run --inspect=ws://localhost:6499/ --conditions=browser ./src/index.ts`

其他提示和技巧：

- 根据您的工作流程，您可能希望使用 `--inspect-wait` 或 `--inspect-brk` 而不是 `--inspect`
- 每次调用时指定 `--inspect=ws://localhost:6499/` 可能会很麻烦，您可能希望改为 `export BUN_OPTIONS=--inspect=ws://localhost:6499/`

#### VSCode 设置

如果您使用 VSCode，您可以使用我们的示例配置 [.vscode/settings.example.json](.vscode/settings.example.json) 和 [.vscode/launch.example.json](.vscode/launch.example.json)。

一些可能有问题的调试方法：

- 带有 `"request": "launch"` 的调试配置可能会导致断点映射不正确，从而无法使用
- 在 VSCode `JavaScript Debug Terminal` 中运行 OpenCode 时也会出现同样的问题

话虽如此，您可能还是想尝试这些方法，因为它们可能对您有效。

## 拉取请求期望

- 尝试保持拉取请求小而集中。
- 在描述中链接相关问题
- 解释问题以及您的更改如何解决它
- 避免冗长的 LLM 生成的 PR 描述
- 在添加新函数或功能之前，确保这种行为在代码库的其他地方不存在。

### 风格偏好

这些不是严格执行的，只是一般指南：

- **函数：** 将逻辑保持在单个函数内，除非将其分解出来能带来明显的重用或组合好处。
- **解构：** 不要对变量进行不必要的解构。
- **控制流：** 避免 `else` 语句。
- **错误处理：** 在可能的情况下，优先使用 `.catch(...)` 而不是 `try`/`catch`。
- **类型：** 使用精确的类型并避免 `any`。
- **变量：** 坚持不可变模式并避免 `let`。
- **命名：** 当单个单词标识符仍然具有描述性时，选择它们。
- **运行时 API：** 当 Bun 帮助程序（如 `Bun.file()`）适合用例时使用它们。

## 功能请求

对于全新的功能，请从设计对话开始。打开一个问题，描述问题、您提出的方法（可选）以及为什么它属于 OpenCode。核心团队将帮助决定是否应该继续推进；请等待该批准，而不是直接打开功能 PR。
