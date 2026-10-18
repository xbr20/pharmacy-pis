import { prisma } from "@/lib/prisma";
import { Badge, PageHeader } from "@/components/ui";
import DataTable from "@/components/DataTable";
import { fmtMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DrugsPage() {
  const drugs = await prisma.drug.findMany({
    include: { _count: { select: { batches: true } } },
    orderBy: { drugCode: "asc" }
  });

  return (
    <>
      <PageHeader
        title="药品档案"
        desc="商品主数据。药品编码为唯一键，主键为系统自增 id（PPT P402：领域字段与主键分开）"
      />
      <div className="card">
        <DataTable
          columns={[
            { key: "drugCode", label: "药品编码", width: "110px" },
            { key: "name", label: "品名" },
            { key: "spec", label: "规格" },
            { key: "manufacturer", label: "生产企业" },
            {
              key: "retailPrice",
              label: "零售价",
              align: "right",
              render: (r) => fmtMoney(r.retailPrice as any)
            },
            {
              key: "isPrescription",
              label: "处方药",
              render: (r) =>
                r.isPrescription ? (
                  <Badge className="bg-red-100 text-red-700">处方药</Badge>
                ) : (
                  <Badge>非处方药</Badge>
                )
            },
            {
              key: "inMedicalInsurance",
              label: "医保目录",
              render: (r) => (r.inMedicalInsurance ? "是" : "否")
            },
            {
              key: "batches",
              label: "批次数",
              render: (r) => (r._count as any).batches
            }
          ]}
          rows={drugs as any}
        />
      </div>
    </>
  );
}
