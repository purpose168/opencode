/**
 * 文本输入框组件
 * 用于创建文本输入字段，支持单行和多行输入
 */
import { TextField as Kobalte } from "@kobalte/core/text-field"
import { createSignal, Show, splitProps } from "solid-js"
import type { ComponentProps } from "solid-js"
import { IconButton } from "./icon-button"
import { Tooltip } from "./tooltip"

/**
 * 文本输入框组件属性接口
 */
export interface TextFieldProps
  extends ComponentProps<typeof Kobalte.Input>,
    Partial<
      Pick<
        ComponentProps<typeof Kobalte>,
        | "name"
        | "defaultValue"
        | "value"
        | "onChange"
        | "onKeyDown"
        | "validationState"
        | "required"
        | "disabled"
        | "readOnly"
      >
    > {
  /** 输入框标签 */
  label?: string
  /** 是否隐藏标签（屏幕阅读器仍然可以访问） */
  hideLabel?: boolean
  /** 输入框描述文本 */
  description?: string
  /** 错误信息 */
  error?: string
  /** 输入框样式变体 */
  variant?: "normal" | "ghost"
  /** 是否可复制 */
  copyable?: boolean
  /** 是否为多行输入 */
  multiline?: boolean
}

/**
 * 文本输入框组件
 * 提供文本输入功能，支持单行/多行输入、复制功能、错误提示等
 */
export function TextField(props: TextFieldProps) {
  // 分离本地属性和其他属性
  const [local, others] = splitProps(props, [
    "name",
    "defaultValue",
    "value",
    "onChange",
    "onKeyDown",
    "validationState",
    "required",
    "disabled",
    "readOnly",
    "class",
    "label",
    "hideLabel",
    "description",
    "error",
    "variant",
    "copyable",
    "multiline",
  ])
  
  // 复制状态信号
  const [copied, setCopied] = createSignal(false)

  /**
   * 处理复制功能
   * 将输入框内容复制到剪贴板
   */
  async function handleCopy() {
    const value = local.value ?? local.defaultValue ?? ""
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  /**
   * 处理点击事件
   * 如果可复制，则执行复制操作
   */
  function handleClick() {
    if (local.copyable) handleCopy()
  }

  return (
    <Kobalte
      data-component="input"
      data-variant={local.variant || "normal"}
      name={local.name}
      defaultValue={local.defaultValue}
      value={local.value}
      onChange={local.onChange}
      onKeyDown={local.onKeyDown}
      onClick={handleClick}
      required={local.required}
      disabled={local.disabled}
      readOnly={local.readOnly}
      validationState={local.validationState}
    >
      {/* 条件渲染标签 */}
      <Show when={local.label}>
        <Kobalte.Label data-slot="input-label" classList={{ "sr-only": local.hideLabel }}>
          {local.label}
        </Kobalte.Label>
      </Show>
      
      {/* 输入框包装器 */}
      <div data-slot="input-wrapper">
        {/* 条件渲染单行或多行输入 */}
        <Show
          when={local.multiline}
          fallback={<Kobalte.Input {...others} data-slot="input-input" class={local.class} />}
        >
          <Kobalte.TextArea {...others} autoResize data-slot="input-input" class={local.class} />
        </Show>
        
        {/* 条件渲染复制按钮 */}
        <Show when={local.copyable}>
          <Tooltip value={copied() ? "已复制" : "复制到剪贴板"} placement="top" gutter={8}>
            <IconButton
              type="button"
              icon={copied() ? "check" : "copy"}
              variant="ghost"
              onClick={handleCopy}
              data-slot="input-copy-button"
            />
          </Tooltip>
        </Show>
      </div>
      
      {/* 条件渲染描述文本 */}
      <Show when={local.description}>
        <Kobalte.Description data-slot="input-description">{local.description}</Kobalte.Description>
      </Show>
      
      {/* 错误信息显示 */}
      <Kobalte.ErrorMessage data-slot="input-error">{local.error}</Kobalte.ErrorMessage>
    </Kobalte>
  )
}
