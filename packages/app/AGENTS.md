# @opencode/app 代理指南

## 构建/测试命令

- **开发**：`bun run dev`（在端口 3000 上启动 Vite 开发服务器）
- **构建**：`bun run build`（生产环境构建）
- **预览**：`bun run serve`（预览生产环境构建）
- **验证**：仅使用 `bun run typecheck` - 不要为验证而构建或运行项目
- **测试**：不要创建或运行自动化测试

## 代码风格

- **框架**：SolidJS 搭配 TypeScript
- **导入**：使用 `@/` 别名指向 src/ 目录（例如：`import Button from "@/ui/button"`）
- **格式化**：Prettier 配置为禁用分号，行宽 120 字符
- **组件**：使用函数声明，splitProps 处理组件属性
- **类型**：为组件属性定义接口，避免使用 `any` 类型
- **CSS**：TailwindCSS 配合自定义 CSS 变量主题系统
- **命名**：组件使用 PascalCase，变量/函数使用 camelCase，文件名使用 snake_case
- **文件结构**：UI 基元位于 `/ui/`，高级组件位于 `/components/`，页面位于 `/pages/`，提供者位于 `/providers/`

## 关键依赖

- SolidJS, @solidjs/router, @kobalte/core（UI 基元）
- TailwindCSS 4.x 配合 @tailwindcss/vite
- 带有 CSS 变量的自定义主题系统

未找到特殊规则文件。
