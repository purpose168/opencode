import { mysqlTable, uniqueIndex, varchar, int, mysqlEnum, index, bigint } from "drizzle-orm/mysql-core"
import { timestamps, ulid, utc, workspaceColumns } from "../drizzle/types"
import { workspaceIndexes } from "./workspace.sql"

/**
 * 用户角色类型
 * admin: 管理员，拥有所有权限
 * member: 成员，拥有基本权限
 */
export const UserRole = ["admin", "member"] as const

/**
 * 用户表
 * 存储工作区用户的基本信息、角色和使用统计
 */
export const UserTable = mysqlTable(
  "user",
  {
    ...workspaceColumns, // 工作区 ID 和 ID
    ...timestamps, // 标准时间戳字段（创建时间、更新时间、删除时间）
    accountID: ulid("account_id"), // 关联的账户 ID
    email: varchar("email", { length: 255 }), // 用户邮箱
    name: varchar("name", { length: 255 }).notNull(), // 用户名称
    timeSeen: utc("time_seen"), // 最后活跃时间
    color: int("color"), // 用户头像颜色
    role: mysqlEnum("role", UserRole).notNull(), // 用户角色（admin 或 member）
    monthlyLimit: int("monthly_limit"), // 月度限额
    monthlyUsage: bigint("monthly_usage", { mode: "number" }), // 月度使用量
    timeMonthlyUsageUpdated: utc("time_monthly_usage_updated"), // 月度使用量更新时间
  },
  (table) => [
    ...workspaceIndexes(table), // 工作区相关索引
    uniqueIndex("user_account_id").on(table.workspaceID, table.accountID), // 唯一索引：同一工作区下的账户 ID 必须唯一
    uniqueIndex("user_email").on(table.workspaceID, table.email), // 唯一索引：同一工作区下的邮箱必须唯一
    index("global_account_id").on(table.accountID), // 账户 ID 索引：用于快速查询用户的所有工作区
    index("global_email").on(table.email), // 邮箱索引：用于快速查询用户的所有工作区
  ],
)
