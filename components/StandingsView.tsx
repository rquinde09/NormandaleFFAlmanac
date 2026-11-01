"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Segmented } from "@/components/Segmented";
import { Bar, RankChange, Stars } from "@/components/ui";
import { pct, pts, record, signed } from "@/lib/format";

export type StandingsRow = {
  slug: string;
  name: string;
  nickname: string;
  active: boolean;
  w: number;
  l: number;
  t: number;
  pf: number;
  pa: number;
  seasons: number;
  titles: number;
  rankChange: number | null;
  winPct: number;
  pfPerGame: number;
  pdiff: number;
};

// Rate stats rank only managers with this many seasons, so a short career can't top the list.
// Placeholder until the league picks a number (see CLAUDE.md).
const MIN_SEASONS = 3;

type Column = {
  key: string;
  label: string;
  value: (r: StandingsRow) => number;
  show: (r: StandingsRow) => string;
  rate?: boolean;
  tiesOnly?: boolean; // shown only once the league has a tie
};

const COLUMNS: Column[] = [
  { key: "wins", label: "W", value: (r) => r.w, show: (r) => String(r.w) },
  { key: "losses", label: "L", value: (r) => r.l, show: (r) => String(r.l) },
  { key: "ties", label: "T", value: (r) => r.t, show: (r) => String(r.t), tiesOnly: true },
  { key: "winpct", label: "Win %", value: (r) => r.winPct, show: (r) => pct(r.winPct), rate: true },
  { key: "pf", label: "PF", value: (r) => r.pf, show: (r) => pts(r.pf) },
  { key: "pfpg", label: "PF/G", value: (r) => r.pfPerGame, show: (r) => pts(r.pfPerGame), rate: true },
  { key: "pa", label: "PA", value: (r) => r.pa, show: (r) => pts(r.pa) },
  { key: "pdiff", label: "PDIFF", value: (r) => r.pdiff, show: (r) => signed(r.pdiff) },
  { key: "seasons", label: "Seasons", value: (r) => r.seasons, show: (r) => String(r.seasons) },
  { key: "titles", label: "Titles", value: (r) => r.titles, show: (r) => String(r.titles) },
];

const PHONE_SORTS = [
  { value: "wins", label: "Wins" },
  { value: "winpct", label: "Win %" },
  { value: "pf", label: "PF" },
  { value: "pdiff", label: "PDIFF" },
];

