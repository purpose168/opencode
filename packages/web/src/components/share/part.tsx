import map from "lang-map"
import { DateTime } from "luxon"
import { For, Show, Match, Switch, type JSX, createMemo, createSignal, type ParentProps } from "solid-js"
import {
  IconHashtag,
  IconSparkles,
  IconGlobeAlt,
  IconDocument,
  IconPaperClip,
  IconQueueList,
  IconUserCircle,
  IconCommandLine,
  IconCheckCircle,
  IconChevronDown,
  IconChevronRight,
  IconDocumentPlus,
  IconPencilSquare,
  IconRectangleStack,
  IconMagnifyingGlass,
  IconDocumentMagnifyingGlass,
} from "../icons"
import { IconMeta, IconRobot, IconOpenAI, IconGemini, IconAnthropic, IconBrain } from "../icons/custom"
import { ContentCode } from "./content-code"
import { ContentDiff } from "./content-diff"
import { ContentText } from "./content-text"
import { ContentBash } from "./content-bash"
import { ContentError } from "./content-error"
import { formatDuration } from "../share/common"
import { ContentMarkdown } from "./content-markdown"
import type { MessageV2 } from "opencode/session/message-v2"
import type { Diagnostic } from "vscode-languageserver-types"

import styles from "./part.module.css"

// 最小持续时间（毫秒）
const MIN_DURATION = 2000

// 部件属性接口
export interface PartProps {
  index: number
  message: MessageV2.Info
  part: MessageV2.Part
  last: boolean
}

