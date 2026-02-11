import { mysqlTable, primaryKey } from "drizzle-orm/mysql-core"
import { id, timestamps } from "../drizzle/types"

/**
 * 账户表
 * 存储用户账户的基本信息和时间戳
 */
export const AccountTable = mysqlTable(
  "account",
  {
    id: id(), // 账户唯一标识符
    ...timestamps, // 标准时间戳字段（创建时间、更新时间、删除时间）
  },
  (table) => [primaryKey({ columns: [table.id] })], // 主键约束
)
