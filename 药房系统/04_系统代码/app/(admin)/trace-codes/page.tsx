import { prisma } from "@/lib/prisma";
import { Badge, PageHeader } from "@/components/ui";
import DataTable from "@/components/DataTable";

export const dynamic = "force-dynamic";

export default async function TraceCodesPage() {
  const codes = await prisma.traceCode.findMany({
    include: { drug: true, _count: { select: { records: true } } },
    orderBy: { code: "asc" },
    take: 100
  });

  return (
    <>
      <PageHeader
        title="追溯码档案"
        desc="一物一码：追溯码为唯一键，扫码时带出批号、效期与生产企业并核销库存（UC-01 扫码追溯药品）"
      />
      <div className="card">
        <DataTable
          columns={[
            { key: "code", label: "追溯码", width: "180px" },
            { key: "drug", label: "药品", render: (r) => (r.drug as any).name },
            { key: "batchNo", label: "批号" },
            { key: "manufacturer", label: "生产企业" },
            {
              key: "verified",
              label: "核销状态",
              render: (r) =>
                r.verified ? (
                  <Badge className="bg-brand-50 text-brand-700">已核销</Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700">未核销</Badge>
                )
            },
            { key: "records", label: "扫码次数", render: (r) => (r._count as any).records }
          ]}
          rows={codes as any}
        />
      </div>
    </>
  );
}
