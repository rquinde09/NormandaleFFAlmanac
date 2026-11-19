"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { ActiveSwitch, CheckSwitch } from "@/components/ActiveSwitch";
import { Segmented } from "@/components/Segmented";
import { updateParams } from "@/lib/url";

export type RecordEntry = { who: string; value: string; detail: string };
export type RecordCard = { key: string; title: string; subtitle: string; holder: RecordEntry | null; rest: RecordEntry[] };
export type RecordSet = { game: RecordCard[]; season: RecordCard[] };

// `all` counts every manager; `active` only today's (the default). On a phone, Compact (on unless
// `compact=0`, like the standings; the site owner's Round 5) shows one line per record: its name
// and description with the holder's number beside them, and a tap shows who holds it. Without
// Compact, and on wider screens, each record lists 1st to 5th.
export function RecordsView({ all, active }: { all: RecordSet; active: RecordSet }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const view = params.get("view") === "season" ? "season" : "game";
  const activeOnly = params.get("active") !== "0";
  const compact = params.get("compact") !== "0";
  const cards = (activeOnly ? active : all)[view];

  return (
    <div className="space-y-4">
      {/* One row from md up; on a phone the switches go under the tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full md:w-auto md:min-w-0 md:flex-1">
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
        <div className="flex-1 md:hidden" />
        <CheckSwitch label="Compact" checked={compact} onChange={(on) => updateParams(pathname, { compact: on ? null : "0" })} className="md:hidden" />
        <ActiveSwitch checked={activeOnly} onChange={(on) => updateParams(pathname, { active: on ? null : "0" })} />
      </div>

      {/* Phone, compact: one line per record; tapping it shows the holder */}
      {compact && (
        <ul className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 md:hidden">
          {cards.map((c) => (
            <li key={c.key} className="border-zinc-800 not-first:border-t">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 active:bg-zinc-800 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium tracking-wider text-red-400 uppercase">{c.title}</div>
                    <div className="text-sm text-zinc-300">{c.subtitle}</div>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums text-zinc-50">{c.holder?.value ?? "–"}</span>
                  <span className="shrink-0 text-xs text-zinc-500 transition-transform group-open:rotate-180" aria-hidden>
                    ▾
                  </span>
                </summary>
                <div className="px-4 pb-3">
                  {c.holder ? (
                    <>
                      <div className="font-semibold text-zinc-50">{c.holder.who}</div>
                      <div className="text-xs text-zinc-500">{c.holder.detail}</div>
                    </>
                  ) : (
                    <div className="text-sm text-zinc-500">No record yet.</div>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      {/* Cards with 1st to 5th: on a phone with Compact off, and on wider screens */}
      {/* grid-cols-1 (minmax(0, 1fr)) keeps a long detail line from widening the page on a phone */}
      <ul className={`grid grid-cols-1 gap-3 md:grid-cols-2 ${compact ? "hidden md:grid" : ""}`}>
        {cards.map((c) => (
          <li key={c.key} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
            <div className="text-xs font-medium tracking-wider text-red-400 uppercase">{c.title}</div>
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
