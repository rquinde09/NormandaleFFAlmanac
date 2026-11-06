"use client";

import { useState } from "react";
import { Segmented } from "@/components/Segmented";
import { Card, SectionLabel } from "@/components/ui";
import { ordinal, pts, record } from "@/lib/format";

type Record3 = { w: number; l: number; t: number };

export type SeasonRow = {
  season: number;
  teamName: string;
  finalRank: number | null;
  live: boolean;
  teams: number;
  seed: number;
  regular: Record3;
  all: Record3 & { pf: number; pa: number; games: number };
  trades: number;
  longestWinStreak: number;
};

type Mode = "wins" | "pf" | "pa";

const MODES: { value: Mode; label: string }[] = [
  { value: "wins", label: "Wins" },
  { value: "pf", label: "PF" },
  { value: "pa", label: "PA" },
];

const MEDALS: Record<number, string> = { 1: "#fbbf24", 2: "#d4d4d8", 3: "#cd7f32" };
const FINISH = "#ef4444"; // red-500, the site's accent
const STAT = "#38bdf8"; // sky-400

// The year-by-year chart and the season card below it share one selected season: tapping a year
// on the chart picks that season. Seasons come newest first; the newest is selected to start.
export function ManagerSeasons({ seasons }: { seasons: SeasonRow[] }) {
  const [selected, setSelected] = useState(seasons[0].season);
  const [mode, setMode] = useState<Mode>("wins");
  const current = seasons.find((s) => s.season === selected) ?? seasons[0];

  return (
    <>
      <section>
        <SectionLabel>Year by year</SectionLabel>
        <Card>
          <Segmented label="Chart" options={MODES} value={mode} onChange={setMode} />
          <Chart seasons={seasons} mode={mode} selected={current.season} onSelect={setSelected} />
          <Legend mode={mode} />
        </Card>
      </section>

      <section>
        <SectionLabel>Season by season</SectionLabel>
        <div className="space-y-2">
          {seasons.length > 1 && (
            <div role="radiogroup" aria-label="Season" className="grid grid-cols-5 gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1 md:grid-cols-10">
              {seasons.map((s) => (
                <button
                  key={s.season}
                  role="radio"
                  aria-checked={s.season === current.season}
                  onClick={() => setSelected(s.season)}
                  className={`rounded-lg px-2 py-1.5 text-sm font-medium tabular-nums transition-colors ${
                    s.season === current.season ? "bg-zinc-700 text-zinc-50" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {s.season}
                </button>
              ))}
            </div>
          )}
          <SeasonCard s={current} />
        </div>
      </section>
    </>
  );
}

const statOf = (s: SeasonRow, mode: Mode) => (mode === "wins" ? s.all.w : mode === "pf" ? s.all.pf : s.all.pa);
const statLabel = (v: number, mode: Mode) => (mode === "wins" ? String(v) : Math.round(v).toLocaleString("en-US"));
const statName = (mode: Mode) => MODES.find((m) => m.value === mode)!.label;

type Point = { s: SeasonRow; v: number };

// Joins consecutive seasons; a missed season breaks the line
function segments(points: Point[]) {
  const out: [Point, Point][] = [];
  for (let i = 1; i < points.length; i++) {
    if (points[i].s.season - points[i - 1].s.season === 1) out.push([points[i - 1], points[i]]);
  }
  return out;
}

// One chart, two lines: finishing position on the left axis (1st at the top, medal dots for
// 1st–3rd) and the chosen stat on the right axis. Points are HTML positioned in percent over an
// SVG drawn with non-scaling strokes, so text and dots keep their size at any width.
function Chart({
  seasons,
  mode,
  selected,
  onSelect,
}: {
  seasons: SeasonRow[];
  mode: Mode;
  selected: number;
  onSelect: (season: number) => void;
}) {
  // Finished seasons only: half a season's PF would flatten the rest (its card still shows it)
  const asc = seasons.filter((s) => !s.live).sort((a, b) => a.season - b.season);
  if (asc.length === 0) return <p className="py-10 text-center text-sm text-zinc-500">No finished seasons yet.</p>;
  const finishes: Point[] = asc.filter((s) => s.finalRank !== null).map((s) => ({ s, v: s.finalRank! }));
  const stats: Point[] = asc.map((s) => ({ s, v: statOf(s, mode) }));

  const worst = Math.max(...asc.map((s) => s.teams));
  const values = stats.map((p) => p.v);
  let lo = 0;
  let hi = Math.max(...values, 1);
  if (mode !== "wins") {
    const pad = Math.max((Math.max(...values) - Math.min(...values)) * 0.15, 50);
    lo = Math.floor((Math.min(...values) - pad) / 100) * 100;
    hi = Math.ceil((Math.max(...values) + pad) / 100) * 100;
  }
  const statTicks = [lo, mode === "wins" ? Math.round(hi / 2) : (lo + hi) / 2, hi];
  const finishTicks = [1, Math.round((1 + worst) / 2), worst];

  const first = asc[0].season;
  const last = asc[asc.length - 1].season;
  const span = Math.max(1, last - first);
  const x = (season: number) => (first === last ? 50 : 4 + ((season - first) / span) * 92);
  // Percent from the top
  const yFinish = (rank: number) => ((rank - 1) / Math.max(1, worst - 1)) * 100;
  const yStat = (v: number) => (1 - (v - lo) / (hi - lo)) * 100;
  const column = first === last ? 30 : Math.min(20, 92 / span);

  return (
    <div className="relative mt-7 mr-8 mb-7 ml-8 h-44">
      {finishTicks.map((t) => (
        <div key={t} className="absolute right-0 left-0 border-t border-zinc-800" style={{ top: `${yFinish(t)}%` }}>
          <span className="absolute right-full mr-2 -translate-y-1/2 text-[10px] tabular-nums whitespace-nowrap text-zinc-500">
            {ordinal(t)}
          </span>
        </div>
      ))}
      {statTicks.map((t) => (
        <span
          key={t}
          className="absolute left-full ml-2 -translate-y-1/2 text-[10px] tabular-nums whitespace-nowrap"
          style={{ top: `${yStat(t)}%`, color: STAT }}
        >
          {statLabel(t, mode)}
        </span>
      ))}

      {/* The selected year, behind everything */}
      {asc.some((s) => s.season === selected) && (
        <div
          className="absolute top-0 bottom-0 -translate-x-1/2 rounded-md bg-zinc-800/70"
          style={{ left: `${x(selected)}%`, width: `${column}%` }}
        />
      )}

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        {segments(stats).map(([a, b]) => (
          <line
            key={`s${a.s.season}`}
            x1={x(a.s.season)}
            y1={yStat(a.v)}
            x2={x(b.s.season)}
            y2={yStat(b.v)}
            stroke={STAT}
            strokeOpacity={0.8}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {segments(finishes).map(([a, b]) => (
          <line
            key={`f${a.s.season}`}
            x1={x(a.s.season)}
            y1={yFinish(a.v)}
            x2={x(b.s.season)}
            y2={yFinish(b.v)}
            stroke={FINISH}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {stats.map(({ s, v }) => (
        <span
          key={`s${s.season}`}
          className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${x(s.season)}%`, top: `${yStat(v)}%`, background: STAT }}
        >
          {s.season === selected && (
            <span className="absolute top-full left-1/2 mt-0.5 -translate-x-1/2 text-[10px] font-semibold tabular-nums whitespace-nowrap" style={{ color: STAT }}>
              {statLabel(v, mode)}
            </span>
          )}
        </span>
      ))}
      {finishes.map(({ s, v }) => {
        const medal = MEDALS[v];
        return (
          <span
            key={`f${s.season}`}
            className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${medal ? "h-3.5 w-3.5" : "h-2.5 w-2.5"}`}
            style={{ left: `${x(s.season)}%`, top: `${yFinish(v)}%`, background: medal ?? FINISH }}
          >
            <span
              className={`absolute bottom-full left-1/2 mb-0.5 -translate-x-1/2 text-[9px] tabular-nums whitespace-nowrap ${
                s.season === selected ? "font-semibold text-zinc-50" : "text-zinc-400"
              }`}
            >
              {ordinal(v)}
            </span>
          </span>
        );
      })}

      {/* Tap anywhere in a year's column to pick it */}
      {asc.map((s) => (
        <button
          key={s.season}
          onClick={() => onSelect(s.season)}
          aria-label={`${s.season}: ${s.finalRank ? ordinal(s.finalRank) : "no finish"}, ${statLabel(statOf(s, mode), mode)} ${statName(mode)}`}
          aria-pressed={s.season === selected}
          className="absolute top-0 bottom-0 -translate-x-1/2"
          style={{ left: `${x(s.season)}%`, width: `${column}%` }}
        >
          <span
            className={`absolute top-full left-1/2 mt-2 -translate-x-1/2 text-[10px] tabular-nums ${
              s.season === selected ? "font-semibold text-zinc-200" : "text-zinc-500"
            }`}
          >
            {asc.length > 5 ? `’${String(s.season).slice(2)}` : s.season}
          </span>
        </button>
      ))}
    </div>
  );
}

function Legend({ mode }: { mode: Mode }) {
  const dot = (color: string) => <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />;
  const line = (color: string) => <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: color }} />;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
      <span className="flex items-center gap-1.5">{line(FINISH)} Finish</span>
      <span className="flex items-center gap-1.5">{line(STAT)} {statName(mode)}</span>
      <span className="flex items-center gap-1.5">{dot(MEDALS[1])} 1st</span>
      <span className="flex items-center gap-1.5">{dot(MEDALS[2])} 2nd</span>
      <span className="flex items-center gap-1.5">{dot(MEDALS[3])} 3rd</span>
    </div>
  );
}

function SeasonCard({ s }: { s: SeasonRow }) {
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-zinc-400">{s.season}</div>
          <div className="truncate font-semibold text-zinc-50">{s.teamName}</div>
        </div>
        <Finish rank={s.finalRank} live={s.live} />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
        <Cell label="Regular" value={record(s.regular)} />
        <Cell label="Seed" value={s.live ? "–" : String(s.seed)} />
        <Cell label="All games" value={record(s.all)} />
        <Cell label="PF/G" value={pts(s.all.games ? s.all.pf / s.all.games : 0)} />
        <Cell label="PF" value={pts(s.all.pf)} />
        <Cell label="PA" value={pts(s.all.pa)} />
        <Cell label="Trades" value={String(s.trades)} />
        <Cell label="Best streak" value={`W${s.longestWinStreak}`} />
      </div>
    </Card>
  );
}

function Finish({ rank, live }: { rank: number | null; live: boolean }) {
  if (live) return <span className="shrink-0 text-xs text-zinc-400">In progress</span>;
  if (rank === 1) return <span className="shrink-0 text-sm font-semibold text-amber-400">★ Champion</span>;
  return <span className="shrink-0 text-sm text-zinc-300">{rank ? ordinal(rank) : "–"}</span>;
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-zinc-500">{label}</div>
      <div className="truncate font-medium tabular-nums text-zinc-200">{value}</div>
    </div>
  );
}
