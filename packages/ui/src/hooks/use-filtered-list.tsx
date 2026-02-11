/**
 * 过滤列表钩子
 * 用于创建带有过滤、分组、排序功能的列表
 */
import fuzzysort from "fuzzysort"
import { entries, flatMap, groupBy, map, pipe } from "remeda"
import { createMemo, createResource } from "solid-js"
import { createStore } from "solid-js/store"
import { createList } from "solid-list"

/**
 * 过滤列表属性接口
 */
export interface FilteredListProps<T> {
  /**
   * 列表项或根据过滤条件获取列表项的函数
   */
  items: T[] | ((filter: string) => T[] | Promise<T[]>)
  /**
   * 获取列表项唯一键的函数
   * @param item 列表项
   * @returns 唯一键
   */
  key: (item: T) => string
  /**
   * 用于过滤的键数组
   */
  filterKeys?: string[]
  /**
   * 当前选中的项
   */
  current?: T
  /**
   * 分组函数
   * @param x 列表项
   * @returns 分组键
   */
  groupBy?: (x: T) => string
  /**
   * 排序函数
   * @param a 第一个列表项
   * @param b 第二个列表项
   * @returns 排序结果
   */
  sortBy?: (a: T, b: T) => number
  /**
   * 分组排序函数
   * @param a 第一个分组
   * @param b 第二个分组
   * @returns 排序结果
   */
  sortGroupsBy?: (a: { category: string; items: T[] }, b: { category: string; items: T[] }) => number
  /**
   * 选择项时的回调函数
   * @param value 选中的项
   * @param index 选中项的索引
   */
  onSelect?: (value: T | undefined, index: number) => void
}

/**
 * 创建过滤列表
 * @param props 过滤列表属性
 * @returns 过滤列表控制对象
 */
export function useFilteredList<T>(props: FilteredListProps<T>) {
  /** 状态存储 */
  const [store, setStore] = createStore<{ filter: string }>({ filter: "" })

  /** 分组后的列表数据 */
  const [grouped, { refetch }] = createResource(
    () => ({
      filter: store.filter,
      items: typeof props.items === "function" ? undefined : props.items,
    }),
    async ({ filter, items }) => {
      /** 过滤关键词 */
      const needle = filter?.toLowerCase()
      /** 所有列表项 */
      const all = (items ?? (await (props.items as (filter: string) => T[] | Promise<T[]>)(needle))) || []
      /** 处理结果 */
      const result = pipe(
        all,
        /** 过滤处理 */
        (x) => {
          if (!needle) return x
          if (!props.filterKeys && Array.isArray(x) && x.every((e) => typeof e === "string")) {
            return fuzzysort.go(needle, x).map((x) => x.target) as T[]
          }
          return fuzzysort.go(needle, x, { keys: props.filterKeys! }).map((x) => x.obj)
        },
        /** 分组处理 */
        groupBy((x) => (props.groupBy ? props.groupBy(x) : "")),
        /** 转换为键值对数组 */
        entries(),
        /** 映射为分组对象 */
        map(([k, v]) => ({ category: k, items: props.sortBy ? v.sort(props.sortBy) : v })),
        /** 分组排序 */
        (groups) => (props.sortGroupsBy ? groups.sort(props.sortGroupsBy) : groups),
      )
      return result
    },
  )

  /** 扁平化的列表数据 */
  const flat = createMemo(() => {
    return pipe(
      grouped() || [],
      flatMap((x) => x.items),
    )
  })

  /**
   * 获取初始激活项的键
   * @returns 初始激活项的键
   */
  function initialActive() {
    if (props.current) return props.key(props.current)

    const items = flat()
    if (items.length === 0) return ""
    return props.key(items[0])
  }

  /** 列表控制器 */
  const list = createList({
    items: () => flat().map(props.key),
    initialActive: initialActive(),
    loop: true,
  })

  /**
   * 重置列表激活状态
   */
  const reset = () => {
    const all = flat()
    if (all.length === 0) return
    list.setActive(props.key(all[0]))
  }

  /**
   * 处理键盘按下事件
   * @param event 键盘事件
   */
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault()
      const selectedIndex = flat().findIndex((x) => props.key(x) === list.active())
      const selected = flat()[selectedIndex]
      if (selected) props.onSelect?.(selected, selectedIndex)
    } else {
      list.onKeyDown(event)
    }
  }

  /**
   * 处理输入事件
   * @param value 输入值
   */
  const onInput = (value: string) => {
    setStore("filter", value)
    reset()
  }

  return {
    /** 分组后的列表数据 */
    grouped,
    /** 获取当前过滤值的函数 */
    filter: () => store.filter,
    /** 扁平化的列表数据 */
    flat,
    /** 重置列表激活状态的函数 */
    reset,
    /** 重新获取数据的函数 */
    refetch,
    /** 清除过滤值的函数 */
    clear: () => setStore("filter", ""),
    /** 处理键盘按下事件的函数 */
    onKeyDown,
    /** 处理输入事件的函数 */
    onInput,
    /** 获取当前激活项键的函数 */
    active: list.active,
    /** 设置激活项的函数 */
    setActive: list.setActive,
  }
}
