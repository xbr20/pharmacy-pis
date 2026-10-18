import { prisma } from "@/lib/prisma";
import { Badge, PageHeader } from "@/components/ui";
import DataTable from "@/components/DataTable";
import { fmtDateTime, fmtMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const sales = await prisma.saleOrder.findMany({
    include: { member: true, staff: true, items: { include: { batch: { include: { drug: true } } } } },
    orderBy: { soldAt: "desc" },
    take: 40
  });

  return (
    <>
      <PageHeader
        title="销售单"
        desc="收银结算记录：会员可空（允许匿名购买），销售明细必须落到具体批次（追溯需要）；医保结算单同时回写医保终端结果"
      />

      {sales.map((s) => (
        <div key={s.id} className="card mb-4">
          <div className="card-title flex flex-wrap items-center gap-3">
            <span>{s.orderNo}</span>
            <Badge
              className={
                s.payMethod === "医保"
                  ? "bg-brand-50 text-brand-700"
                  : "bg-slate-100 text-slate-600"
              }
            >
              {s.payMethod}
            </Badge>
            <span className="text-xs font-normal text-slate-500">
              会员：{s.member?.name ?? "非会员"} · 收银员：{s.staff.name} · 时间：
              {fmtDateTime(s.soldAt)} · 实收：{fmtMoney(s.received as any)}
            </span>
          </div>
          <DataTable
            columns={[
              { key: "drug", label: "药品", render: (r) => ((r.batch as any).drug as any).name },
              { key: "batchNo", label: "批号", render: (r) => (r.batch as any).batchNo },
              { key: "quantity", label: "数量" },
              {
                key: "unitPrice",
                label: "单价",
                align: "right",
                render: (r) => fmtMoney(r.unitPrice as any)
              },
              {
                key: "amount",
                label: "金额",
                align: "right",
                render: (r) => fmtMoney(r.amount as any)
              }
            ]}
            rows={s.items as any}
          />
        </div>
      ))}
    </>
  );
}
