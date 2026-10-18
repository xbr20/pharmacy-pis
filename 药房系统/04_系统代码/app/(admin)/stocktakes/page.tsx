import { prisma } from "@/lib/prisma";
import { Badge, PageHeader } from "@/components/ui";
import DataTable from "@/components/DataTable";
import { fmtDate, fmtMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StocktakesPage() {
  const stocktakes = await prisma.stocktake.findMany({
    include: {
      initiator: true,
      reviewer: true,
      items: { include: { batch: { include: { drug: true } } } }
    },
    orderBy: { baseTime: "desc" }
  });

  return (
    <>
      <PageHeader
        title="库存盘点"
        desc="UC-03 执行库存盘点：盘点单为聚合根，明细经批次落到具体账实差异（对应 1.4“定期手工盘点 → 系统自动对账”）"
      />

      {stocktakes.map((t) => (
        <div key={t.id} className="card mb-5">
          <div className="card-title flex flex-wrap items-center gap-3">
            <span>{t.takeNo}</span>
            <Badge
              className={
                t.status === "已完成"
                  ? "bg-brand-50 text-brand-700"
                  : "bg-amber-100 text-amber-700"
              }
            >
              {t.status}
            </Badge>
            <span className="text-xs font-normal text-slate-500">
              范围：{t.scope ?? "—"} · 基准时间：{fmtDate(t.baseTime)} · 发起人：
              {t.initiator?.name ?? "—"} · 复核人：{t.reviewer?.name ?? "待复核"}
            </span>
          </div>
          <DataTable
            columns={[
              { key: "drug", label: "药品", render: (r) => ((r.batch as any).drug as any).name },
              { key: "batchNo", label: "批号", render: (r) => (r.batch as any).batchNo },
              { key: "bookQty", label: "账面数" },
              { key: "actualQty", label: "实盘数" },
              {
                key: "diffQty",
                label: "差异数",
                render: (r) =>
                  (r.diffQty as number) === 0 ? (
                    "0"
                  ) : (
                    <span className="font-semibold text-red-600">{r.diffQty as number}</span>
                  )
              },
              {
                key: "diffAmount",
                label: "差异金额",
                align: "right",
                render: (r) => fmtMoney(r.diffAmount as any)
              },
              {
                key: "pendingEntry",
                label: "待补录",
                render: (r) => (r.pendingEntry ? <Badge className="bg-amber-100 text-amber-700">待补录</Badge> : "—")
              }
            ]}
            rows={t.items as any}
          />
        </div>
      ))}
    </>
  );
}
