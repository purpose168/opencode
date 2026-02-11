import { sql } from "drizzle-orm"
import { bigint, timestamp, varchar } from "drizzle-orm/mysql-core"

/**
 * 创建 ULID 类型的列
 * ULID 是一种分布式唯一标识符，长度为 30 个字符
 * @param name 列名
 * @returns ULID 类型的列定义
 */
export const ulid = (name: string) => varchar(name, { length: 30 })

/**
 * 工作区相关的列定义
 * 包含 ID 和工作区 ID 的标准列定义
 */
export const workspaceColumns = {
  get id() {
    return ulid("id").notNull()
  },
  get workspaceID() {
    return ulid("workspace_id").notNull()
  },
}

/**
 * 创建非空的 ID 列
 * @returns ID 列定义
 */
export const id = () => ulid("id").notNull()

/**
 * 创建 UTC 时间戳类型的列
 * @param name 列名
 * @returns 时间戳列定义，精度为毫秒
 */
export const utc = (name: string) =>
  timestamp(name, {
    fsp: 3,
  })

/**
 * 创建货币金额类型的列
 * 使用 bigint 存储金额，以微分为单位
 * @param name 列名
 * @returns 货币列定义
 */
export const currency = (name: string) =>
  bigint(name, {
    mode: "number",
  })

/**
 * 标准的时间戳列定义
 * 包含创建时间、更新时间和删除时间
 */
export const timestamps = {
  /**
   * 创建时间
   * 自动设置为当前时间
   */
  timeCreated: utc("time_created").notNull().defaultNow(),
  /**
   * 更新时间
   * 自动设置为当前时间，并在更新时自动刷新
   */
  timeUpdated: utc("time_updated")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`),
  /**
   * 删除时间
   * 用于软删除，可为空
   */
  timeDeleted: utc("time_deleted"),
}
