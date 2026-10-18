import { prisma } from "@/lib/prisma";
import { Badge, PageHeader } from "@/components/ui";
import DataTable from "@/components/DataTable";
import { fmtDate } from "@/lib/format";
import { daysLeft, expiryLevel, LEVEL_CLASS, LEVEL_LABEL } from "@/lib/rules";

export const dynamic = "force-dynamic";

export default async function ExpiryPage() {
  const batches = await prisma.drugBatch.findMany({
    include: { drug: true, location: true },
    orderBy: { expireDate: "asc" }
  });

  const rows = batches
    .map((b) => ({ ...b, days: daysLeft(b.expireDate) }))
    .filter((b) => b.days <= 90)
    .sort((a, b) => a.days - b.days);

  const cards = [
    { label: "预警（≤90 天）", n: rows.filter((r) => r.days > 30).length, cls: "text-amber-600" },
    { label: "紧急（≤30 天）", n: rows.filter((r) => r.days > 7 && r.days <= 30).length, cls: "text-orange-600" },
    { label: "待隔离（≤7 天）", n: rows.filter((r) => r.days >= 0 && r.days <= 7).length, cls: "text-red-600" },
    { label: "已过效期", n: rows.filter((r) => r.days < 0).length, cls: "text-slate-800" }
  ];

  return (
    <>
      <PageHeader
        title="近效期预警"
        desc="替代原《效期登记本》逐盒翻查——系统按剩余天数自动分级，即 1.4 中“每天翻货架变成每天看清单”"
      />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card px-4 py-3">
            <div className="text-xs text-slate-500">{c.label}</div>
            <div className={`mt-1 text-2xl font-bold ${c.cls}`}>{c.n}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <DataTable
          columns={[
            { key: "drug", label: "药品", render: (r) => (r.drug as any).name },
            { key: "batchNo", label: "批号" },
            { key: "location", label: "库位", render: (r) => ((r.location as any)?.locationCode ?? "—") },
            { key: "expireDate", label: "有效期至", render: (r) => fmtDate(r.expireDate as Date) },
            {
              key: "days",
              label: "剩余天数",
              render: (r) => ((r.days as number) < 0 ? `已过期 ${-(r.days as number)} 天` : `${r.days} 天`)
            },
            { key: "stockQty", label: "库存", render: (r) => `${r.stockQty} 盒` },
            {
              key: "level",
              label: "分级",
              render: (r) => {
                const lv = expiryLevel(r.days as number);
                return <Badge className={LEVEL_CLASS[lv]}>{LEVEL_LABEL[lv]}</Badge>;
              }
            }
          ]}
          rows={rows as any}
        />
      </div>
    </>
  );
}
