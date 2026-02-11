import { DIFFS_TAG_NAME } from "@pierre/diffs"

/**
 * TypeScript 声明文件，用于 <diffs-container> 自定义元素
 * 这告诉 TypeScript <diffs-container> 在 SolidJS 中是一个有效的 JSX 元素
 * 在 .tsx 文件中使用 @pierre/diffs Web 组件时需要
 */

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      [DIFFS_TAG_NAME]: HTMLAttributes<HTMLElement>
    }
  }
}

export {}
