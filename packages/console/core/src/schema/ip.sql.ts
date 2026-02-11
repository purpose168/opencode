import { mysqlTable, int, primaryKey, varchar } from "drizzle-orm/mysql-core"
import { timestamps } from "../drizzle/types"

/**
 * IP 地址表
 * 存储访问 IP 地址及其使用统计信息
 */
export const IpTable = mysqlTable(
  "ip",
  {
    ip: varchar("ip", { length: 45 }).notNull(), // IP 地址（支持 IPv4 和 IPv6）
    ...timestamps, // 标准时间戳字段（创建时间、更新时间、删除时间）
    usage: int("usage"), // 使用次数
  },
  (table) => [primaryKey({ columns: [table.ip] })], // 主键约束：IP 地址作为主键
)
