# ACP (智能体客户端协议) 实现

此目录包含一个干净、符合协议规范的 [智能体客户端协议](https://agentclientprotocol.com/) 实现，用于 opencode。

## 架构

该实现遵循清晰的关注点分离原则：

### 核心组件

- **`agent.ts`** - 实现 `@agentclientprotocol/sdk` 中的 `Agent` 接口
  - 处理初始化和能力协商
  - 管理会话生命周期（`session/new`、`session/load`）
  - 处理提示并返回响应
  - 正确实现 ACP 协议 v1

- **`client.ts`** - 实现客户端能力的 `Client` 接口
  - 文件操作（`readTextFile`、`writeTextFile`）
  - 权限请求（目前自动批准）
  - 终端支持（存根实现）

- **`session.ts`** - 会话状态管理
  - 创建和跟踪 ACP 会话
  - 将 ACP 会话映射到内部 opencode 会话
  - 维护工作目录上下文
  - 处理 MCP 服务器配置

- **`server.ts`** - ACP 服务器启动和生命周期管理
  - 使用官方库设置基于标准输入输出的 JSON-RPC
  - 管理 SIGTERM/SIGINT 信号的优雅关闭
  - 为智能体提供实例上下文

- **`types.ts`** - 内部使用的类型定义

## 使用方法

### 命令行

```bash
# 在当前目录启动 ACP 服务器
opencode acp

# 在特定目录启动
opencode acp --cwd /path/to/project
```

### 程序化使用

```typescript
import { ACPServer } from "./acp/server"

await ACPServer.start()
```

### 与 Zed 集成

添加到您的 Zed 配置文件（`~/.config/zed/settings.json`）：

```json
{
  "agent_servers": {
    "OpenCode": {
      "command": "opencode",
      "args": ["acp"]
    }
  }
}
```

## 协议合规性

此实现遵循 ACP 规范 v1：

✅ **初始化**

- 正确的 `initialize` 请求/响应和协议版本协商
- 能力广告（`agentCapabilities`）
- 认证支持（存根）

✅ **会话管理**

- `session/new` - 创建新的对话会话
- `session/load` - 恢复现有会话（基本支持）
- 工作目录上下文（`cwd`）
- MCP 服务器配置支持

✅ **提示处理**

- `session/prompt` - 处理用户消息
- 内容块处理（文本、资源）
- 带停止原因的响应

✅ **客户端能力**

- 文件读写操作
- 权限请求
- 终端支持（未来的存根）

## 当前限制

### 尚未实现

1. **流式响应** - 目前返回完整响应，而不是通过 `session/update` 通知进行流式传输
2. **工具调用报告** - 不报告工具执行进度
3. **会话模式** - 尚未支持模式切换
4. **认证** - 没有实际的认证实现
5. **终端支持** - 仅占位符
6. **会话持久性** - `session/load` 不恢复实际对话历史

### 未来增强

- **实时流式传输**：实现 `session/update` 通知以获取渐进式响应
- **工具调用可见性**：实时报告工具执行情况
- **会话持久性**：保存和恢复完整对话历史
- **模式支持**：实现不同的操作模式（询问、代码等）
- **增强权限**：更复杂的权限处理
- **终端集成**：通过 opencode 的 bash 工具提供完整的终端支持

## 测试

```bash
# 运行 ACP 测试
bun test test/acp.test.ts

# 使用标准输入输出手动测试
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1}}' | opencode acp
```

## 设计决策

### 为什么使用官方库？

我们使用 `@agentclientprotocol/sdk` 而不是自己实现 JSON-RPC，因为：

- 确保协议合规性
- 处理边缘情况和未来的协议版本
- 减少维护负担
- 自动与其他 ACP 客户端配合使用

### 干净的架构

每个组件都有单一职责：

- **智能体** = 协议接口
- **客户端** = 客户端操作
- **会话** = 状态管理
- **服务器** = 生命周期和 I/O

这使得代码库可维护且可测试。

### 映射到 OpenCode

ACP 会话清晰地映射到 opencode 的内部会话模型：

- ACP `session/new` → 创建内部会话
- ACP `session/prompt` → 使用 SessionPrompt.prompt()
- 每个会话保留工作目录上下文
- 工具执行使用现有的 ToolRegistry

## 参考资料

- [ACP 规范](https://agentclientprotocol.com/)
- [TypeScript 库](https://github.com/agentclientprotocol/typescript-sdk)
- [协议示例](https://github.com/agentclientprotocol/typescript-sdk/tree/main/src/examples)
