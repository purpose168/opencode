import { Snapshot } from "../../../snapshot"
import { bootstrap } from "../../bootstrap"
import { cmd } from "../cmd"

/**
 * 快照命令
 * 包含多个子命令，用于管理项目快照
 */
export const SnapshotCommand = cmd({
  /**
   * 命令定义：snapshot
   * 无参数，使用子命令
   */
  command: "snapshot",
  /**
   * 命令构建器
   * 注册子命令并要求必须提供子命令
   */
  builder: (yargs) =>
    yargs
      .command(TrackCommand)    // 跟踪命令
      .command(PatchCommand)    // 应用补丁命令
      .command(DiffCommand)     // 差异比较命令
      .demandCommand(),
  /**
   * 命令处理函数
   * 无实际处理逻辑，由子命令处理
   */
  async handler() {},
})

/**
 * 跟踪命令
 * 用于跟踪当前状态并生成快照
 */
const TrackCommand = cmd({
  /**
   * 命令定义：track
   * 无参数
   */
  command: "track",
  /**
   * 命令处理函数
   * 生成当前状态的快照并输出
   */
  async handler() {
    await bootstrap(process.cwd(), async () => {
      console.log(await Snapshot.track())
    })
  },
})

/**
 * 应用补丁命令
 * 用于应用指定哈希值的快照
 */
const PatchCommand = cmd({
  /**
   * 命令定义：patch <hash>
   * hash: 快照哈希值（必需参数）
   */
  command: "patch <hash>",
  /**
   * 命令构建器
   * 定义哈希值参数
   */
  builder: (yargs) =>
    yargs.positional("hash", {
      type: "string",
      description: "快照哈希值",
      demandOption: true,
    }),
  /**
   * 命令处理函数
   * 应用指定哈希值的快照并输出结果
   * @param args 命令行参数
   */
  async handler(args) {
    await bootstrap(process.cwd(), async () => {
      console.log(await Snapshot.patch(args.hash))
    })
  },
})

/**
 * 差异比较命令
 * 用于显示当前状态与指定哈希值快照之间的差异
 */
const DiffCommand = cmd({
  /**
   * 命令定义：diff <hash>
   * hash: 快照哈希值（必需参数）
   */
  command: "diff <hash>",
  /**
   * 命令构建器
   * 定义哈希值参数
   */
  builder: (yargs) =>
    yargs.positional("hash", {
      type: "string",
      description: "快照哈希值",
      demandOption: true,
    }),
  /**
   * 命令处理函数
   * 显示当前状态与指定哈希值快照之间的差异并输出
   * @param args 命令行参数
   */
  async handler(args) {
    await bootstrap(process.cwd(), async () => {
      console.log(await Snapshot.diff(args.hash))
    })
  },
})
