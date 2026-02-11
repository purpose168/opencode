// 空边框样式常量，用于不显示边框的场景
export const EmptyBorder = {
  topLeft: "", // 左上角边框字符（空）
  bottomLeft: "", // 左下角边框字符（空）
  vertical: "", // 垂直边框字符（空）
  topRight: "", // 右上角边框字符（空）
  bottomRight: "", // 右下角边框字符（空）
  horizontal: " ", // 水平边框字符（空格）
  bottomT: "", // 底部 T 形连接字符（空）
  topT: "", // 顶部 T 形连接字符（空）
  cross: "", // 十字交叉连接字符（空）
  leftT: "", // 左侧 T 形连接字符（空）
  rightT: "", // 右侧 T 形连接字符（空）
}

// 分割边框样式常量，用于分割左右两列的场景
export const SplitBorder = {
  border: ["left" as const, "right" as const], // 边框位置数组：左侧和右侧
  customBorderChars: {
    // 自定义边框字符
    ...EmptyBorder, // 继承空边框的字符
    vertical: "┃", // 垂直边框字符（粗竖线）
  },
}
