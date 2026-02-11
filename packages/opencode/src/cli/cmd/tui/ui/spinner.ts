import type { ColorInput } from "@opentui/core" // 导入颜色输入类型，用于定义颜色参数
import { RGBA } from "@opentui/core" // 导入 RGBA 颜色类，用于处理颜色操作
import type { ColorGenerator } from "opentui-spinner" // 导入颜色生成器类型，用于定义颜色生成函数

/**
 * AdvancedGradientOptions 高级渐变选项接口定义
 *
 * 属性说明：
 * - colors: 颜色数组，用于定义渐变的颜色序列
 * - trailLength: 轨迹长度，定义渐变轨迹的长度
 * - defaultColor: 可选的默认颜色，用于不在轨迹中的字符
 * - direction: 可选的移动方向，支持向前、向后或双向移动
 * - holdFrames: 可选的保持帧数，定义在起点和终点保持的帧数
 * - enableFading: 可选的启用淡入淡出效果，默认为 true
 * - minAlpha: 可选的最小 alpha 值，用于淡入淡出效果的最小透明度
 */
interface AdvancedGradientOptions {
  colors: ColorInput[] // 颜色数组，用于定义渐变的颜色序列
  trailLength: number // 轨迹长度，定义渐变轨迹的长度
  defaultColor?: ColorInput // 可选的默认颜色，用于不在轨迹中的字符
  direction?: "forward" | "backward" | "bidirectional" // 可选的移动方向：向前、向后或双向
  holdFrames?: { start?: number; end?: number } // 可选的保持帧数，定义在起点和终点保持的帧数
  enableFading?: boolean // 可选的启用淡入淡出效果，默认为 true
  minAlpha?: number // 可选的最小 alpha 值，用于淡入淡出效果的最小透明度
}

/**
 * ScannerState 扫描器状态接口定义
 *
 * 属性说明：
 * - activePosition: 当前激活位置（字符索引）
 * - isHolding: 是否处于保持状态（在起点或终点暂停）
 * - holdProgress: 保持进度（当前保持了多少帧）
 * - holdTotal: 保持总帧数（总共需要保持多少帧）
 * - movementProgress: 移动进度（当前移动了多少帧）
 * - movementTotal: 移动总帧数（总共需要移动多少帧）
 * - isMovingForward: 是否向前移动
 */
interface ScannerState {
  activePosition: number // 当前激活位置（字符索引）
  isHolding: boolean // 是否处于保持状态（在起点或终点暂停）
  holdProgress: number // 保持进度（当前保持了多少帧）
  holdTotal: number // 保持总帧数（总共需要保持多少帧）
  movementProgress: number // 移动进度（当前移动了多少帧）
  movementTotal: number // 移动总帧数（总共需要移动多少帧）
  isMovingForward: boolean // 是否向前移动
}

/**
 * getScannerState 获取扫描器状态
 *
 * 功能说明：
 * - 根据当前帧索引和总字符数计算扫描器的状态
 * - 支持三种移动方向：向前、向后、双向
 * - 双向移动包含四个阶段：向前移动、终点保持、向后移动、起点保持
 * - 返回包含位置、保持状态、移动进度等信息的扫描器状态对象
 *
 * 使用场景：
 * - 需要计算 Knight Rider 风格扫描动画的当前状态时
 * - 需要确定扫描器的当前位置和移动方向时
 * - 需要计算动画的进度和持续时间时
 *
 * 参数说明：
 * - frameIndex: 当前帧索引
 * - totalChars: 总字符数（扫描器的宽度）
 * - options: 选项对象，包含方向和保持帧数配置
 *
 * 返回值：
 * - 返回扫描器状态对象，包含位置、保持状态、移动进度等信息
 */
