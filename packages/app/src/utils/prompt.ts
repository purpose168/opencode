import type { Part, TextPart, FilePart } from "@opencode-ai/sdk/v2"
import type { Prompt, FileAttachmentPart } from "@/context/prompt"

/**
 * 从消息部分中提取提示内容，用于恢复到提示输入中。
 * 此函数被撤销操作使用，以恢复原始用户提示。
 */
export function extractPromptFromParts(parts: Part[]): Prompt {
  const result: Prompt = []
  let position = 0

  for (const part of parts) {
    if (part.type === "text") {
      const textPart = part as TextPart
      if (!textPart.synthetic && textPart.text) {
        result.push({
          type: "text",
          content: textPart.text,
          start: position,
          end: position + textPart.text.length,
        })
        position += textPart.text.length
      }
    } else if (part.type === "file") {
      const filePart = part as FilePart
      if (filePart.source?.type === "file") {
        const path = filePart.source.path
        const content = "@" + path
        const attachment: FileAttachmentPart = {
          type: "file",
          path,
          content,
          start: position,
          end: position + content.length,
        }
        result.push(attachment)
        position += content.length
      }
    }
  }

  if (result.length === 0) {
    result.push({ type: "text", content: "", start: 0, end: 0 })
  }

  return result
}
