import { InstanceBootstrap } from "../project/bootstrap" // 导入实例引导模块
import { Instance } from "../project/instance" // 导入实例管理模块

// 引导函数：在指定目录中初始化并执行回调函数
export async function bootstrap<T>(directory: string, cb: () => Promise<T>) {
  return Instance.provide({
    directory, // 工作目录
    init: InstanceBootstrap, // 初始化引导器
    fn: async () => {
      try {
        const result = await cb() // 执行回调函数
        return result // 返回结果
      } finally {
        await Instance.dispose() // 清理实例资源
      }
    },
  })
}
