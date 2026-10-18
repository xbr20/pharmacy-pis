import { prisma } from "@/lib/prisma";
import { Badge, PageHeader } from "@/components/ui";
import DataTable from "@/components/DataTable";
import { fmtDate } from "@/lib/format";
import { daysLeft, expiryLevel, LEVEL_CLASS, LEVEL_LABEL } from "@/lib/rules";

export const dynamic = "force-dynamic";

export default async function BatchesPage() {
  const batches = await prisma.drugBatch.findMany({
    include: { drug: true, location: true },
    orderBy: { expireDate: "asc" },
    take: 200
  });

  return (
    <>
      <PageHeader
        title="药品批次"
        desc="库存以批次为单位管理（组合关系：批次依附于药品）；批号在同一药品下唯一，依据 UC-02 扩展 4a"
      />
      <div className="card">
        <DataTable
          columns={[
            { key: "drug", label: "药品", render: (r) => (r.drug as any).name },
            { key: "batchNo", label: "批号", width: "90px" },
            { key: "location", label: "库位", render: (r) => ((r.location as any)?.locationCode ?? "—") },
            { key: "expireDate", label: "有效期至", render: (r) => fmtDate(r.expireDate as Date) },
            {
              key: "days",
              label: "剩余天数",
              render: (r) => {
                const d = daysLeft(r.expireDate as Date);
                return d < 0 ? `已过期 ${-d} 天` : `${d} 天`;
              }
            },
            { key: "stockQty", label: "库存", render: (r) => `${r.stockQty} 盒` },
            {
              key: "level",
              label: "效期分级",
              render: (r) => {
                const lv = expiryLevel(daysLeft(r.expireDate as Date));
                return <Badge className={LEVEL_CLASS[lv]}>{LEVEL_LABEL[lv]}</Badge>;
              }
            },
            { key: "flowStatus", label: "流转状态" }
          ]}
          rows={batches as any}
        />
      </div>
    </>
  );
}
