import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import DataTable from "@/components/DataTable";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TraceRecordsPage() {
  const records = await prisma.traceRecord.findMany({
    include: { traceCode: { include: { drug: true } }, staff: true },
    orderBy: { scannedAt: "desc" },
    take: 100
  });

  return (
    <>
      <PageHeader
        title="追溯记录"
        desc="每次扫码形成一条追溯记录（扫码时间 + 扫码人），药品流向数据同步上传追溯监管平台（改进点：扫归扫、账归账 → 扫码即核销）"
      />
      <div className="card">
        <DataTable
          columns={[
            { key: "id", label: "记录编号", width: "90px" },
            { key: "code", label: "追溯码", render: (r) => (r.traceCode as any).code },
            { key: "drug", label: "药品", render: (r) => ((r.traceCode as any).drug as any).name },
            { key: "batchNo", label: "批号", render: (r) => (r.traceCode as any).batchNo },
            { key: "staff", label: "扫码人", render: (r) => (r.staff as any).name },
            { key: "scannedAt", label: "扫码时间", render: (r) => fmtDateTime(r.scannedAt as Date) }
          ]}
          rows={records as any}
        />
      </div>
    </>
  );
}
