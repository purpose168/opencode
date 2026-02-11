/**
 * 将美分转换为微美分
 * 用于提高金额精度，避免浮点数计算误差
 * @param amount 美分金额
 * @returns 微美分金额（1 美分 = 1,000,000 微美分）
 */
export function centsToMicroCents(amount: number) {
  return Math.round(amount * 1000000)
}
