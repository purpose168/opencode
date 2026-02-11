import { Resource } from "@opencode-ai/console-resource"
import { Database } from "../src/drizzle/index.js"
import { UserTable } from "../src/schema/user.sql.js"
import { AccountTable } from "../src/schema/account.sql.js"
import { WorkspaceTable } from "../src/schema/workspace.sql.js"
import { BillingTable, PaymentTable, UsageTable } from "../src/schema/billing.sql.js"
import { KeyTable } from "../src/schema/key.sql.js"

// 检查当前环境是否为 frank 阶段
if (Resource.App.stage !== "frank") throw new Error("此脚本仅适用于 frank 环境")

// 要清空的表列表
const tablesToClear = [
  AccountTable,    // 账户表
  BillingTable,    // 账单表
  KeyTable,        // 密钥表
  PaymentTable,    // 支付表
  UsageTable,      // 使用量表
  UserTable,       // 用户表
  WorkspaceTable   // 工作区表
]

// 遍历并清空每个表
for (const table of tablesToClear) {
  await Database.use((tx) => tx.delete(table))
}