// 部件组件
export function Part(props: PartProps) {
  const [copied, setCopied] = createSignal(false)
  const id = createMemo(() => props.message.id + "-" + props.index)

  return (
    <div
      class={styles.root}
      id={id()}
      data-component="part"
      data-type={props.part.type}
      data-role={props.message.role}
      data-copied={copied() ? true : undefined}
    >
      <div data-component="decoration">
        <div data-slot="anchor" title="链接到此消息">
          <a
            href={`#${id()}`}
            onClick={(e) => {
              e.preventDefault()
              const anchor = e.currentTarget
              const hash = anchor.getAttribute("href") || ""
              const { origin, pathname, search } = window.location
              navigator.clipboard
                .writeText(`${origin}${pathname}${search}${hash}`)
                .catch((err) => console.error("复制失败", err))

              setCopied(true)
              setTimeout(() => setCopied(false), 3000)
            }}
          >
            <Switch>
              <Match when={props.message.role === "user" && props.part.type === "text"}>
                <IconUserCircle width={18} height={18} />
              </Match>
              <Match when={props.message.role === "user" && props.part.type === "file"}>
                <IconPaperClip width={18} height={18} />
              </Match>
              <Match
                when={props.part.type === "step-start" && props.message.role === "assistant" && props.message.modelID}
              >
                {(model) => <ProviderIcon model={model()} size={18} />}
              </Match>
              <Match when={props.part.type === "reasoning" && props.message.role === "assistant"}>
                <IconBrain width={18} height={18} />
              </Match>
              <Match when={props.part.type === "tool" && props.part.tool === "todowrite"}>
                <IconQueueList width={18} height={18} />
              </Match>
              <Match when={props.part.type === "tool" && props.part.tool === "todoread"}>
                <IconQueueList width={18} height={18} />
              </Match>
              <Match when={props.part.type === "tool" && props.part.tool === "bash"}>
                <IconCommandLine width={18} height={18} />
              </Match>
              <Match when={props.part.type === "tool" && props.part.tool === "edit"}>
                <IconPencilSquare width={18} height={18} />
              </Match>
              <Match when={props.part.type === "tool" && props.part.tool === "write"}>
                <IconDocumentPlus width={18} height={18} />
              </Match>
              <Match when={props.part.type === "tool" && props.part.tool === "read"}>
                <IconDocument width={18} height={18} />
              </Match>
              <Match when={props.part.type === "tool" && props.part.tool === "grep"}>
                <IconDocumentMagnifyingGlass width={18} height={18} />
              </Match>
              <Match when={props.part.type === "tool" && props.part.tool === "list"}>
                <IconRectangleStack width={18} height={18} />
              </Match>
              <Match when={props.part.type === "tool" && props.part.tool === "glob"}>
                <IconMagnifyingGlass width={18} height={18} />
              </Match>
              <Match when={props.part.type === "tool" && props.part.tool === "webfetch"}>
                <IconGlobeAlt width={18} height={18} />
              </Match>
              <Match when={props.part.type === "tool" && props.part.tool === "task"}>
                <IconRobot width={18} height={18} />
              </Match>
              <Match when={true}>
                <IconSparkles width={18} height={18} />
              </Match>
            </Switch>
            <IconHashtag width={18} height={18} />
            <IconCheckCircle width={18} height={18} />
          </a>
          <span data-slot="tooltip">已复制！</span>
        </div>
        <div data-slot="bar"></div>
      </div>
      <div data-component="content">
        {props.message.role === "user" && props.part.type === "text" && (
          <div data-component="user-text">
            <ContentText text={props.part.text} expand={props.last} />
          </div>
        )}
        {props.message.role === "assistant" && props.part.type === "text" && (
          <div data-component="assistant-text">
            <div data-component="assistant-text-markdown">
              <ContentMarkdown expand={props.last} text={props.part.text} />
            </div>
            {props.last && props.message.role === "assistant" && props.message.time.completed && (
              <Footer
                title={DateTime.fromMillis(props.message.time.completed).toLocaleString(
                  DateTime.DATETIME_FULL_WITH_SECONDS,
                )}
              >
                {DateTime.fromMillis(props.message.time.completed).toLocaleString(DateTime.DATETIME_MED)}
              </Footer>
            )}
          </div>
        )}
        {props.message.role === "assistant" && props.part.type === "reasoning" && (
          <div data-component="tool">
            <div data-component="tool-title">
              <span data-slot="name">思考中</span>
            </div>
            <Show when={props.part.text}>
              <div data-component="assistant-reasoning">
                <ResultsButton showCopy="显示详情" hideCopy="隐藏详情">
                  <div data-component="assistant-reasoning-markdown">
                    <ContentMarkdown expand text={props.part.text || "思考中..."} />
                  </div>
                </ResultsButton>
              </div>
            </Show>
          </div>
        )}
        {props.message.role === "user" && props.part.type === "file" && (
          <div data-component="attachment">
            <div data-slot="copy">附件</div>
            <div data-slot="filename">{props.part.filename}</div>
          </div>
        )}
        {props.message.role === "user" && props.part.type === "file" && (
          <div data-component="attachment">
            <div data-slot="copy">附件</div>
            <div data-slot="filename">{props.part.filename}</div>
          </div>
        )}
        {props.part.type === "step-start" && props.message.role === "assistant" && (
          <div data-component="step-start">
            <div data-slot="provider">{props.message.providerID}</div>
            <div data-slot="model">{props.message.modelID}</div>
          </div>
        )}
        {props.part.type === "tool" && props.part.state.status === "error" && (
          <div data-component="tool" data-tool="error">
            <ContentError>{formatErrorString(props.part.state.error)}</ContentError>
            <Spacer />
          </div>
        )}
        {props.part.type === "tool" &&
          props.part.state.status === "completed" &&
          props.message.role === "assistant" && (
            <>
              <div data-component="tool" data-tool={props.part.tool}>
                <Switch>
                  <Match when={props.part.tool === "grep"}>
                    <GrepTool
                      message={props.message}
                      id={props.part.id}
                      tool={props.part.tool}
                      state={props.part.state}
                    />
                  </Match>
                  <Match when={props.part.tool === "glob"}>
                    <GlobTool
                      message={props.message}
                      id={props.part.id}
                      tool={props.part.tool}
                      state={props.part.state}
                    />
                  </Match>
                  <Match when={props.part.tool === "list"}>
                    <ListTool
                      message={props.message}
                      id={props.part.id}
                      tool={props.part.tool}
                      state={props.part.state}
                    />
                  </Match>
                  <Match when={props.part.tool === "read"}>
                    <ReadTool
                      message={props.message}
                      id={props.part.id}
                      tool={props.part.tool}
                      state={props.part.state}
                    />
                  </Match>
                  <Match when={props.part.tool === "write"}>
                    <WriteTool
                      message={props.message}
                      id={props.part.id}
                      tool={props.part.tool}
                      state={props.part.state}
                    />
                  </Match>
                  <Match when={props.part.tool === "edit"}>
                    <EditTool
                      message={props.message}
                      id={props.part.id}
                      tool={props.part.tool}
                      state={props.part.state}
                    />
                  </Match>
                  <Match when={props.part.tool === "bash"}>
                    <BashTool
                      id={props.part.id}
                      tool={props.part.tool}
                      state={props.part.state}
                      message={props.message}
                    />
                  </Match>
                  <Match when={props.part.tool === "todowrite"}>
                    <TodoWriteTool
                      message={props.message}
                      id={props.part.id}
                      tool={props.part.tool}
                      state={props.part.state}
                    />
                  </Match>
                  <Match when={props.part.tool === "webfetch"}>
                    <WebFetchTool
                      message={props.message}
                      id={props.part.id}
                      tool={props.part.tool}
                      state={props.part.state}
                    />
                  </Match>
                  <Match when={props.part.tool === "task"}>
                    <TaskTool
                      id={props.part.id}
                      tool={props.part.tool}
                      message={props.message}
                      state={props.part.state}
                    />
                  </Match>
                  <Match when={true}>
                    <FallbackTool
                      message={props.message}
                      id={props.part.id}
                      tool={props.part.tool}
                      state={props.part.state}
                    />
                  </Match>
                </Switch>
              </div>
              <ToolFooter
                time={DateTime.fromMillis(props.part.state.time.end)
                  .diff(DateTime.fromMillis(props.part.state.time.start))
                  .toMillis()}
              />
            </>
          )}
      </div>
    </div>
  )
}

