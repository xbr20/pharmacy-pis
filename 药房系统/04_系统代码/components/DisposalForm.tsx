"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ALL_ACTIONS, daysLeft } from "@/lib/rules";

type BatchOption = {
  id: number;
  label: string;
  isPrescription: boolean;
  days: number;
};

type StaffOption = { id: number; name: string; post: string };

export default function DisposalForm({
  batches,
  staffs
}: {
  batches: BatchOption[];
  staffs: StaffOption[];
}) {
  const router = useRouter();
  const [batchId, setBatchId] = useState<string>(batches[0] ? String(batches[0].id) : "");
  const [staffId, setStaffId] = useState<string>(staffs[0] ? String(staffs[0].id) : "");
  const [action, setAction] = useState<string>("下架隔离");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const current = batches.find((b) => String(b.id) === batchId);
  const days = current ? current.days : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const res = await fetch("/api/disposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId: Number(batchId), staffId: Number(staffId), action, deviationNote: note })
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    setMsg({ ok: Boolean(data.ok), text: data.message ?? (res.ok ? "登记成功" : "登记失败") });
    if (data.ok) {
      setNote("");
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 p-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm text-slate-600">近效期批次</label>
          <select
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
          >
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
          {days !== null ? (
            <p className="mt-1 text-xs text-slate-500">
              剩余 {days < 0 ? `已过期 ${-days}` : days} 天
              {current?.isPrescription ? " · 处方药" : " · 非处方药"}
            </p>
          ) : null}
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">处置人</label>
          <select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
          >
            {staffs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}（{s.post}）
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">处置动作</label>
          <div className="flex flex-wrap gap-2 pt-1">
            {ALL_ACTIONS.map((a) => (
              <label
                key={a}
                className={
                  "cursor-pointer rounded border px-2 py-1 text-xs " +
                  (action === a
                    ? "border-brand-500 bg-brand-50 font-semibold text-brand-700"
                    : "border-slate-300 text-slate-600")
                }
              >
                <input
                  type="radio"
                  name="action"
                  value={a}
                  checked={action === a}
                  onChange={() => setAction(a)}
                  className="mr-1 hidden"
                />
                {a}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-600">
          偏离理由（偏离系统建议动作时必填）
        </label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例如：供应商退货约期已过，改为下架隔离"
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading || !batchId}
          className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "提交中…" : "登记处置"}
        </button>
        {msg ? (
          <span className={"text-sm " + (msg.ok ? "text-brand-600" : "text-red-600")}>
            {msg.text}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-slate-400">
        规则校验：≤7 天只能“下架隔离／报损”；处方药 ≤30 天不得促销；已过效期只能报损。
      </p>
    </form>
  );
}
