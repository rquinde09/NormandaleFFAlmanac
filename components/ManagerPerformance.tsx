"use client";

import { useState } from "react";
import { Segmented } from "@/components/Segmented";
import { Card, SectionLabel } from "@/components/ui";
import { ordinal, pts } from "@/lib/format";

export type SeasonRow = {
  season: number;
  teamName: string;
  finalRank: number | null;
  lastPlace: boolean;
  live: boolean;
  teams: number;
  all: { w: number; l: number; t: number; pf: number; pa: number; games: number };
  trades: number;
  longestWinStreak: number;
  longestLossStreak: number;
};

type Mode = "finish" | "wins" | "pf" | "pa";

const MODES: { value: Mode; label: string }[] = [
  { value: "finish", label: "Finish" },
  { value: "wins", label: "Wins" },
  { value: "pf", label: "PF" },
  { value: "pa", label: "PA" },
];

const MEDALS: Record<number, string> = { 1: "#fbbf24", 2: "#d4d4d8", 3: "#cd7f32" };
const LINE = "#ef4444"; // red-500, the site's accent

// One box (the site owner's "Manager Performance", 2026-11-07): the year-by-year chart, the year
// picker and the picked season's numbers. Tapping a year on the chart picks that season too.
// Seasons come newest first; the newest is picked to start.
export function ManagerPerformance({ seasons }: { seasons: SeasonRow[] }) {
  const [selected, setSelected] = useState(seasons[0].season);
  const [mode, setMode] = useState<Mode>("finish");
  const current = seasons.find((s) => s.season === selected) ?? seasons[0];

  return (
    <section>
      <SectionLabel>Manager Performance</SectionLabel>
      <Card>
        <Segmented label="Chart" options={MODES} value={mode} onChange={setMode} />
        <Chart seasons={seasons} mode={mode} selected={current.season} onSelect={setSelected} />
        <Legend />

        {seasons.length > 1 && (
          <div role="radiogroup" aria-label="Season" className="mt-4 grid grid-cols-5 gap-1 rounded-xl border border-zinc-800 p-1 md:grid-cols-10">
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

        <SeasonDetail s={current} />
      </Card>
    </section>
  );
}

const valueOf = (s: SeasonRow, mode: Mode) =>
  mode === "finish" ? s.finalRank! : mode === "wins" ? s.all.w : mode === "pf" ? s.all.pf : s.all.pa;
const labelOf = (v: number, mode: Mode) =>
  mode === "finish" ? ordinal(v) : mode === "wins" ? String(v) : Math.round(v).toLocaleString("en-US");

type Point = { s: SeasonRow; v: number };

// Joins consecutive seasons; a missed season breaks the line
function segments(points: Point[]) {
  const out: [Point, Point][] = [];
  for (let i = 1; i < points.length; i++) {
    if (points[i].s.season - points[i - 1].s.season === 1) out.push([points[i - 1], points[i]]);
  }
  return out;
}

// One line, one axis, which follows the tab. Each season's marker shows how it finished on every
// tab: gold, silver and bronze for 1st–3rd, a pancake for last. Markers are HTML positioned in
// percent over an SVG drawn with non-scaling strokes, so text and dots keep their size at any width.
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
  // Finished seasons only: half a season's PF would flatten the rest (the season card still shows it)
  const asc = seasons.filter((s) => !s.live && s.finalRank !== null).sort((a, b) => a.season - b.season);
  if (asc.length === 0) return <p className="py-10 text-center text-sm text-zinc-500">No finished seasons yet.</p>;
  const points: Point[] = asc.map((s) => ({ s, v: valueOf(s, mode) }));
  const values = points.map((p) => p.v);

  // y: 0 at the top, 100 at the bottom, in percent
  let y: (v: number) => number;
  let ticks: number[];
  if (mode === "finish") {
    const worst = Math.max(...asc.map((s) => s.teams));
    y = (rank) => ((rank - 1) / Math.max(1, worst - 1)) * 100;
    ticks = [1, Math.round((1 + worst) / 2), worst];
  } else if (mode === "wins") {
    const hi = Math.max(2, Math.ceil(Math.max(...values) / 2) * 2);
    y = (v) => (1 - v / hi) * 100;
    ticks = [0, hi / 2, hi];
  } else {
    const pad = Math.max((Math.max(...values) - Math.min(...values)) * 0.15, 50);
    const lo = Math.floor((Math.min(...values) - pad) / 100) * 100;
    const hi = Math.ceil((Math.max(...values) + pad) / 100) * 100;
    y = (v) => (1 - (v - lo) / (hi - lo)) * 100;
    ticks = [lo, (lo + hi) / 2, hi];
  }

  const first = asc[0].season;
  const last = asc[asc.length - 1].season;
  const span = Math.max(1, last - first);
  const x = (season: number) => (first === last ? 50 : 4 + ((season - first) / span) * 92);
  const column = first === last ? 30 : Math.min(20, 92 / span);
  // PF and PA numbers are too wide to label every point on a phone; the picked year's is shown
  const labelAll = mode === "finish" || mode === "wins";

  return (
    <div className="relative mt-7 mr-2 mb-7 ml-10 h-44">
      {ticks.map((t) => (
        <div key={t} className="absolute right-0 left-0 border-t border-zinc-800" style={{ top: `${y(t)}%` }}>
          <span className="absolute right-full mr-2 -translate-y-1/2 text-[10px] tabular-nums whitespace-nowrap text-zinc-500">
            {labelOf(t, mode)}
          </span>
        </div>
      ))}

      {/* The picked year, behind everything */}
      {asc.some((s) => s.season === selected) && (
        <div
          className="absolute top-0 bottom-0 -translate-x-1/2 rounded-md bg-zinc-800/70"
          style={{ left: `${x(selected)}%`, width: `${column}%` }}
        />
      )}

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        {segments(points).map(([a, b]) => (
          <line
            key={a.s.season}
            x1={x(a.s.season)}
            y1={y(a.v)}
            x2={x(b.s.season)}
            y2={y(b.v)}
            stroke={LINE}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {points.map(({ s, v }) => {
        const medal = MEDALS[s.finalRank!];
        const picked = s.season === selected;
        return (
          <span
            key={s.season}
            className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{ left: `${x(s.season)}%`, top: `${y(v)}%` }}
          >
            {s.lastPlace ? (
              <span className="text-[15px] leading-none">🥞</span>
            ) : (
              <span
                className={`block rounded-full ring-2 ring-zinc-900 ${medal ? "h-3.5 w-3.5" : "h-2.5 w-2.5"}`}
                style={{ background: medal ?? LINE }}
              />
            )}
            {(labelAll || picked) && (
              <span
                className={`absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-[9px] tabular-nums whitespace-nowrap ${
                  picked ? "font-semibold text-zinc-50" : "text-zinc-400"
                }`}
              >
                {labelOf(v, mode)}
              </span>
            )}
          </span>
        );
      })}

      {/* Tap anywhere in a year's column to pick it */}
      {asc.map((s) => (
        <button
          key={s.season}
          onClick={() => onSelect(s.season)}
          aria-label={`${s.season}: ${ordinal(s.finalRank!)}, ${s.all.w} wins, ${pts(s.all.pf)} PF, ${pts(s.all.pa)} PA`}
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

function Legend() {
  const dot = (color: string) => <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
      <span className="flex items-center gap-1.5">{dot(MEDALS[1])} 1st</span>
      <span className="flex items-center gap-1.5">{dot(MEDALS[2])} 2nd</span>
      <span className="flex items-center gap-1.5">{dot(MEDALS[3])} 3rd</span>
      <span className="flex items-center gap-1.5">
        <span className="text-[13px] leading-none">🥞</span> Last
      </span>
    </div>
  );
}

// The longer of the season's winning and losing streaks
function streak(s: SeasonRow) {
  if (!s.longestWinStreak && !s.longestLossStreak) return "–";
  return s.longestLossStreak > s.longestWinStreak ? `L${s.longestLossStreak}` : `W${s.longestWinStreak}`;
}

function SeasonDetail({ s }: { s: SeasonRow }) {
  const perGame = (n: number) => pts(s.all.games ? n / s.all.games : 0);
  return (
    <div className="mt-4 border-t border-zinc-800 pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-zinc-400">{s.season}</div>
          <div className="truncate font-semibold text-zinc-50">{s.teamName}</div>
        </div>
        <Finish s={s} />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
        <Cell label="PF/G" value={perGame(s.all.pf)} />
        <Cell label="PA/G" value={perGame(s.all.pa)} />
        <Cell label="Streak" value={streak(s)} />
        <Cell label="Trades" value={String(s.trades)} />
      </div>
    </div>
  );
}

function Finish({ s }: { s: SeasonRow }) {
  if (s.live) return <span className="shrink-0 text-xs text-zinc-400">In progress</span>;
  if (s.finalRank === 1) return <span className="shrink-0 text-sm font-semibold text-amber-400">★ Champion</span>;
  if (s.lastPlace) return <span className="shrink-0 text-sm text-orange-300">🥞 Last</span>;
  return <span className="shrink-0 text-sm text-zinc-300">{s.finalRank ? ordinal(s.finalRank) : "–"}</span>;
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-zinc-500">{label}</div>
      <div className="truncate font-medium tabular-nums text-zinc-200">{value}</div>
    </div>
  );
}
