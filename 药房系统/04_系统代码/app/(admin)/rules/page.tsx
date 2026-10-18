import { prisma } from "@/lib/prisma";
import { Badge, PageHeader } from "@/components/ui";
import DataTable from "@/components/DataTable";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const rules = await prisma.disposalRule.findMany({
    include: { drug: true },
    orderBy: [{ category: "asc" }, { expiryDays: "asc" }]
  });

  return (
    <>
      <PageHeader
        title="处置规则"
        desc="封装老店长的效期判定逻辑（PPT 改进模式三：封装领域逻辑，获得核心竞争力）。系统据此自动给出建议动作"
      />
      <div className="card">
        <DataTable
          columns={[
            { key: "ruleCode", label: "规则编号", width: "100px" },
            { key: "category", label: "适用分类" },
            { key: "drug", label: "指定药品", render: (r) => ((r.drug as any)?.name ?? "（按分类通用）") },
            { key: "expiryDays", label: "效期阈值", render: (r) => `剩余 ≤ ${r.expiryDays} 天` },
            {
              key: "suggestedAction",
              label: "建议动作",
              render: (r) => (
                <Badge
                  className={
                    r.suggestedAction === "报损"
                      ? "bg-red-100 text-red-700"
                      : r.suggestedAction === "下架隔离"
                      ? "bg-orange-100 text-orange-700"
                      : r.suggestedAction === "促销"
                      ? "bg-brand-50 text-brand-700"
                      : "bg-slate-100 text-slate-600"
                  }
                >
                  {r.suggestedAction as string}
                </Badge>
              )
            },
            { key: "needApproval", label: "需审批", render: (r) => (r.needApproval ? "是" : "否") }
          ]}
          rows={rules as any}
        />
      </div>
    </>
  );
}
