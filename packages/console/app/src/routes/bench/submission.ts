import type { APIEvent } from "@solidjs/start/server"
import { Database } from "@opencode-ai/console-core/drizzle/index.js"
import { BenchmarkTable } from "@opencode-ai/console-core/schema/benchmark.sql.js"
import { Identifier } from "@opencode-ai/console-core/identifier.js"

/**
 * 提交请求体接口
 */
interface SubmissionBody {
  model: string  // 模型名称
  agent: string  // 代理名称
  result: string  // 基准测试结果
}

/**
 * 处理基准测试结果提交
 * @param event API 事件
 * @returns 响应结果
 */
export async function POST(event: APIEvent) {
  const body = (await event.request.json()) as SubmissionBody

  if (!body.model || !body.agent || !body.result) {
    return Response.json({ error: "所有字段都是必需的" }, { status: 400 })
  }

  await Database.use((tx) =>
    tx.insert(BenchmarkTable).values({
      id: Identifier.create("benchmark"),
      model: body.model,
      agent: body.agent,
      result: body.result,
    }),
  )

  return Response.json({ success: true }, { status: 200 })
}
