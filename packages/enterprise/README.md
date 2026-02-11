# SolidStart

构建Solid项目所需的一切，由 [`solid-start`](https://start.solidjs.com) 提供支持；

## 创建项目

```bash
# 在当前目录创建新项目
npm init solid@latest

# 在my-app目录创建新项目
npm init solid@latest my-app
```

## 开发

创建项目并使用 `npm install`（或 `pnpm install` 或 `yarn`）安装依赖后，启动开发服务器：

```bash
npm run dev

# 或启动服务器并在新浏览器标签中打开应用
npm run dev -- --open
```

## 构建

Solid应用使用_预设_进行构建，这些预设会根据不同的部署环境优化您的项目。

默认情况下，`npm run build` 将生成一个Node应用，您可以使用 `npm start` 运行它。要使用不同的预设，请将其添加到 `package.json` 中的 `devDependencies` 并在 `app.config.js` 中指定。

## 此项目是使用 [Solid CLI](https://github.com/solidjs-community/solid-cli) 创建的
