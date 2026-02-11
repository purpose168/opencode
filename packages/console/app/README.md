# SolidStart

构建 Solid 项目所需的一切，由 [`solid-start`](https://start.solidjs.com) 提供支持；

## 创建项目

```bash
# 在当前目录创建新项目
npm init solid@latest

# 在 my-app 目录创建新项目
npm init solid@latest my-app
```

## 开发

创建项目并使用 `npm install`（或 `pnpm install` 或 `yarn`）安装依赖后，启动开发服务器：

```bash
npm run dev

# 或启动服务器并在新浏览器标签页中打开应用
npm run dev -- --open
```

## 构建

Solid 应用使用 _预设（presets）_ 构建，这些预设会优化您的项目以部署到不同环境。

默认情况下，`npm run build` 会生成一个 Node 应用，您可以使用 `npm start` 运行它。要使用不同的预设，请将其添加到 `package.json` 中的 `devDependencies` 并在 `app.config.js` 中指定。

## 此项目由 [Solid CLI](https://github.com/solidjs-community/solid-cli) 创建
