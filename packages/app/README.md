## 使用方法

这些模板依赖通过 [pnpm](https://pnpm.io) 进行维护，使用 `pnpm up -Lri` 命令。

这就是为什么你会看到 `pnpm-lock.yaml` 文件。不过，任何包管理器都可以使用。一旦你克隆了模板，这个文件可以安全地删除。

```bash
$ npm install # 或 pnpm install 或 yarn install
```

### 在 [Solid 网站](https://solidjs.com) 上了解更多信息，并在我们的 [Discord](https://discord.com/invite/solidjs) 上与我们聊天

## 可用脚本

在项目目录中，你可以运行：

### `npm run dev` 或 `npm start`

在开发模式下运行应用程序。<br>
打开 [http://localhost:3000](http://localhost:3000) 在浏览器中查看。

如果你进行编辑，页面将重新加载。<br>

### `npm run build`

将应用程序构建到生产环境的 `dist` 文件夹中。<br>
它会在生产模式下正确打包 Solid，并优化构建以获得最佳性能。

构建会被压缩，文件名包含哈希值。<br>
你的应用程序已准备好部署！

## 部署

你可以将 `dist` 文件夹部署到任何静态主机提供商（netlify、surge、now 等）
