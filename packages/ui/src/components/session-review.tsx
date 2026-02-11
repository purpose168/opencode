/**
 * 会话回顾组件
 * 用于显示会话中的文件变更，支持统一和拆分两种差异显示模式
 */
import { Accordion } from "./accordion"
import { Button } from "./button"
import { RadioGroup } from "./radio-group"
import { DiffChanges } from "./diff-changes"
import { FileIcon } from "./file-icon"
import { Icon } from "./icon"
import { StickyAccordionHeader } from "./sticky-accordion-header"
import { useDiffComponent } from "../context/diff"
import { getDirectory, getFilename } from "@opencode-ai/util/path"
import { For, Match, Show, Switch, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { type FileDiff } from "@opencode-ai/sdk/v2"
import { PreloadMultiFileDiffResult } from "@pierre/diffs/ssr"
import { Dynamic } from "solid-js/web"
import { checksum } from "@opencode-ai/util/encode"

/**
 * 会话回顾差异显示样式
 */
export type SessionReviewDiffStyle = "unified" | "split"

/**
 * 会话回顾组件属性接口
 */
export interface SessionReviewProps {
  /** 是否使用拆分模式 */
  split?: boolean
  /** 差异显示样式 */
  diffStyle?: SessionReviewDiffStyle
  /** 差异显示样式变更回调函数 */
  onDiffStyleChange?: (diffStyle: SessionReviewDiffStyle) => void
  /** 自定义 CSS 类名 */
  class?: string
  /** 自定义 CSS 类名对象 */
  classList?: Record<string, boolean | undefined>
  /** 自定义组件类名 */
  classes?: { root?: string; header?: string; container?: string }
  /** 自定义操作按钮 */
  actions?: JSX.Element
  /** 文件差异数组 */
  diffs: (FileDiff & { preloaded?: PreloadMultiFileDiffResult<any> })[]
}

/**
 * 会话回顾组件
 * 显示会话中的文件变更，支持统一和拆分两种差异显示模式
 */
export const SessionReview = (props: SessionReviewProps) => {
  // 获取差异组件
  const diffComponent = useDiffComponent()
  // 创建状态存储
  const [store, setStore] = createStore({
    // 当差异数量大于 10 时默认折叠所有，否则默认展开所有
    open: props.diffs.length > 10 ? [] : props.diffs.map((d) => d.file),
  })

  /**
   * 获取差异显示样式
   * @returns 差异显示样式
   */
  const diffStyle = () => props.diffStyle ?? (props.split ? "split" : "unified")

  /**
   * 处理折叠状态变更
   * @param open - 打开的文件数组
   */
  const handleChange = (open: string[]) => {
    setStore("open", open)
  }

  /**
   * 处理展开或折叠所有
   */
  const handleExpandOrCollapseAll = () => {
    if (store.open.length > 0) {
      setStore("open", [])
    } else {
      setStore(
        "open",
        props.diffs.map((d) => d.file),
      )
    }
  }

  return (
    <div
      data-component="session-review"
      classList={{
        ...(props.classList ?? {}),
        [props.classes?.root ?? ""]: !!props.classes?.root,
        [props.class ?? ""]: !!props.class,
      }}
    >
      {/* 头部 */}
      <div
        data-slot="session-review-header"
        classList={{
          [props.classes?.header ?? ""]: !!props.classes?.header,
        }}
      >
        <div data-slot="session-review-title">Session changes</div>
        <div data-slot="session-review-actions">
          {/* 差异显示样式选择 */}
          <Show when={props.onDiffStyleChange}>
            <RadioGroup
              options={["unified", "split"] as const}
              current={diffStyle()}
              value={(style) => style}
              label={(style) => (style === "unified" ? "Unified" : "Split")}
              onSelect={(style) => style && props.onDiffStyleChange?.(style)}
            />
          </Show>
          {/* 展开/折叠所有按钮 */}
          <Button size="normal" icon="chevron-grabber-vertical" onClick={handleExpandOrCollapseAll}>
            <Switch>
              <Match when={store.open.length > 0}>Collapse all</Match>
              <Match when={true}>Expand all</Match>
            </Switch>
          </Button>
          {/* 自定义操作 */}
          {props.actions}
        </div>
      </div>
      {/* 容器 */}
      <div
        data-slot="session-review-container"
        classList={{
          [props.classes?.container ?? ""]: !!props.classes?.container,
        }}
      >
        {/* 手风琴组件 */}
        <Accordion multiple value={store.open} onChange={handleChange}>
          <For each={props.diffs}>
            {(diff) => (
              <Accordion.Item value={diff.file} data-slot="session-review-accordion-item">
                {/* 粘性头部 */}
                <StickyAccordionHeader>
                  <Accordion.Trigger>
                    <div data-slot="session-review-trigger-content">
                      {/* 文件信息 */}
                      <div data-slot="session-review-file-info">
                        <FileIcon node={{ path: diff.file, type: "file" }} />
                        <div data-slot="session-review-file-name-container">
                          <Show when={diff.file.includes("/")}>
                            <span data-slot="session-review-directory">{getDirectory(diff.file)}&lrm;</span>
                          </Show>
                          <span data-slot="session-review-filename">{getFilename(diff.file)}</span>
                        </div>
                      </div>
                      {/* 操作 */}
                      <div data-slot="session-review-trigger-actions">
                        <DiffChanges changes={diff} />
                        <Icon name="chevron-grabber-vertical" size="small" />
                      </div>
                    </div>
                  </Accordion.Trigger>
                </StickyAccordionHeader>
                {/* 内容 */}
                <Accordion.Content data-slot="session-review-accordion-content">
                  <Dynamic
                    component={diffComponent}
                    preloadedDiff={diff.preloaded}
                    diffStyle={diffStyle()}
                    before={{
                      name: diff.file!,
                      contents: diff.before!,
                      cacheKey: checksum(diff.before),
                    }}
                    after={{
                      name: diff.file!,
                      contents: diff.after!,
                      cacheKey: checksum(diff.after),
                    }}
                  />
                </Accordion.Content>
              </Accordion.Item>
            )}
          </For>
        </Accordion>
      </div>
    </div>
  )
}
