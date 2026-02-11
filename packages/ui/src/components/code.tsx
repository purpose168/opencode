import { type FileContents, File, FileOptions, LineAnnotation } from "@pierre/diffs"
import { ComponentProps, createEffect, createMemo, splitProps } from "solid-js"
import { createDefaultOptions, styleVariables } from "../pierre"
import { getWorkerPool } from "../pierre/worker"

/**
 * 代码组件属性
 * 扩展自 FileOptions 类型
 */
export type CodeProps<T = {}> = FileOptions<T> & {
  /** 文件内容 */
  file: FileContents
  /** 行注释数组 */
  annotations?: LineAnnotation<T>[]
  /** CSS 类名 */
  class?: string
  /** CSS 类名列表 */
  classList?: ComponentProps<"div">["classList"]
}

/**
 * 代码组件
 * 基于 Pierre diffs 实现的代码显示组件
 */
export function Code<T>(props: CodeProps<T>) {
  // 容器引用
  let container!: HTMLDivElement
  // 分离本地属性和传递给 File 的属性
  const [local, others] = splitProps(props, ["file", "class", "classList", "annotations"])

  // 创建文件实例
  const file = createMemo(
    () =>
      new File<T>(
        {
          // 合并默认选项和传递的选项
          ...createDefaultOptions<T>("unified"),
          ...others,
        },
        // 获取工作池
        getWorkerPool("unified"),
      ),
  )

  // 当属性变化时重新渲染
  createEffect(() => {
    // 清空容器
    container.innerHTML = ""
    // 渲染文件
    file().render({
      file: local.file,
      lineAnnotations: local.annotations,
      containerWrapper: container,
    })
  })

  return (
    <div
      data-component="code"
      style={styleVariables}
      classList={{
        ...(local.classList || {}),
        [local.class ?? ""]: !!local.class,
      }}
      ref={container}
    />
  )
}