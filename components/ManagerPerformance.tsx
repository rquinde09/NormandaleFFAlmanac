"use client";

import { useState } from "react";
import { Segmented } from "@/components/Segmented";
import { Card, SectionLabel } from "@/components/ui";
import { ordinal } from "@/lib/format";
import type { ChartMode as Mode, SeasonPoint } from "@/lib/manager";

// `ranks` says how the markers are ranked on that tab
const MODES: { value: Mode; label: string; ranks: string }[] = [
  { value: "finish", label: "Finish", ranks: "Final place in the league each season." },
  { value: "wins", label: "Wins", ranks: "Rank in the league that season: most wins is 1st, ties broken by PF." },
  { value: "pf", label: "PF", ranks: "Rank in the league that season: most points for is 1st." },
  { value: "pa", label: "PA", ranks: "Rank in the league that season: fewest points against is 1st." },
  {
    value: "streak",
    label: "Streak",
    ranks: "The season's longest winning (W) or losing (L) streak, whichever is longer. The league's longest winning streak that season is 1st, its longest losing streak last.",
  },
  { value: "trades", label: "Trades", ranks: "Rank in the league that season: most trades is 1st." },
];

const MEDALS: Record<number, string> = { 1: "#fbbf24", 2: "#d4d4d8", 3: "#cd7f32" };
const LINE = "#ef4444"; // red-500, the site's accent

// One box (the site owner's "Manager Performance"): a year-by-year chart with a tab for each
// stat. Each season's marker shows where it ranked in the league on that tab: gold, silver and
// bronze for 1st–3rd, a pancake for last (Round 3, 2026-11-14). Completed seasons only.
export function ManagerPerformance({ seasons }: { seasons: SeasonPoint[] }) {
  const [mode, setMode] = useState<Mode>("finish");
  const ranks = MODES.find((m) => m.value === mode)!.ranks;
  return (
    <section>
      <SectionLabel>Manager Performance</SectionLabel>
      <Card>
        <Segmented label="Chart" options={MODES} value={mode} onChange={setMode} small />
        <Chart seasons={seasons} mode={mode} />
        <Legend ranks={ranks} pancake={mode !== "trades"} />
      </Card>
    </section>
  );
}

const labelOf = (v: number, mode: Mode) =>
  mode === "finish"
    ? ordinal(v)
    : mode === "streak"
      ? v > 0 ? `W${v}` : v < 0 ? `L${-v}` : "0"
      : mode === "pf" || mode === "pa"
        ? String(Math.round(v))
        : String(v);
const tickOf = (v: number, mode: Mode) => (mode === "pf" || mode === "pa" ? Math.round(v).toLocaleString("en-US") : labelOf(v, mode));

type Point = { s: SeasonPoint; v: number };

// Joins consecutive seasons; a missed season breaks the line
function segments(points: Point[]) {
  const out: [Point, Point][] = [];
  for (let i = 1; i < points.length; i++) {
    if (points[i].s.season - points[i - 1].s.season === 1) out.push([points[i - 1], points[i]]);
  }
  return out;
}

// A count axis from 0 (or below, for losing streaks) to a round top
function countAxis(values: number[]) {
  const hi = Math.max(2, Math.ceil(Math.max(0, ...values) / 2) * 2);
  const lo = Math.min(0, Math.floor(Math.min(0, ...values) / 2) * 2);
  return { lo, hi, ticks: lo < 0 ? [lo, 0, hi] : [0, hi / 2, hi] };
}