// 工具属性类型
type ToolProps = {
  id: MessageV2.ToolPart["id"]
  tool: MessageV2.ToolPart["tool"]
  state: MessageV2.ToolStateCompleted
  message: MessageV2.Assistant
  isLastPart?: boolean
}

// 待办事项类型
interface Todo {
  id: string
  content: string
  status: "pending" | "in_progress" | "completed"
  priority: "low" | "medium" | "high"
}

// 去除工作目录前缀
function stripWorkingDirectory(filePath?: string, workingDir?: string) {
  if (filePath === undefined || workingDir === undefined) return filePath

  const prefix = workingDir.endsWith("/") ? workingDir : workingDir + "/"

  if (filePath === workingDir) {
    return ""
  }

  if (filePath.startsWith(prefix)) {
    return filePath.slice(prefix.length)
  }

  return filePath
}

// 获取 Shiki 语言类型
function getShikiLang(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  const langs = map.languages(ext)
  const type = langs?.[0]?.toLowerCase()

  const overrides: Record<string, string> = {
    conf: "shellscript",
  }

  return type ? (overrides[type] ?? type) : "plaintext"
}

// 获取诊断信息
function getDiagnostics(diagnosticsByFile: Record<string, Diagnostic[]>, currentFile: string): JSX.Element[] {
  const result: JSX.Element[] = []

  if (diagnosticsByFile === undefined || diagnosticsByFile[currentFile] === undefined) return result

  for (const diags of Object.values(diagnosticsByFile)) {
    for (const d of diags) {
      if (d.severity !== 1) continue

      const line = d.range.start.line + 1
      const column = d.range.start.character + 1

      result.push(
        <pre>
          <span data-color="red" data-marker="label">
            错误
          </span>
          <span data-color="dimmed" data-separator>
            [{line}:{column}]
          </span>
          <span>{d.message}</span>
        </pre>,
      )
    }
  }

  return result
}

// 格式化错误字符串
function formatErrorString(error: string): JSX.Element {
  const errorMarker = "Error: "
  const startsWithError = error.startsWith(errorMarker)

  return startsWithError ? (
    <pre>
      <span data-color="red" data-marker="label" data-separator>
        错误
      </span>
      <span>{error.slice(errorMarker.length)}</span>
    </pre>
  ) : (
    <pre>
      <span data-color="dimmed">{error}</span>
    </pre>
  )
}

