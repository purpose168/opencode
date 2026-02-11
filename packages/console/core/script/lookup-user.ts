import { Database, eq } from "../src/drizzle/index.js"
import { AuthTable } from "../src/schema/auth.sql"

// 从命令行获取输入
const email = process.argv[2]
if (!email) {
  console.error("用法: bun lookup-user.ts <邮箱>")
  process.exit(1)
}

// 根据邮箱查询用户认证信息
const authData = await printTable("认证信息", (tx) => tx.select().from(AuthTable).where(eq(AuthTable.subject, email)))
if (authData.length === 0) {
  console.error("未找到用户")
  process.exit(1)
}

// 根据账户ID查询所有相关认证信息
await printTable("认证信息", (tx) => tx.select().from(AuthTable).where(eq(AuthTable.accountID, authData[0].accountID)))

/**
 * 打印表格数据
 * @param title 表格标题
 * @param callback 查询数据的回调函数
 * @returns 查询到的数据
 */
function printTable(title: string, callback: (tx: Database.TxOrDb) => Promise<any[]>): Promise<any[]> {
  return Database.use(async (tx) => {
    const data = await callback(tx)
    console.log(`== ${title} ==`)
    console.table(data)
    return data
  })
}
