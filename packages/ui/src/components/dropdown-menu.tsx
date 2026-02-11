import { DropdownMenu as Kobalte } from "@kobalte/core/dropdown-menu"
import { splitProps } from "solid-js"
import type { ComponentProps, ParentProps } from "solid-js"

/**
 * 下拉菜单组件属性
 * 扩展自 Kobalte DropdownMenu 组件的属性
 */
export interface DropdownMenuProps extends ComponentProps<typeof Kobalte> {}

/**
 * 下拉菜单触发器属性
 * 扩展自 Kobalte DropdownMenu.Trigger 组件的属性
 */
export interface DropdownMenuTriggerProps extends ComponentProps<typeof Kobalte.Trigger> {}

/**
 * 下拉菜单图标属性
 * 扩展自 Kobalte DropdownMenu.Icon 组件的属性
 */
export interface DropdownMenuIconProps extends ComponentProps<typeof Kobalte.Icon> {}

/**
 * 下拉菜单门户属性
 * 扩展自 Kobalte DropdownMenu.Portal 组件的属性
 */
export interface DropdownMenuPortalProps extends ComponentProps<typeof Kobalte.Portal> {}

/**
 * 下拉菜单内容属性
 * 扩展自 Kobalte DropdownMenu.Content 组件的属性
 */
export interface DropdownMenuContentProps extends ComponentProps<typeof Kobalte.Content> {}

/**
 * 下拉菜单箭头属性
 * 扩展自 Kobalte DropdownMenu.Arrow 组件的属性
 */
export interface DropdownMenuArrowProps extends ComponentProps<typeof Kobalte.Arrow> {}

/**
 * 下拉菜单分隔符属性
 * 扩展自 Kobalte DropdownMenu.Separator 组件的属性
 */
export interface DropdownMenuSeparatorProps extends ComponentProps<typeof Kobalte.Separator> {}

/**
 * 下拉菜单组属性
 * 扩展自 Kobalte DropdownMenu.Group 组件的属性
 */
export interface DropdownMenuGroupProps extends ComponentProps<typeof Kobalte.Group> {}

/**
 * 下拉菜单组标签属性
 * 扩展自 Kobalte DropdownMenu.GroupLabel 组件的属性
 */
export interface DropdownMenuGroupLabelProps extends ComponentProps<typeof Kobalte.GroupLabel> {}

/**
 * 下拉菜单项属性
 * 扩展自 Kobalte DropdownMenu.Item 组件的属性
 */
export interface DropdownMenuItemProps extends ComponentProps<typeof Kobalte.Item> {}

/**
 * 下拉菜单项标签属性
 * 扩展自 Kobalte DropdownMenu.ItemLabel 组件的属性
 */
export interface DropdownMenuItemLabelProps extends ComponentProps<typeof Kobalte.ItemLabel> {}

/**
 * 下拉菜单项描述属性
 * 扩展自 Kobalte DropdownMenu.ItemDescription 组件的属性
 */
export interface DropdownMenuItemDescriptionProps extends ComponentProps<typeof Kobalte.ItemDescription> {}

/**
 * 下拉菜单项指示器属性
 * 扩展自 Kobalte DropdownMenu.ItemIndicator 组件的属性
 */
export interface DropdownMenuItemIndicatorProps extends ComponentProps<typeof Kobalte.ItemIndicator> {}

/**
 * 下拉菜单单选按钮组属性
 * 扩展自 Kobalte DropdownMenu.RadioGroup 组件的属性
 */
export interface DropdownMenuRadioGroupProps extends ComponentProps<typeof Kobalte.RadioGroup> {}

/**
 * 下拉菜单单选按钮项属性
 * 扩展自 Kobalte DropdownMenu.RadioItem 组件的属性
 */
export interface DropdownMenuRadioItemProps extends ComponentProps<typeof Kobalte.RadioItem> {}

/**
 * 下拉菜单复选框项属性
 * 扩展自 Kobalte DropdownMenu.CheckboxItem 组件的属性
 */