export function StandingsView({ rows }: { rows: StandingsRow[] }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const col = COLUMNS.find((c) => c.key === params.get("sort")) ?? COLUMNS[0];
  const dir = params.get("dir") === "asc" ? "asc" : "desc";
  const query = params.get("q") ?? "";
  const activeOnly = params.get("active") === "1";

  // Updating history directly keeps sorting instant; Next.js keeps useSearchParams in sync.
  // Start from the live URL, not this render's params, so quick successive changes all stick.
  function update(next: Record<string, string | null>) {
    const p = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    const s = p.toString();
    window.history.replaceState(null, "", s ? `${pathname}?${s}` : pathname);
  }
  const setSort = (key: string) =>
    update({ sort: key === "wins" ? null : key, dir: key === col.key && dir === "desc" ? "asc" : null });

  const needle = query.trim().toLowerCase();
  const shown = rows.filter(
    (r) => (!activeOnly || r.active) && (!needle || `${r.name} ${r.nickname}`.toLowerCase().includes(needle)),
  );
  const qualifies = (r: StandingsRow) => !col.rate || r.seasons >= MIN_SEASONS;
  const sorted = [...shown].sort((a, b) => {
    if (qualifies(a) !== qualifies(b)) return qualifies(a) ? -1 : 1;
    const d = col.value(a) - col.value(b);
    return (dir === "desc" ? -d : d) || b.w - a.w || b.pf - a.pf;
  });
  const ranked = sorted.filter(qualifies);
  const values = ranked.map(col.value);
  const lo = Math.min(...values, 0);
  const hi = Math.max(...values);
  const barValue = (r: StandingsRow) => (hi > lo ? (col.value(r) - lo) / (hi - lo) : 0);
  const hasTies = rows.some((r) => r.t > 0);
  const columns = COLUMNS.filter((c) => hasTies || !c.tiesOnly);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="md:hidden">
          <Segmented
            label="Sort by"
            options={PHONE_SORTS}
            value={col.key}
            onChange={(key) => update({ sort: key === "wins" ? null : key, dir: null })}
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            defaultValue={query}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="Search names"
            aria-label="Search names"
            className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
          />
          <button
            onClick={() => update({ dir: dir === "desc" ? "asc" : null })}
            aria-label={dir === "desc" ? "Sorted high to low" : "Sorted low to high"}
            className="shrink-0 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300"
          >
            {dir === "desc" ? "↓ High" : "↑ Low"}
          </button>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => update({ active: e.target.checked ? "1" : null })}
              className="accent-red-500"
            />
            Active
          </label>
        </div>
      </div>

      {sorted.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">No managers match.</p>}

      {/* Phone: cards */}
      <ol className="space-y-2 md:hidden">
        {sorted.map((r, i) => (
          <li key={r.slug}>
            {col.rate && i === ranked.length && <Unranked />}
            <Link
              href={`/teams/${r.slug}`}
              className="block rounded-2xl border border-zinc-800 bg-zinc-900 p-4 transition-colors active:border-zinc-600"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-baseline gap-3">
                  <span className="w-5 shrink-0 text-right text-sm tabular-nums text-zinc-500">
                    {qualifies(r) ? i + 1 : "–"}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-zinc-50">
                      {r.nickname} <Stars count={r.titles} />
                    </div>
                    <div className="truncate text-xs text-zinc-500">
                      {r.name}
                      {!r.active && " · retired"}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-semibold tabular-nums text-zinc-50">{col.show(r)}</div>
                  <div className="text-xs text-zinc-500">{col.label === "W" ? "Wins" : col.label}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                <Mini label="Record" value={record(r)} />
                <Mini label="Win %" value={pct(r.winPct)} />
                <Mini label="PF/G" value={pts(r.pfPerGame)} />
                <Mini label="PDIFF" value={signed(r.pdiff)} />
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Bar value={qualifies(r) ? barValue(r) : 0} />
                {col.key === "wins" && <RankChange change={r.rankChange} />}
              </div>
            </Link>
          </li>
        ))}
      </ol>

      {/* Desktop: table with the name column pinned */}
      <div className="no-scrollbar hidden overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900 md:block">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-zinc-800 text-xs text-zinc-400">
              <th className="sticky left-0 z-10 bg-zinc-900 px-3 py-2.5 text-left font-medium">Manager</th>
              {columns.map((c) => (
                <SortHeader key={c.key} c={c} active={c.key === col.key} dir={dir} onClick={setSort} />
              ))}
              <th className="px-3 py-2.5 text-right font-medium" title="Change in all-time rank since the end of last season">
                Rank Δ
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.slug} className={`border-b border-zinc-800/60 last:border-0 ${col.rate && i === ranked.length ? "border-t-2 border-t-zinc-700" : ""}`}>
                <td className="sticky left-0 z-10 bg-zinc-900 px-3 py-2.5">
                  <Link href={`/teams/${r.slug}`} className="flex items-baseline gap-3 whitespace-nowrap hover:text-white">
                    <span className="w-5 text-right text-zinc-500">{qualifies(r) ? i + 1 : "–"}</span>
                    <span className="font-medium text-zinc-100">{r.name}</span>
                    <Stars count={r.titles} />
                    {!r.active && <span className="text-xs text-zinc-500">retired</span>}
                  </Link>
                </td>
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2.5 text-right ${c.key === col.key ? "font-semibold text-zinc-50" : "text-zinc-300"}`}>
                    {c.show(r)}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right">
                  <RankChange change={r.rankChange} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {col.rate && ranked.length < sorted.length && (
        <p className="text-xs text-zinc-500">
          {col.label} ranks managers with at least {MIN_SEASONS} seasons. Shorter careers are listed after them.
        </p>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-zinc-500">{label}</div>
      <div className="truncate font-medium tabular-nums text-zinc-200">{value}</div>
    </div>
  );
}

function Unranked() {
  return (
    <div className="px-1 pt-2 pb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
      Fewer than {MIN_SEASONS} seasons
    </div>
  );
}

function SortHeader({
  c,
  active,
  dir,
  onClick,
}: {
  c: Column;
  active: boolean;
  dir: "asc" | "desc";
  onClick: (key: string) => void;
}) {
  return (
    <th className="px-3 py-2.5 text-right font-medium" aria-sort={active ? (dir === "desc" ? "descending" : "ascending") : "none"}>
      <button onClick={() => onClick(c.key)} className={`whitespace-nowrap ${active ? "text-zinc-50" : "hover:text-zinc-200"}`}>
        {c.label}
        {active ? (dir === "desc" ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );
}
