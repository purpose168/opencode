import fs from "fs/promises" // 导入文件系统Promise API
import os from "os" // 导入操作系统工具模块
import path from "path" // 导入路径处理模块
import { xdgCache, xdgConfig, xdgData, xdgState } from "xdg-basedir" // 导入XDG基础目录规范

const app = "opencode" // 应用程序名称

const data = path.join(xdgData!, app) // 数据目录路径
const cache = path.join(xdgCache!, app) // 缓存目录路径
const config = path.join(xdgConfig!, app) // 配置目录路径
const state = path.join(xdgState!, app) // 状态目录路径

export namespace Global {
  export const Path = {
    // 允许通过 OPENCODE_TEST_HOME 环境变量覆盖,用于测试隔离
    get home() {
      return process.env.OPENCODE_TEST_HOME || os.homedir()
    },
    data, // 数据目录
    bin: path.join(data, "bin"), // 二进制文件目录
    log: path.join(data, "log"), // 日志目录
    cache, // 缓存目录
    config, // 配置目录
    state, // 状态目录
  }
}

// 创建所有必要的目录
await Promise.all([
  fs.mkdir(Global.Path.data, { recursive: true }), // 创建数据目录
  fs.mkdir(Global.Path.config, { recursive: true }), // 创建配置目录
  fs.mkdir(Global.Path.state, { recursive: true }), // 创建状态目录
  fs.mkdir(Global.Path.log, { recursive: true }), // 创建日志目录
  fs.mkdir(Global.Path.bin, { recursive: true }), // 创建二进制文件目录
])

const CACHE_VERSION = "14" // 缓存版本号

// 读取当前缓存版本
const version = await Bun.file(path.join(Global.Path.cache, "version"))
  .text()
  .catch(() => "0")

// 如果缓存版本不匹配,则清空缓存目录
if (version !== CACHE_VERSION) {
  try {
    const contents = await fs.readdir(Global.Path.cache) // 读取缓存目录内容
    await Promise.all(
      contents.map((item) =>
        fs.rm(path.join(Global.Path.cache, item), {
          recursive: true,
          force: true,
        }),
      ),
    ) // 删除所有缓存文件
  } catch (e) {} // 忽略删除过程中的错误
  await Bun.file(path.join(Global.Path.cache, "version")).write(CACHE_VERSION) // 写入新的版本号
}
