/**
 * Pierre 代码差异比较组件
 * 
 * 该文件定义了代码差异比较组件的类型、默认选项和样式变量
 * 用于显示代码的添加、删除和修改部分，支持多种显示样式
 */
import { DiffLineAnnotation, FileContents, FileDiffOptions } from "@pierre/diffs"
import { ComponentProps } from "solid-js"

/**
 * 差异比较组件的属性类型
 * 
 * @template T - 注释数据的类型
 * @property before - 比较前的文件内容
 * @property after - 比较后的文件内容
 * @property annotations - 可选的行注释数组
 * @property class - 可选的 CSS 类名
 * @property classList - 可选的 CSS 类列表
 */
export type DiffProps<T = {}> = FileDiffOptions<T> & {
  before: FileContents
  after: FileContents
  annotations?: DiffLineAnnotation<T>[]
  class?: string
  classList?: ComponentProps<"div">["classList"]
}

/**
 * 不安全的 CSS 样式定义
 * 
 * 包含差异比较组件的所有样式变量和默认样式
 * 使用 data-diffs 属性选择器来应用样式
 */
const unsafeCSS = `
[data-diffs] {
  --diffs-bg: light-dark(var(--diffs-light-bg), var(--diffs-dark-bg));
  --diffs-bg-buffer: var(--diffs-bg-buffer-override, light-dark( color-mix(in lab, var(--diffs-bg) 92%, var(--diffs-mixer)), color-mix(in lab, var(--diffs-bg) 92%, var(--diffs-mixer))));
  --diffs-bg-hover: var(--diffs-bg-hover-override, light-dark( color-mix(in lab, var(--diffs-bg) 97%, var(--diffs-mixer)), color-mix(in lab, var(--diffs-bg) 91%, var(--diffs-mixer))));
  --diffs-bg-context: var(--diffs-bg-context-override, light-dark( color-mix(in lab, var(--diffs-bg) 98.5%, var(--diffs-mixer)), color-mix(in lab, var(--diffs-bg) 92.5%, var(--diffs-mixer))));
  --diffs-bg-separator: var(--diffs-bg-separator-override, light-dark( color-mix(in lab, var(--diffs-bg) 96%, var(--diffs-mixer)), color-mix(in lab, var(--diffs-bg) 85%, var(--diffs-mixer))));
  --diffs-fg: light-dark(var(--diffs-light), var(--diffs-dark));
  --diffs-fg-number: var(--diffs-fg-number-override, light-dark(color-mix(in lab, var(--diffs-fg) 65%, var(--diffs-bg)), color-mix(in lab, var(--diffs-fg) 65%, var(--diffs-bg))));
  --diffs-deletion-base: var(--diffs-deletion-color-override, light-dark(var(--diffs-light-deletion-color, var(--diffs-deletion-color, rgb(255, 0, 0))), var(--diffs-dark-deletion-color, var(--diffs-deletion-color, rgb(255, 0, 0)))));
  --diffs-addition-base: var(--diffs-addition-color-override, light-dark(var(--diffs-light-addition-color, var(--diffs-addition-color, rgb(0, 255, 0))), var(--diffs-dark-addition-color, var(--diffs-addition-color, rgb(0, 255, 0)))));
  --diffs-modified-base: var(--diffs-modified-color-override, light-dark(var(--diffs-light-modified-color, var(--diffs-modified-color, rgb(0, 0, 255))), var(--diffs-dark-modified-color, var(--diffs-modified-color, rgb(0, 0, 255)))));
  --diffs-bg-deletion: var(--diffs-bg-deletion-override, light-dark( color-mix(in lab, var(--diffs-bg) 98%, var(--diffs-deletion-base)), color-mix(in lab, var(--diffs-bg) 92%, var(--diffs-deletion-base))));
  --diffs-bg-deletion-number: var(--diffs-bg-deletion-number-override, light-dark( color-mix(in lab, var(--diffs-bg) 91%, var(--diffs-deletion-base)), color-mix(in lab, var(--diffs-bg) 85%, var(--diffs-deletion-base))));
  --diffs-bg-deletion-hover: var(--diffs-bg-deletion-hover-override, light-dark( color-mix(in lab, var(--diffs-bg) 80%, var(--diffs-deletion-base)), color-mix(in lab, var(--diffs-bg) 75%, var(--diffs-deletion-base))));
  --diffs-bg-deletion-emphasis: var(--diffs-bg-deletion-emphasis-override, light-dark(rgb(from var(--diffs-deletion-base) r g b / 0.7), rgb(from var(--diffs-deletion-base) r g b / 0.1)));
  --diffs-bg-addition: var(--diffs-bg-addition-override, light-dark( color-mix(in lab, var(--diffs-bg) 98%, var(--diffs-addition-base)), color-mix(in lab, var(--diffs-bg) 92%, var(--diffs-addition-base))));
  --diffs-bg-addition-number: var(--diffs-bg-addition-number-override, light-dark( color-mix(in lab, var(--diffs-bg) 91%, var(--diffs-addition-base)), color-mix(in lab, var(--diffs-bg) 85%, var(--diffs-addition-base))));
  --diffs-bg-addition-hover: var(--diffs-bg-addition-hover-override, light-dark( color-mix(in lab, var(--diffs-bg) 80%, var(--diffs-addition-base)), color-mix(in lab, var(--diffs-bg) 70%, var(--diffs-addition-base))));
  --diffs-bg-addition-emphasis: var(--diffs-bg-addition-emphasis-override, light-dark(rgb(from var(--diffs-addition-base) r g b / 0.07), rgb(from var(--diffs-addition-base) r g b / 0.1)));
  --diffs-selection-base: var(--diffs-modified-base);
  --diffs-selection-number-fg: light-dark( color-mix(in lab, var(--diffs-selection-base) 65%, var(--diffs-mixer)), color-mix(in lab, var(--diffs-selection-base) 75%, var(--diffs-mixer)));
  --diffs-bg-selection: var(--diffs-bg-selection-override, light-dark( color-mix(in lab, var(--diffs-bg) 82%, var(--diffs-selection-base)), color-mix(in lab, var(--diffs-bg) 75%, var(--diffs-selection-base))));
  --diffs-bg-selection-number: var(--diffs-bg-selection-number-override, light-dark( color-mix(in lab, var(--diffs-bg) 75%, var(--diffs-selection-base)), color-mix(in lab, var(--diffs-bg) 60%, var(--diffs-selection-base))));
}

[data-diffs-header],
[data-diffs] {
  [data-separator-wrapper] {
    margin: 0 !important;
    border-radius: 0 !important;
  }
  [data-expand-button] {
    width: 6.5ch !important;
    height: 24px !important;
    justify-content: end !important;
    padding-left: 3ch !important;
    padding-inline: 1ch !important;
  }
  [data-separator-multi-button] {
    grid-template-rows: 10px 10px !important;
    [data-expand-button] {
      height: 12px !important;
    }
  }
  [data-separator-content] {
    height: 24px !important;
  }
  [data-code] {
    overflow-x: auto !important;
  }
}`

