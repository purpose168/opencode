import { index, mediumtext, mysqlTable, primaryKey, varchar } from "drizzle-orm/mysql-core"
import { id, timestamps } from "../drizzle/types"

/**
 * 基准测试表
 * 存储模型和智能体的基准测试结果
 */
export const BenchmarkTable = mysqlTable(
  "benchmark",
  {
    id: id(), // 基准测试记录唯一标识符
    ...timestamps, // 标准时间戳字段（创建时间、更新时间、删除时间）
    model: varchar("model", { length: 64 }).notNull(), // 模型名称
    agent: varchar("agent", { length: 64 }).notNull(), // 智能体名称
    result: mediumtext("result").notNull(), // 测试结果（JSON 格式）
  },
  (table) => [
    primaryKey({ columns: [table.id] }), // 主键约束
    index("time_created").on(table.timeCreated), // 创建时间索引：用于按时间排序查询
  ],
)
