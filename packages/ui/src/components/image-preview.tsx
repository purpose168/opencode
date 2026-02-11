/**
 * 图片预览组件
 * 用于在对话框中显示图片预览
 */
import { Dialog as Kobalte } from "@kobalte/core/dialog"
import { IconButton } from "./icon-button"

/**
 * 图片预览组件的属性接口
 */
export interface ImagePreviewProps {
  /** 图片的源地址 */
  src: string
  /** 图片的替代文本，用于可访问性 */
  alt?: string
}

/**
 * 图片预览组件
 * 显示一个带有关闭按钮的图片预览对话框
 */
export function ImagePreview(props: ImagePreviewProps) {
  return (
    <div data-component="image-preview">
      <div data-slot="image-preview-container">
        <Kobalte.Content data-slot="image-preview-content">
          <div data-slot="image-preview-header">
            <Kobalte.CloseButton data-slot="image-preview-close" as={IconButton} icon="close" variant="ghost" />
          </div>
          <div data-slot="image-preview-body">
            <img src={props.src} alt={props.alt ?? "Image preview"} data-slot="image-preview-image" />
          </div>
        </Kobalte.Content>
      </div>
    </div>
  )
}
