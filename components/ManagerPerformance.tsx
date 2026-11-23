"use client";

import { useState } from "react";
import { ChartFrame, MedalKey, RED, SeasonLine, countAxis, keep, medalColor, rankOf, xScale } from "@/components/ChartFrame";
import { PlaycallReview } from "@/components/PlaycallReview";
import { RosterBox } from "@/components/RosterBox";
import { Segmented } from "@/components/Segmented";
import { Card, SectionLabel } from "@/components/ui";
import { ordinal, pts } from "@/lib/format";
import type { SeasonPoint } from "@/lib/manager";

type Mode = "finish" | "wins" | "pf" | "pa";

// `ranks` says how the markers are ranked on that tab
const MODES: { value: Mode; label: string; ranks: string }[] = [
  { value: "finish", label: "Finish", ranks: "Final place in the league each season." },
  { value: "wins", label: "Wins", ranks: "Rank in the league that season: most wins is 1st, ties broken by PF." },
  { value: "pf", label: "PF", ranks: "Rank in the league that season: most points for is 1st." },
  { value: "pa", label: "PA", ranks: "Rank in the league that season: fewest points against is 1st." },
];

// The site owner's "Manager Performance" box: a year-by-year line with a tab for each stat. Each
// season's marker shows where it ranked in the league on that tab: gold, silver and bronze for
// 1st–3rd, a pancake for last (Round 3). Tapping a season selects it (Round 4); the line under the
// chart then says where it ranked, the Roster box opens with that season's players (Round 5), and
// the Playcall Review below it with that season's decisions (Round 6). Since Round 8 those two open
// on a tap, shut at first; since Round 9 they're titled "Players to Remember" and "Playcalling
// Analysis". The season in progress is selected at first.
export function ManagerPerformance({
  seasons,
  selected,
  onSelect,
}: {
  seasons: SeasonPoint[];
  selected: number | null;
  onSelect: (season: number) => void;
}) {
  const [mode, setMode] = useState<Mode>("finish");
  // The Roster box and the Playcall Review open on a tap (the site owner, Round 8), shut at first
  const [rosterOpen, setRosterOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const ranks = MODES.find((m) => m.value === mode)!.ranks;
  const point = seasons.find((s) => s.season === selected) ?? null;

  return (
    <section>
      <SectionLabel>Manager Performance</SectionLabel>
      <Card>
        <div {...keep}>
          <Segmented label="Chart" options={MODES} value={mode} onChange={setMode} small />
        </div>
        <LineChart seasons={seasons} mode={mode} selected={selected} onSelect={onSelect} />
        <div {...keep}>{point && <SeasonLine season={point.season} parts={describe(point, mode)} />}</div>
        <div className="mt-3 space-y-1 text-xs text-zinc-500">
          <MedalKey pancake />
          <p>{ranks}</p>
        </div>
        {point && <RosterBox point={point} open={rosterOpen} onToggle={() => setRosterOpen(!rosterOpen)} />}
        {point && <PlaycallReview point={point} open={reviewOpen} onToggle={() => setReviewOpen(!reviewOpen)} />}
      </Card>
    </section>
  );
}

function describe(p: SeasonPoint, mode: Mode): string[] {
  if (p.live) return ["Season in progress"];
  const m = p.marks[mode];
  const rank = rankOf(m.place, p.teams);
  const last = m.last ? " 🥞" : "";
  const v = p.values[mode]!;
  switch (mode) {
    case "finish":
      return [`Finished ${ordinal(v)} of ${p.teams}${last}`];
    case "wins":
      return [`${v} win${v === 1 ? "" : "s"} (${p.facts.record})`, `${rank}${last}`];
    case "pf":
      return [`${pts(v)} PF`, `${rank}${last}`];
    case "pa":
      return [`${pts(v)} PA`, `${rank}${last}`];
  }
}

// Points tabs: a free axis around the values, labels rounded to whole points
const POINTS = new Set<Mode>(["pf", "pa"]);
const labelOf = (v: number, mode: Mode) => (mode === "finish" ? ordinal(v) : POINTS.has(mode) ? String(Math.round(v)) : String(v));
const tickOf = (v: number, mode: Mode) => (POINTS.has(mode) ? Math.round(v).toLocaleString("en-US") : labelOf(v, mode));

type Point = { s: SeasonPoint; v: number };

// Joins consecutive seasons; a missed season breaks the line
function segments(points: Point[]) {
  const out: [Point, Point][] = [];
  for (let i = 1; i < points.length; i++) {
    if (points[i].s.season - points[i - 1].s.season === 1) out.push([points[i - 1], points[i]]);
  }
  return out;
}

// One line, one axis, which follows the tab. Markers are HTML positioned in percent over an SVG
// drawn with non-scaling strokes, so text and dots keep their size at any width.
function LineChart({
  seasons,
  mode,
  selected,
  onSelect,
}: {
  seasons: SeasonPoint[];
  mode: Mode;
  selected: number | null;
  onSelect: (season: number) => void;
}) {
  const points: Point[] = seasons.flatMap((s) => (s.values[mode] === null ? [] : [{ s, v: s.values[mode]! }]));
  if (seasons.length === 0) return <p className="py-10 text-center text-sm text-zinc-500">No seasons yet.</p>;
  const values = points.map((p) => p.v);

  // y: 0 at the top, 100 at the bottom, in percent
  let y: (v: number) => number;
  let ticks: number[];
  if (mode === "finish") {
    const worst = Math.max(...seasons.map((s) => s.teams));
    y = (rank) => ((rank - 1) / Math.max(1, worst - 1)) * 100;
    ticks = [1, Math.round((1 + worst) / 2), worst];
  } else if (POINTS.has(mode) && values.length) {
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
  const x = xScale(seasons);

  // A label sits above its point unless the line comes into the point from above on both sides
  const below = (i: number) => {
    const here = y(points[i].v);
    const near = [points[i - 1], points[i + 1]].filter(Boolean).map((p) => y(p!.v));
    return near.length > 0 && near.every((n) => n < here) && here < 85;
  };

  return (
    <ChartFrame
      seasons={seasons}
      y={y}
      ticks={ticks.map((t) => ({ value: t, label: tickOf(t, mode) }))}
      selected={selected}
      onSelect={onSelect}
      label={(s) => (s.live ? `${s.season}: season in progress` : s.values[mode] === null ? `${s.season}` : `${s.season}: ${labelOf(s.values[mode]!, mode)}`)}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        {segments(points).map(([a, b]) => (
          <line
            key={a.s.season}
            x1={x(a.s.season)}
            y1={y(a.v)}
            x2={x(b.s.season)}
            y2={y(b.v)}
            stroke={RED}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {points.map(({ s, v }, i) => {
        const m = s.marks[mode];
        const medal = medalColor(m);
        const on = s.season === selected;
        return (
          <div
            key={s.season}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{ left: `${x(s.season)}%`, top: `${y(v)}%` }}
            aria-hidden
          >
            {m.last ? (
              <span className="text-[15px] leading-none">🥞</span>
            ) : (
              <span className={`block rounded-full ring-2 ring-zinc-900 ${medal ? "h-3.5 w-3.5" : "h-2.5 w-2.5"}`} style={{ background: medal ?? RED }} />
            )}
            <span
              className={`absolute left-1/2 -translate-x-1/2 tabular-nums whitespace-nowrap ${
                on ? "text-[11px] font-bold text-zinc-50" : "text-[9px] text-zinc-400"
              } ${below(i) ? "top-full mt-1" : "bottom-full mb-1"}`}
            >
              {labelOf(v, mode)}
            </span>
          </div>
        );
      })}
    </ChartFrame>
  );
}
