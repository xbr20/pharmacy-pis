import { prisma } from "@/lib/prisma";
import { Badge, PageHeader } from "@/components/ui";
import DataTable from "@/components/DataTable";
import { fmtDate, fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PrescriptionsPage() {
  const rxs = await prisma.prescription.findMany({
    include: {
      staff: true,
      items: { include: { batch: { include: { drug: true } } } }
    },
    orderBy: { rxDate: "desc" }
  });

  return (
    <>
      <PageHeader
        title="处方登记"
        desc="UC-02 通过手机端管理处方：医师手机端直接开方，系统自动核验处方要素，处方—批次为多对多关系（经处方明细关联表拆解）"
      />

      {rxs.map((rx) => (
        <div key={rx.id} className="card mb-5">
          <div className="card-title flex flex-wrap items-center gap-3">
            <span>{rx.rxNo}</span>
            {rx.autoVerified ? (
              <Badge className="bg-brand-50 text-brand-700">已自动核验</Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-700">待核验</Badge>
            )}
            <span className="text-xs font-normal text-slate-500">
              开方医师：{rx.doctorName} · 开方日期：{fmtDate(rx.rxDate)} · 登记人：
              {rx.staff?.name ?? "（患者端提交）"} · 核验时间：{fmtDateTime(rx.verifiedAt)}
            </span>
          </div>
          <DataTable
            columns={[
              { key: "drug", label: "药品", render: (r) => ((r.batch as any).drug as any).name },
              { key: "batchNo", label: "批号", render: (r) => (r.batch as any).batchNo },
              { key: "expire", label: "有效期至", render: (r) => fmtDate((r.batch as any).expireDate) },
              { key: "dosage", label: "用法用量" }
            ]}
            rows={rx.items as any}
          />
        </div>
      ))}
    </>
  );
}
