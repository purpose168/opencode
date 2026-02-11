import { mysqlTable, varchar, uniqueIndex } from "drizzle-orm/mysql-core"
import { timestamps, workspaceColumns } from "../drizzle/types"
import { workspaceIndexes } from "./workspace.sql"

/**
 * 模型表
 * 存储工作区可用的 AI 模型信息
 */
export const ModelTable = mysqlTable(
  "model",
  {
    ...workspaceColumns, // 工作区 ID 和 ID
    ...timestamps, // 标准时间戳字段（创建时间、更新时间、删除时间）
    model: varchar("model", { length: 64 }).notNull(), // 模型名称
  },
  (table) => [
    ...workspaceIndexes(table), // 工作区相关索引
    uniqueIndex("model_workspace_model").on(table.workspaceID, table.model), // 唯一索引：同一工作区下的模型名称必须唯一
  ],
)
