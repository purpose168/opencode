import { createEffect, createSignal, For, Match, Show, Switch, type JSX } from "solid-js"
import { Collapsible } from "./collapsible"
import { Icon, IconProps } from "./icon"

/**
 * 工具触发器标题类型
 * 用于定义工具触发器的标题、副标题、参数和操作按钮
 */
export type TriggerTitle = {
  /** 工具标题文本 */
  title: string
  /** 标题的自定义CSS类名 */
  titleClass?: string
  /** 工具副标题文本 */
  subtitle?: string
  /** 副标题的自定义CSS类名 */
  subtitleClass?: string
  /** 工具参数数组 */
  args?: string[]
  /** 参数的自定义CSS类名 */
  argsClass?: string
  /** 操作按钮或其他JSX元素 */
  action?: JSX.Element
}

/**
 * 检查值是否为TriggerTitle类型
 * @param val 要检查的值
 * @returns 是否为TriggerTitle类型
 */
const isTriggerTitle = (val: any): val is TriggerTitle => {
  return (
    typeof val === "object" && val !== null && "title" in val && (typeof Node === "undefined" || !(val instanceof Node))
  )
}

/**
 * 基础工具组件属性
 */
export interface BasicToolProps {
  /** 工具图标名称 */
  icon: IconProps["name"]
  /** 工具触发器，可以是TriggerTitle对象或JSX元素 */
  trigger: TriggerTitle | JSX.Element
  /** 工具详细内容 */
  children?: JSX.Element
  /** 是否隐藏详细内容 */
  hideDetails?: boolean
  /** 默认是否展开 */
  defaultOpen?: boolean
  /** 是否强制展开 */
  forceOpen?: boolean
}

/**
 * 基础工具组件
 * 用于创建带有图标、标题和可折叠内容的工具项
 */
export function BasicTool(props: BasicToolProps) {
  // 创建展开状态信号
  const [open, setOpen] = createSignal(props.defaultOpen ?? false)

  // 当forceOpen为true时，强制设置为展开状态
  createEffect(() => {
    if (props.forceOpen) setOpen(true)
  })

  return (
    <Collapsible open={open()} onOpenChange={setOpen}>
      <Collapsible.Trigger>
        <div data-component="tool-trigger">
          <div data-slot="basic-tool-tool-trigger-content">
            {/* 工具图标 */}
            <Icon name={props.icon} size="small" />
            <div data-slot="basic-tool-tool-info">
              {/* 根据trigger类型渲染不同内容 */}
              <Switch>
                {/* 当trigger是TriggerTitle类型时 */}
                <Match when={isTriggerTitle(props.trigger) && props.trigger}>
                  {(trigger) => (
                    <div data-slot="basic-tool-tool-info-structured">
                      <div data-slot="basic-tool-tool-info-main">
                        {/* 工具标题 */}
                        <span
                          data-slot="basic-tool-tool-title"
                          classList={{
                            [trigger().titleClass ?? ""]: !!trigger().titleClass,
                          }}
                        >
                          {trigger().title}
                        </span>
                        {/* 工具副标题（如果有） */}
                        <Show when={trigger().subtitle}>
                          <span
                            data-slot="basic-tool-tool-subtitle"
                            classList={{
                              [trigger().subtitleClass ?? ""]: !!trigger().subtitleClass,
                            }}
                          >
                            {trigger().subtitle}
                          </span>
                        </Show>
                        {/* 工具参数（如果有） */}
                        <Show when={trigger().args?.length}>
                          <For each={trigger().args}>
                            {(arg) => (
                              <span
                                data-slot="basic-tool-tool-arg"
                                classList={{
                                  [trigger().argsClass ?? ""]: !!trigger().argsClass,
                                }}
                              >
                                {arg}
                              </span>
                            )}
                          </For>
                        </Show>
                      </div>
                      {/* 操作按钮（如果有） */}
                      <Show when={trigger().action}>{trigger().action}</Show>
                    </div>
                  )}
                </Match>
                {/* 当trigger是JSX元素时 */}
                <Match when={true}>{props.trigger as JSX.Element}</Match>
              </Switch>
            </div>
          </div>
          {/* 展开/收起箭头（如果有子内容且不隐藏详细信息） */}
          <Show when={props.children && !props.hideDetails}>
            <Collapsible.Arrow />
          </Show>
        </div>
      </Collapsible.Trigger>
      {/* 可折叠内容（如果有子内容且不隐藏详细信息） */}
      <Show when={props.children && !props.hideDetails}>
        <Collapsible.Content>{props.children}</Collapsible.Content>
      </Show>
    </Collapsible>
  )
}

/**
 * 通用工具组件
 * 简化版的BasicTool，只需要工具名称
 */
export function GenericTool(props: { tool: string; hideDetails?: boolean }) {
  return <BasicTool icon="mcp" trigger={{ title: props.tool }} hideDetails={props.hideDetails} />
}