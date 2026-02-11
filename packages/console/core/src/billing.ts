import { Stripe } from "stripe"
import { Database, eq, sql } from "./drizzle"
import { BillingTable, PaymentTable, UsageTable } from "./schema/billing.sql"
import { Actor } from "./actor"
import { fn } from "./util/fn"
import { z } from "zod"
import { Resource } from "@opencode-ai/console-resource"
import { Identifier } from "./identifier"
import { centsToMicroCents } from "./util/price"
import { User } from "./user"

/**
 * 账单管理命名空间
 * 提供账单查询、充值、支付和会话管理功能
 */
export namespace Billing {
  // Stripe 订单项名称：积分
  export const ITEM_CREDIT_NAME = "opencode credits"
  // Stripe 订单项名称：手续费
  export const ITEM_FEE_NAME = "processing fee"
  // 默认充值金额（美元）
  export const RELOAD_AMOUNT = 20
  // 最小充值金额（美元）
  export const RELOAD_AMOUNT_MIN = 10
  // 默认自动充值触发阈值（美元）
  export const RELOAD_TRIGGER = 5
  // 最小自动充值触发阈值（美元）
  export const RELOAD_TRIGGER_MIN = 5

  /**
   * 获取 Stripe 客户端
   * 使用环境变量中的密钥创建 Stripe 客户端
   * @returns Stripe 客户端实例
   */
  export const stripe = () =>
    new Stripe(Resource.STRIPE_SECRET_KEY.value, {
      apiVersion: "2025-03-31.basil",
      httpClient: Stripe.createFetchHttpClient(),
    })

  /**
   * 获取账单信息
   * @returns 当前工作区的账单信息
   */
  export const get = async () => {
    return Database.use(async (tx) =>
      tx
        .select({
          customerID: BillingTable.customerID,
          paymentMethodID: BillingTable.paymentMethodID,
          paymentMethodType: BillingTable.paymentMethodType,
          paymentMethodLast4: BillingTable.paymentMethodLast4,
          balance: BillingTable.balance,
          reload: BillingTable.reload,
          reloadAmount: BillingTable.reloadAmount,
          reloadTrigger: BillingTable.reloadTrigger,
          monthlyLimit: BillingTable.monthlyLimit,
          monthlyUsage: BillingTable.monthlyUsage,
          timeMonthlyUsageUpdated: BillingTable.timeMonthlyUsageUpdated,
          reloadError: BillingTable.reloadError,
          timeReloadError: BillingTable.timeReloadError,
        })
        .from(BillingTable)
        .where(eq(BillingTable.workspaceID, Actor.workspace()))
        .then((r) => r[0]),
    )
  }

  /**
   * 获取支付记录
   * @returns 最近 100 条支付记录，按创建时间降序排列
   */
  export const payments = async () => {
    return await Database.use((tx) =>
      tx
        .select()
        .from(PaymentTable)
        .where(eq(PaymentTable.workspaceID, Actor.workspace()))
        .orderBy(sql`${PaymentTable.timeCreated} DESC`)
        .limit(100),
    )
  }

  /**
   * 获取使用记录
   * @param page 页码（从 0 开始）
   * @param pageSize 每页大小（默认 50）
   * @returns 使用记录列表，按创建时间降序排列
   */
  export const usages = async (page = 0, pageSize = 50) => {
    return await Database.use((tx) =>
      tx
        .select()
        .from(UsageTable)
        .where(eq(UsageTable.workspaceID, Actor.workspace()))
        .orderBy(sql`${UsageTable.timeCreated} DESC`)
        .limit(pageSize)
        .offset(page * pageSize),
    )
  }

  /**
   * 计算手续费（美分）
   * 手续费计算公式：(x + 30) / 0.956 * 0.044 + 30
   * @param x 总金额（美分）
   * @returns 手续费（美分）
   */
  export const calculateFeeInCents = (x: number) => {
    // math: x = total - (total * 0.044 + 0.30)
    // math: x = total * (1-0.044) - 0.30
    // math: (x + 0.30) / 0.956 = total
    return Math.round(((x + 30) / 0.956) * 0.044 + 30)
  }

