"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: { group: string; items: { href: string; label: string }[] }[] = [
  {
    group: "总览",
    items: [{ href: "/dashboard", label: "仪表盘" }]
  },
  {
    group: "商品与库存",
    items: [
      { href: "/drugs", label: "药品档案" },
      { href: "/batches", label: "药品批次" },
      { href: "/locations", label: "库位" },
      { href: "/stocktakes", label: "库存盘点" }
    ]
  },
  {
    group: "效期管控",
    items: [
      { href: "/expiry", label: "近效期预警" },
      { href: "/disposals", label: "近效期处置" },
      { href: "/rules", label: "处置规则" }
    ]
  },
  {
    group: "追溯与处方",
    items: [
      { href: "/trace-codes", label: "追溯码档案" },
      { href: "/trace-records", label: "追溯记录" },
      { href: "/prescriptions", label: "处方登记" }
    ]
  },
  {
    group: "销售与会员",
    items: [
      { href: "/sales", label: "销售单" },
      { href: "/members", label: "会员" },
      { href: "/member-purchases", label: "会员购药记录" }
    ]
  },
  {
    group: "人员",
    items: [{ href: "/staff", label: "店员与排班" }]
  }
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="text-base font-bold text-brand-600">药房信息系统</div>
        <div className="mt-0.5 text-xs text-slate-400">Pharmacy Information System</div>
      </div>
      <nav className="px-2 py-3">
        {NAV.map((g) => (
          <div key={g.group} className="mb-3">
            <div className="px-2 pb-1 text-xs font-semibold text-slate-400">
              {g.group}
            </div>
            <ul>
              {g.items.map((it) => {
                const active =
                  pathname === it.href || pathname.startsWith(it.href + "/");
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className={
                        "block rounded px-2 py-1.5 text-sm " +
                        (active
                          ? "bg-brand-50 font-semibold text-brand-700"
                          : "text-slate-600 hover:bg-slate-100")
                      }
                    >
                      {it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
