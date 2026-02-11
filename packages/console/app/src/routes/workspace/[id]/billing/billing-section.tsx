import { action, useParams, useAction, createAsync, useSubmission, json } from "@solidjs/router"
import { createMemo, Match, Show, Switch, createEffect } from "solid-js"
import { createStore } from "solid-js/store"
import { Billing } from "@opencode-ai/console-core/billing.js"
import { withActor } from "~/context/auth.withActor"
import { IconCreditCard, IconStripe } from "~/component/icon"
import styles from "./billing-section.module.css"
import { createCheckoutUrl, formatBalance, queryBillingInfo } from "../../common"

// 创建会话 URL 的动作
const createSessionUrl = action(async (workspaceID: string, returnUrl: string) => {
  "use server"
  return json(
    await withActor(
      () =>
        Billing.generateSessionUrl({ returnUrl })
          .then((data) => ({ error: undefined, data }))
          .catch((e) => ({
            error: e.message as string,
            data: undefined,
          })),
      workspaceID,
    ),
    { revalidate: queryBillingInfo.key },
  )
}, "sessionUrl")

export function BillingSection() {
  const params = useParams()
  // 原始代码 - 为测试而注释
  const billingInfo = createAsync(() => queryBillingInfo(params.id!))
  const checkoutAction = useAction(createCheckoutUrl)
  const checkoutSubmission = useSubmission(createCheckoutUrl)
  const sessionAction = useAction(createSessionUrl)
  const sessionSubmission = useSubmission(createSessionUrl)
  const [store, setStore] = createStore({
    showAddBalanceForm: false,
    addBalanceAmount: billingInfo()?.reloadAmount.toString() ?? "",
    checkoutRedirecting: false,
    sessionRedirecting: false,
  })

  // 当账单信息变化时更新充值金额
  createEffect(() => {
    const info = billingInfo()
    if (info) {
      setStore("addBalanceAmount", info.reloadAmount.toString())
    }
  })
  // 格式化余额显示
  const balance = createMemo(() => formatBalance(billingInfo()?.balance ?? 0))

  // 点击结账按钮的处理函数
  async function onClickCheckout() {
    const amount = parseInt(store.addBalanceAmount)
    const baseUrl = window.location.href

    const checkout = await checkoutAction(params.id!, amount, baseUrl, baseUrl)
    if (checkout && checkout.data) {
      setStore("checkoutRedirecting", true)
      window.location.href = checkout.data
    }
  }

  // 点击会话按钮的处理函数
  async function onClickSession() {
    const baseUrl = window.location.href
    const sessionUrl = await sessionAction(params.id!, baseUrl)
    if (sessionUrl && sessionUrl.data) {
      setStore("sessionRedirecting", true)
      window.location.href = sessionUrl.data
    }
  }

  // 显示添加余额表单
  function showAddBalanceForm() {
    while (true) {
      checkoutSubmission.clear()
      if (!checkoutSubmission.result) break
    }
    setStore({
      showAddBalanceForm: true,
    })
  }

  // 隐藏添加余额表单
  function hideAddBalanceForm() {
    setStore("showAddBalanceForm", false)
    checkoutSubmission.clear()
  }

  // 测试用的模拟数据 - 取消注释下面的场景之一

  // 场景 1: 用户未添加账单详情且无余额
  // const balanceInfo = () => ({
  //   balance: 0,
  //   paymentMethodType: null as string | null,
  //   paymentMethodLast4: null as string | null,
  //   reload: false,
  //   reloadError: null as string | null,
  //   timeReloadError: null as Date | null,
  // })

  // 场景 2: 用户未添加账单详情但有余额
  // const balanceInfo = () => ({
  //   balance: 1500000000, // $15.00
  //   paymentMethodType: null as string | null,
  //   paymentMethodLast4: null as string | null,
  //   reload: false,
  //   reloadError: null as string | null,
  //   timeReloadError: null as Date | null
  // })

  // 场景 3: 用户已添加账单详情（启用自动充值）
  // const balanceInfo = () => ({
  //   balance: 750000000, // $7.50
  //   paymentMethodType: "card",
  //   paymentMethodLast4: "4242",
  //   reload: true,
  //   reloadError: null as string | null,
  //   timeReloadError: null as Date | null
  // })

  // 场景 4: 用户有账单详情但充值失败
  // const balanceInfo = () => ({
  //   balance: 250000000, // $2.50
  //   paymentMethodType: "card",
  //   paymentMethodLast4: "4242",
  //   reload: true,
  //   reloadError: "您的卡被拒绝。" as string,
  //   timeReloadError: new Date(Date.now() - 3600000) as Date // 1小时前
  // })

  // 场景 5: 用户有 Link 支付方式
  // const balanceInfo = () => ({
  //   balance: 500000000, // $5.00
  //   paymentMethodType: "link",
  //   paymentMethodLast4: null as string | null,
  //   reload: true,
  //   reloadError: null as string | null,
  //   timeReloadError: null as Date | null
  // })

  return (
    <section class={styles.root}>
      <div data-slot="section-title">
        <h2>账单管理</h2>
        <p>
          管理支付方式。如有任何问题，请 <a href="mailto:contact@anoma.ly">联系我们</a>。
        </p>
      </div>
      <div data-slot="section-content">
        <div data-slot="balance-display">
          <div data-slot="balance-amount">
            <span data-slot="balance-value">${balance()}</span>
            <span data-slot="balance-label">当前余额</span>
          </div>
          <Show when={billingInfo()?.customerID}>
            <div data-slot="balance-right-section">
              <Show
                when={!store.showAddBalanceForm}
                fallback={
                  <div data-slot="add-balance-form-container">
                    <div data-slot="add-balance-form">
                      <label>添加 $</label>
                      <input
                        data-component="input"
                        type="number"
                        min={billingInfo()?.reloadAmountMin.toString()}
                        step="1"
                        value={store.addBalanceAmount}
                        onInput={(e) => {
                          setStore("addBalanceAmount", e.currentTarget.value)
                          checkoutSubmission.clear()
                        }}
                        placeholder="输入金额"
                      />
                      <div data-slot="form-actions">
                        <button data-color="ghost" type="button" onClick={() => hideAddBalanceForm()}>
                          取消
                        </button>
                        <button
                          data-color="primary"
                          type="button"
                          disabled={!store.addBalanceAmount || checkoutSubmission.pending || store.checkoutRedirecting}
                          onClick={onClickCheckout}
                        >
                          {checkoutSubmission.pending || store.checkoutRedirecting ? "加载中..." : "添加"}
                        </button>
                      </div>
                    </div>
                    <Show when={checkoutSubmission.result && (checkoutSubmission.result as any).error}>
                      {(err: any) => <div data-slot="form-error">{err()}</div>}
                    </Show>
                  </div>
                }
              >
                <button data-color="primary" onClick={() => showAddBalanceForm()}>
                  添加余额
                </button>
              </Show>
              <div data-slot="credit-card">
                <div data-slot="card-icon">
                  <Switch fallback={<IconCreditCard style={{ width: "24px", height: "24px" }} />}>
                    <Match when={billingInfo()?.paymentMethodType === "link"}>
                      <IconStripe style={{ width: "24px", height: "24px" }} />
                    </Match>
                  </Switch>
                </div>
                <div data-slot="card-details">
                  <Switch>
                    <Match when={billingInfo()?.paymentMethodType === "card"}>
                      <Show when={billingInfo()?.paymentMethodLast4} fallback={<span data-slot="number">----</span>}>
                        <span data-slot="secret">••••</span>
                        <span data-slot="number">{billingInfo()?.paymentMethodLast4}</span>
                      </Show>
                    </Match>
                    <Match when={billingInfo()?.paymentMethodType === "link"}>
                      <span data-slot="type">已链接到 Stripe</span>
                    </Match>
                  </Switch>
                </div>
                <button
                  data-color="ghost"
                  disabled={sessionSubmission.pending || store.sessionRedirecting}
                  onClick={onClickSession}
                >
                  {sessionSubmission.pending || store.sessionRedirecting ? "加载中..." : "管理"}
                </button>
              </div>
            </div>
          </Show>
        </div>
        <Show when={!billingInfo()?.customerID}>
          <button
            data-slot="enable-billing-button"
            data-color="primary"
            disabled={checkoutSubmission.pending || store.checkoutRedirecting}
            onClick={onClickCheckout}
          >
            {checkoutSubmission.pending || store.checkoutRedirecting ? "加载中..." : "启用账单"}
          </button>
        </Show>
      </div>
    </section>
  )
}
