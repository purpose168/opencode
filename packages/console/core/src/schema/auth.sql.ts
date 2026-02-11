import { index, mysqlEnum, mysqlTable, primaryKey, uniqueIndex, varchar } from "drizzle-orm/mysql-core"
import { id, timestamps, ulid } from "../drizzle/types"

/**
 * 认证提供者类型
 * 支持邮箱、GitHub 和 Google 认证方式
 */
export const AuthProvider = ["email", "github", "google"] as const

/**
 * 认证表
 * 存储用户认证信息，包括认证方式、主题和关联的账户ID
 */
export const AuthTable = mysqlTable(
  "auth",
  {
    id: id(), // 认证记录唯一标识符
    ...timestamps, // 标准时间戳字段（创建时间、更新时间、删除时间）
    provider: mysqlEnum("provider", AuthProvider).notNull(), // 认证提供者（邮箱、GitHub、Google）
    subject: varchar("subject", { length: 255 }).notNull(), // 认证主题（如邮箱地址或用户ID）
    accountID: ulid("account_id").notNull(), // 关联的账户ID
  },
  (table) => [
    primaryKey({ columns: [table.id] }), // 主键约束
    uniqueIndex("provider").on(table.provider, table.subject), // 唯一索引：同一提供者下的主题必须唯一
    index("account_id").on(table.accountID), // 账户ID索引：用于快速查询账户的所有认证方式
  ],
)