function getScannerState(
  frameIndex: number, // 当前帧索引
  totalChars: number, // 总字符数（扫描器的宽度）
  options: Pick<AdvancedGradientOptions, "direction" | "holdFrames">, // 选项对象，包含方向和保持帧数配置
): ScannerState {
  // 返回扫描器状态对象
  const { direction = "forward", holdFrames = {} } = options // 解构选项，设置默认方向为向前，保持帧数为空对象

  if (direction === "bidirectional") {
    // 如果是双向移动
    const forwardFrames = totalChars // 向前移动的帧数等于总字符数
    const holdEndFrames = holdFrames.end ?? 0 // 终点保持帧数，默认为 0
    const backwardFrames = totalChars - 1 // 向后移动的帧数等于总字符数减 1

    if (frameIndex < forwardFrames) {
      // 如果在向前移动阶段
      // Moving forward // 向前移动
      return {
        activePosition: frameIndex, // 激活位置等于当前帧索引
        isHolding: false, // 不处于保持状态
        holdProgress: 0, // 保持进度为 0
        holdTotal: 0, // 保持总帧数为 0
        movementProgress: frameIndex, // 移动进度等于当前帧索引
        movementTotal: forwardFrames, // 移动总帧数等于向前移动帧数
        isMovingForward: true, // 正在向前移动
      }
    } else if (frameIndex < forwardFrames + holdEndFrames) {
      // 如果在终点保持阶段
      // Holding at end // 在终点保持
      return {
        activePosition: totalChars - 1, // 激活位置在最后一个字符
        isHolding: true, // 处于保持状态
        holdProgress: frameIndex - forwardFrames, // 保持进度等于当前帧索引减去向前移动帧数
        holdTotal: holdEndFrames, // 保持总帧数等于终点保持帧数
        movementProgress: 0, // 移动进度为 0
        movementTotal: 0, // 移动总帧数为 0
        isMovingForward: true, // 仍然标记为向前移动（保持前的方向）
      }
    } else if (frameIndex < forwardFrames + holdEndFrames + backwardFrames) {
      // 如果在向后移动阶段
      // Moving backward // 向后移动
      const backwardIndex = frameIndex - forwardFrames - holdEndFrames // 向后移动索引等于当前帧索引减去向前移动帧数和终点保持帧数
      return {
        activePosition: totalChars - 2 - backwardIndex, // 激活位置从倒数第二个字符开始向后移动
        isHolding: false, // 不处于保持状态
        holdProgress: 0, // 保持进度为 0
        holdTotal: 0, // 保持总帧数为 0
        movementProgress: backwardIndex, // 移动进度等于向后移动索引
        movementTotal: backwardFrames, // 移动总帧数等于向后移动帧数
        isMovingForward: false, // 正在向后移动
      }
    } else {
      // 如果在起点保持阶段
      // Holding at start // 在起点保持
      return {
        activePosition: 0, // 激活位置在第一个字符
        isHolding: true, // 处于保持状态
        holdProgress: frameIndex - forwardFrames - holdEndFrames - backwardFrames, // 保持进度等于当前帧索引减去所有其他阶段的帧数
        holdTotal: holdFrames.start ?? 0, // 保持总帧数等于起点保持帧数
        movementProgress: 0, // 移动进度为 0
        movementTotal: 0, // 移动总帧数为 0
        isMovingForward: false, // 仍然标记为向后移动（保持后的方向）
      }
    }
  } else if (direction === "backward") {
    // 如果是向后移动
    return {
      activePosition: totalChars - 1 - (frameIndex % totalChars), // 激活位置从最后一个字符开始循环向后移动
      isHolding: false, // 不处于保持状态
      holdProgress: 0, // 保持进度为 0
      holdTotal: 0, // 保持总帧数为 0
      movementProgress: frameIndex % totalChars, // 移动进度等于当前帧索引对总字符数取模
      movementTotal: totalChars, // 移动总帧数等于总字符数
      isMovingForward: false, // 正在向后移动
    }
  } else {
    // 默认情况：向前移动
    return {
      activePosition: frameIndex % totalChars, // 激活位置等于当前帧索引对总字符数取模
      isHolding: false, // 不处于保持状态
      holdProgress: 0, // 保持进度为 0
      holdTotal: 0, // 保持总帧数为 0
      movementProgress: frameIndex % totalChars, // 移动进度等于当前帧索引对总字符数取模
      movementTotal: totalChars, // 移动总帧数等于总字符数
      isMovingForward: true, // 正在向前移动
    }
  }
}

