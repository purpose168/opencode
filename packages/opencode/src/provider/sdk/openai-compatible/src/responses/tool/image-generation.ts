import { createProviderDefinedToolFactoryWithOutputSchema } from "@ai-sdk/provider-utils"
import { z } from "zod/v4"

// 图像生成参数Schema定义
export const imageGenerationArgsSchema = z
  .object({
    background: z.enum(["auto", "opaque", "transparent"]).optional(), // 背景类型:自动、不透明、透明
    inputFidelity: z.enum(["low", "high"]).optional(), // 输入保真度:低、高
    inputImageMask: z
      .object({
        fileId: z.string().optional(), // 掩码图像的文件ID(可选)
        imageUrl: z.string().optional(), // Base64编码的掩码图像(可选)
      })
      .optional(), // 输入图像掩码(可选)
    model: z.string().optional(), // 使用的图像生成模型(可选)
    moderation: z.enum(["auto"]).optional(), // 生成图像的审核级别(可选)
    outputCompression: z.number().int().min(0).max(100).optional(), // 输出图像的压缩级别(可选)
    outputFormat: z.enum(["png", "jpeg", "webp"]).optional(), // 生成图像的输出格式(可选)
    partialImages: z.number().int().min(0).max(3).optional(), // 在流模式下生成的部分图像数量(可选)
    quality: z.enum(["auto", "low", "medium", "high"]).optional(), // 生成图像的质量(可选)
    size: z.enum(["1024x1024", "1024x1536", "1536x1024", "auto"]).optional(), // 生成图像的尺寸(可选)
  })
  .strict()

// 图像生成输出Schema定义
export const imageGenerationOutputSchema = z.object({
  result: z.string(), // 以base64编码的生成图像
})

// 图像生成参数类型定义
type ImageGenerationArgs = {
  /**
   * 生成图像的背景类型。默认为'auto'。
   */
  background?: "auto" | "opaque" | "transparent"

  /**
   * 生成图像的输入保真度。默认为'low'。
   */
  inputFidelity?: "low" | "high"

  /**
   * 用于修复的可选掩码。
   * 包含image_url(字符串,可选)和file_id(字符串,可选)。
   */
  inputImageMask?: {
    /**
     * 掩码图像的文件ID。
     */
    fileId?: string

    /**
     * Base64编码的掩码图像。
     */
    imageUrl?: string
  }

  /**
   * 要使用的图像生成模型。默认:gpt-image-1。
   */
  model?: string

  /**
   * 生成图像的审核级别。默认:auto。
   */
  moderation?: "auto"

  /**
   * 输出图像的压缩级别。默认:100。
   */
  outputCompression?: number

  /**
   * 生成图像的输出格式。
   * 可选png、webp或jpeg之一。
   * 默认:png
   */
  outputFormat?: "png" | "jpeg" | "webp"

  /**
   * 在流模式下生成的部分图像数量,从0(默认值)到3。
   */
  partialImages?: number

  /**
   * 生成图像的质量。
   * 可选low、medium、high或auto之一。默认:auto。
   */
  quality?: "auto" | "low" | "medium" | "high"

  /**
   * 生成图像的尺寸。
   * 可选1024x1024、1024x1536、1536x1024或auto之一。
   * 默认:auto。
   */
  size?: "auto" | "1024x1024" | "1024x1536" | "1536x1024"
}

// 图像生成工具工厂
// 创建具有输入和输出Schema的图像生成工具
const imageGenerationToolFactory = createProviderDefinedToolFactoryWithOutputSchema<
  {}, // 空输入类型
  {
    /**
     * 以base64编码的生成图像。
     */
    result: string
  },
  ImageGenerationArgs // 参数类型
>({
  id: "openai.image_generation", // 工具ID
  name: "image_generation", // 工具名称
  inputSchema: z.object({}), // 输入Schema(空对象)
  outputSchema: imageGenerationOutputSchema, // 输出Schema
})

// 图像生成函数
// 创建并返回图像生成工具实例
export const imageGeneration = (
  args: ImageGenerationArgs = {}, // 默认参数为空对象
) => {
  return imageGenerationToolFactory(args)
}
