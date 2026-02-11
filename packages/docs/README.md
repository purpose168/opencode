# Mintlify  starter kit（入门套件）

使用入门套件部署您的文档并准备好进行自定义。

点击此仓库顶部的绿色 **Use this template**（使用此模板）按钮复制 Mintlify 入门套件。该入门套件包含以下示例：

- 指南页面
- 导航
- 自定义设置
- API 参考页面
- 常用组件的使用

**[遵循完整的快速入门指南](https://starter.mintlify.com/quickstart)**

## 开发

安装 [Mintlify CLI](https://www.npmjs.com/package/mint) 以在本地预览文档更改。要安装，请使用以下命令：

```bash
# 全局安装 Mintlify CLI 工具
npm i -g mint
```

在文档根目录（包含 `docs.json` 的位置）运行以下命令：

```bash
# 启动本地开发服务器
mint dev
```

在 `http://localhost:3000` 查看本地预览。

## 发布更改

从您的 [dashboard](https://dashboard.mintlify.com/settings/organization/github-app)（仪表板）安装我们的 GitHub 应用，以将更改从您的仓库传播到您的部署。推送到默认分支后，更改会自动部署到生产环境。

## 需要帮助？

### 故障排除

- 如果您的开发环境未运行：运行 `mint update` 以确保您拥有最新版本的 CLI。
- 如果页面加载为 404：确保您在包含有效 `docs.json` 的文件夹中运行。

### 资源

- [Mintlify 文档](https://mintlify.com/docs)
