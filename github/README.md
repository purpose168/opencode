# opencode GitHub Action

一个将 [opencode](https://opencode.ai) 直接集成到您的 GitHub 工作流程中的 GitHub Action。

在您的评论中提及 `/opencode`，opencode 将在您的 GitHub Actions 运行器中执行任务。

## 功能特性

#### 解释问题

在 GitHub issue 上留下以下评论。`opencode` 将阅读整个讨论线程，包括所有评论，并回复清晰的解释。

```
/opencode explain this issue
```

#### 修复问题

在 GitHub issue 上留下以下评论。opencode 将创建一个新分支，实现更改，并打开包含这些更改的 PR。

```
/opencode fix this
```

#### 审查 PR 并进行更改

在 GitHub PR 上留下以下评论。opencode 将实现请求的更改并将其提交到同一个 PR。

```
Delete the attachment from S3 when the note is removed /oc
```

#### 审查特定代码行

在 PR 的 "Files" 选项卡中直接对代码行发表评论。opencode 将自动检测文件、行号和差异上下文，以提供精确的响应。

```
[在 Files 选项卡中对特定行发表评论]
/oc add error handling here
```

当对特定行发表评论时，opencode 会收到：

- 正在审查的确切文件
- 特定的代码行
- 周围的差异上下文
- 行号信息

这允许更有针对性的请求，而无需手动指定文件路径或行号。

## 安装

在您的 GitHub 仓库的终端中运行以下命令：

```bash
opencode github install
```

这将引导您完成 GitHub 应用的安装、工作流程的创建以及密钥的设置。

### 手动设置

1. 安装 GitHub 应用 https://github.com/apps/opencode-agent。确保它已安装在目标仓库上。
2. 在您的仓库中添加以下工作流程文件到 `.github/workflows/opencode.yml`。在 `env` 中设置适当的 `model` 和所需的 API 密钥。

   ```yml
   name: opencode

   on:
     issue_comment:
       types: [created]
     pull_request_review_comment:
       types: [created]

   jobs:
     opencode:
       if: |
         contains(github.event.comment.body, '/oc') ||
         contains(github.event.comment.body, '/opencode')
       runs-on: ubuntu-latest
       permissions:
         id-token: write
       steps:
         - name: Checkout repository
           uses: actions/checkout@v4
           with:
             fetch-depth: 1

         - name: Run opencode
           uses: sst/opencode/github@latest
           env:
             ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
           with:
             model: anthropic/claude-sonnet-4-20250514
   ```

3. 将 API 密钥存储在密钥中。在您的组织或项目的 **设置** 中，展开左侧的 **Secrets and variables** 并选择 **Actions**。添加所需的 API 密钥。

## 支持

这是一个早期版本。如果您遇到问题或有反馈，请在 https://github.com/sst/opencode/issues 创建一个 issue。

## 开发

要在本地测试：

1. 导航到测试仓库（例如 `hello-world`）：

   ```bash
   cd hello-world
   ```

2. 运行：

   ```bash
   MODEL=anthropic/claude-sonnet-4-20250514 \
     ANTHROPIC_API_KEY=sk-ant-api03-1234567890 \
     GITHUB_RUN_ID=dummy \
     MOCK_TOKEN=github_pat_1234567890 \
     MOCK_EVENT='{"eventName":"issue_comment",...}' \
     bun /path/to/opencode/github/index.ts
   ```

   - `MODEL`：opencode 使用的模型。与 GitHub 工作流程中定义的 `MODEL` 相同。
   - `ANTHROPIC_API_KEY`：您的模型提供商 API 密钥。与 GitHub 工作流程中定义的密钥相同。
   - `GITHUB_RUN_ID`：模拟 GitHub action 环境的虚拟值。
   - `MOCK_TOKEN`：GitHub 个人访问令牌。此令牌用于验证您对测试仓库有 `admin` 或 `write` 权限。在此 [生成令牌](https://github.com/settings/personal-access-tokens)。
   - `MOCK_EVENT`：模拟的 GitHub 事件负载（见下面的模板）。
   - `/path/to/opencode`：您克隆的 opencode 仓库的路径。`bun /path/to/opencode/github/index.ts` 运行您本地版本的 `opencode`。

### Issue 评论事件

```
MOCK_EVENT='{"eventName":"issue_comment","repo":{"owner":"sst","repo":"hello-world"},"actor":"fwang","payload":{"issue":{"number":4},"comment":{"id":1,"body":"hey opencode, summarize thread"}}}'
```

替换：

- `"owner":"sst"` 为仓库所有者
- `"repo":"hello-world"` 为仓库名称
- `"actor":"fwang"` 为评论者的 GitHub 用户名
- `"number":4` 为 GitHub issue ID
- `"body":"hey opencode, summarize thread"` 为评论内容

### 带有图片附件的 Issue 评论

```
MOCK_EVENT='{"eventName":"issue_comment","repo":{"owner":"sst","repo":"hello-world"},"actor":"fwang","payload":{"issue":{"number":4},"comment":{"id":1,"body":"hey opencode, what is in my image ![Image](https://github.com/user-attachments/assets/xxxxxxxx)"}}}'
```

将图片 URL `https://github.com/user-attachments/assets/xxxxxxxx` 替换为有效的 GitHub 附件（您可以通过在任何 issue 中评论并附上图片来生成一个）。

### PR 评论事件

```
MOCK_EVENT='{"eventName":"issue_comment","repo":{"owner":"sst","repo":"hello-world"},"actor":"fwang","payload":{"issue":{"number":4,"pull_request":{}},"comment":{"id":1,"body":"hey opencode, summarize thread"}}}'
```

### PR 审查评论事件

```
MOCK_EVENT='{"eventName":"pull_request_review_comment","repo":{"owner":"sst","repo":"hello-world"},"actor":"fwang","payload":{"pull_request":{"number":7},"comment":{"id":1,"body":"hey opencode, add error handling","path":"src/components/Button.tsx","diff_hunk":"@@ -45,8 +45,11 @@\n- const handleClick = () => {\n-   console.log('clicked')\n+ const handleClick = useCallback(() => {\n+   console.log('clicked')\n+   doSomething()\n+ }, [doSomething])","line":47,"original_line":45,"position":10,"commit_id":"abc123","original_commit_id":"def456"}}}'
```
