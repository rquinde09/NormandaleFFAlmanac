"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { ActiveSwitch } from "@/components/ActiveSwitch";
import { Segmented } from "@/components/Segmented";
import { ordinal } from "@/lib/format";
import { updateParams } from "@/lib/url";

export type RecordEntry = { who: string; value: string; detail: string };
export type RecordCard = { key: string; title: string; subtitle: string; holder: RecordEntry | null; rest: RecordEntry[] };
export type RecordSet = { game: RecordCard[]; season: RecordCard[] };

// `all` counts every manager; `active` only today's (the default).
export function RecordsView({ all, active }: { all: RecordSet; active: RecordSet }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const view = params.get("view") === "season" ? "season" : "game";
  const activeOnly = params.get("active") !== "0";
  const cards = (activeOnly ? active : all)[view];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Segmented
            label="Record type"
            options={[
              { value: "game", label: "Game" },
              { value: "season", label: "Season" },
            ]}
            value={view}
            onChange={(v) => updateParams(pathname, { view: v === "game" ? null : v })}
          />
        </div>
        <ActiveSwitch checked={activeOnly} onChange={(on) => updateParams(pathname, { active: on ? null : "0" })} />
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {cards.map((c) => (
          <li key={c.key} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-red-400">{c.title}</div>
            <div className="text-sm text-zinc-400">{c.subtitle}</div>
            {c.holder ? (
              <>
                <div className="mt-3 flex items-baseline justify-between gap-3">
                  <div className="min-w-0 truncate text-lg font-semibold text-zinc-50">{c.holder.who}</div>
                  <div className="shrink-0 text-lg font-semibold tabular-nums text-zinc-50">{c.holder.value}</div>
                </div>
                <div className="text-xs text-zinc-500">{c.holder.detail}</div>
              </>
            ) : (
              <div className="mt-3 text-sm text-zinc-500">No record yet.</div>
            )}
            {/* 2nd to 5th stay folded until asked for (the site owner, 2026-11-07) */}
            {c.rest.length > 0 && (
              <details className="group mt-3 border-t border-zinc-800 pt-3">
                <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-zinc-400 hover:text-zinc-200 [&::-webkit-details-marker]:hidden">
                  {c.rest.length > 1 ? `2nd–${ordinal(c.rest.length + 1)}` : "2nd"}
                  <span className="text-zinc-500 transition-transform group-open:rotate-180" aria-hidden>
                    ▾
                  </span>
                </summary>
                <ol start={2} className="mt-2 space-y-1.5 text-sm">
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
              </details>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
