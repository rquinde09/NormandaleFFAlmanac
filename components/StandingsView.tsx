"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ActiveSwitch } from "@/components/ActiveSwitch";
import { Segmented } from "@/components/Segmented";
import { Bar, RankChange, Stars } from "@/components/ui";
import type { StandingsRow } from "@/lib/league";
import { MIN_SEASONS, VIEWS, qualifies, rankOrder, type Career, type Stat } from "@/lib/standings";
import { updateParams } from "@/lib/url";

export type StandingsMeta = {
  first: number;
  latest: number;
  latestComplete: boolean;
  throughWeek: number;
  weeks: number; // in the latest season, playoffs included
};

type Entry = { row: StandingsRow; now: Career; prev: Career | null };

export function StandingsView({ rows, meta }: { rows: StandingsRow[]; meta: StandingsMeta }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const view = VIEWS.find((v) => v.key === params.get("view")) ?? VIEWS[0];
  const hasTies = rows.some((r) => r.now.t > 0);
  const stats = view.stats.filter((s) => hasTies || !s.tiesOnly);
  const col = stats.find((s) => s.key === params.get("sort")) ?? stats.find((s) => s.key === view.rankStat)!;
  const dir = params.get("dir") === "asc" ? "asc" : "desc";
  const query = params.get("q") ?? "";
  const activeOnly = params.get("active") !== "0"; // on unless switched off

  const update = (next: Record<string, string | null>) => updateParams(pathname, next);
  const setSort = (key: string) =>
    update({ sort: key === view.rankStat ? null : key, dir: key === col.key && dir === "desc" ? "asc" : null });

  // Everyone this view covers. Positions and Rank Δ are counted within it, so the Active switch
  // renumbers them and searching doesn't.
  const pool: Entry[] = rows.filter((r) => !activeOnly || r.active).map((row) => ({ row, now: row.now, prev: row.prev }));

  const ok = (e: Entry) => qualifies(view, e.now);
  const sorted = [...pool].sort((a, b) => {
    if (ok(a) !== ok(b)) return ok(a) ? -1 : 1;
    const d = col.value(a.now) - col.value(b.now);
    return (dir === "desc" ? -d : d) || view.rank(a.now, b.now);
  });
  const position = new Map(sorted.map((e, i) => [e.row.slug, i + 1]));
  const nowOrder = rankOrder(view, pool.map((e) => [e.row.slug, e.now]));
  const prevOrder = rankOrder(view, pool.map((e) => [e.row.slug, e.prev]));
  const rankChange = (slug: string) => {
    const before = prevOrder.indexOf(slug);
    const now = nowOrder.indexOf(slug);
    return before === -1 || now === -1 ? null : before - now;
  };

  const values = sorted.filter(ok).map((e) => col.value(e.now));
  const lo = Math.min(...values, 0);
  const hi = Math.max(...values);
  const barValue = (e: Entry) => (ok(e) && hi > lo ? (col.value(e.now) - lo) / (hi - lo) : 0);

  const needle = query.trim().toLowerCase();
  const shown = sorted.filter((e) => !needle || `${e.row.name} ${e.row.nickname}`.toLowerCase().includes(needle));
  const firstUnranked = view.rate ? shown.findIndex((e) => !ok(e)) : -1;

  const live = meta.latestComplete ? "" : ` ${meta.latest} through week ${meta.throughWeek}.`;
  const partial = meta.latestComplete
    ? ""
    : ` ${meta.latest} counts as ${meta.throughWeek}/${meta.weeks} of a season so far.`;
  const since = meta.latest - 1;
  const describe = {
    all: `Totals over every game since ${meta.first}: regular season, playoffs and consolation.${live}`,
    season: `Averages per season since ${meta.first}.${partial}`,
    game: `Averages per game over every game since ${meta.first}.${live}`,
  }[view.key];

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Segmented
          label="Standings"
          options={VIEWS.map((v) => ({ value: v.key, label: v.label }))}
          value={view.key}
          onChange={(key) => update({ view: key === "all" ? null : key, sort: null, dir: null })}
        />
        <p className="text-sm text-zinc-400">
          {describe} Rank Δ is the change since the end of {since}.
        </p>
        <div className="md:hidden">
          <Segmented
            label="Sort by"
            options={view.phoneSorts}
            value={col.key}
            onChange={(key) => update({ sort: key === view.rankStat ? null : key, dir: null })}
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
          <ActiveSwitch checked={activeOnly} onChange={(on) => update({ active: on ? null : "0" })} />
        </div>
      </div>

      {shown.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">No managers match.</p>}

      {/* Phone: cards */}
      <ol className="space-y-2 md:hidden">
        {shown.map((e, i) => (
          <li key={e.row.slug}>
            {i === firstUnranked && <Unranked />}
            <Link
              href={`/teams/${e.row.slug}`}
              className="block rounded-2xl border border-zinc-800 bg-zinc-900 p-4 transition-colors active:border-zinc-600"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-baseline gap-3">
                  <span className="w-5 shrink-0 text-right text-sm tabular-nums text-zinc-500">
                    {ok(e) ? position.get(e.row.slug) : "–"}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-zinc-50">
                      {e.row.nickname} <Stars count={e.row.now.titles} />
                    </div>
                    <div className="truncate text-xs text-zinc-500">
                      {e.row.name}
                      {!e.row.active && " · retired"} · {e.now.seasons} season{e.now.seasons === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-semibold tabular-nums text-zinc-50">{col.show(e.now)}</div>
                  <div className="text-xs text-zinc-500">{col.name}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                {view.phoneMinis.filter((m) => m.key !== col.key).slice(0, 4).map((m) => (
                  <Mini key={m.label} label={m.label} value={m.show(e.now)} />
                ))}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Bar value={barValue(e)} />
                {col.key === view.rankStat && ok(e) && <RankChange change={rankChange(e.row.slug)} />}
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
              {stats.map((s) => (
                <SortHeader key={s.key} s={s} active={s.key === col.key} dir={dir} onClick={setSort} />
              ))}
              <th className="px-3 py-2.5 text-right font-medium" title={`Change in rank since the end of ${since}`}>
                Rank Δ
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((e, i) => (
              <tr
                key={e.row.slug}
                className={`border-b border-zinc-800/60 last:border-0 ${i === firstUnranked ? "border-t-2 border-t-zinc-700" : ""}`}
              >
                <td className="sticky left-0 z-10 bg-zinc-900 px-3 py-2.5">
                  <Link href={`/teams/${e.row.slug}`} className="flex items-baseline gap-3 whitespace-nowrap hover:text-white">
                    <span className="w-5 text-right text-zinc-500">{ok(e) ? position.get(e.row.slug) : "–"}</span>
                    <span className="font-medium text-zinc-100">{e.row.name}</span>
                    <Stars count={e.row.now.titles} />
                    {!e.row.active && <span className="text-xs text-zinc-500">retired</span>}
                  </Link>
                </td>
                {stats.map((s) => (
                  <td key={s.key} className={`px-3 py-2.5 text-right ${s.key === col.key ? "font-semibold text-zinc-50" : "text-zinc-300"}`}>
                    {s.show(e.now)}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right">{ok(e) && <RankChange change={rankChange(e.row.slug)} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {firstUnranked !== -1 && (
        <p className="text-xs text-zinc-500">
          {view.label} ranks managers with at least {MIN_SEASONS} seasons. Shorter careers are listed after them.
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
  s,
  active,
  dir,
  onClick,
}: {
  s: Stat;
  active: boolean;
  dir: "asc" | "desc";
  onClick: (key: string) => void;
}) {
  return (
    <th className="px-3 py-2.5 text-right font-medium" aria-sort={active ? (dir === "desc" ? "descending" : "ascending") : "none"}>
      <button onClick={() => onClick(s.key)} title={s.name} className={`whitespace-nowrap ${active ? "text-zinc-50" : "hover:text-zinc-200"}`}>
        {s.label}
        {active ? (dir === "desc" ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );
}