export interface DropdownMenuCheckboxItemProps extends ComponentProps<typeof Kobalte.CheckboxItem> {}

/**
 * 下拉菜单子菜单属性
 * 扩展自 Kobalte DropdownMenu.Sub 组件的属性
 */
export interface DropdownMenuSubProps extends ComponentProps<typeof Kobalte.Sub> {}

/**
 * 下拉菜单子菜单触发器属性
 * 扩展自 Kobalte DropdownMenu.SubTrigger 组件的属性
 */
export interface DropdownMenuSubTriggerProps extends ComponentProps<typeof Kobalte.SubTrigger> {}

/**
 * 下拉菜单子菜单内容属性
 * 扩展自 Kobalte DropdownMenu.SubContent 组件的属性
 */
export interface DropdownMenuSubContentProps extends ComponentProps<typeof Kobalte.SubContent> {}

/**
 * 下拉菜单根组件
 * 基于 Kobalte DropdownMenu 实现的根组件
 */
function DropdownMenuRoot(props: DropdownMenuProps) {
  return <Kobalte {...props} data-component="dropdown-menu" />
}

/**
 * 下拉菜单触发器组件
 * 基于 Kobalte DropdownMenu.Trigger 实现的触发器组件
 */
function DropdownMenuTrigger(props: ParentProps<DropdownMenuTriggerProps>) {
  const [local, rest] = splitProps(props, ["class", "classList", "children"])
  return (
    <Kobalte.Trigger
      {...rest}
      data-slot="dropdown-menu-trigger"
      classList={{
        ...(local.classList ?? {}),
        [local.class ?? ""]: !!local.class,
      }}
    >
      {local.children}
    </Kobalte.Trigger>
  )
}

/**
 * 下拉菜单图标组件
 * 基于 Kobalte DropdownMenu.Icon 实现的图标组件
 */
function DropdownMenuIcon(props: ParentProps<DropdownMenuIconProps>) {
  const [local, rest] = splitProps(props, ["class", "classList", "children"])
  return (
    <Kobalte.Icon
      {...rest}
      data-slot="dropdown-menu-icon"
      classList={{
        ...(local.classList ?? {}),
        [local.class ?? ""]: !!local.class,
      }}
    >
      {local.children}
    </Kobalte.Icon>
  )
}

/**
 * 下拉菜单门户组件
 * 基于 Kobalte DropdownMenu.Portal 实现的门户组件
 */
function DropdownMenuPortal(props: DropdownMenuPortalProps) {
  return <Kobalte.Portal {...props} />
}

/**
 * 下拉菜单内容组件
 * 基于 Kobalte DropdownMenu.Content 实现的内容组件
 */
function DropdownMenuContent(props: ParentProps<DropdownMenuContentProps>) {
  const [local, rest] = splitProps(props, ["class", "classList", "children"])
  return (
    <Kobalte.Content
      {...rest}
      data-component="dropdown-menu-content"
      classList={{
        ...(local.classList ?? {}),
        [local.class ?? ""]: !!local.class,
      }}
    >
      {local.children}
    </Kobalte.Content>
  )
}

/**
 * 下拉菜单箭头组件
 * 基于 Kobalte DropdownMenu.Arrow 实现的箭头组件
 */
function DropdownMenuArrow(props: DropdownMenuArrowProps) {
  const [local, rest] = splitProps(props, ["class", "classList"])
  return (
    <Kobalte.Arrow
      {...rest}
      data-slot="dropdown-menu-arrow"
      classList={{
        ...(local.classList ?? {}),
        [local.class ?? ""]: !!local.class,
      }}
    />
  )
}

/**
 * 下拉菜单分隔符组件
 * 基于 Kobalte DropdownMenu.Separator 实现的分隔符组件
 */
function DropdownMenuSeparator(props: DropdownMenuSeparatorProps) {
  const [local, rest] = splitProps(props, ["class", "classList"])
  return (
    <Kobalte.Separator
      {...rest}
      data-slot="dropdown-menu-separator"
      classList={{
        ...(local.classList ?? {}),
        [local.class ?? ""]: !!local.class,
      }}
    />
  )
}

