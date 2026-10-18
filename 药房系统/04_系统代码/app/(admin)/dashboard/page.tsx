import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, PageHeader, StatCard } from "@/components/ui";
import DataTable from "@/components/DataTable";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import { daysLeft, expiryLevel, LEVEL_CLASS, LEVEL_LABEL } from "@/lib/rules";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [
    drugCount,
    batchCount,
    memberCount,
    todaySales,
    pendingStocktake,
    batches,
    disposals,
    sales
  ] = await Promise.all([
    prisma.drug.count(),
    prisma.drugBatch.count(),
    prisma.member.count(),
    prisma.saleOrder.count({
      where: { soldAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }
    }),
    prisma.stocktake.count({ where: { status: "进行中" } }),
    prisma.drugBatch.findMany({
      include: { drug: true, location: true },
      orderBy: { expireDate: "asc" },
      take: 60
    }),
    prisma.expiryDisposal.findMany({
      include: { batch: { include: { drug: true } }, staff: true },
      orderBy: { disposedAt: "desc" },
      take: 6
    }),
    prisma.saleOrder.findMany({
      include: { member: true, staff: true },
      orderBy: { soldAt: "desc" },
      take: 6
    })
  ]);

  const near = batches
    .map((b) => ({ ...b, days: daysLeft(b.expireDate) }))
    .filter((b) => b.days <= 90)
    .sort((a, b) => a.days - b.days);

  const urgent = near.filter((b) => b.days <= 30).length;
  const isolate = near.filter((b) => b.days <= 7).length;

  return (
    <>
      <PageHeader
        title="仪表盘"
        desc="门店经营与效期管控总览（全部为模拟数据）"
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard label="药品品种" value={drugCount} />
        <StatCard label="在库批次" value={batchCount} />
        <StatCard label="近效期批次（≤90 天）" value={near.length} hint="含过期批次" />
        <StatCard label="紧急（≤30 天）" value={urgent} hint="须优先处置" />
        <StatCard label="待隔离（≤7 天）" value={isolate} hint="只可下架隔离／报损" />
        <StatCard label="今日销售单" value={todaySales} hint={`会员 ${memberCount} 人 · 进行中盘点 ${pendingStocktake} 单`} />
      </div>

      <div className="card mb-5">
        <div className="card-title">
          近效期预警（按剩余天数升序）
          <span className="ml-2 text-xs font-normal text-slate-400">
            依据业务规则：≤90 天预警 · ≤30 天紧急 · ≤7 天待隔离
          </span>
        </div>
        <DataTable
          columns={[
            { key: "drug", label: "药品", render: (r) => (r.drug as any).name },
            { key: "batchNo", label: "批号" },
            { key: "location", label: "库位", render: (r) => ((r.location as any)?.locationCode ?? "—") },
            { key: "expireDate", label: "有效期至", render: (r) => fmtDate(r.expireDate as Date) },
            { key: "stockQty", label: "库存", render: (r) => `${r.stockQty} 盒` },
            {
              key: "days",
              label: "剩余天数",
              render: (r) => {
                const d = r.days as number;
                return d < 0 ? `已过期 ${-d} 天` : `${d} 天`;
              }
            },
            {
              key: "level",
              label: "状态",
              render: (r) => {
                const lv = expiryLevel(r.days as number);
                return <Badge className={LEVEL_CLASS[lv]}>{LEVEL_LABEL[lv]}</Badge>;
              }
            }
          ]}
          rows={near.slice(0, 10) as any}
        />
        <div className="px-4 py-2 text-right text-xs">
          <Link href="/expiry" className="text-brand-600 hover:underline">
            查看全部近效期批次 →
          </Link>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card">
          <div className="card-title">最近处置记录</div>
          <DataTable
            columns={[
              { key: "drug", label: "药品", render: (r) => ((r.batch as any).drug as any).name },
              { key: "action", label: "动作" },
              { key: "staff", label: "处置人", render: (r) => (r.staff as any).name },
              { key: "disposedAt", label: "时间", render: (r) => fmtDateTime(r.disposedAt as Date) }
            ]}
            rows={disposals as any}
          />
        </div>
        <div className="card">
          <div className="card-title">最近销售单</div>
          <DataTable
            columns={[
              { key: "orderNo", label: "单号" },
              { key: "member", label: "会员", render: (r) => ((r.member as any)?.name ?? "非会员") },
              { key: "payMethod", label: "支付" },
              {
                key: "received",
                label: "实收",
                align: "right",
                render: (r) => fmtMoney(r.received as any)
              },
              { key: "soldAt", label: "时间", render: (r) => fmtDateTime(r.soldAt as Date) }
            ]}
            rows={sales as any}
          />
        </div>
      </div>
    </>
  );
}
