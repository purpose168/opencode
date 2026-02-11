import { z } from "zod"

export function fn<T extends z.ZodType, Result>(schema: T, cb: (input: z.infer<T>) => Result) {
  const result = (input: z.infer<T>) => {
    const parsed = schema.parse(input)
    return cb(parsed)
  }
  result.force = (input: z.infer<T>) => cb(input)
  result.schema = schema
  return result
}

// fn函数：创建一个带有Zod模式验证的函数包装器
// 泛型参数：
//   T: Zod模式类型，继承自z.ZodType
//   Result: 回调函数的返回值类型
// 参数：
//   schema: Zod验证模式，用于验证输入数据
//   cb: 回调函数，接收验证后的输入并返回结果
// 返回值：
//   增强的函数对象，包含以下属性和方法：
//     - 主函数：执行输入验证并调用回调
//     - force方法：跳过验证直接调用回调
//     - schema属性：存储原始的Zod模式
// 功能：
//   - 创建一个包装函数，自动验证输入数据
//   - 使用schema.parse验证输入，验证失败时抛出错误
//   - 将验证后的数据传递给回调函数
//   - 提供force方法用于跳过验证（适用于已验证的数据）
//   - 附加schema属性以便外部访问验证模式
// 使用场景：
//   - 为API端点创建输入验证函数
//   - 确保函数参数符合预期的数据结构
//   - 在开发时提供类型安全和运行时验证
//   - 重用验证逻辑而不重复编写验证代码
