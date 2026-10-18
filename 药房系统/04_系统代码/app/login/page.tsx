"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok || !data.ok) {
      setError(data.message ?? "登录失败，请重试");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-800">药房信息系统</h1>
          <p className="mt-1 text-sm text-slate-500">Pharmacy Information System · 管理后台</p>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm text-slate-600">账号</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              placeholder="请输入账号"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">口令</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              placeholder="请输入口令"
              autoComplete="current-password"
            />
          </div>
          {error ? (
            <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "登录中…" : "登 录"}
          </button>
          <p className="text-center text-xs text-slate-400">
            演示账号：admin ／ 口令：admin123（模拟数据，不含真实患者信息）
          </p>
        </form>
      </div>
    </main>
  );
}