// 待办事项写入工具组件
export function TodoWriteTool(props: ToolProps) {
  const priority: Record<Todo["status"], number> = {
    in_progress: 0,
    pending: 1,
    completed: 2,
  }
  const todos = createMemo(() =>
    ((props.state.input?.todos ?? []) as Todo[]).slice().sort((a, b) => priority[a.status] - priority[b.status]),
  )
  const starting = () => todos().every((t: Todo) => t.status === "pending")
  const finished = () => todos().every((t: Todo) => t.status === "completed")

  return (
    <>
      <div data-component="tool-title">
        <span data-slot="name">
          <Switch fallback="更新计划">
            <Match when={starting()}>创建计划</Match>
            <Match when={finished()}>完成计划</Match>
          </Switch>
        </span>
      </div>
      <Show when={todos().length > 0}>
        <ul data-component="todos">
          <For each={todos()}>
            {(todo) => (
              <li data-slot="item" data-status={todo.status}>
                <span></span>
                {todo.content}
              </li>
            )}
          </For>
        </ul>
      </Show>
    </>
  )
}

// Grep 工具组件
export function GrepTool(props: ToolProps) {
  return (
    <>
      <div data-component="tool-title">
        <span data-slot="name">Grep</span>
        <span data-slot="target">&ldquo;{props.state.input.pattern}&rdquo;</span>
      </div>
      <div data-component="tool-result">
        <Switch>
          <Match when={props.state.metadata?.matches && props.state.metadata?.matches > 0}>
            <ResultsButton
              showCopy={props.state.metadata?.matches === 1 ? "1 个匹配" : `${props.state.metadata?.matches} 个匹配`}
            >
              <ContentText expand compact text={props.state.output} />
            </ResultsButton>
          </Match>
          <Match when={props.state.output}>
            <ContentText expand compact text={props.state.output} data-size="sm" data-color="dimmed" />
          </Match>
        </Switch>
      </div>
    </>
  )
}

// 列表工具组件
export function ListTool(props: ToolProps) {
  const path = createMemo(() =>
    props.state.input?.path !== props.message.path.cwd
      ? stripWorkingDirectory(props.state.input?.path, props.message.path.cwd)
      : props.state.input?.path,
  )

  return (
    <>
      <div data-component="tool-title">
        <span data-slot="name">LS</span>
        <span data-slot="target" title={props.state.input?.path}>
          {path()}
        </span>
      </div>
      <div data-component="tool-result">
        <Switch>
          <Match when={props.state.output}>
            <ResultsButton>
              <ContentText expand compact text={props.state.output} />
            </ResultsButton>
          </Match>
        </Switch>
      </div>
    </>
  )
}

// 网络获取工具组件
export function WebFetchTool(props: ToolProps) {
  return (
    <>
      <div data-component="tool-title">
        <span data-slot="name">获取</span>
        <span data-slot="target">{props.state.input.url}</span>
      </div>
      <div data-component="tool-result">
        <Switch>
          <Match when={props.state.metadata?.error}>
            <ContentError>{formatErrorString(props.state.output)}</ContentError>
          </Match>
          <Match when={props.state.output}>
            <ResultsButton>
              <ContentCode lang={props.state.input.format || "text"} code={props.state.output} />
            </ResultsButton>
          </Match>
        </Switch>
      </div>
    </>
  )
}

// 读取工具组件
export function ReadTool(props: ToolProps) {
  const filePath = createMemo(() => stripWorkingDirectory(props.state.input?.filePath, props.message.path.cwd))

  return (
    <>
      <div data-component="tool-title">
        <span data-slot="name">读取</span>
        <span data-slot="target" title={props.state.input?.filePath}>
          {filePath()}
        </span>
      </div>
      <div data-component="tool-result">
        <Switch>
          <Match when={props.state.metadata?.error}>
            <ContentError>{formatErrorString(props.state.output)}</ContentError>
          </Match>
          <Match when={typeof props.state.metadata?.preview === "string"}>
            <ResultsButton showCopy="显示预览" hideCopy="隐藏预览">
              <ContentCode lang={getShikiLang(filePath() || "")} code={props.state.metadata?.preview} />
            </ResultsButton>
          </Match>
          <Match when={typeof props.state.metadata?.preview !== "string" && props.state.output}>
            <ResultsButton>
              <ContentText expand compact text={props.state.output} />
            </ResultsButton>
          </Match>
        </Switch>
      </div>
    </>
  )
}

