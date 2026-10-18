/**
 * 业务规则（与《药房信息系统-系统分析与设计（A-C）》1.4 / 2.2 UC-04 规约一致）
 * 依据：业务规则 1（效期分级 90/30/7 天）、业务规则 2（处方药 ≤30 天不得促销，
 *      剩余不足 7 天只能下架隔离或报损 —— 对应扩展 4a）
 */

export type ExpiryLevel = "normal" | "warn" | "urgent" | "isolate" | "expired";

/** 依据剩余天数给出效期分级 */
export function expiryLevel(daysLeft: number): ExpiryLevel {
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 7) return "isolate";
  if (daysLeft <= 30) return "urgent";
  if (daysLeft <= 90) return "warn";
  return "normal";
}

export const LEVEL_LABEL: Record<ExpiryLevel, string> = {
  normal: "正常",
  warn: "预警（≤90 天）",
  urgent: "紧急（≤30 天）",
  isolate: "待隔离（≤7 天）",
  expired: "已过效期"
};

export const LEVEL_CLASS: Record<ExpiryLevel, string> = {
  normal: "bg-slate-100 text-slate-600",
  warn: "bg-amber-100 text-amber-700",
  urgent: "bg-orange-100 text-orange-700",
  isolate: "bg-red-100 text-red-700",
  expired: "bg-slate-800 text-white"
};

export const ALL_ACTIONS = ["促销", "退货", "调拨", "下架隔离", "报损"] as const;
export type DisposalAction = (typeof ALL_ACTIONS)[number];

/** 剩余天数（按自然日，负值表示已过期） */
export function daysLeft(expireDate: Date, base = new Date()): number {
  const a = Date.UTC(base.getFullYear(), base.getMonth(), base.getDate());
  const b = Date.UTC(
    expireDate.getFullYear(),
    expireDate.getMonth(),
    expireDate.getDate()
  );
  return Math.round((b - a) / 86400000);
}

/**
 * 依据业务规则校验处置动作是否被允许，返回错误信息（null 表示允许）
 * - 已过效期：只能报损
 * - ≤7 天：只能下架隔离 / 报损（UC-04 扩展 4a）
 * - ≤30 天：不得促销（业务规则 2）
 */
export function checkAction(
  action: string,
  days: number,
  isPrescription: boolean
): string | null {
  if (days < 0) {
    return action === "报损" ? null : "该批次已过效期，只能选择“报损”。";
  }
  if (days <= 7 && action !== "下架隔离" && action !== "报损") {
    return `该批次距效期不足 7 天（剩余 ${days} 天），按业务规则只能“下架隔离”或“报损”。`;
  }
  if (days <= 30 && action === "促销" && isPrescription) {
    return `处方药效期剩余 ${days} 天（≤30 天），按业务规则不得促销，请改选退货／调拨／下架隔离。`;
  }
  return null;
}

/**
 * 会员积分规则（UC-08 销售开单）
 * - 会员价与非会员价：应收金额按会员价折扣率计算（会员等级.会员价折扣率）
 * - 每月逢 8（8/18/28 日）为会员日，当日积分双倍（业务规则）
 */
export function memberPoints(
  amount: number,
  date: Date,
  pointRate = 1
): number {
  const base = Math.floor(amount * pointRate);
  const day = date.getDate();
  const isMemberDay = day === 8 || day === 18 || day === 28;
  return isMemberDay ? base * 2 : base;
}

/**
 * 会员价计算（UC-08 销售开单）
 * 应收单价 = 非会员价 × 会员价折扣率（会员等级.discount_rate）
 */
export function memberPrice(
  unitPrice: number,
  discountRate: number
): number {
  return Math.round(unitPrice * discountRate * 100) / 100;
}

/**
 * 积分兑换奖品校验（UC-08 扩展路径）
 * threshold 为会员等级的兑换门槛（单次最低兑换分）
 * 返回错误信息（null 表示允许兑换并扣减积分）
 */
export function redeemPoints(
  balance: number,
  cost: number,
  threshold = 0
): string | null {
  if (cost <= 0) return "兑换所需积分必须大于 0。";
  if (threshold > 0 && cost < threshold) {
    return `单次兑换最少 ${threshold} 分。`;
  }
  if (balance < cost) {
    return `积分余额 ${balance} 不足兑换所需 ${cost} 分。`;
  }
  return null;
}
