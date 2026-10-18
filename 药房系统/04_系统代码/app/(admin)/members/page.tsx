import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import DataTable from "@/components/DataTable";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const [members, levels] = await Promise.all([
    prisma.member.findMany({
      include: { level: true, _count: { select: { sales: true } } },
      orderBy: { cardNo: "asc" }
    }),
    prisma.memberLevel.findMany({ orderBy: { id: "asc" } })
  ]);

  return (
    <>
      <PageHeader
        title="会员"
        desc="会员卡号唯一；会员等级决定折扣率与积分倍率。健康档案备注仅作用药提醒，不含诊断结论"
      />

      <div className="card mb-5">
        <div className="card-title">会员等级</div>
        <DataTable
          columns={[
            { key: "levelName", label: "等级名称" },
            { key: "discountRate", label: "折扣率", render: (r) => `${(Number(r.discountRate) * 100).toFixed(0)}%` },
            { key: "pointRate", label: "积分倍率", render: (r) => `×${Number(r.pointRate).toFixed(1)}` }
          ]}
          rows={levels as any}
        />
      </div>

      <div className="card">
        <div className="card-title">会员名单</div>
        <DataTable
          columns={[
            { key: "cardNo", label: "会员卡号", width: "130px" },
            { key: "name", label: "姓名" },
            { key: "level", label: "等级", render: (r) => (r.level as any).levelName },
            { key: "phone", label: "手机" },
            { key: "birthDate", label: "出生日期", render: (r) => fmtDate(r.birthDate as Date) },
            { key: "totalPoints", label: "累计积分" },
            { key: "sales", label: "消费次数", render: (r) => (r._count as any).sales },
            { key: "healthNote", label: "健康档案备注", render: (r) => ((r.healthNote as string) ?? "—") }
          ]}
          rows={members as any}
        />
      </div>
    </>
  );
}