// 写入工具组件
export function WriteTool(props: ToolProps) {
  const filePath = createMemo(() => stripWorkingDirectory(props.state.input?.filePath, props.message.path.cwd))
  const diagnostics = createMemo(() => getDiagnostics(props.state.metadata?.diagnostics, props.state.input.filePath))

  return (
    <>
      <div data-component="tool-title">
        <span data-slot="name">写入</span>
        <span data-slot="target" title={props.state.input?.filePath}>
          {filePath()}
        </span>
      </div>
      <Show when={diagnostics().length > 0}>
        <ContentError>{diagnostics()}</ContentError>
      </Show>
      <div data-component="tool-result">
        <Switch>
          <Match when={props.state.metadata?.error}>
            <ContentError>{formatErrorString(props.state.output)}</ContentError>
          </Match>
          <Match when={props.state.input?.content}>
            <ResultsButton showCopy="显示内容" hideCopy="隐藏内容">
              <ContentCode lang={getShikiLang(filePath() || "")} code={props.state.input?.content} />
            </ResultsButton>
          </Match>
        </Switch>
      </div>
    </>
  )
}

// 编辑工具组件
export function EditTool(props: ToolProps) {
  const filePath = createMemo(() => stripWorkingDirectory(props.state.input.filePath, props.message.path.cwd))
  const diagnostics = createMemo(() => getDiagnostics(props.state.metadata?.diagnostics, props.state.input.filePath))

  return (
    <>
      <div data-component="tool-title">
        <span data-slot="name">编辑</span>
        <span data-slot="target" title={props.state.input?.filePath}>
          {filePath()}
        </span>
      </div>
      <div data-component="tool-result">
        <Switch>
          <Match when={props.state.metadata?.error}>
            <ContentError>{formatErrorString(props.state.metadata?.message || "")}</ContentError>
          </Match>
          <Match when={props.state.metadata?.diff}>
            <div data-component="diff">
              <ContentDiff diff={props.state.metadata?.diff} lang={getShikiLang(filePath() || "")} />
            </div>
          </Match>
        </Switch>
      </div>
      <Show when={diagnostics().length > 0}>
        <ContentError>{diagnostics()}</ContentError>
      </Show>
    </>
  )
}

// Bash 工具组件
export function BashTool(props: ToolProps) {
  return (
    <ContentBash
      command={props.state.input.command}
      output={props.state.metadata.output ?? props.state.metadata?.stdout}
      description={props.state.metadata.description}
    />
  )
}

// Glob 工具组件
export function GlobTool(props: ToolProps) {
  return (
    <>
      <div data-component="tool-title">
        <span data-slot="name">Glob</span>
        <span data-slot="target">&ldquo;{props.state.input.pattern}&rdquo;</span>
      </div>
      <Switch>
        <Match when={props.state.metadata?.count && props.state.metadata?.count > 0}>
          <div data-component="tool-result">
            <ResultsButton
              showCopy={props.state.metadata?.count === 1 ? "1 个结果" : `${props.state.metadata?.count} 个结果`}
            >
              <ContentText expand compact text={props.state.output} />
            </ResultsButton>
          </div>
        </Match>
        <Match when={props.state.output}>
          <ContentText expand text={props.state.output} data-size="sm" data-color="dimmed" />
        </Match>
      </Switch>
    </>
  )
}

