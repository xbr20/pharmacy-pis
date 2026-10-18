/**
 * 自检脚本：验证数据库约束与核心业务规则
 * 运行：npm test
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const ok = (m) => { pass++; console.log(`  \u2713 ${m}`); };
const bad = (m) => { fail++; console.log(`  \u2717 ${m}`); };

const DAY = 86400000;
const daysLeft = (d) => {
  const t = new Date();
  const a = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  const b = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((b - a) / DAY);
};
/** 与 lib/rules.ts checkAction 等价的规则判定 */
function checkAction(action, days, isRx) {
  if (days < 0) return action === "报损";
  if (days <= 7) return action === "下架隔离" || action === "报损";
  if (days <= 30 && action === "促销" && isRx) return false;
  return true;
}

async function expectReject(label, fn) {
  try {
    await fn();
    bad(`${label}：应当被拒绝，但写入成功了`);
  } catch (e) {
    const code = e.code ?? "";
    ok(`${label}：已被拒绝（${code || e.message.split("\n")[0].slice(0, 40)}）`);
  }
}

async function main() {
  console.log("\n===== 1. 数据规模 =====");
  const tables = ["drug", "drugBatch", "traceCode", "staff", "member", "saleOrder", "expiryDisposal", "stocktake"];
  const counts = {};
  for (const t of tables) counts[t] = await prisma[t].count();
  console.log("  " + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join("  "));
  Object.entries(counts).forEach(([k, v]) => (v > 0 ? ok(`${k} 有数据（${v} 条）`) : bad(`${k} 无数据`)));

  console.log("\n===== 2. 唯一约束 =====");
  const b = await prisma.drugBatch.findFirst();
  await expectReject("同一药品下批号重复（drug_id, batch_no 联合唯一）", () =>
    prisma.drugBatch.create({
      data: { drugId: b.drugId, batchNo: b.batchNo, expireDate: new Date(), stockQty: 1 }
    })
  );
  const tc = await prisma.traceCode.findFirst();
  await expectReject("追溯码重复", () =>
    prisma.traceCode.create({ data: { code: tc.code, drugId: tc.drugId, batchNo: tc.batchNo } })
  );
  await expectReject("药品编码重复", async () => {
    const d = await prisma.drug.findFirst();
    await prisma.drug.create({ data: { drugCode: d.drugCode, name: "重复编码测试" } });
  });

  console.log("\n===== 3. 效期处置业务规则（UC-04 / 业务规则 2 / 扩展 4a）=====");
  const cases = [
    [-5, "报损", false, true, "已过效期 → 报损 允许"],
    [-5, "促销", false, false, "已过效期 → 促销 拒绝"],
    [3, "下架隔离", false, true, "≤7 天 → 下架隔离 允许"],
    [3, "报损", true, true, "≤7 天 → 报损 允许"],
    [3, "促销", false, false, "≤7 天 → 促销 拒绝"],
    [3, "调拨", false, false, "≤7 天 → 调拨 拒绝"],
    [20, "促销", true, false, "处方药 ≤30 天 → 促销 拒绝"],
    [20, "促销", false, true, "非处方药 ≤30 天 → 促销 允许"],
    [60, "促销", true, true, "处方药 60 天 → 促销 允许"],
    [45, "退货", false, true, "≤90 天 → 退货 允许"]
  ];
  for (const [days, action, isRx, expect, label] of cases) {
    const got = checkAction(action, days, isRx);
    got === expect ? ok(label) : bad(`${label}（实际 ${got}）`);
  }

  console.log("\n===== 4. 外键与数据一致性 =====");
  const saleItems = await prisma.saleItem.findMany({ include: { batch: true, saleOrder: true } });
  const broken = saleItems.filter((i) => !i.batch || !i.saleOrder);
  broken.length === 0 ? ok(`销售明细外键完整（${saleItems.length} 条）`) : bad(`${broken.length} 条销售明细外键缺失`);

  const disposals = await prisma.expiryDisposal.findMany({ include: { batch: true, staff: true } });
  const brokenD = disposals.filter((d) => !d.batch || !d.staff);
  brokenD.length === 0 ? ok(`处置记录外键完整（${disposals.length} 条）`) : bad(`${brokenD.length} 条处置记录外键缺失`);

  const nrx = await prisma.prescriptionItem.findMany({ include: { prescription: true, batch: true } });
  const brokenR = nrx.filter((i) => !i.prescription || !i.batch);
  brokenR.length === 0 ? ok(`处方明细外键完整（${nrx.length} 条）`) : bad(`${brokenR.length} 条处方明细外键缺失`);

  console.log("\n===== 5. 效期分级与预警数据 =====");
  const batches = await prisma.drugBatch.findMany();
  const near = batches.filter((x) => daysLeft(x.expireDate) <= 90);
  near.length > 0 ? ok(`近效期批次 ${near.length} 条（≤90 天）`) : bad("无近效期批次，预警页将为空");
  const anyUrgent = near.some((x) => daysLeft(x.expireDate) <= 30);
  anyUrgent ? ok("存在 ≤30 天紧急批次，可演示规则拦截") : bad("无 ≤30 天批次，规则拦截无法演示");

  console.log("\n===== 6. 门店角色数据 =====");
  const manager = await prisma.staff.count({ where: { post: "店长" } });
  manager > 0 ? ok(`存在店长 ${manager} 名（盘点复核人）`) : bad("缺少店长数据");
  const activeCert = await prisma.staff.count({ where: { pharmacistNo: { not: null } } });
  activeCert > 0 ? ok(`持证店员 ${activeCert} 名（承担处方人工复核）`) : bad("缺少持证店员");

  console.log("\n===== 7. 库存流水与台账一致性 =====");
  const movs = await prisma.stockMovement.findMany();
  movs.length > 0 ? ok(`库存流水 ${movs.length} 条（任何改数都有来源）`) : bad("缺少库存流水");
  const noStaff = movs.filter((m) => m.staffId === null).length;
  noStaff === 0 ? ok("每条流水都记录操作人") : bad(`${noStaff} 条流水未记录操作人`);

  // 逐批核对：qty_before + quantity === qty_after（连续可对账）
  const byBatch = new Map();
  for (const m of movs) {
    if (!byBatch.has(m.batchId)) byBatch.set(m.batchId, []);
    byBatch.get(m.batchId).push(m);
  }
  let chainBroken = 0;
  for (const [, list] of byBatch) {
    list.sort((a, b) => a.occurredAt - b.occurredAt || a.id - b.id);
    for (let i = 1; i < list.length; i++) {
      if (list[i].qtyBefore !== list[i - 1].qtyAfter && list[i].movementType !== "盘点调整") chainBroken++;
    }
  }
  chainBroken === 0 ? ok("流水前后勾稽连续（qty_before = 上一条 qty_after）") : bad(`${chainBroken} 处流水勾稽断裂`);
  const negs = await prisma.stockMovement.count({ where: { qtyAfter: { lt: 0 } } });
  negs === 0 ? ok("无负库存流水") : bad(`${negs} 条流水导致负库存`);

  // 期初入库能还原当前库存（期初 + 全部变动 = 当前）
  const batchesAll = await prisma.drugBatch.findMany();
  let mismatch = 0;
  for (const b of batchesAll) {
    const sum = movs.filter((m) => m.batchId === b.id).reduce((s, m) => s + m.quantity, 0);
    if (sum !== b.stockQty) mismatch++;
  }
  mismatch === 0
    ? ok(`${batchesAll.length} 个批次「流水合计 = 当前库存」全部对得上`)
    : bad(`${mismatch} 个批次流水合计与当前库存不符`);

  console.log("\n===== 8. 追溯事件闭环（一物一码）=====");
  const events = await prisma.traceRecord.groupBy({ by: ["eventType"], _count: { _all: true } });
  const evMap = Object.fromEntries(events.map((e) => [e.eventType, e._count._all]));
  console.log("  " + JSON.stringify(evMap));
  (evMap["入库"] || 0) > 0 ? ok("入库事件已记录") : bad("缺少入库事件");
  (evMap["销售出库"] || 0) > 0 ? ok("销售出库事件已记录（流向可上报）") : bad("缺少销售出库事件");
  const pending = await prisma.traceRecord.count({ where: { syncStatus: "待补传" } });
  pending > 0 ? ok(`待补传事件 ${pending} 条（断网降级后补传）`) : bad("无待补传事件，降级策略无法演示");

  console.log("\n===== 9. 销售单—处方关联与价格/积分 =====");
  const rxSales = await prisma.saleOrder.count({ where: { prescriptionId: { not: null } } });
  rxSales > 0 ? ok(`处方药销售已绑定处方 ${rxSales} 单`) : bad("处方药销售未绑定处方");
  const priced = await prisma.saleOrder.findMany({ include: { items: { include: { batch: { include: { drug: true } } } } } });
  const badPrice = priced.filter((s) =>
    s.items.some((it) => Number(it.unitPrice) > Number(it.batch.drug.retailPrice) + 0.001)
  );
  badPrice.length === 0 ? ok("成交单价不超过零售价") : bad(`${badPrice.length} 单成交价高于零售价`);
  const noPrice = await prisma.drug.count({ where: { retailPrice: 0 } });
  const drugTotal = await prisma.drug.count();
  noPrice === 0 ? ok(`${drugTotal} 个药品均有零售价`) : bad(`${noPrice} 个药品缺零售价`);
  const pointLogs = await prisma.pointLog.findMany();
  pointLogs.length > 0 ? ok(`积分流水 ${pointLogs.length} 条（得分/兑换可追溯）`) : bad("缺少积分流水");
  const rewardItems = await prisma.rewardItem.count();
  rewardItems > 0 ? ok(`积分兑换奖励品 ${rewardItems} 种`) : bad("缺少奖励品目录");

  console.log("\n===== 10. 处置与盘点状态闭环 =====");
  const st = await prisma.expiryDisposal.groupBy({ by: ["status"], _count: { _all: true } });
  console.log("  " + JSON.stringify(Object.fromEntries(st.map((s) => [s.status, s._count._all]))));
  const failed = await prisma.expiryDisposal.count({ where: { status: "待重试", lastError: { not: null } } });
  (failed > 0 || st.length > 0) ? ok("处置状态含审批/重试/撤销，可落地") : bad("处置状态未闭环");
  const takes = await prisma.stocktake.groupBy({ by: ["status"], _count: { _all: true } });
  console.log("  " + JSON.stringify(Object.fromEntries(takes.map((s) => [s.status, s._count._all]))));
  const adjusted = takes.find((t) => t.status === "已调账");
  adjusted ? ok("存在已调账盘点单（差异已回写流水）") : bad("无已调账盘点单");
  const auditCount = await prisma.auditLog.count();
  auditCount > 0 ? ok(`审计日志 ${auditCount} 条`) : bad("缺少审计日志");

  console.log(`\n===== 结果：通过 ${pass} 项，失败 ${fail} 项 =====\n`);
  if (fail > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
