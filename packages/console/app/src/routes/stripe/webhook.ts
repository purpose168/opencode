import { Billing } from "@opencode-ai/console-core/billing.js"
import type { APIEvent } from "@solidjs/start/server"
import { and, Database, eq, sql } from "@opencode-ai/console-core/drizzle/index.js"
import { BillingTable, PaymentTable } from "@opencode-ai/console-core/schema/billing.sql.js"
import { Identifier } from "@opencode-ai/console-core/identifier.js"
import { centsToMicroCents } from "@opencode-ai/console-core/util/price.js"
import { Actor } from "@opencode-ai/console-core/actor.js"
import { Resource } from "@opencode-ai/console-resource"

export async function POST(input: APIEvent) {
  const body = await Billing.stripe().webhooks.constructEventAsync(
    await input.request.text(),
    input.request.headers.get("stripe-signature")!,
    Resource.STRIPE_WEBHOOK_SECRET.value,
  )
  console.log(body.type, JSON.stringify(body, null, 2))

  return (async () => {
    if (body.type === "customer.updated") {
      // 检查默认支付方式是否变更
      const prevInvoiceSettings = body.data.previous_attributes?.invoice_settings ?? {}
      if (!("default_payment_method" in prevInvoiceSettings)) return "ignored"

      const customerID = body.data.object.id
      const paymentMethodID = body.data.object.invoice_settings.default_payment_method as string

      if (!customerID) throw new Error("未找到客户ID")
      if (!paymentMethodID) throw new Error("未找到支付方式ID")

      const paymentMethod = await Billing.stripe().paymentMethods.retrieve(paymentMethodID)
      await Database.use(async (tx) => {
        await tx
          .update(BillingTable)
          .set({
            paymentMethodID,
            paymentMethodLast4: paymentMethod.card?.last4 ?? null,
            paymentMethodType: paymentMethod.type,
          })
          .where(eq(BillingTable.customerID, customerID))
      })
    }
    if (body.type === "checkout.session.completed") {
      const workspaceID = body.data.object.metadata?.workspaceID
      const amountInCents = body.data.object.metadata?.amount && parseInt(body.data.object.metadata?.amount)
      const customerID = body.data.object.customer as string
      const paymentID = body.data.object.payment_intent as string
      const invoiceID = body.data.object.invoice as string

      if (!workspaceID) throw new Error("未找到工作区ID")
      if (!customerID) throw new Error("未找到客户ID")
      if (!amountInCents) throw new Error("未找到金额")
      if (!paymentID) throw new Error("未找到支付ID")
      if (!invoiceID) throw new Error("未找到发票ID")

      await Actor.provide("system", { workspaceID }, async () => {
        const customer = await Billing.get()
        if (customer?.customerID && customer.customerID !== customerID) throw new Error("客户ID不匹配")

        // 设置客户元数据
        if (!customer?.customerID) {
          await Billing.stripe().customers.update(customerID, {
            metadata: {
              workspaceID,
            },
          })
        }

        // 获取支付意图并展开支付方式信息
        const paymentIntent = await Billing.stripe().paymentIntents.retrieve(paymentID, {
          expand: ["payment_method"], // 展开支付方式字段
        })
        const paymentMethod = paymentIntent.payment_method
        // 检查支付方式是否存在且已展开（不是字符串ID）
        if (!paymentMethod || typeof paymentMethod === "string") throw new Error("支付方式未展开")

        await Database.transaction(async (tx) => {
          await tx
            .update(BillingTable)
            .set({
              balance: sql`${BillingTable.balance} + ${centsToMicroCents(amountInCents)}`,
              customerID,
              paymentMethodID: paymentMethod.id,
              paymentMethodLast4: paymentMethod.card?.last4 ?? null,
              paymentMethodType: paymentMethod.type,
              // 如果是首次启用计费，启用自动充值
              ...(customer?.customerID
                ? {}
                : {
                    reload: true,
                    reloadError: null,
                    timeReloadError: null,
                  }),
            })
            .where(eq(BillingTable.workspaceID, workspaceID))
          await tx.insert(PaymentTable).values({
            workspaceID,
            id: Identifier.create("payment"),
            amount: centsToMicroCents(amountInCents),
            paymentID,
            invoiceID,
            customerID,
          })
        })
      })
    }
    if (body.type === "charge.refunded") {
      const customerID = body.data.object.customer as string
      const paymentIntentID = body.data.object.payment_intent as string
      if (!customerID) throw new Error("未找到客户ID")
      if (!paymentIntentID) throw new Error("未找到支付ID")

      const workspaceID = await Database.use((tx) =>
        tx
          .select({
            workspaceID: BillingTable.workspaceID,
          })
          .from(BillingTable)
          .where(eq(BillingTable.customerID, customerID))
          .then((rows) => rows[0]?.workspaceID),
      )
      if (!workspaceID) throw new Error("未找到工作区ID")

      // 获取支付金额
      const amount = await Database.use((tx) =>
        tx
          .select({
            amount: PaymentTable.amount,
          })
          .from(PaymentTable)
          .where(and(eq(PaymentTable.paymentID, paymentIntentID), eq(PaymentTable.workspaceID, workspaceID)))
          .then((rows) => rows[0]?.amount),
      )
      if (!amount) throw new Error("未找到支付记录")

      await Database.transaction(async (tx) => {
        // 更新支付记录为已退款
        await tx
          .update(PaymentTable)
          .set({
            timeRefunded: new Date(body.created * 1000),
          })
          .where(and(eq(PaymentTable.paymentID, paymentIntentID), eq(PaymentTable.workspaceID, workspaceID)))

        // 从余额中扣除退款金额
        await tx
          .update(BillingTable)
          .set({
            balance: sql`${BillingTable.balance} - ${amount}`,
          })
          .where(eq(BillingTable.workspaceID, workspaceID))
      })
    }
  })()
    .then((message) => {
      return Response.json({ message: message ?? "完成" }, { status: 200 })
    })
    .catch((error: any) => {
      return Response.json({ message: error.message }, { status: 500 })
    })
}
