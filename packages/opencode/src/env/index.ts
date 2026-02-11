import { Instance } from "../project/instance" // 导入实例管理模块

export namespace Env {
  // 环境变量状态,获取当前进程的环境变量
  const state = Instance.state(() => {
    return process.env as Record<string, string | undefined>
  })

  // 获取指定环境变量的值
  export function get(key: string) {
    const env = state()
    return env[key]
  }

  // 获取所有环境变量
  export function all() {
    return state()
  }

  // 设置环境变量的值
  export function set(key: string, value: string) {
    const env = state()
    env[key] = value
  }

  // 删除指定的环境变量
  export function remove(key: string) {
    const env = state()
    delete env[key]
  }
}