/**
 * 创建差异比较组件的默认选项
 * 
 * @template T - 注释数据的类型
 * @param style - 差异显示样式，可选值为 "unified" 或 "split"
 * @returns 包含所有默认选项的对象
 */
export function createDefaultOptions<T>(style: FileDiffOptions<T>["diffStyle"]) {
  return {
    theme: "OpenCode", // 主题名称
    themeType: "system", // 主题类型：系统
    disableLineNumbers: false, // 是否禁用行号
    overflow: "wrap", // 溢出处理方式：换行
    diffStyle: style ?? "unified", // 差异显示样式，默认为 unified
    diffIndicators: "bars", // 差异指示器类型：条形
    disableBackground: false, // 是否禁用背景色
    expansionLineCount: 20, // 展开的行数
    lineDiffType: style === "split" ? "word-alt" : "none", // 行差异类型
    maxLineDiffLength: 1000, // 最大行差异长度
    maxLineLengthForHighlighting: 1000, // 高亮显示的最大行长度
    disableFileHeader: true, // 是否禁用文件头部
    unsafeCSS, // 不安全的 CSS 样式
    // hunkSeparators(hunkData: HunkData) {
    //   const fragment = document.createDocumentFragment()
    //   const numCol = document.createElement("div")
    //   numCol.innerHTML = `<svg data-slot="diff-hunk-separator-line-number-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.97978 14.0204L8.62623 13.6668L9.33334 12.9597L9.68689 13.3133L9.33333 13.6668L8.97978 14.0204ZM12 16.3335L12.3535 16.6871L12 17.0406L11.6464 16.687L12 16.3335ZM14.3131 13.3133L14.6667 12.9597L15.3738 13.6668L15.0202 14.0204L14.6667 13.6668L14.3131 13.3133ZM12.5 16.0002V16.5002H11.5V16.0002H12H12.5ZM9.33333 13.6668L9.68689 13.3133L12.3535 15.9799L12 16.3335L11.6464 16.687L8.97978 14.0204L9.33333 13.6668ZM12 16.3335L11.6464 15.9799L14.3131 13.3133L14.6667 13.6668L15.0202 14.0204L12.3535 16.6871L12 16.3335ZM6.5 8.00016V7.50016H8.5V8.00016V8.50016H6.5V8.00016ZM9.5 8.00016V7.50016H11.5V8.00016V8.50016H9.5V8.00016ZM12.5 8.00016V7.50016H14.5V8.00016V8.50016H12.5V8.00016ZM15.5 8.00016V7.50016H17.5V8.00016V8.50016H15.5V8.00016ZM12 10.5002H12.5V16.0002H12H11.5V10.5002H12Z" fill="currentColor"/></svg> `
    //   numCol.dataset["slot"] = "diff-hunk-separator-line-number"
    //   fragment.appendChild(numCol)
    //   const contentCol = document.createElement("div")
    //   contentCol.dataset["slot"] = "diff-hunk-separator-content"
    //   const span = document.createElement("span")
    //   span.dataset["slot"] = "diff-hunk-separator-content-span"
    //   span.textContent = `${hunkData.lines} unmodified lines`
    //   contentCol.appendChild(span)
    //   fragment.appendChild(contentCol)
    //   return fragment
    // },
  } as const
}

/**
 * 差异比较组件的样式变量
 * 
 * 包含用于差异比较组件的所有 CSS 变量定义
 */
export const styleVariables = {
  "--diffs-font-family": "var(--font-family-mono)", // 差异比较的字体家族
  "--diffs-font-size": "var(--font-size-small)", // 差异比较的字体大小
  "--diffs-line-height": "24px", // 差异比较的行高
  "--diffs-tab-size": 2, // 差异比较的制表符大小
  "--diffs-font-features": "var(--font-family-mono--font-feature-settings)", // 差异比较的字体特性
  "--diffs-header-font-family": "var(--font-family-sans)", // 差异比较头部的字体家族
  "--diffs-gap-block": 0, // 差异比较的块间距
  "--diffs-min-number-column-width": "4ch", // 差异比较行号列的最小宽度
}
