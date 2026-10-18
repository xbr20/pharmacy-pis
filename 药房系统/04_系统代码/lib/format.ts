export function fmtDate(d?: Date | string | null): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fmtDateTime(d?: Date | string | null): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${fmtDate(dt)} ${hh}:${mm}`;
}

export function fmtMoney(v?: number | string | null | unknown): string {
  if (v === null || v === undefined) return "—";
  // Prisma 的 Decimal 字段返回的是 Decimal 对象（typeof "object"），
  // 直接 Number(obj) 会得到 NaN，必须先 toNumber()/toString() 再转数字
  const raw = v as any;
  let n: number;
  if (typeof raw === "number") n = raw;
  else if (typeof raw === "string") n = Number(raw);
  else if (raw && typeof raw.toNumber === "function") n = raw.toNumber();
  else n = Number(String(raw));
  if (!Number.isFinite(n)) return "—";
  return `¥${n.toFixed(2)}`;
}
