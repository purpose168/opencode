# opencode智能体指南

## 构建/测试命令

- **安装**: `bun install`
- **运行**: `bun run index.ts`
- **类型检查**: `bun run typecheck` (npm run typecheck)
- **测试**: `bun test` (运行所有测试)
- **单个测试**: `bun test test/tool/tool.test.ts` (特定测试文件)

## 代码风格

- **运行时**: Bun with TypeScript ESM模块
- **导入**: 本地模块使用相对导入，优先使用命名导入
- **类型**: 使用Zod模式进行验证，使用TypeScript接口定义结构
- **命名**: 变量/函数使用camelCase（驼峰命名法），类/命名空间使用PascalCase（帕斯卡命名法）
- **错误处理**: 使用Result模式，避免在工具中抛出异常
- **文件结构**: 基于命名空间的组织（例如，`Tool.define()`、`Session.create()`）

## 架构

- **工具**: 实现`Tool.Info`接口和`execute()`方法
- **上下文**: 在工具上下文中传递`sessionID`，使用`App.provide()`进行依赖注入
- **验证**: 所有输入都使用Zod模式验证
- **日志记录**: 使用`Log.create({ service: "name" })`模式
- **存储**: 使用`Storage`命名空间进行持久化
- **API客户端**: Go TUI通过stainless SDK与TypeScript服务器通信。在`packages/opencode/src/server/server.ts`中添加/修改服务器端点时，要求用户生成新的客户端SDK以继续客户端更改。
