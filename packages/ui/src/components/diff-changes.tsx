import { createMemo, For, Match, Show, Switch } from "solid-js"

/**
 * 差异变化组件
 * 显示代码差异的添加和删除统计
 */
export function DiffChanges(props: {
  /** CSS 类名 */
  class?: string
  /** 差异变化数据，可以是单个对象或对象数组 */
  changes: { additions: number; deletions: number } | { additions: number; deletions: number }[]
  /** 显示变体：default（数字）或 bars（条形图） */
  variant?: "default" | "bars"
}) {
  // 获取变体类型，默认为 default
  const variant = () => props.variant ?? "default"

  // 计算添加的总数
  const additions = createMemo(() =>
    Array.isArray(props.changes)
      ? props.changes.reduce((acc, diff) => acc + (diff.additions ?? 0), 0)
      : props.changes.additions,
  )
  
  // 计算删除的总数
  const deletions = createMemo(() =>
    Array.isArray(props.changes)
      ? props.changes.reduce((acc, diff) => acc + (diff.deletions ?? 0), 0)
      : props.changes.deletions,
  )
  
  // 计算总变化数
  const total = createMemo(() => (additions() ?? 0) + (deletions() ?? 0))

  // 计算条形图的块数
  const blockCounts = createMemo(() => {
    const TOTAL_BLOCKS = 5

    const adds = additions() ?? 0
    const dels = deletions() ?? 0

    // 无变化时返回全部中性块
    if (adds === 0 && dels === 0) {
      return { added: 0, deleted: 0, neutral: TOTAL_BLOCKS }
    }

    const total = adds + dels

    // 变化较少时简化显示
    if (total < 5) {
      const added = adds > 0 ? 1 : 0
      const deleted = dels > 0 ? 1 : 0
      const neutral = TOTAL_BLOCKS - added - deleted
      return { added, deleted, neutral }
    }

    // 计算添加和删除的比例
    const ratio = adds > dels ? adds / dels : dels / adds
    let BLOCKS_FOR_COLORS = TOTAL_BLOCKS

    // 根据变化量调整显示的彩色块数
    if (total < 20) {
      BLOCKS_FOR_COLORS = TOTAL_BLOCKS - 1
    } else if (ratio < 4) {
      BLOCKS_FOR_COLORS = TOTAL_BLOCKS - 1
    }

    // 计算添加和删除的百分比
    const percentAdded = adds / total
    const percentDeleted = dels / total

    // 计算原始块数
    const added_raw = percentAdded * BLOCKS_FOR_COLORS
    const deleted_raw = percentDeleted * BLOCKS_FOR_COLORS

    // 确保至少有一个块表示变化
    let added = adds > 0 ? Math.max(1, Math.round(added_raw)) : 0
    let deleted = dels > 0 ? Math.max(1, Math.round(deleted_raw)) : 0

    // 根据实际变化量限制块数
    if (adds > 0 && adds <= 5) added = Math.min(added, 1)
    if (adds > 5 && adds <= 10) added = Math.min(added, 2)
    if (dels > 0 && dels <= 5) deleted = Math.min(deleted, 1)
    if (dels > 5 && dels <= 10) deleted = Math.min(deleted, 2)

    // 确保块数不超过限制
    let total_allocated = added + deleted
    if (total_allocated > BLOCKS_FOR_COLORS) {
      if (added_raw > deleted_raw) {
        added = BLOCKS_FOR_COLORS - deleted
      } else {
        deleted = BLOCKS_FOR_COLORS - added
      }
      total_allocated = added + deleted
    }

    // 计算中性块数
    const neutral = Math.max(0, TOTAL_BLOCKS - total_allocated)

    return { added, deleted, neutral }
  })

  // 颜色常量定义
  const ADD_COLOR = "var(--icon-diff-add-base)"
  const DELETE_COLOR = "var(--icon-diff-delete-base)"
  const NEUTRAL_COLOR = "var(--icon-weak-base)"

  // 计算可见的块数组
  const visibleBlocks = createMemo(() => {
    const counts = blockCounts()
    const blocks = [
      ...Array(counts.added).fill(ADD_COLOR),
      ...Array(counts.deleted).fill(DELETE_COLOR),
      ...Array(counts.neutral).fill(NEUTRAL_COLOR),
    ]
    return blocks.slice(0, 5)
  })

  return (
    <Show when={variant() === "default" ? total() > 0 : true}>
      <div data-component="diff-changes" data-variant={variant()} classList={{ [props.class ?? ""]: true }}>
        <Switch>
          <Match when={variant() === "bars"}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 12" fill="none">
              <g>
                <For each={visibleBlocks()}>
                  {(color, i) => <rect x={i() * 4} width="2" height="12" rx="1" fill={color} />}
                </For>
              </g>
            </svg>
          </Match>
          <Match when={variant() === "default"}>
            <span data-slot="diff-changes-additions">{`+${additions()}`}</span>
            <span data-slot="diff-changes-deletions">{`-${deletions()}`}</span>
          </Match>
        </Switch>
      </div>
    </Show>
  )
}