// 结果按钮组件属性接口
interface ResultsButtonProps extends ParentProps {
  showCopy?: string
  hideCopy?: string
}
// 结果按钮组件
function ResultsButton(props: ResultsButtonProps) {
  const [show, setShow] = createSignal(false)

  return (
    <>
      <button type="button" data-component="button-text" data-more onClick={() => setShow((e) => !e)}>
        <span>{show() ? props.hideCopy || "隐藏结果" : props.showCopy || "显示结果"}</span>
        <span data-slot="icon">
          <Show when={show()} fallback={<IconChevronRight width={11} height={11} />}>
            <IconChevronDown width={11} height={11} />
          </Show>
        </span>
      </button>
      <Show when={show()}>{props.children}</Show>
    </>
  )
}

// 间隔组件
export function Spacer() {
  return <div data-component="spacer"></div>
}

// 页脚组件
function Footer(props: ParentProps<{ title: string }>) {
  return (
    <div data-component="content-footer" title={props.title}>
      {props.children}
    </div>
  )
}

// 工具页脚组件
function ToolFooter(props: { time: number }) {
  return props.time > MIN_DURATION && <Footer title={`${props.time}毫秒`}>{formatDuration(props.time)}</Footer>
}

// 任务工具组件
function TaskTool(props: ToolProps) {
  return (
    <>
      <div data-component="tool-title">
        <span data-slot="name">任务</span>
        <span data-slot="target">{props.state.input.description}</span>
      </div>
      <div data-component="tool-input">&ldquo;{props.state.input.prompt}&rdquo;</div>
      <ResultsButton showCopy="显示输出" hideCopy="隐藏输出">
        <div data-component="tool-output">
          <ContentMarkdown expand text={props.state.output} />
        </div>
      </ResultsButton>
    </>
  )
}

// 回退工具组件
export function FallbackTool(props: ToolProps) {
  return (
    <>
      <div data-component="tool-title">
        <span data-slot="name">{props.tool}</span>
      </div>
      <div data-component="tool-args">
        <For each={flattenToolArgs(props.state.input)}>
          {(arg) => (
            <>
              <div></div>
              <div>{arg[0]}</div>
              <div>{arg[1]}</div>
            </>
          )}
        </For>
      </div>
      <Switch>
        <Match when={props.state.output}>
          <div data-component="tool-result">
            <ResultsButton>
              <ContentText expand compact text={props.state.output} data-size="sm" data-color="dimmed" />
            </ResultsButton>
          </div>
        </Match>
      </Switch>
    </>
  )
}

// 将嵌套的对象/数组转换为 [路径, 值] 对
// 例如：{a:{b:{c:1}}, d:[{e:2}, 3]} => [["a.b.c",1], ["d[0].e",2], ["d[1]",3]]
function flattenToolArgs(obj: any, prefix: string = ""): Array<[string, any]> {
  const entries: Array<[string, any]> = []

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key

    if (value !== null && typeof value === "object") {
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          const arrayPath = `${path}[${index}]`
          if (item !== null && typeof item === "object") {
            entries.push(...flattenToolArgs(item, arrayPath))
          } else {
            entries.push([arrayPath, item])
          }
        })
      } else {
        entries.push(...flattenToolArgs(value, path))
      }
    } else {
      entries.push([path, value])
    }
  }

  return entries
}

// 获取提供商
function getProvider(model: string) {
  const lowerModel = model.toLowerCase()

  if (/claude|anthropic/.test(lowerModel)) return "anthropic"
  if (/gpt|o[1-4]|codex|openai/.test(lowerModel)) return "openai"
  if (/gemini|palm|bard|google/.test(lowerModel)) return "gemini"
  if (/llama|meta/.test(lowerModel)) return "meta"

  return "any"
}

// 提供商图标组件
export function ProviderIcon(props: { model: string; size?: number }) {
  const provider = getProvider(props.model)
  const size = props.size || 16
  return (
    <Switch fallback={<IconSparkles width={size} height={size} />}>
      <Match when={provider === "openai"}>
        <IconOpenAI width={size} height={size} />
      </Match>
      <Match when={provider === "anthropic"}>
        <IconAnthropic width={size} height={size} />
      </Match>
      <Match when={provider === "gemini"}>
        <IconGemini width={size} height={size} />
      </Match>
      <Match when={provider === "meta"}>
        <IconMeta width={size} height={size} />
      </Match>
    </Switch>
  )
}
