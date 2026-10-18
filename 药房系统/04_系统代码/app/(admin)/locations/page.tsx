import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import DataTable from "@/components/DataTable";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const locs = await prisma.storageLocation.findMany({
    include: { _count: { select: { batches: true } } },
    orderBy: { locationCode: "asc" }
  });

  return (
    <>
      <PageHeader
        title="库位"
        desc="批次存放位置（库位编码为唯一键）。处方药存放于加锁专柜，冷藏药品存放于冷藏柜"
      />
      <div className="card">
        <DataTable
          columns={[
            { key: "locationCode", label: "库位编码", width: "110px" },
            { key: "shelfNo", label: "货架" },
            { key: "cabinetNo", label: "柜号" },
            { key: "storageCondition", label: "储存条件" },
            { key: "batches", label: "批次数", render: (r) => (r._count as any).batches }
          ]}
          rows={locs as any}
        />
      </div>
    </>
  );
}
