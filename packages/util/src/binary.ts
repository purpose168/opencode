/**
 * 二分查找和插入工具
 * 
 * 提供二分查找和有序插入功能，用于在有序数组中高效地查找和插入元素
 */
export namespace Binary {
  /**
   * 在有序数组中二分查找元素
   * 
   * @template T - 数组元素的类型
   * @param array - 有序数组
   * @param id - 要查找的元素 ID
   * @param compare - 比较函数，用于从元素中提取 ID
   * @returns 包含查找结果和索引的对象
   */
  export function search<T>(array: T[], id: string, compare: (item: T) => string): { found: boolean; index: number } {
    let left = 0
    let right = array.length - 1

    while (left <= right) {
      const mid = Math.floor((left + right) / 2) // 计算中间索引
      const midId = compare(array[mid]) // 获取中间元素的 ID

      if (midId === id) {
        return { found: true, index: mid } // 找到元素
      } else if (midId < id) {
        left = mid + 1 // 向右搜索
      } else {
        right = mid - 1 // 向左搜索
      }
    }

    return { found: false, index: left } // 未找到元素，返回插入位置
  }

  /**
   * 在有序数组中插入元素，保持数组有序
   * 
   * @template T - 数组元素的类型
   * @param array - 有序数组
   * @param item - 要插入的元素
   * @param compare - 比较函数，用于从元素中提取 ID
   * @returns 插入后的数组
   */
  export function insert<T>(array: T[], item: T, compare: (item: T) => string): T[] {
    const id = compare(item) // 获取要插入元素的 ID
    let left = 0
    let right = array.length

    while (left < right) {
      const mid = Math.floor((left + right) / 2) // 计算中间索引
      const midId = compare(array[mid]) // 获取中间元素的 ID

      if (midId < id) {
        left = mid + 1 // 向右搜索
      } else {
        right = mid // 向左搜索
      }
    }

    array.splice(left, 0, item) // 在找到的位置插入元素
    return array
  }
}
