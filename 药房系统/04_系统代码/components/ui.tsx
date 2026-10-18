import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  hint
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-800">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-400">{hint}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  className = "bg-slate-100 text-slate-600"
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs ${className}`}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  desc
}: {
  title: string;
  desc?: string;
}) {
  return (
    <div className="mb-4">
      <h1 className="text-xl font-bold text-slate-800">{title}</h1>
      {desc ? <p className="mt-1 text-sm text-slate-500">{desc}</p> : null}
    </div>
  );
}