/**
 * 下拉菜单组组件
 * 基于 Kobalte DropdownMenu.Group 实现的组组件
 */
function DropdownMenuGroup(props: ParentProps<DropdownMenuGroupProps>) {
  const [local, rest] = splitProps(props, ["class", "classList", "children"])
  return (
    <Kobalte.Group
      {...rest}
      data-slot="dropdown-menu-group"
      classList={{
        ...(local.classList ?? {}),
        [local.class ?? ""]: !!local.class,
      }}
    >
      {local.children}
    </Kobalte.Group>
  )
}

/**
 * 下拉菜单组标签组件
 * 基于 Kobalte DropdownMenu.GroupLabel 实现的组标签组件
 */
function DropdownMenuGroupLabel(props: ParentProps<DropdownMenuGroupLabelProps>) {
  const [local, rest] = splitProps(props, ["class", "classList", "children"])
  return (
    <Kobalte.GroupLabel
      {...rest}
      data-slot="dropdown-menu-group-label"
      classList={{
        ...(local.classList ?? {}),
        [local.class ?? ""]: !!local.class,
      }}
    >
      {local.children}
    </Kobalte.GroupLabel>
  )
}

/**
 * 下拉菜单项组件
 * 基于 Kobalte DropdownMenu.Item 实现的菜单项组件
 */
function DropdownMenuItem(props: ParentProps<DropdownMenuItemProps>) {
  const [local, rest] = splitProps(props, ["class", "classList", "children"])
  return (
    <Kobalte.Item
      {...rest}
      data-slot="dropdown-menu-item"
      classList={{
        ...(local.classList ?? {}),
        [local.class ?? ""]: !!local.class,
      }}
    >
      {local.children}
    </Kobalte.Item>
  )
}

/**
 * 下拉菜单项标签组件
 * 基于 Kobalte DropdownMenu.ItemLabel 实现的菜单项标签组件
 */
function DropdownMenuItemLabel(props: ParentProps<DropdownMenuItemLabelProps>) {
  const [local, rest] = splitProps(props, ["class", "classList", "children"])
  return (
    <Kobalte.ItemLabel
      {...rest}
      data-slot="dropdown-menu-item-label"
      classList={{
        ...(local.classList ?? {}),
        [local.class ?? ""]: !!local.class,
      }}
    >
      {local.children}
    </Kobalte.ItemLabel>
  )
}

/**
 * 下拉菜单项描述组件
 * 基于 Kobalte DropdownMenu.ItemDescription 实现的菜单项描述组件
 */
function DropdownMenuItemDescription(props: ParentProps<DropdownMenuItemDescriptionProps>) {
  const [local, rest] = splitProps(props, ["class", "classList", "children"])
  return (
    <Kobalte.ItemDescription
      {...rest}
      data-slot="dropdown-menu-item-description"
      classList={{
        ...(local.classList ?? {}),
        [local.class ?? ""]: !!local.class,
      }}
    >
      {local.children}
    </Kobalte.ItemDescription>
  )
}

/**
 * 下拉菜单项指示器组件
 * 基于 Kobalte DropdownMenu.ItemIndicator 实现的菜单项指示器组件
 */
function DropdownMenuItemIndicator(props: ParentProps<DropdownMenuItemIndicatorProps>) {
  const [local, rest] = splitProps(props, ["class", "classList", "children"])
  return (
    <Kobalte.ItemIndicator
      {...rest}
      data-slot="dropdown-menu-item-indicator"
      classList={{
        ...(local.classList ?? {}),
        [local.class ?? ""]: !!local.class,
      }}
    >
      {local.children}
    </Kobalte.ItemIndicator>
  )
}

/**
 * 下拉菜单单选按钮组组件
 * 基于 Kobalte DropdownMenu.RadioGroup 实现的单选按钮组组件
 */
