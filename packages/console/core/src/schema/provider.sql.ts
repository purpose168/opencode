import { mysqlTable, text, uniqueIndex, varchar } from "drizzle-orm/mysql-core"
import { timestamps, workspaceColumns } from "../drizzle/types"
import { workspaceIndexes } from "./workspace.sql"

/**
 * 提供商表
 * 存储工作区的 AI 模型提供商配置和凭证信息
 */
export const ProviderTable = mysqlTable(
  "provider",
  {
    ...workspaceColumns, // 工作区 ID 和 ID
    ...timestamps, // 标准时间戳字段（创建时间、更新时间、删除时间）
    provider: varchar("provider", { length: 64 }).notNull(), // 提供商名称（如 openai、anthropic 等）
    credentials: text("credentials").notNull(), // 提供商凭证（JSON 格式）
  },
  (table) => [
    ...workspaceIndexes(table), // 工作区相关索引
    uniqueIndex("workspace_provider").on(table.workspaceID, table.provider), // 唯一索引：同一工作区下的提供商必须唯一
  ],
)
