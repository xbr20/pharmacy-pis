import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAction, daysLeft, expiryLevel, LEVEL_LABEL } from "@/lib/rules";

/**
 * 近效期处置登记
 * 业务规则（与 UC-04 规约一致）：
 *  - 距效期不足 7 天：只能“下架隔离”或“报损”（扩展 4a）
 *  - 处方药剩余 ≤ 30 天：不得促销（业务规则 2）
 *  - 已过效期：只能“报损”
 *  - 偏离系统建议时必须填写偏离理由（业务规则 3）
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "请求格式错误" }, { status: 400 });
  }

  const batchId = Number(body.batchId);
  const staffId = Number(body.staffId);
  const action = String(body.action ?? "");
  const deviationNote = body.deviationNote ? String(body.deviationNote).trim() : null;

  if (!batchId || !staffId || !action) {
    return NextResponse.json({ ok: false, message: "请选择批次、处置人与处置动作" }, { status: 400 });
  }

  const batch = await prisma.drugBatch.findUnique({
    where: { id: batchId },
    include: { drug: true }
  });
  if (!batch) {
    return NextResponse.json({ ok: false, message: "批次不存在" }, { status: 404 });
  }

  const days = daysLeft(batch.expireDate);
  const error = checkAction(action, days, batch.drug.isPrescription);
  if (error) {
    return NextResponse.json({ ok: false, message: error }, { status: 400 });
  }

  const created = await prisma.expiryDisposal.create({
    data: {
      batchId,
      staffId,
      action,
      deviationNote,
      applyNo: action === "退货" || action === "调拨" ? `AP${Date.now().toString().slice(-8)}` : null
    }
  });

  // 处置后同步批次状态（效期维度分级标签）
  const lv = expiryLevel(days);
  await prisma.drugBatch.update({
    where: { id: batchId },
    data: {
      batchStatus: lv === "normal" ? "在库" : LEVEL_LABEL[lv].split("（")[0],
      flowStatus: action === "下架隔离" ? "已隔离" : action === "报损" ? "已报损" : "待处理"
    }
  });

  return NextResponse.json({
    ok: true,
    message: `已登记处置：${batch.drug.name}（${batch.batchNo}）→ ${action}`,
    id: created.id
  });
}