function DropdownMenuRadioGroup(props: ParentProps<DropdownMenuRadioGroupProps>) {
  const [local, rest] = splitProps(props, ["class", "classList", "children"])
  return (
    <Kobalte.RadioGroup
      {...rest}
      data-slot="dropdown-menu-radio-group"
      classList={{
        ...(local.classList ?? {}),
        [local.class ?? ""]: !!local.class,
      }}
    >
      {local.children}
    </Kobalte.RadioGroup>
  )
}

/**
 * 下拉菜单单选按钮项组件
 * 基于 Kobalte DropdownMenu.RadioItem 实现的单选按钮项组件
 */
function DropdownMenuRadioItem(props: ParentProps<DropdownMenuRadioItemProps>) {
  const [local, rest] = splitProps(props, ["class", "classList", "children"])
  return (
    <Kobalte.RadioItem
      {...rest}
      data-slot="dropdown-menu-radio-item"
      classList={{
        ...(local.classList ?? {}),
        [local.class ?? ""]: !!local.class,
      }}
    >
      {local.children}
    </Kobalte.RadioItem>
  )
}

/**
 * 下拉菜单复选框项组件
 * 基于 Kobalte DropdownMenu.CheckboxItem 实现的复选框项组件
 */
function DropdownMenuCheckboxItem(props: ParentProps<DropdownMenuCheckboxItemProps>) {
  const [local, rest] = splitProps(props, ["class", "classList", "children"])
  return (
    <Kobalte.CheckboxItem
      {...rest}
      data-slot="dropdown-menu-checkbox-item"
      classList={{
        ...(local.classList ?? {}),
        [local.class ?? ""]: !!local.class,
      }}
    >
      {local.children}
    </Kobalte.CheckboxItem>
  )
}

/**
 * 下拉菜单子菜单组件
 * 基于 Kobalte DropdownMenu.Sub 实现的子菜单组件
 */
function DropdownMenuSub(props: DropdownMenuSubProps) {
  return <Kobalte.Sub {...props} />
}

/**
 * 下拉菜单子菜单触发器组件
 * 基于 Kobalte DropdownMenu.SubTrigger 实现的子菜单触发器组件
 */
function DropdownMenuSubTrigger(props: ParentProps<DropdownMenuSubTriggerProps>) {
  const [local, rest] = splitProps(props, ["class", "classList", "children"])
  return (
    <Kobalte.SubTrigger
      {...rest}
      data-slot="dropdown-menu-sub-trigger"
      classList={{
        ...(local.classList ?? {}),
        [local.class ?? ""]: !!local.class,
      }}
    >
      {local.children}
    </Kobalte.SubTrigger>
  )
}

/**
 * 下拉菜单子菜单内容组件
 * 基于 Kobalte DropdownMenu.SubContent 实现的子菜单内容组件
 */
function DropdownMenuSubContent(props: ParentProps<DropdownMenuSubContentProps>) {
  const [local, rest] = splitProps(props, ["class", "classList", "children"])
  return (
    <Kobalte.SubContent
      {...rest}
      data-component="dropdown-menu-sub-content"
      classList={{
        ...(local.classList ?? {}),
        [local.class ?? ""]: !!local.class,
      }}
    >
      {local.children}
    </Kobalte.SubContent>
  )
}

/**
 * 下拉菜单组件
 * 组合了根组件、触发器、内容、菜单项、子菜单等所有相关组件
 */
export const DropdownMenu = Object.assign(DropdownMenuRoot, {
  Trigger: DropdownMenuTrigger,
  Icon: DropdownMenuIcon,
  Portal: DropdownMenuPortal,
  Content: DropdownMenuContent,
  Arrow: DropdownMenuArrow,
  Separator: DropdownMenuSeparator,
  Group: DropdownMenuGroup,
  GroupLabel: DropdownMenuGroupLabel,
  Item: DropdownMenuItem,
  ItemLabel: DropdownMenuItemLabel,
  ItemDescription: DropdownMenuItemDescription,
  ItemIndicator: DropdownMenuItemIndicator,
  RadioGroup: DropdownMenuRadioGroup,
  RadioItem: DropdownMenuRadioItem,
  CheckboxItem: DropdownMenuCheckboxItem,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
})
