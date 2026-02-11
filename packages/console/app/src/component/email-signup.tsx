import { action, useSubmission } from "@solidjs/router"
import dock from "../asset/lander/dock.png"
import { Resource } from "@opencode-ai/console-resource"
import { Show } from "solid-js"

/**
 * 电子邮件注册服务器操作
 * @param formData 表单数据
 * @returns 注册结果
 */
const emailSignup = action(async (formData: FormData) => {
  "use server"
  // 获取电子邮件地址
  const emailAddress = formData.get("email")!
  // EmailOctopus 列表 ID
  const listId = "8b9bb82c-9d5f-11f0-975f-0df6fd1e4945"
  
  // 调用 EmailOctopus API 添加联系人
  const response = await fetch(`https://api.emailoctopus.com/lists/${listId}/contacts`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${Resource.EMAILOCTOPUS_API_KEY.value}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: emailAddress,
    }),
  })
  
  // 打印响应结果
  console.log(response)
  return true
})

/**
 * 电子邮件注册组件
 */
export function EmailSignup() {
  // 使用提交状态
  const submission = useSubmission(emailSignup)
  
  return (
    <section data-component="email">
      <div data-slot="section-title">
        <h3>率先了解我们的新产品发布</h3>
        <p>加入等待列表，获取早期访问权限。</p>
      </div>
      <form data-slot="form" action={emailSignup} method="post">
        <input type="email" name="email" placeholder="电子邮件地址" required />
        <button type="submit" disabled={submission.pending}>
          订阅
        </button>
      </form>
      <Show when={submission.result}>
        <div style="color: #03B000; margin-top: 24px;">
          即将完成，请检查您的收件箱并确认您的电子邮件地址
        </div>
      </Show>
      <Show when={submission.error}>
        <div style="color: #FF408F; margin-top: 24px;">{submission.error}</div>
      </Show>
    </section>
  )
}
