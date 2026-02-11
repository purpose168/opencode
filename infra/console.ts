// 导入域名配置
import { domain } from "./stage"
// 导入EmailOctopus API密钥配置
import { EMAILOCTOPUS_API_KEY } from "./app"

////////////////
// 数据库配置
////////////////

// 获取PlanetScale数据库集群输出（PlanetScale为云数据库服务）
const cluster = planetscale.getDatabaseOutput({
  name: "opencode",
  organization: "anomalyco",
})

// 根据环境选择或创建数据库分支
const branch =
  $app.stage === "production"
    ? planetscale.getBranchOutput({
        name: "production",
        organization: cluster.organization,
        database: cluster.name,
      })
    : new planetscale.Branch("DatabaseBranch", {
        database: cluster.name,
        organization: cluster.organization,
        name: $app.stage,
        parentBranch: "production",
      })
// 创建数据库密码配置
const password = new planetscale.Password("DatabasePassword", {
  name: $app.stage,
  database: cluster.name,
  organization: cluster.organization,
  branch: branch.name,
})

// 导出数据库链接配置，包含连接属性
export const database = new sst.Linkable("Database", {
  properties: {
    host: password.accessHostUrl,
    database: cluster.name,
    username: password.username,
    password: password.plaintext,
    port: 3306,
  },
})

// 创建开发命令配置，用于启动数据库管理工具（Studio）
new sst.x.DevCommand("Studio", {
  link: [database],
  dev: {
    command: "bun db studio",
    directory: "packages/console/core",
    autostart: true,
  },
})

////////////////
// 身份认证配置
////////////////

// 创建GitHub控制台客户端ID密钥配置
const GITHUB_CLIENT_ID_CONSOLE = new sst.Secret("GITHUB_CLIENT_ID_CONSOLE")
// 创建GitHub控制台客户端密钥配置
const GITHUB_CLIENT_SECRET_CONSOLE = new sst.Secret("GITHUB_CLIENT_SECRET_CONSOLE")
// 创建Google客户端ID密钥配置
const GOOGLE_CLIENT_ID = new sst.Secret("GOOGLE_CLIENT_ID")
// 创建Cloudflare键值存储（KV）用于身份认证
const authStorage = new sst.cloudflare.Kv("AuthStorage")
// 创建身份认证API Worker服务
export const auth = new sst.cloudflare.Worker("AuthApi", {
  domain: `auth.${domain}`,
  handler: "packages/console/function/src/auth.ts",
  url: true,
  link: [database, authStorage, GITHUB_CLIENT_ID_CONSOLE, GITHUB_CLIENT_SECRET_CONSOLE, GOOGLE_CLIENT_ID],
})

////////////////
// 网关配置
////////////////

// 创建Stripe Webhook端点配置（Stripe为在线支付处理平台）
export const stripeWebhook = new stripe.WebhookEndpoint("StripeWebhookEndpoint", {
  url: $interpolate`https://${domain}/stripe/webhook`,
  enabledEvents: [
    "checkout.session.async_payment_failed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.completed",
    "checkout.session.expired",
    "charge.refunded",
    "customer.created",
    "customer.deleted",
    "customer.updated",
    "customer.discount.created",
    "customer.discount.deleted",
    "customer.discount.updated",
    "customer.source.created",
    "customer.source.deleted",
    "customer.source.expiring",
    "customer.source.updated",
    "customer.subscription.created",
    "customer.subscription.deleted",
    "customer.subscription.paused",
    "customer.subscription.pending_update_applied",
    "customer.subscription.pending_update_expired",
    "customer.subscription.resumed",
    "customer.subscription.trial_will_end",
    "customer.subscription.updated",
  ],
})

// 创建Zen模型密钥配置数组（Zen为AI模型服务）
const ZEN_MODELS = [
  new sst.Secret("ZEN_MODELS1"),
  new sst.Secret("ZEN_MODELS2"),
  new sst.Secret("ZEN_MODELS3"),
  new sst.Secret("ZEN_MODELS4"),
  new sst.Secret("ZEN_MODELS5"),
  new sst.Secret("ZEN_MODELS6"),
]
// 创建Stripe密钥配置
const STRIPE_SECRET_KEY = new sst.Secret("STRIPE_SECRET_KEY")
// 创建身份认证API URL链接配置
const AUTH_API_URL = new sst.Linkable("AUTH_API_URL", {
  properties: { value: auth.url.apply((url) => url!) },
})
// 创建Stripe Webhook密钥链接配置
const STRIPE_WEBHOOK_SECRET = new sst.Linkable("STRIPE_WEBHOOK_SECRET", {
  properties: { value: stripeWebhook.secret },
})
// 创建网关键值存储（KV）
const gatewayKv = new sst.cloudflare.Kv("GatewayKv")

////////////////
// 控制台配置
////////////////

// 创建Zen数据存储桶
const bucket = new sst.cloudflare.Bucket("ZenData")
// 创建Zen新数据存储桶
const bucketNew = new sst.cloudflare.Bucket("ZenDataNew")

// 创建AWS SES访问密钥ID配置（AWS SES为简单邮件服务）
const AWS_SES_ACCESS_KEY_ID = new sst.Secret("AWS_SES_ACCESS_KEY_ID")
// 创建AWS SES秘密访问密钥配置
const AWS_SES_SECRET_ACCESS_KEY = new sst.Secret("AWS_SES_SECRET_ACCESS_KEY")

// 根据环境创建日志处理器
let logProcessor
if ($app.stage === "production" || $app.stage === "frank") {
  // 创建Honeycomb API密钥配置（Honeycomb为可观测性平台）
  const HONEYCOMB_API_KEY = new sst.Secret("HONEYCOMB_API_KEY")
  logProcessor = new sst.cloudflare.Worker("LogProcessor", {
    handler: "packages/console/function/src/log-processor.ts",
    link: [HONEYCOMB_API_KEY],
  })
}

// 创建SolidStart控制台应用（SolidStart为全栈框架）
new sst.cloudflare.x.SolidStart("Console", {
  domain,
  path: "packages/console/app",
  link: [
    bucket,
    bucketNew,
    database,
    AUTH_API_URL,
    STRIPE_WEBHOOK_SECRET,
    STRIPE_SECRET_KEY,
    EMAILOCTOPUS_API_KEY,
    AWS_SES_ACCESS_KEY_ID,
    AWS_SES_SECRET_ACCESS_KEY,
    ...ZEN_MODELS,
    ...($dev
      ? [
          new sst.Secret("CLOUDFLARE_DEFAULT_ACCOUNT_ID", process.env.CLOUDFLARE_DEFAULT_ACCOUNT_ID!),
          new sst.Secret("CLOUDFLARE_API_TOKEN", process.env.CLOUDFLARE_API_TOKEN!),
        ]
      : []),
    gatewayKv,
  ],
  environment: {
    //VITE_DOCS_URL: web.url.apply((url) => url!),
    //VITE_API_URL: gateway.url.apply((url) => url!),
    VITE_AUTH_URL: auth.url.apply((url) => url!),
  },
  transform: {
    server: {
      transform: {
        worker: {
          // 设置Worker放置模式为智能模式
          placement: { mode: "smart" },
          // 配置日志消费者
          tailConsumers: logProcessor ? [{ service: logProcessor.nodes.worker.scriptName }] : [],
        },
      },
    },
  },
})
