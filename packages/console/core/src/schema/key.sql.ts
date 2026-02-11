import { mysqlTable, varchar, uniqueIndex } from "drizzle-orm/mysql-core"
import { timestamps, ulid, utc, workspaceColumns } from "../drizzle/types"
import { workspaceIndexes } from "./workspace.sql"

/**
 * API 密钥表
 * 存储工作区的 API 密钥信息
 */
export const KeyTable = mysqlTable(
  "key",
  {
    ...workspaceColumns, // 工作区 ID 和 ID
    ...timestamps, // 标准时间戳字段（创建时间、更新时间、删除时间）
    name: varchar("name", { length: 255 }).notNull(), // 密钥名称
    key: varchar("key", { length: 255 }).notNull(), // API 密钥值
    userID: ulid("user_id").notNull(), // 创建密钥的用户 ID
    timeUsed: utc("time_used"), // 最后使用时间
  },
  (table) => [
    ...workspaceIndexes(table), // 工作区相关索引
    uniqueIndex("global_key").on(table.key), // 密钥值唯一索引：确保全局唯一
  ],
)
