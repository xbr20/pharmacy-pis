import { prisma } from "@/lib/prisma";
import { Badge, PageHeader } from "@/components/ui";
import DataTable from "@/components/DataTable";
import { fmtDateTime, fmtMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MemberPurchasesPage() {
  const orders = await prisma.saleOrder.findMany({
    where: { memberId: { not: null } },
    include: {
      member: { include: { level: true } },
      staff: true,
      items: { include: { batch: { include: { drug: true } } } }
    },
    orderBy: { soldAt: "desc" }
  });

  // 明细行：一条销售明细 = 一行
  const rows = orders.flatMap((s) =>
    s.items.map((it) => ({
      cardNo: s.member!.cardNo,
      memberName: s.member!.name,
      levelName: (s.member!.level as any).levelName,
      orderNo: s.orderNo,
      soldAt: s.soldAt,
      drugName: (it.batch as any).drug.name,
      spec: (it.batch as any).drug.spec,
      manufacturer: (it.batch as any).drug.manufacturer,
      batchNo: (it.batch as any).batchNo,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      amount: it.amount,
      isMemberPrice: s.isMemberPrice,
      pointsEarned: s.pointsEarned,
      payMethod: s.payMethod,
      staffName: s.staff.name
    }))
  );

  // 按会员汇总
  const byMember = new Map<
    number,
    {
      cardNo: string;
      memberName: string;
      levelName: string;
      orders: number;
      kinds: Set<string>;
      qty: number;
      amount: number;
      points: number;
    }
  >();
  for (const s of orders) {
    const key = s.member!.id;
    const found = byMember.get(key);
    const m =
      found ??
      {
        cardNo: s.member!.cardNo ?? "",
        memberName: s.member!.name ?? "",
        levelName: ((s.member!.level as any)?.levelName as string) ?? "",
        orders: 0,
        kinds: new Set<string>(),
        qty: 0,
        amount: 0,
        points: 0
      };
    if (!found) byMember.set(key, m);
    m.orders += 1;
    m.points += s.pointsEarned;
    for (const it of s.items) {
      m.kinds.add((it.batch as any).drug.name);
      m.qty += it.quantity;
      m.amount += Number(it.amount);
    }
  }
  const summary = [...byMember.values()]
    .map((m) => ({
      cardNo: m.cardNo,
      memberName: m.memberName,
      levelName: m.levelName,
      orders: m.orders,
      kinds: m.kinds.size,
      qty: m.qty,
      amount: m.amount,
      points: m.points
    }))
    .sort((a, b) => b.amount - a.amount);

  const totalAmount = summary.reduce((s, m) => s + m.amount, 0);

  return (
    <>
      <PageHeader
        title="会员购药记录"
        desc="会员每一次购药都可追溯：销售单落到会员，明细落到具体批次（追溯需要）。非会员（匿名）购买不计入此处，见「销售单」"
      />

      <div className="card mb-5">
        <div className="card-title">
          按会员汇总（{summary.length} 位会员，合计 {fmtMoney(totalAmount)}）
        </div>
        <DataTable
          columns={[
            { key: "cardNo", label: "会员卡号", width: "130px" },
            { key: "memberName", label: "姓名" },
            { key: "levelName", label: "等级" },
            { key: "orders", label: "购药次数", align: "right" },
            { key: "kinds", label: "药品品种数", align: "right" },
            { key: "qty", label: "购买盒数", align: "right" },
            {
              key: "amount",
              label: "消费金额",
              align: "right",
              render: (r) => fmtMoney(r.amount as any)
            },
            { key: "points", label: "累计获得积分", align: "right" }
          ]}
          rows={summary as any}
        />
      </div>

      <div className="card">
        <div className="card-title">购药明细（{rows.length} 条）</div>
        <DataTable
          columns={[
            { key: "cardNo", label: "会员卡号", width: "120px" },
            { key: "memberName", label: "姓名", width: "80px" },
            { key: "levelName", label: "等级", width: "70px" },
            { key: "orderNo", label: "销售单号", width: "130px" },
            {
              key: "soldAt",
              label: "购买时间",
              width: "150px",
              render: (r) => fmtDateTime(r.soldAt as Date)
            },
            { key: "drugName", label: "药品" },
            { key: "spec", label: "规格", width: "120px" },
            { key: "manufacturer", label: "生产企业", width: "130px" },
            { key: "batchNo", label: "批号", width: "100px" },
            { key: "quantity", label: "数量", align: "right", width: "70px" },
            {
              key: "unitPrice",
              label: "单价",
              align: "right",
              width: "90px",
              render: (r) => fmtMoney(r.unitPrice as any)
            },
            {
              key: "amount",
              label: "金额",
              align: "right",
              width: "90px",
              render: (r) => fmtMoney(r.amount as any)
            },
            {
              key: "isMemberPrice",
              label: "会员价",
              width: "80px",
              render: (r) =>
                r.isMemberPrice ? (
                  <Badge className="bg-brand-50 text-brand-700">会员价</Badge>
                ) : (
                  <Badge>非会员价</Badge>
                )
            },
            { key: "pointsEarned", label: "本次积分", align: "right", width: "80px" },
            { key: "payMethod", label: "支付方式", width: "90px" },
            { key: "staffName", label: "收银员", width: "80px" }
          ]}
          rows={rows as any}
        />
      </div>
    </>
  );
}
