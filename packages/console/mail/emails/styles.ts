// @ts-nocheck

/**
 * 样式单位
 * 用于统一管理邮件中的间距和尺寸
 */
export const unit = 12

/**
 * 主题颜色定义
 */
export const PRIMARY_COLOR = "#211E1E" // 主色调
export const TEXT_COLOR = "#656363" // 文本颜色
export const LINK_COLOR = "#007AFF" // 链接颜色
export const LINK_BACKGROUND_COLOR = "#F9F8F8" // 链接背景色
export const BACKGROUND_COLOR = "#F0F0F1" // 页面背景色
export const SURFACE_DIVIDER_COLOR = "#D5D5D9" // 分隔线颜色

/**
 * 邮件正文样式
 */
export const body = {
  background: BACKGROUND_COLOR, // 使用定义的背景色
}

/**
 * 容器样式
 */
export const container = {
  minWidth: "600px", // 最小宽度
  padding: "64px 0px", // 上下内边距
}

/**
 * 内容框架样式
 */
export const frame = {
  padding: `${unit * 2}px`, // 内边距，使用单位的 2 倍
  border: `1px solid ${SURFACE_DIVIDER_COLOR}`, // 边框
  background: "#FFF", // 背景色
  borderRadius: "6px", // 圆角
  boxShadow: `0 1px 2px rgba(0,0,0,0.03),
              0 2px 4px rgba(0,0,0,0.03),
              0 2px 6px rgba(0,0,0,0.03)`, // 阴影效果
}

/**
 * 基础文本样式
 */
export const baseText = {
  fontFamily: "JetBrains Mono, monospace", // 字体
}

/**
 * 标题文本样式
 */
export const headingText = {
  color: PRIMARY_COLOR, // 使用主色调
  fontSize: "16px", // 字体大小
  fontStyle: "normal", // 字体样式
  fontWeight: 500, // 字重
  lineHeight: "normal", // 行高
}

/**
 * 内容文本样式
 */
export const contentText = {
  color: TEXT_COLOR, // 使用文本颜色
  fontSize: "14px", // 字体大小
  fontStyle: "normal", // 字体样式
  fontWeight: 400, // 字重
  lineHeight: "180%", // 行高
}

/**
 * 按钮文本样式
 */
export const buttonText = {
  color: "#FDFCFC", // 文本颜色
  fontSize: "16px", // 字体大小
  fontWeight: 500, // 字重
  margin: 0, // 外边距
  padding: 0, // 内边距
  display: "inline-flex", // 显示方式
  alignItems: "center", // 垂直对齐
  gap: "12px", // 间距
}

/**
 * 链接文本样式
 */
export const linkText = {
  color: LINK_COLOR, // 使用链接颜色
  fontSize: "14px", // 字体大小
  fontStyle: "normal", // 字体样式
  fontWeight: 400, // 字重
  lineHeight: "150%", // 行高
  textDecorationLine: "underline", // 下划线
  textDecorationStyle: "solid" as const, // 下划线样式
  textDecorationSkipInk: "auto" as const, // 下划线跳过墨水
  textDecorationThickness: "auto", // 下划线粗细
  textUnderlineOffset: "auto", // 下划线偏移
  textUnderlinePosition: "from-font", // 下划线位置
  borderRadius: "4px", // 圆角
  background: LINK_BACKGROUND_COLOR, // 使用链接背景色
  padding: "8px 12px", // 内边距
  textAlign: "center" as const, // 文本对齐
}

/**
 * 内容高亮文本样式
 */
export const contentHighlightText = {
  color: PRIMARY_COLOR, // 使用主色调
}

/**
 * 按钮样式
 */
export const button = {
  display: "inline-grid", // 显示方式
  padding: "8px 12px 8px 20px", // 内边距
  justifyContent: "center", // 水平对齐
  alignItems: "center", // 垂直对齐
  gap: "8px", // 间距
  flexShrink: "0", // 不收缩
  borderRadius: "4px", // 圆角
  backgroundColor: PRIMARY_COLOR, // 使用主色调作为背景
}
