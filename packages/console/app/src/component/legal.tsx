import { A } from "@solidjs/router"

/**
 * 法律信息组件
 */
export function Legal() {
  return (
    <div data-component="legal">
      <span>
        ©{new Date().getFullYear()} <a href="https://anoma.ly">Anomaly</a>
      </span>
      <span>
        <A href="/brand">品牌</A>
      </span>
      <span>
        <A href="/legal/privacy-policy">隐私政策</A>
      </span>
      <span>
        <A href="/legal/terms-of-service">服务条款</A>
      </span>
    </div>
  )
}
