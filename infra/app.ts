// 导入域名配置
import { domain } from "./stage"

// 创建GitHub应用ID的密钥配置
const GITHUB_APP_ID = new sst.Secret("GITHUB_APP_ID")
// 创建GitHub应用私钥的密钥配置
const GITHUB_APP_PRIVATE_KEY = new sst.Secret("GITHUB_APP_PRIVATE_KEY")
// 创建EmailOctopus API密钥的密钥配置（EmailOctopus为邮件营销服务）
export const EMAILOCTOPUS_API_KEY = new sst.Secret("EMAILOCTOPUS_API_KEY")
// 创建管理员密钥的配置
const ADMIN_SECRET = new sst.Secret("ADMIN_SECRET")
// 创建Cloudflare存储桶（Bucket）实例
const bucket = new sst.cloudflare.Bucket("Bucket")

// 创建Cloudflare Worker API服务
export const api = new sst.cloudflare.Worker("Api", {
  // 设置API域名
  domain: `api.${domain}`,
  // 指定API处理程序文件路径
  handler: "packages/function/src/api.ts",
  // 配置环境变量
  environment: {
    WEB_DOMAIN: domain,
  },
  // 启用URL生成
  url: true,
  // 链接存储桶和密钥资源
  link: [bucket, GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, ADMIN_SECRET],
  // 转换Worker配置
  transform: {
    worker: (args) => {
      // 启用日志推送功能
      args.logpush = true
      // 配置Worker绑定，包括持久化对象命名空间（Durable Object Namespace）
      args.bindings = $resolve(args.bindings).apply((bindings) => [
        ...bindings,
        {
          name: "SYNC_SERVER",
          type: "durable_object_namespace",
          className: "SyncServer",
        },
      ])
      // 配置迁移设置
      args.migrations = {
        // 注意：发布下一个标签时，确保所有阶段都使用v2标签
        oldTag: $app.stage === "production" || $app.stage === "thdxr" ? "" : "v1",
        newTag: $app.stage === "production" || $app.stage === "thdxr" ? "" : "v1",
        //newSqliteClasses: ["SyncServer"],
      }
    },
  },
})

// 创建Astro文档网站
new sst.cloudflare.x.Astro("Web", {
  // 设置文档网站域名
  domain: "docs." + domain,
  // 指定Astro项目路径
  path: "packages/web",
  // 配置环境变量
  environment: {
    // 用于Astro配置
    SST_STAGE: $app.stage,
    VITE_API_URL: api.url.apply((url) => url!),
  },
})

// 创建静态Web应用网站
new sst.cloudflare.StaticSite("WebApp", {
  // 设置Web应用域名
  domain: "app." + domain,
  // 指定应用项目路径
  path: "packages/app",
  // 配置构建设置
  build: {
    // 使用Turbo进行构建
    command: "bun turbo build",
    // 指定输出目录
    output: "./dist",
  },
})