/**
 * calculateColorIndex 计算颜色索引
 *
 * 功能说明：
 * - 根据当前帧索引、字符索引和扫描器状态计算颜色索引
 * - 计算字符与激活位置的方向距离
 * - 处理保持帧的淡入淡出效果
 * - 只在移动方向后的轨迹范围内显示渐变颜色
 * - 在激活位置显示最亮的颜色
 *
 * 使用场景：
 * - 需要为扫描动画中的每个字符计算颜色时
 * - 需要实现轨迹渐变效果时
 * - 需要处理保持状态的淡入淡出动画时
 *
 * 参数说明：
 * - frameIndex: 当前帧索引
 * - charIndex: 当前字符索引
 * - totalChars: 总字符数
 * - options: 选项对象，包含方向、保持帧数、轨迹长度配置
 * - state: 可选的扫描器状态对象，如果未提供则自动计算
 *
 * 返回值：
 * - 返回颜色索引，如果在轨迹范围内则返回距离值，在激活位置返回 0，否则返回 -1
 */
function calculateColorIndex(
  frameIndex: number, // 当前帧索引
  charIndex: number, // 当前字符索引
  totalChars: number, // 总字符数
  options: Pick<AdvancedGradientOptions, "direction" | "holdFrames" | "trailLength">, // 选项对象
  state?: ScannerState, // 可选的扫描器状态对象
): number {
  // 返回颜色索引
  const { trailLength } = options // 解构轨迹长度
  const { activePosition, isHolding, holdProgress, isMovingForward } =
    state ?? getScannerState(frameIndex, totalChars, options) // 获取或计算扫描器状态

  // Calculate directional distance (positive means trailing behind) // 计算方向距离（正值表示在激活位置后面）
  const directionalDistance = isMovingForward
    ? activePosition - charIndex // For forward: trail is to the left (lower indices) // 向前移动时：轨迹在左侧（较小的索引）
    : charIndex - activePosition // For backward: trail is to the right (higher indices) // 向后移动时：轨迹在右侧（较大的索引）

  // Handle hold frame fading: keep the lead bright, fade the trail // 处理保持帧的淡入淡出效果：保持头部明亮，淡出轨迹
  if (isHolding) {
    // 如果处于保持状态
    // Shifts the color index by how long we've been holding // 根据保持的时间长度偏移颜色索引
    return directionalDistance + holdProgress // 返回方向距离加上保持进度
  }

  // Normal movement - show gradient trail only behind the movement direction // 正常移动 - 只在移动方向后面显示渐变轨迹
  if (directionalDistance > 0 && directionalDistance < trailLength) {
    // 如果方向距离在轨迹长度范围内
    return directionalDistance // 返回方向距离作为颜色索引
  }

  // At the active position, show the brightest color // 在激活位置，显示最亮的颜色
  if (directionalDistance === 0) {
    // 如果在激活位置
    return 0 // 返回 0，表示使用最亮的颜色
  }

  return -1 // 不在轨迹范围内，返回 -1
}

/**
 * createKnightRiderTrail 创建骑士骑手轨迹颜色生成器
 *
 * 功能说明：
 * - 创建一个颜色生成器函数，用于生成 Knight Rider 风格的扫描动画颜色
 * - 支持自定义颜色数组或从单个颜色派生轨迹
 * - 支持淡入淡出效果，在保持和移动期间淡入淡出非活动点
 * - 使用缓存优化性能，避免重复计算扫描器状态
 *
 * 使用场景：
 * - 需要创建 Knight Rider 风格的扫描动画时
 * - 需要为终端界面提供动态颜色效果时
 * - 需要实现高性能的颜色计算时
 *
 * 参数说明：
 * - options: 高级渐变选项对象，包含颜色、轨迹长度、默认颜色、方向、保持帧数、淡入淡出等配置
 *
 * 返回值：
 * - 返回一个颜色生成器函数，该函数接受帧索引、字符索引、总帧数和总字符数，返回对应的颜色
 */
