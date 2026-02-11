import type { APIEvent } from "@solidjs/start/server"
import { AWS } from "@opencode-ai/console-core/aws.js"

/**
 * 企业表单数据接口
 */
interface EnterpriseFormData {
  name: string    // 姓名
  role: string    // 职位
  email: string   // 电子邮件
  message: string // 留言内容
}

/**
 * 处理企业咨询表单提交
 */
export async function POST(event: APIEvent) {
  try {
    // 解析请求体
    const body = (await event.request.json()) as EnterpriseFormData

    // 验证必填字段
    if (!body.name || !body.role || !body.email || !body.message) {
      return Response.json({ error: "所有字段都是必填的" }, { status: 400 })
    }

    // 验证电子邮件格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return Response.json({ error: "电子邮件格式无效" }, { status: 400 })
    }

    // 创建电子邮件内容
    const emailContent = `
${body.message}<br><br>
--<br>
${body.name}<br>
${body.role}<br>
${body.email}`.trim()

    // 使用 AWS SES 发送电子邮件
    await AWS.sendEmail({
      to: "contact@anoma.ly",
      subject: `企业咨询 - ${body.name}`,
      body: emailContent,
      replyTo: body.email,
    })

    return Response.json({ success: true, message: "表单提交成功" }, { status: 200 })
  } catch (error) {
    console.error("处理企业表单时出错:", error)
    return Response.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
