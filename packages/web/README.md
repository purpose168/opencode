# Starlight 入门套件：基础版

[![使用 Starlight 构建](https://astro.badg.es/v2/built-with-starlight/tiny.svg)](https://starlight.astro.build)

```
npm create astro@latest -- --template starlight
```

[![在 StackBlitz 中打开](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/withastro/starlight/tree/main/examples/basics)
[![使用 CodeSandbox 打开](https://assets.codesandbox.io/github/button-edit-lime.svg)](https://codesandbox.io/p/sandbox/github/withastro/starlight/tree/main/examples/basics)
[![部署到 Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/withastro/starlight&create_from_path=examples/basics)
[![使用 Vercel 部署](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fwithastro%2Fstarlight%2Ftree%2Fmain%2Fexamples%2Fbasics&project-name=my-starlight-docs&repository-name=my-starlight-docs)

> 🧑‍🚀 **经验丰富的宇航员？** 删除此文件。尽情享受！

## 🚀 项目结构

在你的 Astro + Starlight 项目中，你会看到以下文件夹和文件：

```
.
├── public/
├── src/
│   ├── assets/
│   ├── content/
│   │   ├── docs/
│   └── content.config.ts
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

Starlight 在 `src/content/docs/` 目录中查找 `.md` 或 `.mdx` 文件。每个文件都根据其文件名作为路由暴露。

图像可以添加到 `src/assets/` 并用相对链接嵌入到 Markdown 中。

静态资源，如收藏夹图标，可以放在 `public/` 目录中。

## 🧞 命令

所有命令都从项目根目录的终端运行：

| 命令                       | 操作                                           |
| :------------------------ | :--------------------------------------------- |
| `npm install`             | 安装依赖项                                     |
| `npm run dev`             | 在 `localhost:4321` 启动本地开发服务器         |
| `npm run build`           | 构建生产站点到 `./dist/` 目录                  |
| `npm run preview`         | 在部署前本地预览构建                            |
| `npm run astro ...`       | 运行 CLI 命令，如 `astro add`、`astro check`   |
| `npm run astro -- --help` | 获取使用 Astro CLI 的帮助                      |

## 👀 想了解更多？

查看 [Starlight 的文档](https://starlight.astro.build/)，阅读 [Astro 文档](https://docs.astro.build)，或加入 [Astro Discord 服务器](https://astro.build/chat)。
