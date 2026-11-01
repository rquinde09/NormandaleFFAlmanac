"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Segmented } from "@/components/Segmented";

export type RecordEntry = { who: string; value: string; detail: string };
export type RecordCard = { key: string; title: string; subtitle: string; holder: RecordEntry; rest: RecordEntry[] };

export function RecordsView({ game, season }: { game: RecordCard[]; season: RecordCard[] }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const view = params.get("view") === "season" ? "season" : "game";
  const cards = view === "season" ? season : game;

  return (
    <div className="space-y-4">
      <Segmented
        label="Record type"
        options={[
          { value: "game", label: "Game records" },
          { value: "season", label: "Season records" },
        ]}
        value={view}
        onChange={(v) => window.history.replaceState(null, "", v === "game" ? pathname : `${pathname}?view=${v}`)}
      />
      <ul className="grid gap-3 md:grid-cols-2">
        {cards.map((c) => (
          <li key={c.key} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-red-400">{c.title}</div>
            <div className="text-sm text-zinc-400">{c.subtitle}</div>
            <div className="mt-3 flex items-baseline justify-between gap-3">
              <div className="min-w-0 truncate text-lg font-semibold text-zinc-50">{c.holder.who}</div>
              <div className="shrink-0 text-lg font-semibold tabular-nums text-zinc-50">{c.holder.value}</div>
            </div>
            <div className="text-xs text-zinc-500">{c.holder.detail}</div>
            {c.rest.length > 0 && (
              <ol start={2} className="mt-3 space-y-1.5 border-t border-zinc-800 pt-3 text-sm">
                {c.rest.map((e, i) => (
                  <li key={i} className="flex items-baseline gap-3">
                    <span className="w-4 shrink-0 text-right text-xs tabular-nums text-zinc-600">{i + 2}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-zinc-300">{e.who}</div>
                      <div className="truncate text-xs text-zinc-500">{e.detail}</div>
                    </div>
                    <span className="shrink-0 tabular-nums text-zinc-300">{e.value}</span>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
