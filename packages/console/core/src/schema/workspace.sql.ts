import { primaryKey, mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core"
import { timestamps, ulid } from "../drizzle/types"

/**
 * 工作区表
 * 存储工作区的基本信息，包括 ID、标识符和名称
 */
export const WorkspaceTable = mysqlTable(
  "workspace",
  {
    id: ulid("id").notNull().primaryKey(), // 工作区唯一标识符
    slug: varchar("slug", { length: 255 }), // 工作区标识符（用于 URL）
    name: varchar("name", { length: 255 }).notNull(), // 工作区名称
    ...timestamps, // 标准时间戳字段（创建时间、更新时间、删除时间）
  },
  (table) => [uniqueIndex("slug").on(table.slug)], // 唯一索引：标识符必须唯一
)

/**
 * 生成工作区相关的索引
 * 用于其他表中包含工作区 ID 的复合主键
 * @param table 表对象
 * @returns 包含工作区 ID 和 ID 的复合主键
 */
export function workspaceIndexes(table: any) {
  return [
    primaryKey({
      columns: [table.workspaceID, table.id],
    }),
  ]
}