// One line, one axis, which follows the tab. Markers are HTML positioned in percent over an SVG
// drawn with non-scaling strokes, so text and dots keep their size at any width.
function Chart({ seasons, mode }: { seasons: SeasonPoint[]; mode: Mode }) {
  if (seasons.length === 0) return <p className="py-10 text-center text-sm text-zinc-500">No finished seasons yet.</p>;
  const points: Point[] = seasons.map((s) => ({ s, v: s.values[mode] }));
  const values = points.map((p) => p.v);

  // y: 0 at the top, 100 at the bottom, in percent
  let y: (v: number) => number;
  let ticks: number[];
  if (mode === "finish") {
    const worst = Math.max(...seasons.map((s) => s.teams));
    y = (rank) => ((rank - 1) / Math.max(1, worst - 1)) * 100;
    ticks = [1, Math.round((1 + worst) / 2), worst];
  } else if (mode === "pf" || mode === "pa") {
    const pad = Math.max((Math.max(...values) - Math.min(...values)) * 0.15, 50);
    const lo = Math.floor((Math.min(...values) - pad) / 100) * 100;
    const hi = Math.ceil((Math.max(...values) + pad) / 100) * 100;
    y = (v) => (1 - (v - lo) / (hi - lo)) * 100;
    ticks = [lo, (lo + hi) / 2, hi];
  } else {
    const axis = countAxis(values);
    y = (v) => (1 - (v - axis.lo) / (axis.hi - axis.lo)) * 100;
    ticks = axis.ticks;
  }

  const first = seasons[0].season;
  const last = seasons[seasons.length - 1].season;
  const span = Math.max(1, last - first);
  const x = (season: number) => (first === last ? 50 : 4 + ((season - first) / span) * 92);

  // A label sits above its point unless the line comes into the point from above on both sides
  const below = (i: number) => {
    const here = y(points[i].v);
    const near = [points[i - 1], points[i + 1]].filter(Boolean).map((p) => y(p!.v));
    return near.length > 0 && near.every((n) => n < here) && here < 85;
  };

  return (
    <div className="relative mt-7 mr-2 mb-7 ml-10 h-44">
      {ticks.map((t) => (
        <div key={t} className={`absolute right-0 left-0 border-t ${t === 0 && mode === "streak" ? "border-zinc-600" : "border-zinc-800"}`} style={{ top: `${y(t)}%` }}>
          <span className="absolute right-full mr-2 -translate-y-1/2 text-[10px] tabular-nums whitespace-nowrap text-zinc-500">
            {tickOf(t, mode)}
          </span>
        </div>
      ))}

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

      <ul aria-label="Seasons">
        {points.map(({ s, v }, i) => {
          const m = s.marks[mode];
          const medal = m.place !== null && !m.last ? MEDALS[m.place] : undefined;
          const rank = m.last ? "last" : m.place && m.place <= 3 ? ordinal(m.place) : null;
          return (
            <li
              key={s.season}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
              style={{ left: `${x(s.season)}%`, top: `${y(v)}%` }}
              aria-label={`${s.season}: ${labelOf(v, mode)}${rank && mode !== "finish" ? `, ${rank} in the league` : ""}`}
            >
              {m.last ? (
                <span className="text-[15px] leading-none">🥞</span>
              ) : (
                <span
                  className={`block rounded-full ring-2 ring-zinc-900 ${medal ? "h-3.5 w-3.5" : "h-2.5 w-2.5"}`}
                  style={{ background: medal ?? LINE }}
                />
              )}
              <span
                className={`absolute left-1/2 -translate-x-1/2 text-[9px] tabular-nums whitespace-nowrap text-zinc-400 ${
                  below(i) ? "top-full mt-1" : "bottom-full mb-1"
                }`}
                aria-hidden
              >
                {labelOf(v, mode)}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Years along the bottom */}
      {points.map(({ s }) => (
        <span
          key={s.season}
          className="absolute top-full mt-2 -translate-x-1/2 text-[10px] tabular-nums text-zinc-500"
          style={{ left: `${x(s.season)}%` }}
          aria-hidden
        >
          {points.length > 5 ? `’${String(s.season).slice(2)}` : s.season}
        </span>
      ))}
    </div>
  );
}

function Legend({ ranks, pancake }: { ranks: string; pancake: boolean }) {
  const dot = (color: string) => <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />;
  return (
    <div className="space-y-1 text-xs text-zinc-500">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5">{dot(MEDALS[1])} 1st</span>
        <span className="flex items-center gap-1.5">{dot(MEDALS[2])} 2nd</span>
        <span className="flex items-center gap-1.5">{dot(MEDALS[3])} 3rd</span>
        {pancake && (
          <span className="flex items-center gap-1.5">
            <span className="text-[13px] leading-none">🥞</span> Last
          </span>
        )}
      </div>
      <p>{ranks}</p>
    </div>
  );
}
