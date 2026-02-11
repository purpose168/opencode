/**
 * 命名错误类
 * 
 * 提供一个抽象类用于创建命名错误类型，支持模式验证和对象转换
 */
import z from "zod"

/**
 * 命名错误抽象类
 * 
 * 扩展自标准 Error 类，添加了命名和数据验证功能
 */
export abstract class NamedError extends Error {
  /**
   * 获取错误模式
   * 
   * @returns Zod 模式对象
   */
  abstract schema(): z.core.$ZodType
  
  /**
   * 转换为对象
   * 
   * @returns 包含错误名称和数据的对象
   */
  abstract toObject(): { name: string; data: any }

  /**
   * 创建命名错误类
   * 
   * @template Name - 错误名称类型
   * @template Data - 错误数据模式类型
   * @param name - 错误名称
   * @param data - 错误数据模式
   * @returns 命名错误类
   */
  static create<Name extends string, Data extends z.core.$ZodType>(name: Name, data: Data) {
    // 创建错误模式
    const schema = z
      .object({
        name: z.literal(name),
        data,
      })
      .meta({
        ref: name,
      })
    
    // 创建并返回错误类
    const result = class extends NamedError {
      /**
       * 错误模式
       */
      public static readonly Schema = schema

      /**
       * 错误名称
       */
      public override readonly name = name as Name

      /**
       * 构造函数
       * 
       * @param data - 错误数据
       * @param options - 错误选项
       */
      constructor(
        public readonly data: z.input<Data>,
        options?: ErrorOptions,
      ) {
        super(name, options)
        this.name = name
      }

      /**
       * 检查是否为该错误类型的实例
       * 
       * @param input - 要检查的值
       * @returns 是否为该错误类型的实例
       */
      static isInstance(input: any): input is InstanceType<typeof result> {
        return typeof input === "object" && "name" in input && input.name === name
      }

      /**
       * 获取错误模式
       * 
       * @returns Zod 模式对象
       */
      schema() {
        return schema
      }

      /**
       * 转换为对象
       * 
       * @returns 包含错误名称和数据的对象
       */
      toObject() {
        return {
          name: name,
          data: this.data,
        }
      }
    }
    
    // 设置类名
    Object.defineProperty(result, "name", { value: name })
    return result
  }

  /**
   * 未知错误类型
   */
  public static readonly Unknown = NamedError.create(
    "UnknownError",
    z.object({
      message: z.string(),
    }),
  )
}