  /**
   * 执行自动充值
   * 使用 Stripe 创建发票并支付，更新账单余额
   * @throws 如果支付失败则记录错误并抛出异常
   */
  export const reload = async () => {
    // 获取账单信息
    const billing = await Database.use((tx) =>
      tx
        .select({
          customerID: BillingTable.customerID,
          paymentMethodID: BillingTable.paymentMethodID,
          reloadAmount: BillingTable.reloadAmount,
        })
        .from(BillingTable)
        .where(eq(BillingTable.workspaceID, Actor.workspace()))
        .then((rows) => rows[0]),
    )
    const customerID = billing.customerID
    const paymentMethodID = billing.paymentMethodID
    const amountInCents = (billing.reloadAmount ?? Billing.RELOAD_AMOUNT) * 100
    const paymentID = Identifier.create("payment")
    let invoice
    try {
      // 创建发票草稿
      const draft = await Billing.stripe().invoices.create({
        customer: customerID!,
        auto_advance: false,
        default_payment_method: paymentMethodID!,
        collection_method: "charge_automatically",
        currency: "usd",
      })
      // 添加积分订单项
      await Billing.stripe().invoiceItems.create({
        amount: amountInCents,
        currency: "usd",
        customer: customerID!,
        invoice: draft.id!,
        description: ITEM_CREDIT_NAME,
      })
      // 添加手续费订单项
      await Billing.stripe().invoiceItems.create({
        amount: calculateFeeInCents(amountInCents),
        currency: "usd",
        customer: customerID!,
        invoice: draft.id!,
        description: ITEM_FEE_NAME,
      })
      // 完成发票
      await Billing.stripe().invoices.finalizeInvoice(draft.id!)
      // 支付发票
      invoice = await Billing.stripe().invoices.pay(draft.id!, {
        off_session: true,
        payment_method: paymentMethodID!,
        expand: ["payments"],
      })
      // 检查支付状态
      if (invoice.status !== "paid" || invoice.payments?.data.length !== 1)
        throw new Error(invoice.last_finalization_error?.message)
    } catch (e: any) {
      console.error(e)
      // 记录充值错误
      await Database.use((tx) =>
        tx
          .update(BillingTable)
          .set({
            reloadError: e.message ?? "Payment failed.",
            timeReloadError: sql`now()`,
          })
          .where(eq(BillingTable.workspaceID, Actor.workspace())),
      )
      return
    }

    // 更新账单余额
    await Database.transaction(async (tx) => {
      await tx
        .update(BillingTable)
        .set({
          balance: sql`${BillingTable.balance} + ${centsToMicroCents(amountInCents)}`,
          reloadError: null,
          timeReloadError: null,
        })
        .where(eq(BillingTable.workspaceID, Actor.workspace()))
      // 插入支付记录
      await tx.insert(PaymentTable).values({
        workspaceID: Actor.workspace(),
        id: paymentID,
        amount: centsToMicroCents(amountInCents),
        invoiceID: invoice.id!,
        paymentID: invoice.payments?.data[0].payment.payment_intent as string,
        customerID,
      })
    })
  }

  /**
   * 设置月度限额
   * @param input 月度限额（美元）
   */
  export const setMonthlyLimit = fn(z.number(), async (input) => {
    return await Database.use((tx) =>
      tx
        .update(BillingTable)
        .set({
          monthlyLimit: input,
        })
        .where(eq(BillingTable.workspaceID, Actor.workspace())),
    )
  })

  /**
   * 生成结账会话 URL
   * 用于用户添加余额的支付流程
   * @param input 输入参数，包含成功 URL、取消 URL 和可选的金额
   * @returns Stripe Checkout 会话 URL
   * @throws 如果金额小于最小值则抛出错误
   */
  export const generateCheckoutUrl = fn(
    z.object({
      successUrl: z.string(),
      cancelUrl: z.string(),
      amount: z.number().optional(),
    }),
    async (input) => {
      const user = Actor.assert("user")
      const { successUrl, cancelUrl, amount } = input

      // 验证最小充值金额
      if (amount !== undefined && amount < Billing.RELOAD_AMOUNT_MIN) {
        throw new Error(`金额必须至少为 $${Billing.RELOAD_AMOUNT_MIN}`)
      }

      const email = await User.getAuthEmail(user.properties.userID)
      const customer = await Billing.get()
      const amountInCents = (amount ?? customer.reloadAmount ?? Billing.RELOAD_AMOUNT) * 100
      // 创建 Stripe Checkout 会话
      const session = await Billing.stripe().checkout.sessions.create({
        mode: "payment",
        billing_address_collection: "required",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: ITEM_CREDIT_NAME },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
          {
            price_data: {
              currency: "usd",
              product_data: { name: ITEM_FEE_NAME },
              unit_amount: calculateFeeInCents(amountInCents),
            },
            quantity: 1,
          },
        ],
        ...(customer.customerID
          ? {
              customer: customer.customerID,
              customer_update: {
                name: "auto",
              },
            }
          : {
              customer_email: email!,
              customer_creation: "always",
            }),
        currency: "usd",
        invoice_creation: {
          enabled: true,
        },
        payment_intent_data: {
          setup_future_usage: "on_session",
        },
        payment_method_types: ["card"],
        payment_method_data: {
          allow_redisplay: "always",
        },
        tax_id_collection: {
          enabled: true,
        },
        metadata: {
          workspaceID: Actor.workspace(),
          amount: amountInCents.toString(),
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      })

      return session.url
    },
  )

  /**
   * 生成会话 URL
   * 用于用户管理支付方式和账单信息
   * @param input 输入参数，包含返回 URL
   * @returns Stripe Billing Portal 会话 URL
   * @throws 如果没有 Stripe 客户 ID 则抛出错误
   */
  export const generateSessionUrl = fn(
    z.object({
      returnUrl: z.string(),
    }),
    async (input) => {
      const { returnUrl } = input

      const customer = await Billing.get()
      if (!customer?.customerID) {
        throw new Error("未找到 Stripe 客户 ID")
      }

      const session = await Billing.stripe().billingPortal.sessions.create({
        customer: customer.customerID,
        return_url: returnUrl,
      })

      return session.url
    },
  )

  /**
   * 生成收据 URL
   * 用于用户查看支付收据
   * @param input 输入参数，包含支付 ID
   * @returns 收据 URL
   * @throws 如果未找到费用或收据 URL 则抛出错误
   */
  export const generateReceiptUrl = fn(
    z.object({
      paymentID: z.string(),
    }),
    async (input) => {
      const { paymentID } = input

      const intent = await Billing.stripe().paymentIntents.retrieve(paymentID)
      if (!intent.latest_charge) throw new Error("未找到费用")

      const charge = await Billing.stripe().charges.retrieve(intent.latest_charge as string)
      if (!charge.receipt_url) throw new Error("未找到收据 URL")

      return charge.receipt_url
    },
  )
}