function createKnightRiderTrail(options: AdvancedGradientOptions): ColorGenerator {
  // 返回颜色生成器函数
  const { colors, defaultColor, enableFading = true, minAlpha = 0 } = options // 解构选项，设置默认值

  // Use the provided defaultColor if it's an RGBA instance, otherwise convert/default // 如果提供的默认颜色是 RGBA 实例则直接使用，否则转换或使用默认值
  // We use RGBA.fromHex for fallback to ensure we have an RGBA object. // 我们使用 RGBA.fromHex 作为后备，确保有一个 RGBA 对象
  // Note: If defaultColor is a string, we convert it once here. // 注意：如果 defaultColor 是字符串，我们在这里转换一次
  const defaultRgba = defaultColor instanceof RGBA ? defaultColor : RGBA.fromHex((defaultColor as string) || "#000000") // 获取或转换默认颜色为 RGBA

  // Store the base alpha from the inactive factor // 存储来自非活动因子的基础 alpha 值
  const baseInactiveAlpha = defaultRgba.a // 基础非活动 alpha 值

  let cachedFrameIndex = -1 // 缓存的帧索引，初始为 -1
  let cachedState: ScannerState | null = null // 缓存的扫描器状态，初始为 null

  return (frameIndex: number, charIndex: number, _totalFrames: number, totalChars: number) => {
    // 返回颜色生成器函数
    if (frameIndex !== cachedFrameIndex) {
      // 如果帧索引与缓存的帧索引不同
      cachedFrameIndex = frameIndex // 更新缓存的帧索引
      cachedState = getScannerState(frameIndex, totalChars, options) // 计算并缓存扫描器状态
    }

    const state = cachedState! // 使用缓存的扫描器状态

    const index = calculateColorIndex(frameIndex, charIndex, totalChars, options, state) // 计算颜色索引

    // Calculate global fade for inactive dots during hold or movement // 计算保持或移动期间非活动点的全局淡入淡出
    const { isHolding, holdProgress, holdTotal, movementProgress, movementTotal } = state // 解构扫描器状态

    let fadeFactor = 1.0 // 初始化淡入淡出因子为 1.0（完全不透明）
    if (enableFading) {
      // 如果启用淡入淡出效果
      if (isHolding && holdTotal > 0) {
        // 如果处于保持状态且有保持总帧数
        // Fade out linearly to minAlpha // 线性淡出到最小 alpha 值
        const progress = Math.min(holdProgress / holdTotal, 1) // 计算保持进度（最大为 1）
        fadeFactor = Math.max(minAlpha, 1 - progress * (1 - minAlpha)) // 计算淡入淡出因子
      } else if (!isHolding && movementTotal > 0) {
        // 如果不处于保持状态且有移动总帧数
        // Fade in linearly from minAlpha during movement // 移动期间从最小 alpha 值线性淡入
        const progress = Math.min(movementProgress / Math.max(1, movementTotal - 1), 1) // 计算移动进度（最大为 1）
        fadeFactor = minAlpha + progress * (1 - minAlpha) // 计算淡入淡出因子
      }
    }

    // Combine base inactive alpha with the fade factor // 将基础非活动 alpha 与淡入淡出因子结合
    // This ensures inactiveFactor is respected while still allowing fading animation // 这确保非活动因子被尊重，同时仍然允许淡入淡出动画
    defaultRgba.a = baseInactiveAlpha * fadeFactor // 更新默认颜色的 alpha 值

    if (index === -1) {
      // 如果颜色索引为 -1（不在轨迹范围内）
      return defaultRgba // 返回默认颜色
    }

    return colors[index] ?? defaultRgba // 返回颜色数组中对应索引的颜色，如果不存在则返回默认颜色
  }
}

/**
 * deriveTrailColors 从单个亮色派生轨迹颜色
 *
 * 功能说明：
 * - 从单个亮色派生一组渐变轨迹颜色
 * - 使用 alpha 衰减实现自然的轨迹淡出效果
 * - 第一个颜色为最亮的颜色（中心/头部）
 * - 第二个颜色有轻微的发光/眩光效果
 * - 后续颜色使用指数 alpha 衰减
 *
 * 使用场景：
 * - 需要从单个颜色创建渐变轨迹时
 * - 需要实现自然的淡出效果时
 * - 需要为扫描动画提供颜色序列时
 *
 * 参数说明：
 * - brightColor: 最亮的颜色（扫描器的中心/头部）
 * - steps: 渐变步数（默认：6）
 *
 * 返回值：
 * - 返回 RGBA 颜色数组，包含基于 alpha 的轨迹淡出效果（与背景无关）
 */
