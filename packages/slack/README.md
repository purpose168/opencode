# @opencode-ai/slack

用于 opencode 的 Slack 机器人集成，可创建线程化对话。

## 设置

1. 在 https://api.slack.com/apps 创建一个 Slack 应用
2. 启用 Socket 模式（Socket Mode）
3. 添加以下 OAuth 权限范围（OAuth scopes）：
   - `chat:write` - 聊天写入权限
   - `app_mentions:read` - 应用提及读取权限
   - `channels:history` - 频道历史记录权限
   - `groups:history` - 群组历史记录权限
4. 将应用安装到您的工作区
5. 在 `.env` 文件中设置环境变量：
   - `SLACK_BOT_TOKEN` - 机器人用户 OAuth 令牌（Bot User OAuth Token）
   - `SLACK_SIGNING_SECRET` - 从基本信息中获取的签名密钥（Signing Secret）
   - `SLACK_APP_TOKEN` - 从基本信息中获取的应用级令牌（App-Level Token）

## 使用方法

```bash
# 使用您的 Slack 应用凭据编辑 .env 文件
bun dev
```

机器人将响应其被添加到的频道中的消息，为每个线程创建独立的 opencode 会话。
