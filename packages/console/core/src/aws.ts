import { z } from "zod"
import { Resource } from "@opencode-ai/console-resource"
import { AwsClient } from "aws4fetch"
import { fn } from "./util/fn"

/**
 * AWS 服务命名空间
 * 提供 AWS SES 邮件发送功能
 */
export namespace AWS {
  let client: AwsClient // AWS 客户端实例（延迟初始化）

  /**
   * 创建 AWS 客户端
   * 使用环境变量中的凭证创建 SES 客户端
   * @returns AWS 客户端实例
   */
  const createClient = () => {
    if (!client) {
      client = new AwsClient({
        accessKeyId: Resource.AWS_SES_ACCESS_KEY_ID.value, // AWS 访问密钥 ID
        secretAccessKey: Resource.AWS_SES_SECRET_ACCESS_KEY.value, // AWS 秘密访问密钥
        region: "us-east-1", // AWS 区域
      })
    }
    return client
  }

  /**
   * 发送邮件
   * 使用 AWS SES 服务发送邮件
   * @param input 邮件参数，包含收件人、主题、正文和可选的回复地址
   * @throws 如果发送失败则抛出错误
   */
  export const sendEmail = fn(
    z.object({
      to: z.string(), // 收件人邮箱
      subject: z.string(), // 邮件主题
      body: z.string(), // 邮件正文
      replyTo: z.string().optional(), // 回复地址（可选）
    }),
    async (input) => {
      // 调用 AWS SES API 发送邮件
      const res = await createClient().fetch("https://email.us-east-1.amazonaws.com/v2/email/outbound-emails", {
        method: "POST",
        headers: {
          "X-Amz-Target": "SES.SendEmail", // SES API 目标
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          FromEmailAddress: `OpenCode Zen <contact@anoma.ly>`, // 发件人
          Destination: {
            ToAddresses: [input.to], // 收件人地址列表
          },
          ...(input.replyTo && { ReplyToAddresses: [input.replyTo] }), // 回复地址（如果提供）
          Content: {
            Simple: {
              Subject: {
                Charset: "UTF-8",
                Data: input.subject, // 邮件主题
              },
              Body: {
                Text: {
                  Charset: "UTF-8",
                  Data: input.body, // 纯文本正文
                },
                Html: {
                  Charset: "UTF-8",
                  Data: input.body, // HTML 正文
                },
              },
            },
          },
        }),
      })
      // 检查发送结果
      if (!res.ok) {
        throw new Error(`发送邮件失败：${res.statusText}`)
      }
    },
  )
}
