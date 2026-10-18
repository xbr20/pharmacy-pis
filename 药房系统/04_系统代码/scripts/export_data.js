/**
 * 导出数据库中的真实业务数据为 JSON，供生成「数据表图片」使用。
 * 运行：node scripts/export_data.js  →  输出 %TEMP%/pis_data.json
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const d = (x) => (x ? new Date(x).toISOString().slice(0, 10) : "");

(async () => {
  const mvRows = await prisma.stockMovement.findMany({
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    take: 14,
    include: { batch: { include: { drug: true } } }
  });
  const mv = mvRows.map((m) => [
    String(m.id), m.batch.drug.name, m.movementType, String(m.quantity),
    String(m.qtyBefore), String(m.qtyAfter), m.sourceType, d(m.occurredAt)
  ]);

  const stRows = await prisma.stocktakeItem.findMany({
    orderBy: { id: "asc" },
    include: { stocktake: true, batch: { include: { drug: true } } }
  });
  const st = stRows.map((s) => [
    s.stocktake.takeNo, s.batch.drug.name, s.batch.batchNo,
    String(s.bookQty), String(s.countedQty), String(s.actualQty), String(s.diffQty)
  ]);

  const trRows = await prisma.traceRecord.findMany({
    orderBy: { id: "asc" }, take: 12,
    include: { traceCode: true, batch: true }
  });
  const tr = trRows.map((r) => [
    r.traceCode.code.slice(-10), r.eventType, r.batch ? r.batch.batchNo : "-",
    d(r.scannedAt), r.syncStatus
  ]);

  const plRows = await prisma.pointLog.findMany({
    orderBy: { id: "asc" }, include: { member: true }
  });
  const pl = plRows.map((p) => [
    p.member.cardNo, p.changeType, String(p.points), String(p.balanceAfter), d(p.occurredAt)
  ]);

  const out = path.join(os.tmpdir(), "pis_data.json");
  fs.writeFileSync(out, JSON.stringify({ mv, st, tr, pl }, null, 1), "utf8");
  console.log("written", out, `mv=${mv.length} st=${st.length} tr=${tr.length} pl=${pl.length}`);
  await prisma.$disconnect();
})();
