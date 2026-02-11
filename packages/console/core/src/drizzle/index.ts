import { drizzle } from "drizzle-orm/planetscale-serverless"
import { Resource } from "@opencode-ai/console-resource"
export * from "drizzle-orm"
import { Client } from "@planetscale/database"

import { MySqlTransaction, type MySqlTransactionConfig } from "drizzle-orm/mysql-core"
import type { ExtractTablesWithRelations } from "drizzle-orm"
import type { PlanetScalePreparedQueryHKT, PlanetscaleQueryResultHKT } from "drizzle-orm/planetscale-serverless"
import { Context } from "../context"
import { memo } from "../util/memo"

/**
 * 数据库操作命名空间
 * 提供数据库连接、事务管理和上下文处理功能
 */
export namespace Database {
  /**
   * 数据库事务类型
   * 基于 MySQL 事务，使用 PlanetScale 作为底层实现
   */
  export type Transaction = MySqlTransaction<
    PlanetscaleQueryResultHKT,
    PlanetScalePreparedQueryHKT,
    Record<string, never>,
    ExtractTablesWithRelations<Record<string, never>>
  >

  /**
   * 数据库客户端实例（带缓存）
   * 使用 memo 确保只创建一个实例
   */
  const client = memo(() => {
    const result = new Client({
      host: Resource.Database.host,
      username: Resource.Database.username,
      password: Resource.Database.password,
    })
    const db = drizzle(result, {})
    return db
  })

  /**
   * 事务或数据库连接类型
   * 可以是正在进行的事务，也可以是直接的数据库连接
   */
  export type TxOrDb = Transaction | ReturnType<typeof client>

  /**
   * 事务上下文
   * 用于在嵌套函数调用中共享事务实例和副作用
   */
  const TransactionContext = Context.create<{
    tx: TxOrDb
    effects: (() => void | Promise<void>)[]
  }>()

  /**
   * 使用数据库连接或现有事务执行操作
   * 如果已有事务上下文，则使用该事务；否则创建新连接
   * @param callback 数据库操作回调函数
   * @returns 操作结果
   */
  export async function use<T>(callback: (trx: TxOrDb) => Promise<T>) {
    try {
      const { tx } = TransactionContext.use()
      return tx.transaction(callback)
    } catch (err) {
      if (err instanceof Context.NotFound) {
        const effects: (() => void | Promise<void>)[] = []
        const result = await TransactionContext.provide(
          {
            effects,
            tx: client(),
          },
          () => callback(client()),
        )
        await Promise.all(effects.map((x) => x()))
        return result
      }
      throw err
    }
  }

  /**
   * 创建一个接受输入参数的数据库操作函数
   * @param callback 带输入参数的数据库操作回调
   * @returns 接受输入参数的函数
   */
  export async function fn<Input, T>(callback: (input: Input, trx: TxOrDb) => Promise<T>) {
    return (input: Input) => use(async (tx) => callback(input, tx))
  }

  /**
   * 注册事务副作用
   * 如果在事务上下文中，则将副作用添加到队列；否则立即执行
   * @param effect 副作用函数
   */
  export async function effect(effect: () => any | Promise<any>) {
    try {
      const { effects } = TransactionContext.use()
      effects.push(effect)
    } catch {
      await effect()
    }
  }

  /**
   * 执行数据库事务
   * 如果已有事务上下文，则使用该事务；否则创建新事务
   * @param callback 事务操作回调函数
   * @param config 事务配置选项
   * @returns 操作结果
   */
  export async function transaction<T>(callback: (tx: TxOrDb) => Promise<T>, config?: MySqlTransactionConfig) {
    try {
      const { tx } = TransactionContext.use()
      return callback(tx)
    } catch (err) {
      if (err instanceof Context.NotFound) {
        const effects: (() => void | Promise<void>)[] = []
        const result = await client().transaction(async (tx) => {
          return TransactionContext.provide({ tx, effects }, () => callback(tx))
        }, config)
        await Promise.all(effects.map((x) => x()))
        return result
      }
      throw err
    }
  }
}