export function deriveTrailColors(brightColor: ColorInput, steps: number = 6): RGBA[] {
  // 返回 RGBA 颜色数组
  const baseRgba = brightColor instanceof RGBA ? brightColor : RGBA.fromHex(brightColor as string) // 获取或转换基础颜色为 RGBA

  const colors: RGBA[] = [] // 初始化颜色数组

  for (let i = 0; i < steps; i++) {
    // 遍历每个渐变步数
    // Alpha-based falloff with optional bloom effect // 基于 alpha 的衰减，带有可选的发光效果
    let alpha: number // alpha 值
    let brightnessFactor: number // 亮度因子

    if (i === 0) {
      // 第一个颜色
      // Lead position: full brightness and opacity // 头部位置：完全亮度和不透明度
      alpha = 1.0 // alpha 为 1.0（完全不透明）
      brightnessFactor = 1.0 // 亮度因子为 1.0（完全亮度）
    } else if (i === 1) {
      // 第二个颜色
      // Slight bloom/glare effect: brighten color but reduce opacity slightly // 轻微的发光/眩光效果：增亮颜色但略微降低不透明度
      alpha = 0.9 // alpha 为 0.9
      brightnessFactor = 1.15 // 亮度因子为 1.15（增亮 15%）
    } else {
      // 后续颜色
      // Exponential alpha decay for natural-looking trail fade // 指数 alpha 衰减，实现自然的轨迹淡出
      alpha = Math.pow(0.65, i - 1) // alpha 为 0.65 的 (i-1) 次方
      brightnessFactor = 1.0 // 亮度因子为 1.0（无增亮）
    }

    const r = Math.min(1.0, baseRgba.r * brightnessFactor) // 计算红色分量，最大为 1.0
    const g = Math.min(1.0, baseRgba.g * brightnessFactor) // 计算绿色分量，最大为 1.0
    const b = Math.min(1.0, baseRgba.b * brightnessFactor) // 计算蓝色分量，最大为 1.0

    colors.push(RGBA.fromValues(r, g, b, alpha)) // 将颜色添加到数组
  }

  return colors // 返回颜色数组
}

/**
 * deriveInactiveColor 从亮色派生非活动/默认颜色
 *
 * 功能说明：
 * - 从亮色派生非活动/默认颜色
 * - 使用 alpha 调整实现与背景无关的调暗效果
 * - 保持原始颜色的亮度，只调整透明度
 *
 * 使用场景：
 * - 需要为扫描动画的非活动部分创建颜色时
 * - 需要实现与背景无关的调暗效果时
 * - 需要保持颜色亮度的一致性时
 *
 * 参数说明：
 * - brightColor: 最亮的颜色（扫描器的中心/头部）
 * - factor: 非活动颜色的 alpha 因子（默认：0.2，范围：0-1）
 *
 * 返回值：
 * - 返回相同的颜色，但具有降低的 alpha 值，用于与背景无关的调暗
 */
export function deriveInactiveColor(brightColor: ColorInput, factor: number = 0.2): RGBA {
  // 返回 RGBA 颜色
  const baseRgba = brightColor instanceof RGBA ? brightColor : RGBA.fromHex(brightColor as string) // 获取或转换基础颜色为 RGBA

  // Use the full color brightness but adjust alpha for background-independent dimming // 使用完整的颜色亮度，但调整 alpha 以实现与背景无关的调暗
  return RGBA.fromValues(baseRgba.r, baseRgba.g, baseRgba.b, factor) // 返回具有调整后的 alpha 值的颜色
}

/**
 * KnightRiderStyle 骑士骑手样式类型定义
 *
 * 样式说明：
 * - blocks: 使用方块字符（■）表示活动点
 * - diamonds: 使用菱形字符（⬥、◆、⬩、⬪）表示活动点
 */
export type KnightRiderStyle = "blocks" | "diamonds" // 骑士骑手样式类型：方块或菱形

/**
 * KnightRiderOptions 骑士骑手选项接口定义
 *
 * 属性说明：
 * - width: 可选的扫描器宽度（字符数）
 * - style: 可选的样式类型（方块或菱形）
 * - holdStart: 可选的起点保持帧数
 * - holdEnd: 可选的终点保持帧数
 * - colors: 可选的颜色数组
 * - color: 可选的单个颜色，用于派生轨迹（替代提供颜色数组）
 * - trailSteps: 使用单个颜色时的轨迹步数（默认：6）
 * - defaultColor: 可选的默认颜色
 * - inactiveFactor: 使用单个颜色时非活动颜色的 alpha 因子（默认：0.2，范围：0-1）
 * - enableFading: 启用保持和移动期间非活动点的淡入淡出（默认：true）
 * - minAlpha: 淡入淡出时的最小 alpha 值（默认：0，范围：0-1）
 */
