"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
    >
      退出登录
    </button>
  );
}
