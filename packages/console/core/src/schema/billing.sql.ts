import { bigint, boolean, int, mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core"
import { timestamps, ulid, utc, workspaceColumns } from "../drizzle/types"
import { workspaceIndexes } from "./workspace.sql"

/**
 * 账单表
 * 存储工作区的账单信息，包括支付方式、余额、自动充值设置等
 */
export const BillingTable = mysqlTable(
  "billing",
  {
    ...workspaceColumns, // 工作区 ID 和 ID
    ...timestamps, // 标准时间戳字段（创建时间、更新时间、删除时间）
    customerID: varchar("customer_id", { length: 255 }), // Stripe 客户 ID
    paymentMethodID: varchar("payment_method_id", { length: 255 }), // 支付方式 ID
    paymentMethodType: varchar("payment_method_type", { length: 32 }), // 支付方式类型（card、link 等）
    paymentMethodLast4: varchar("payment_method_last4", { length: 4 }), // 支付方式后四位（用于卡号显示）
    balance: bigint("balance", { mode: "number" }).notNull(), // 账户余额（以微分为单位）
    monthlyLimit: int("monthly_limit"), // 月度限额
    monthlyUsage: bigint("monthly_usage", { mode: "number" }), // 月度使用量
    timeMonthlyUsageUpdated: utc("time_monthly_usage_updated"), // 月度使用量更新时间
    reload: boolean("reload"), // 是否启用自动充值
    reloadTrigger: int("reload_trigger"), // 自动充值触发阈值（余额低于此值时触发）
    reloadAmount: int("reload_amount"), // 自动充值金额
    reloadError: varchar("reload_error", { length: 255 }), // 自动充值错误信息
    timeReloadError: utc("time_reload_error"), // 自动充值错误时间
    timeReloadLockedTill: utc("time_reload_locked_till"), // 自动充值锁定时间（防止重复充值）
  },
  (table) => [
    ...workspaceIndexes(table), // 工作区相关索引
    uniqueIndex("global_customer_id").on(table.customerID), // 客户 ID 唯一索引
  ],
)

/**
 * 支付表
 * 存储支付记录，包括支付金额、发票 ID 等
 */
export const PaymentTable = mysqlTable(
  "payment",
  {
    ...workspaceColumns, // 工作区 ID 和 ID
    ...timestamps, // 标准时间戳字段（创建时间、更新时间、删除时间）
    customerID: varchar("customer_id", { length: 255 }), // Stripe 客户 ID
    invoiceID: varchar("invoice_id", { length: 255 }), // Stripe 发票 ID
    paymentID: varchar("payment_id", { length: 255 }), // Stripe 支付 ID
    amount: bigint("amount", { mode: "number" }).notNull(), // 支付金额（以微分为单位）
    timeRefunded: utc("time_refunded"), // 退款时间（为空表示未退款）
  },
  (table) => [...workspaceIndexes(table)], // 工作区相关索引
)

/**
 * 使用量表
 * 存储模型使用记录，包括输入/输出 token 数量、缓存统计和成本
 */
export const UsageTable = mysqlTable(
  "usage",
  {
    ...workspaceColumns, // 工作区 ID 和 ID
    ...timestamps, // 标准时间戳字段（创建时间、更新时间、删除时间）
    model: varchar("model", { length: 255 }).notNull(), // 模型名称
    provider: varchar("provider", { length: 255 }).notNull(), // 提供商名称
    inputTokens: int("input_tokens").notNull(), // 输入 token 数量
    outputTokens: int("output_tokens").notNull(), // 输出 token 数量
    reasoningTokens: int("reasoning_tokens"), // 推理 token 数量
    cacheReadTokens: int("cache_read_tokens"), // 缓存读取 token 数量
    cacheWrite5mTokens: int("cache_write_5m_tokens"), // 5分钟缓存写入 token 数量
    cacheWrite1hTokens: int("cache_write_1h_tokens"), // 1小时缓存写入 token 数量
    cost: bigint("cost", { mode: "number" }).notNull(), // 使用成本（以微分为单位）
    keyID: ulid("key_id"), // API 密钥 ID
  },
  (table) => [...workspaceIndexes(table)], // 工作区相关索引
)