export interface KnightRiderOptions {
  width?: number // 可选的扫描器宽度（字符数）
  style?: KnightRiderStyle // 可选的样式类型（方块或菱形）
  holdStart?: number // 可选的起点保持帧数
  holdEnd?: number // 可选的终点保持帧数
  colors?: ColorInput[] // 可选的颜色数组
  /** Single color to derive trail from (alternative to providing colors array) */ // 单个颜色，用于派生轨迹（替代提供颜色数组）
  color?: ColorInput // 可选的单个颜色，用于派生轨迹
  /** Number of trail steps when using single color (default: 6) */ // 使用单个颜色时的轨迹步数（默认：6）
  trailSteps?: number // 可选的轨迹步数
  defaultColor?: ColorInput // 可选的默认颜色
  /** Alpha factor for inactive color when using single color (default: 0.2, range: 0-1) */ // 使用单个颜色时非活动颜色的 alpha 因子（默认：0.2，范围：0-1）
  inactiveFactor?: number // 可选的非活动颜色 alpha 因子
  /** Enable fading of inactive dots during hold and movement (default: true) */ // 启用保持和移动期间非活动点的淡入淡出（默认：true）
  enableFading?: boolean // 可选的启用淡入淡出
  /** Minimum alpha value when fading (default: 0, range: 0-1) */ // 淡入淡出时的最小 alpha 值（默认：0，范围：0-1）
  minAlpha?: number // 可选的最小 alpha 值
}

/**
 * createFrames 创建骑士骑手风格扫描动画的帧字符串
 *
 * 功能说明：
 * - 创建 Knight Rider 风格的扫描动画帧字符串数组
 * - 支持两种样式：方块（■）和菱形（⬥、◆、⬩、⬪）
 * - 支持双向移动，包含起点和终点的保持阶段
 * - 使用动态帧生成，非活动像素为点（·），活动像素为方块或菱形
 *
 * 使用场景：
 * - 需要创建 Knight Rider 风格的扫描动画时
 * - 需要为终端界面提供加载指示器时
 * - 需要实现复古风格的扫描效果时
 *
 * 参数说明：
 * - options: 骑士骑手效果配置选项
 *
 * 返回值：
 * - 返回帧字符串数组，每个字符串表示一帧的扫描器状态
 */
export function createFrames(options: KnightRiderOptions = {}): string[] {
  // 返回帧字符串数组
  const width = options.width ?? 8 // 扫描器宽度，默认为 8 个字符
  const style = options.style ?? "diamonds" // 样式类型，默认为菱形
  const holdStart = options.holdStart ?? 30 // 起点保持帧数，默认为 30
  const holdEnd = options.holdEnd ?? 9 // 终点保持帧数，默认为 9

  const colors =
    options.colors ??
    (options.color // 如果提供了颜色数组则使用，否则从单个颜色派生
      ? deriveTrailColors(options.color, options.trailSteps) // 从单个颜色派生轨迹颜色
      : [
          // 默认红色渐变（Knight Rider 风格）
          RGBA.fromHex("#ff0000"), // Brightest Red (Center) // 最亮的红色（中心）
          RGBA.fromHex("#ff5555"), // Glare/Bloom // 发光/眩光
          RGBA.fromHex("#dd0000"), // Trail 1 // 轨迹 1
          RGBA.fromHex("#aa0000"), // Trail 2 // 轨迹 2
          RGBA.fromHex("#770000"), // Trail 3 // 轨迹 3
          RGBA.fromHex("#440000"), // Trail 4 // 轨迹 4
        ])

  const defaultColor =
    options.defaultColor ??
    (options.color // 如果提供了默认颜色则使用，否则从单个颜色派生
      ? deriveInactiveColor(options.color, options.inactiveFactor) // 从单个颜色派生非活动颜色
      : RGBA.fromHex("#330000")) // 默认非活动颜色（暗红色）

  const trailOptions = {
    // 轨迹选项配置
    colors, // 颜色数组
    trailLength: colors.length, // 轨迹长度等于颜色数组长度
    defaultColor, // 默认颜色
    direction: "bidirectional" as const, // 方向为双向
    holdFrames: { start: holdStart, end: holdEnd }, // 保持帧数配置
    enableFading: options.enableFading, // 启用淡入淡出
    minAlpha: options.minAlpha, // 最小 alpha 值
  }

  // Bidirectional cycle: Forward (width) + Hold End + Backward (width-1) + Hold Start // 双向循环：向前（宽度）+ 终点保持 + 向后（宽度-1）+ 起点保持
  const totalFrames = width + holdEnd + (width - 1) + holdStart // 计算总帧数

  // Generate dynamic frames where inactive pixels are dots and active ones are blocks // 生成动态帧，其中非活动像素为点，活动像素为方块
  const frames = Array.from({ length: totalFrames }, (_, frameIndex) => {
    // 创建帧数组
    return Array.from({ length: width }, (_, charIndex) => {
      // 每帧包含宽度个字符
      const index = calculateColorIndex(frameIndex, charIndex, width, trailOptions) // 计算颜色索引

      if (style === "diamonds") {
        // 如果样式为菱形
        const shapes = ["⬥", "◆", "⬩", "⬪"] // 菱形字符数组
        if (index >= 0 && index < trailOptions.colors.length) {
          // 如果在轨迹范围内
          return shapes[Math.min(index, shapes.length - 1)] // 返回对应的菱形字符
        }
        return "·" // 返回点字符（非活动）
      }

      // Default to blocks // 默认使用方块
      // It's active if we have a valid color index that is within our colors array // 如果有有效的颜色索引且在颜色数组范围内，则为活动状态
      const isActive = index >= 0 && index < trailOptions.colors.length // 判断是否为活动状态
      return isActive ? "■" : "⬝" // 返回方块（活动）或右箭头（非活动）
    }).join("") // 将字符数组连接为字符串
  })

  return frames // 返回帧数组
}

