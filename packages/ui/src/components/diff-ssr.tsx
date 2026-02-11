import { DIFFS_TAG_NAME, FileDiff } from "@pierre/diffs"
import { PreloadMultiFileDiffResult } from "@pierre/diffs/ssr"
import { onCleanup, onMount, Show, splitProps } from "solid-js"
import { Dynamic, isServer } from "solid-js/web"
import { createDefaultOptions, styleVariables, type DiffProps } from "../pierre"
import { useWorkerPool } from "../context/worker-pool"

/**
 * 服务端渲染差异组件属性
 * 扩展自 DiffProps 类型，添加了服务端预加载的差异数据
 */
export type SSRDiffProps<T = {}> = DiffProps<T> & {
  /** 服务端预加载的差异结果 */
  preloadedDiff: PreloadMultiFileDiffResult<T>
}

/**
 * 服务端渲染差异组件
 * 用于在服务端预渲染差异内容，然后在客户端进行水合
 */
export function Diff<T>(props: SSRDiffProps<T>) {
  // 容器引用
  let container!: HTMLDivElement
  // 文件差异元素引用
  let fileDiffRef!: HTMLElement
  // 分离本地属性和传递给 FileDiff 的属性
  const [local, others] = splitProps(props, ["before", "after", "class", "classList", "annotations"])
  // 使用工作池
  const workerPool = useWorkerPool(props.diffStyle)

  // 文件差异实例
  let fileDiffInstance: FileDiff<T> | undefined
  // 清理函数数组
  const cleanupFunctions: Array<() => void> = []

  // 组件挂载时执行
  onMount(() => {
    // 只在客户端执行，且需要有预加载的差异数据
    if (isServer || !props.preloadedDiff) return
    
    // 创建 FileDiff 实例
    fileDiffInstance = new FileDiff<T>(
      {
        // 合并默认选项
        ...createDefaultOptions(props.diffStyle),
        // 合并其他属性
        ...others,
        // 合并预加载的差异数据
        ...props.preloadedDiff,
      },
      // 传递工作池
      workerPool,
    )
    
    // 设置文件容器引用（TypeScript 忽略错误，因为 fileContainer 是私有属性但在 SSR 水合时需要）
    // @ts-expect-error - fileContainer is private but needed for SSR hydration
    fileDiffInstance.fileContainer = fileDiffRef
    
    // 执行水合操作
    fileDiffInstance.hydrate({
      oldFile: local.before,
      newFile: local.after,
      lineAnnotations: local.annotations,
      fileContainer: fileDiffRef,
      containerWrapper: container,
    })

    // 水合注释插槽（已注释）
    // if (props.annotations.length > 0 && props.renderAnnotation != null) {
    //   for (const annotation of props.annotations) {
    //     const slotName = `annotation-${annotation.side}-${annotation.lineNumber}`;
    //     const slotElement = fileDiffRef.querySelector(
    //       `[slot="${slotName}"]`
    //     ) as HTMLElement;

    //     if (slotElement != null) {
    //       // Clear the static server-rendered content from the slot
    //       slotElement.innerHTML = '';

    //       // Mount a fresh SolidJS component into this slot using render().
    //       // This enables full SolidJS reactivity (signals, effects, etc.)
    //       const dispose = render(
    //         () => props.renderAnnotation!(annotation),
    //         slotElement
    //       );
    //       cleanupFunctions.push(dispose);
    //     }
    //   }
    // }
  })

  // 组件清理时执行
  onCleanup(() => {
    // 清理 FileDiff 事件处理器
    fileDiffInstance?.cleanUp()
    // 执行所有清理函数
    cleanupFunctions.forEach((dispose) => dispose())
  })

  return (
    <div data-component="diff" style={styleVariables} ref={container}>
      {/* 动态创建差异元素 */}
      <Dynamic component={DIFFS_TAG_NAME} ref={fileDiffRef} id="ssr-diff">
        {/* 在服务端渲染时，使用预渲染的 HTML 内容 */}
        <Show when={isServer}>
          <template shadowrootmode="open" innerHTML={props.preloadedDiff.prerenderedHTML} />
        </Show>
      </Dynamic>
    </div>
  )
}