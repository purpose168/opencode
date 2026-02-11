import { A } from "@solidjs/router"

/**
 * 404页面组件
 * 当访问不存在的路由时显示
 */
export default function NotFound() {
  return (
    <main class="text-center mx-auto text-gray-700 p-4">
      <h1 class="max-6-xs text-6xl text-sky-700 font-thin uppercase my-16">未找到</h1>
      <p class="mt-8">
        访问{
          " "
        }
        <a href="https://solidjs.com" target="_blank" class="text-sky-600 hover:underline">
          solidjs.com
        </a>{
          " "
        }
        学习如何构建 Solid 应用。
      </p>
      <p class="my-4">
        <A href="/" class="text-sky-600 hover:underline">
          首页
        </A>
        {" - "}
        <A href="/about" class="text-sky-600 hover:underline">
          关于页面
        </A>
      </p>
    </main>
  )
}
