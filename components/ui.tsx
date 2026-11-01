import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-50">{children}</h1>
      {sub && <p className="mt-1 text-sm text-zinc-400">{sub}</p>}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">{children}</div>;
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "up" | "down" }) {
  const color = tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : "text-zinc-50";
  return (
    <div>
      <div className="text-xs text-zinc-400">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

export function Bar({ value, className = "bg-red-500" }: { value: number; className?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

export function Stars({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="text-amber-400" title={`${count} championship${count > 1 ? "s" : ""}`}>
      {"★".repeat(count)}
    </span>
  );
}

export function RankChange({ change }: { change: number | null }) {
  if (change === null) return <span className="text-xs text-zinc-500">new</span>;
  if (change === 0) return <span className="text-xs text-zinc-600">–</span>;
  return (
    <span className={`text-xs font-medium tabular-nums ${change > 0 ? "text-emerald-400" : "text-red-400"}`}>
      {change > 0 ? "▲" : "▼"}
      {Math.abs(change)}
    </span>
  );
}
