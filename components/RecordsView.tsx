"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ActiveSwitch } from "@/components/ActiveSwitch";
import { Segmented } from "@/components/Segmented";
import type { RecordCard, RecordEntry, RecordSet, RecordTab } from "@/lib/records";
import { updateParams } from "@/lib/url";

const TABS: { value: RecordTab; label: string }[] = [
  { value: "game", label: "Game" },
  { value: "season", label: "Season" },
  { value: "league", label: "League" },
];

// `all` counts every manager; `active` only today's (the default). Three tabs since Round 8 (the
// site owner, 2026-11-20), each in his sections. On a phone, small cards two to a row, like the home
// page: the name, the number, the holder and the game or season; tapping one opens a panel listing
// 2nd to 5th (Round 9 removed the Compact switch that turned them off). On wider screens each record
// is a card listing 1st to 5th.
export function RecordsView({ all, active }: { all: RecordSet; active: RecordSet }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const view = TABS.find((t) => t.value === params.get("view"))?.value ?? "game";
  const activeOnly = params.get("active") !== "0";
  const sections = (activeOnly ? active : all)[view];
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* The tabs, then the Active switch */}
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Segmented
            label="Record type"
            options={TABS}
            value={view}
            onChange={(v) => {
              setOpen(null);
              updateParams(pathname, { view: v === "game" ? null : v });
            }}
          />
        </div>
        <ActiveSwitch checked={activeOnly} onChange={(on) => updateParams(pathname, { active: on ? null : "0" })} />
      </div>

      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="mb-2 px-1 text-sm font-semibold text-zinc-400">{section.title}</h2>

          {/* Phone: two small cards to a row; tapping one opens a panel under its row with the whole
              detail and 2nd–5th */}
          <ul className="grid grid-cols-2 gap-2.5 md:hidden">
            {section.cards.map((c, i) => {
              const row = section.cards.slice(i - (i % 2), i - (i % 2) + 2);
              const picked = i % 2 === 1 || i === section.cards.length - 1 ? row.find((x) => x.key === open) : undefined;
              return [
                <SmallCard key={c.key} c={c} open={open === c.key} onToggle={() => setOpen(open === c.key ? null : c.key)} />,
                picked && <Panel key={`${picked.key}-panel`} c={picked} />,
              ];
            })}
          </ul>

          {/* Wider screens: cards with 1st to 5th */}
          <ul className="hidden grid-cols-2 gap-3 md:grid">
            {section.cards.map((c) => (
              <FullCard key={c.key} c={c} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// The site owner's mockup: the name in red capitals, the description (not on the match-up records),
// the number, the holder and a small line with the game or season
function SmallCard({ c, open, onToggle }: { c: RecordCard; open: boolean; onToggle: () => void }) {
  const h = c.holder;
  return (
    <li className={`min-w-0 rounded-2xl border bg-zinc-900 ${open ? "border-zinc-500" : "border-zinc-800"}`}>
      <button onClick={onToggle} aria-expanded={open} className="flex h-full w-full flex-col items-center px-2.5 py-3.5 text-center">
        <span className="text-[11px] leading-tight font-semibold tracking-wider text-red-400 uppercase">
          {c.title}
          <Star c={c} />
        </span>
        {c.brief && <span className="mt-0.5 text-[11px] leading-tight text-zinc-400">{c.brief}</span>}
        {h ? (
          <>
            <span className="mt-2 text-xl font-bold tabular-nums text-zinc-50">{h.value}</span>
            <span className="mt-1 max-w-full truncate text-sm font-semibold text-zinc-100">{h.who}</span>
            <span className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-zinc-500">{h.short}</span>
          </>
        ) : (
          <span className="mt-3 text-sm text-zinc-500">No record yet</span>
        )}
      </button>
    </li>
  );
}

// Under a tapped card's row: the holder's whole detail line, then 2nd to 5th
function Panel({ c }: { c: RecordCard }) {
  return (
    <li className="col-span-2 min-w-0 rounded-2xl border border-zinc-800 bg-zinc-950/60 px-3.5 py-3">
      <div className="text-[11px] font-semibold tracking-wider text-red-400 uppercase">
        {c.title}
        <Star c={c} />
      </div>
      {c.holder && (
        <div className="mt-1 flex items-baseline gap-3 text-sm">
          <span className="w-4 shrink-0 text-right text-xs tabular-nums text-zinc-600">1</span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-zinc-50">{c.holder.who}</div>
            <div className="text-xs text-zinc-500">{c.holder.detail}</div>
          </div>
          <span className="shrink-0 font-semibold tabular-nums text-zinc-50">{c.holder.value}</span>
        </div>
      )}
      {c.rest.length > 0 && <Rest rest={c.rest} className="mt-2 pt-2" />}
    </li>
  );
}

function FullCard({ c }: { c: RecordCard }) {
  return (
    <li className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
      <div className="text-xs font-medium tracking-wider text-red-400 uppercase">
        {c.title}
        <Star c={c} />
      </div>
      {c.subtitle && <div className="text-sm text-zinc-400">{c.subtitle}</div>}
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
      {c.rest.length > 0 && <Rest rest={c.rest} />}
    </li>
  );
}

// A record the notes at the bottom of the page explain (the site owner, Round 11)
function Star({ c }: { c: RecordCard }) {
  if (!c.starred) return null;
  return (
    <span className="ml-0.5 text-zinc-400" title="How it’s counted: see the notes at the bottom">
      *<span className="sr-only"> (explained at the bottom of the page)</span>
    </span>
  );
}

function Rest({ rest, className = "" }: { rest: RecordEntry[]; className?: string }) {
  return (
    <ol start={2} className={`mt-3 space-y-1.5 border-t border-zinc-800 pt-3 text-left text-sm ${className}`}>
      {rest.map((e, i) => (
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
  );
}