/**
 * createColors 创建骑士骑手风格扫描动画的颜色生成器
 *
 * 功能说明：
 * - 创建一个颜色生成器函数，用于生成 Knight Rider 风格的扫描动画颜色
 * - 支持自定义颜色数组或从单个颜色派生轨迹
 * - 支持淡入淡出效果，在保持和移动期间淡入淡出非活动点
 * - 使用双向移动模式，包含起点和终点的保持阶段
 *
 * 使用场景：
 * - 需要创建 Knight Rider 风格的扫描动画颜色生成器时
 * - 需要为终端界面提供动态颜色效果时
 * - 需要实现高性能的颜色计算时
 *
 * 参数说明：
 * - options: 骑士骑手效果配置选项
 *
 * 返回值：
 * - 返回一个颜色生成器函数，该函数接受帧索引、字符索引、总帧数和总字符数，返回对应的颜色
 */
export function createColors(options: KnightRiderOptions = {}): ColorGenerator {
  // 返回颜色生成器函数
  const holdStart = options.holdStart ?? 30 // 起点保持帧数，默认为 30
  const holdEnd = options.holdEnd ?? 9 // 终点保持帧数，默认为 9

  const colors =
    options.colors ??
    (options.color // 如果提供了颜色数组则使用，否则从单个颜色派生
      ? deriveTrailColors(options.color, options.trailSteps) // 从单个颜色派生轨迹颜色
      : [
          // 默认红色渐变（Knight Rider 风格）
          RGBA.fromHex("#ff0000"), // Brightest Red (Center) // 最亮的红色（中心）
          RGBA.fromHex("#ff5555"), // Glare/Bloom // 发光/眩光
          RGBA.fromHex("#dd0000"), // Trail 1 // 轨迹 1
          RGBA.fromHex("#aa0000"), // Trail 2 // 轨迹 2
          RGBA.fromHex("#770000"), // Trail 3 // 轨迹 3
          RGBA.fromHex("#440000"), // Trail 4 // 轨迹 4
        ])

  const defaultColor =
    options.defaultColor ??
    (options.color // 如果提供了默认颜色则使用，否则从单个颜色派生
      ? deriveInactiveColor(options.color, options.inactiveFactor) // 从单个颜色派生非活动颜色
      : RGBA.fromHex("#330000")) // 默认非活动颜色（暗红色）

  const trailOptions = {
    // 轨迹选项配置
    colors, // 颜色数组
    trailLength: colors.length, // 轨迹长度等于颜色数组长度
    defaultColor, // 默认颜色
    direction: "bidirectional" as const, // 方向为双向
    holdFrames: { start: holdStart, end: holdEnd }, // 保持帧数配置
    enableFading: options.enableFading, // 启用淡入淡出
    minAlpha: options.minAlpha, // 最小 alpha 值
  }

  return createKnightRiderTrail(trailOptions) // 返回骑士骑手轨迹颜色生成器
}
