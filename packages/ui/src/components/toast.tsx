/**
 * 提示框组件
 * 用于显示临时的通知消息
 */
import { Toast as Kobalte, toaster } from "@kobalte/core/toast"
import type { ToastRootProps, ToastCloseButtonProps, ToastTitleProps, ToastDescriptionProps } from "@kobalte/core/toast"
import type { ComponentProps, JSX } from "solid-js"
import { Show } from "solid-js"
import { Portal } from "solid-js/web"
import { Icon, type IconProps } from "./icon"
import { IconButton } from "./icon-button"

/**
 * 提示框区域属性接口
 */
export interface ToastRegionProps extends ComponentProps<typeof Kobalte.Region> {}

/**
 * 提示框区域组件
 * 用于包裹提示框列表的容器，使用 Portal 渲染到 DOM 顶层
 */
function ToastRegion(props: ToastRegionProps) {
  return (
    <Portal>
      <Kobalte.Region data-component="toast-region" {...props}>
        <Kobalte.List data-slot="toast-list" />
      </Kobalte.Region>
    </Portal>
  )
}

/**
 * 提示框根组件属性接口
 */
export interface ToastRootComponentProps extends ToastRootProps {
  /** 自定义 CSS 类名 */
  class?: string
  /** 自定义 CSS 类名对象 */
  classList?: ComponentProps<"li">["classList"]
  /** 子元素 */
  children?: JSX.Element
}

/**
 * 提示框根组件
 * 提供提示框的基本结构
 */
function ToastRoot(props: ToastRootComponentProps) {
  return (
    <Kobalte
      data-component="toast"
      classList={{
        ...(props.classList ?? {}),
        [props.class ?? ""]: !!props.class,
      }}
      {...props}
    />
  )
}

/**
 * 提示框图标组件
 * 用于显示提示框的图标
 */
function ToastIcon(props: { name: IconProps["name"] }) {
  return (
    <div data-slot="toast-icon">
      <Icon name={props.name} />
    </div>
  )
}

/**
 * 提示框内容组件
 * 用于包裹提示框的内容
 */
function ToastContent(props: ComponentProps<"div">) {
  return <div data-slot="toast-content" {...props} />
}

/**
 * 提示框标题组件
 * 用于显示提示框的标题
 */
function ToastTitle(props: ToastTitleProps & ComponentProps<"div">) {
  return <Kobalte.Title data-slot="toast-title" {...props} />
}

/**
 * 提示框描述组件
 * 用于显示提示框的描述文本
 */
function ToastDescription(props: ToastDescriptionProps & ComponentProps<"div">) {
  return <Kobalte.Description data-slot="toast-description" {...props} />
}

/**
 * 提示框操作组件
 * 用于显示提示框的操作按钮
 */
function ToastActions(props: ComponentProps<"div">) {
  return <div data-slot="toast-actions" {...props} />
}

/**
 * 提示框关闭按钮组件
 * 用于关闭提示框
 */
function ToastCloseButton(props: ToastCloseButtonProps & ComponentProps<"button">) {
  return <Kobalte.CloseButton data-slot="toast-close-button" as={IconButton} icon="close" variant="ghost" {...props} />
}

/**
 * 提示框进度条轨道组件
 * 用于显示提示框的进度条背景
 */
function ToastProgressTrack(props: ComponentProps<typeof Kobalte.ProgressTrack>) {
  return <Kobalte.ProgressTrack data-slot="toast-progress-track" {...props} />
}

/**
 * 提示框进度条填充组件
 * 用于显示提示框的进度条填充部分
 */
function ToastProgressFill(props: ComponentProps<typeof Kobalte.ProgressFill>) {
  return <Kobalte.ProgressFill data-slot="toast-progress-fill" {...props} />
}

/**
 * 提示框组件集合
 * 包含所有提示框相关的子组件
 */
export const Toast = Object.assign(ToastRoot, {
  Region: ToastRegion,
  Icon: ToastIcon,
  Content: ToastContent,
  Title: ToastTitle,
  Description: ToastDescription,
  Actions: ToastActions,
  CloseButton: ToastCloseButton,
  ProgressTrack: ToastProgressTrack,
  ProgressFill: ToastProgressFill,
})

/**
 * 提示框管理器
 * 用于控制提示框的显示和隐藏
 */
export { toaster }

/**
 * 提示框变体类型
 */
export type ToastVariant = "default" | "success" | "error" | "loading"

/**
 * 提示框操作按钮接口
 */
export interface ToastAction {
  /** 按钮文本 */
  label: string
  /** 点击事件处理函数或关闭操作 */
  onClick: "dismiss" | (() => void)
}

/**
 * 提示框选项接口
 */
export interface ToastOptions {
  /** 提示框标题 */
  title?: string
  /** 提示框描述文本 */
  description?: string
  /** 提示框图标 */
  icon?: IconProps["name"]
  /** 提示框变体 */
  variant?: ToastVariant
  /** 提示框显示时长（毫秒） */
  duration?: number
  /** 是否持久显示（需要手动关闭） */
  persistent?: boolean
  /** 提示框操作按钮 */
  actions?: ToastAction[]
}

/**
 * 显示提示框
 * @param options 提示框选项或描述文本
 * @returns 提示框实例
 */
export function showToast(options: ToastOptions | string) {
  const opts = typeof options === "string" ? { description: options } : options
  return toaster.show((props) => (
    <Toast
      toastId={props.toastId}
      duration={opts.duration}
      persistent={opts.persistent}
      data-variant={opts.variant ?? "default"}
    >
      <Show when={opts.icon}>
        <Toast.Icon name={opts.icon!} />
      </Show>
      <Toast.Content>
        <Show when={opts.title}>
          <Toast.Title>{opts.title}</Toast.Title>
        </Show>
        <Show when={opts.description}>
          <Toast.Description>{opts.description}</Toast.Description>
        </Show>
        <Show when={opts.actions?.length}>
          <Toast.Actions>
            {opts.actions!.map((action) => (
              <button
                data-slot="toast-action"
                onClick={() => {
                  if (typeof action.onClick === "function") {
                    action.onClick()
                  }
                  toaster.dismiss(props.toastId)
                }}
              >
                {action.label}
              </button>
            ))}
          </Toast.Actions>
        </Show>
      </Toast.Content>
      <Toast.CloseButton />
    </Toast>
  ))
}

/**
 * 提示框 Promise 选项接口
 */
export interface ToastPromiseOptions<T, U = unknown> {
  /** 加载状态显示内容 */
  loading?: JSX.Element
  /** 成功状态显示内容 */
  success?: (data: T) => JSX.Element
  /** 错误状态显示内容 */
  error?: (error: U) => JSX.Element
}

/**
 * 显示 Promise 提示框
 * @param promise Promise 对象或返回 Promise 的函数
 * @param options 提示框选项
 * @returns 提示框实例
 */
export function showPromiseToast<T, U = unknown>(
  promise: Promise<T> | (() => Promise<T>),
  options: ToastPromiseOptions<T, U>,
) {
  return toaster.promise(promise, (props) => (
    <Toast
      toastId={props.toastId}
      data-variant={props.state === "pending" ? "loading" : props.state === "fulfilled" ? "success" : "error"}
    >
      <Toast.Content>
        <Toast.Description>
          {props.state === "pending" && options.loading}
          {props.state === "fulfilled" && options.success?.(props.data!)}
          {props.state === "rejected" && options.error?.(props.error)}
        </Toast.Description>
      </Toast.Content>
      <Toast.CloseButton />
    </Toast>
  ))
}
