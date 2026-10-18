import { prisma } from "@/lib/prisma";
import { Badge, PageHeader } from "@/components/ui";
import DataTable from "@/components/DataTable";
import DisposalForm from "@/components/DisposalForm";
import { fmtDateTime } from "@/lib/format";
import { daysLeft } from "@/lib/rules";

export const dynamic = "force-dynamic";

export default async function DisposalsPage() {
  const [batches, staffs, records] = await Promise.all([
    prisma.drugBatch.findMany({
      include: { drug: true },
      orderBy: { expireDate: "asc" }
    }),
    prisma.staff.findMany({ orderBy: { employeeNo: "asc" } }),
    prisma.expiryDisposal.findMany({
      include: { batch: { include: { drug: true } }, staff: true },
      orderBy: { disposedAt: "desc" },
      take: 60
    })
  ]);

  const options = batches
    .map((b) => ({
      id: b.id,
      label: `${b.drug.name}（批号 ${b.batchNo}，余 ${
        daysLeft(b.expireDate) < 0 ? "已过期" : daysLeft(b.expireDate) + " 天"
      }）`,
      isPrescription: b.drug.isPrescription,
      days: daysLeft(b.expireDate)
    }))
    .filter((b) => b.days <= 90);

  return (
    <>
      <PageHeader
        title="近效期处置"
        desc="UC-04 记录近效期处置：按效期阈值给出建议动作并登记处置结果（对应 1.4“电话问总部 → 系统按规则直接给建议动作”）"
      />

      <div className="card mb-5">
        <div className="card-title">登记处置</div>
        <DisposalForm
          batches={options}
          staffs={staffs.map((s) => ({ id: s.id, name: s.name, post: s.post }))}
        />
      </div>

      <div className="card">
        <div className="card-title">处置记录</div>
        <DataTable
          columns={[
            { key: "drug", label: "药品", render: (r) => ((r.batch as any).drug as any).name },
            { key: "batchNo", label: "批号", render: (r) => (r.batch as any).batchNo },
            {
              key: "action",
              label: "处置动作",
              render: (r) => (
                <Badge
                  className={
                    r.action === "报损"
                      ? "bg-red-100 text-red-700"
                      : r.action === "下架隔离"
                      ? "bg-orange-100 text-orange-700"
                      : "bg-slate-100 text-slate-600"
                  }
                >
                  {r.action as string}
                </Badge>
              )
            },
            { key: "staff", label: "处置人", render: (r) => (r.staff as any).name },
            { key: "disposedAt", label: "处置时间", render: (r) => fmtDateTime(r.disposedAt as Date) },
            { key: "applyNo", label: "申请单号", render: (r) => ((r.applyNo as string) ?? "—") },
            { key: "deviationNote", label: "偏离理由", render: (r) => ((r.deviationNote as string) ?? "—") }
          ]}
          rows={records as any}
        />
      </div>

    </>
  );
}
