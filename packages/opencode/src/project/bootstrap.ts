import { ShareNext } from "@/share/share-next"
import { Log } from "@/util/log"
import { Bus } from "../bus"
import { Command } from "../command"
import { File } from "../file"
import { FileWatcher } from "../file/watcher"
import { Format } from "../format"
import { LSP } from "../lsp"
import { Plugin } from "../plugin"
import { Share } from "../share/share"
import { Instance } from "./instance"
import { Project } from "./project"
import { Vcs } from "./vcs"

// 实例引导初始化函数
// 负责初始化OpenCode实例的所有核心服务和组件
// 按照依赖顺序依次初始化各个子系统
export async function InstanceBootstrap() {
  // 记录引导初始化日志,输出当前目录信息
  Log.Default.info("bootstrapping", { directory: Instance.directory })

  // 初始化插件系统
  // 加载并初始化所有插件,插件可以扩展系统功能
  await Plugin.init()

  // 初始化共享功能(旧版)
  // 处理文件和内容的共享功能
  Share.init()

  // 初始化共享功能(新版)
  // 提供增强的共享功能实现
  ShareNext.init()

  // 初始化代码格式化功能
  // 提供代码格式化和美化服务
  Format.init()

  // 初始化语言服务器协议(LSP)
  // 提供代码补全、诊断、导航等IDE功能
  await LSP.init()

  // 初始化文件监视器
  // 监控文件系统变化,实时响应文件修改
  FileWatcher.init()

  // 初始化文件系统服务
  // 提供文件读写、遍历等文件操作功能
  File.init()

  // 初始化版本控制系统
  // 集成Git等版本控制功能
  Vcs.init()

  // 订阅命令执行事件
  // 当执行INIT命令时,将项目标记为已初始化状态
  Bus.subscribe(Command.Event.Executed, async (payload) => {
    if (payload.properties.name === Command.Default.INIT) {
      // 设置项目为已初始化状态
      await Project.setInitialized(Instance.project.id)
    }
  })
}
