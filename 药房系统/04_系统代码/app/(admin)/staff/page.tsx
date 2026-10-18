import { prisma } from "@/lib/prisma";
import { Badge, PageHeader } from "@/components/ui";
import DataTable from "@/components/DataTable";
import { daysLeft } from "@/lib/rules";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const [staffs, shifts] = await Promise.all([
    prisma.staff.findMany({
      include: { _count: { select: { disposals: true, sales: true } } },
      orderBy: { employeeNo: "asc" }
    }),
    prisma.shift.findMany({ include: { staff: true }, orderBy: [{ workDate: "asc" }] })
  ]);

  return (
    <>
      <PageHeader
        title="店员与排班"
        desc="店员兼任基础药师角色；执业药师证有效期到期前需提醒（证过期则不得承担处方人工复核）。排班为角色类，按 日期+班次 记录"
      />

      <div className="card mb-5">
        <div className="card-title">店员名单</div>
        <DataTable
          columns={[
            { key: "employeeNo", label: "员工编号", width: "100px" },
            { key: "name", label: "姓名" },
            {
              key: "post",
              label: "岗位",
              render: (r) =>
                r.post === "店长" ? (
                  <Badge className="bg-brand-50 text-brand-700">店长</Badge>
                ) : (
                  <Badge>店员</Badge>
                )
            },
            { key: "pharmacistNo", label: "执业药师证号", render: (r) => ((r.pharmacistNo as string) ?? "—") },
            {
              key: "cert",
              label: "证有效期",
              render: (r) => {
                if (!r.pharmacistExpire) return "—";
                const d = daysLeft(r.pharmacistExpire as Date);
                return d < 0 ? (
                  <Badge className="bg-red-100 text-red-700">已过期</Badge>
                ) : d <= 90 ? (
                  <Badge className="bg-amber-100 text-amber-700">
                    {fmtDate(r.pharmacistExpire as Date)}（{d} 天后到期）
                  </Badge>
                ) : (
                  fmtDate(r.pharmacistExpire as Date)
                );
              }
            },
            { key: "hiredDate", label: "入职日期", render: (r) => fmtDate(r.hiredDate as Date) },
            {
              key: "counts",
              label: "业务量",
              render: (r) =>
                `处置 ${(r._count as any).disposals} · 收银 ${(r._count as any).sales}`
            }
          ]}
          rows={staffs as any}
        />
      </div>

      <div className="card">
        <div className="card-title">排班表（未来 3 天）</div>
        <DataTable
          columns={[
            { key: "workDate", label: "日期", render: (r) => fmtDate(r.workDate as Date) },
            { key: "shiftNo", label: "班次" },
            { key: "timeRange", label: "时段" },
            { key: "staff", label: "店员", render: (r) => `${(r.staff as any).name}（${(r.staff as any).post}）` }
          ]}
          rows={shifts as any}
        />
      </div>
    </>
  );
}
