import { FileDiff } from "@pierre/diffs"
import { createEffect, createMemo, onCleanup, splitProps } from "solid-js"
import { createDefaultOptions, type DiffProps, styleVariables } from "../pierre"
import { getWorkerPool } from "../pierre/worker"

// 线程元数据接口（已注释）
// interface ThreadMetadata {
//   threadId: string
// }
//
//

/**
 * 差异组件
 * 基于 Pierre diffs 实现的代码差异显示组件
 */
export function Diff<T>(props: DiffProps<T>) {
  // 容器引用
  let container!: HTMLDivElement
  // 分离本地属性和传递给 FileDiff 的属性
  const [local, others] = splitProps(props, ["before", "after", "class", "classList", "annotations"])

  // 创建文件差异实例
  const fileDiff = createMemo(
    () =>
      new FileDiff<T>(
        {
          // 合并默认选项
          ...createDefaultOptions(props.diffStyle),
          // 合并其他属性
          ...others,
        },
        // 获取工作池
        getWorkerPool(props.diffStyle),
      ),
  )

  // 当属性变化时重新渲染
  createEffect(() => {
    const diff = fileDiff()
    // 清空容器
    container.innerHTML = ""
    // 渲染差异
    diff.render({
      oldFile: local.before,
      newFile: local.after,
      lineAnnotations: local.annotations,
      containerWrapper: container,
    })

    // 清理函数
    onCleanup(() => {
      diff.cleanUp()
    })
  })

  return <div data-component="diff" style={styleVariables} ref={container} />
}
