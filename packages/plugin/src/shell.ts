// 定义 Shell 函数类型
export type ShellFunction = (input: Uint8Array) => Uint8Array

// 定义 Shell 表达式类型
export type ShellExpression =
  | { toString(): string }
  | Array<ShellExpression>
  | string
  | { raw: string }
  | ReadableStream

// 定义 Bun Shell 接口
export interface BunShell {
  (strings: TemplateStringsArray, ...expressions: ShellExpression[]): BunShellPromise

  /**
   * 对给定的模式执行类似 bash 的大括号扩展。
   * @param pattern - 要扩展的大括号模式
   */
  braces(pattern: string): string[]

  /**
   * 对输入到 shell 命令的字符串进行转义。
   */
  escape(input: string): string

  /**
   * 更改由此实例创建的 shell 的默认环境变量。
   */
  env(newEnv?: Record<string, string | undefined>): BunShell

  /**
   * 由此实例创建的 shell 使用的默认工作目录。
   */
  cwd(newCwd?: string): BunShell

  /**
   * 配置 shell 在非零退出代码时不抛出异常。
   */
  nothrow(): BunShell

  /**
   * 配置 shell 是否应在非零退出代码时抛出异常。
   */
  throws(shouldThrow: boolean): BunShell
}

// 定义 Bun Shell Promise 接口
export interface BunShellPromise extends Promise<BunShellOutput> {
  readonly stdin: WritableStream

  /**
   * 更改 shell 的当前工作目录。
   */
  cwd(newCwd: string): this

  /**
   * 为 shell 设置环境变量。
   */
  env(newEnv: Record<string, string> | undefined): this

  /**
   * 默认情况下，shell 会写入当前进程的 stdout 和 stderr，并缓冲该输出。
   * 这将配置 shell 仅缓冲输出。
   */
  quiet(): this

  /**
   * 从 stdout 逐行读取为字符串
   * 自动调用 quiet() 以禁用输出到 stdout。
   */
  lines(): AsyncIterable<string>

  /**
   * 从 stdout 读取为字符串。
   * 自动调用 quiet() 以禁用输出到 stdout。
   */
  text(encoding?: BufferEncoding): Promise<string>

  /**
   * 从 stdout 读取为 JSON 对象
   * 自动调用 quiet()
   */
  json(): Promise<any>

  /**
   * 从 stdout 读取为 ArrayBuffer
   * 自动调用 quiet()
   */
  arrayBuffer(): Promise<ArrayBuffer>

  /**
   * 从 stdout 读取为 Blob
   * 自动调用 quiet()
   */
  blob(): Promise<Blob>

  /**
   * 配置 shell 在非零退出代码时不抛出异常。
   */
  nothrow(): this

  /**
   * 配置 shell 是否应在非零退出代码时抛出异常。
   */
  throws(shouldThrow: boolean): this
}

// 定义 Bun Shell 输出接口
export interface BunShellOutput {
  readonly stdout: Buffer
  readonly stderr: Buffer
  readonly exitCode: number

  /**
   * 从 stdout 读取为字符串
   */
  text(encoding?: BufferEncoding): string

  /**
   * 从 stdout 读取为 JSON 对象
   */
  json(): any

  /**
   * 从 stdout 读取为 ArrayBuffer
   */
  arrayBuffer(): ArrayBuffer

  /**
   * 从 stdout 读取为 Uint8Array
   */
  bytes(): Uint8Array

  /**
   * 从 stdout 读取为 Blob
   */
  blob(): Blob
}

// 定义 Bun Shell 错误类型
export type BunShellError = Error & BunShellOutput
