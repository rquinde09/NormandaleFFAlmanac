"use client";

import { useState } from "react";
import { ChartFrame, GREEN, GREY, MedalKey, PLOT_HEIGHT, RED, SeasonLine, countAxis, keep, medalColor, plusMinus, rankOf, xScale } from "@/components/ChartFrame";
import { Segmented } from "@/components/Segmented";
import { Card, SectionLabel } from "@/components/ui";
import { ordinal, pts, signed } from "@/lib/format";
import type { SeasonPoint } from "@/lib/manager";

type Mode = "luck" | "odds" | "bench" | "trades" | "streak";

// The site owner's order (Round 5): Luck, Bench, Trades, Streak. Luke kept all-play Luck and added
// Odds after it; Bench is called Roster IQ.
const MODES: { value: Mode; label: string; about: string }[] = [
  {
    value: "luck",
    label: "Luck",
    about:
      "Wins above or below expected. Expected wins: each week, the share of the league this team outscored. Green: more wins than the scores earned, red: fewer. Medals: the league's luckiest that season.",
  },
  {
    value: "odds",
    label: "Odds",
    about:
      "Wins above or below what ESPN projected. Each game, ESPN's favorite is the starting lineup with the higher projected score. Green: ESPN doubted the team; red: ESPN gave it false hope. Medals: the most wins above projection that season. ESPN has projections from 2018 on (none for 2017).",
  },
  {
    value: "bench",
    label: "Roster IQ",
    about:
      "Points left on the bench: each week's best possible lineup minus the one started. Green: fewer than the league average that season, red: more. Tap a bar for the league average and the seed with the best lineup every week. ESPN has bench lineups from 2018 on (2017 lists starters only).",
  },
  {
    value: "trades",
    label: "Trades",
    about:
      "Bar height: trades that season. Green: the players received outscored the players sent away, counting points in each team's starting lineup from the trade to the season's end; red: the other way. The number is the net points. Medals: the most trades that season. ESPN has no trade details for 2017.",
  },
  {
    value: "streak",
    label: "Streak",
    about:
      "The season's longest winning streak (green, up) or losing streak (red, down), whichever is longer. Medals: the league's three longest winning streaks that season; the pancake: its longest losing streak.",
  },
];

// The site owner's "Manager Playcalls" (Round 5): a breakdown of the manager's own decisions, folded
// shut under Manager Performance. Bar charts, sharing the selected season with the line above.
export function ManagerPlaycalls({
  seasons,
  selected,
  onSelect,
}: {
  seasons: SeasonPoint[];
  selected: number | null;
  onSelect: (season: number) => void;
}) {
  const [mode, setMode] = useState<Mode>("luck");
  const about = MODES.find((m) => m.value === mode)!.about;
  const point = seasons.find((s) => s.season === selected) ?? null;

  return (
    <section>
      <SectionLabel>Manager Playcalls</SectionLabel>
      <Card>
        <details className="group">
          <summary
            {...keep}
            className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-zinc-300 hover:text-zinc-100 [&::-webkit-details-marker]:hidden"
          >
            Luck, Odds, Roster IQ, Trades, Streak
            <span className="text-zinc-500 transition-transform group-open:rotate-180" aria-hidden>
              ▾
            </span>
          </summary>
          <div className="mt-3">
            <div {...keep}>
              <Segmented label="Playcalls" options={MODES} value={mode} onChange={setMode} small />
            </div>
            <BarChart seasons={seasons} mode={mode} selected={selected} onSelect={onSelect} />
            {point && (
              <div {...keep}>
                {mode === "bench" && !point.live && point.values.bench !== null ? (
                  // Roster IQ's small window (Round 5): the bench, then the seed with the best lineups
                  <div className="mx-auto max-w-sm space-y-0.5 rounded-xl border border-zinc-800 px-3 py-2">
                    {describe(point, mode).map((parts, i) =>
                      i === 0 ? (
                        <SeasonLine key={i} season={point.season} parts={parts} />
                      ) : (
                        <p key={i} className="text-center text-xs text-zinc-300">
                          {parts.join(" · ")}
                        </p>
                      ),
                    )}
                  </div>
                ) : (
                  <SeasonLine season={point.season} parts={describe(point, mode)[0]} />
                )}
              </div>
            )}
            <div className="mt-3 space-y-1 text-xs text-zinc-500">
              {mode === "bench" ? <BenchKey /> : mode !== "trades" || seasons.some((s) => s.facts.trades > 0) ? <MedalKey pancake={mode === "streak"} /> : null}
              <p>{about}</p>
            </div>
          </div>
        </details>
      </Card>
    </section>
  );
}

const wins = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const oddsLabel = (v: number) => plusMinus(v, Number.isInteger(v) ? 0 : 1);

// The line (or, for Roster IQ, the small window) under the chart about the selected season
function describe(p: SeasonPoint, mode: Mode): string[][] {
  if (p.live) return [["Season in progress"]];
  const f = p.facts;
  const m = p.marks[mode];
  const rank = rankOf(m.place, p.teams);
  const v = p.values[mode];
  switch (mode) {
    case "luck":
      return [[`${f.record}, ${f.expectedWins.toFixed(1)} wins expected`, `${plusMinus(v!, 1)}`, rank!]];
    case "odds":
      if (v === null || f.projectedWins === null) return [[`ESPN has no ${p.season} projections`]];
      return [[`${f.record}, ESPN projected ${wins(f.projectedWins)}-${wins(f.games - f.projectedWins)}`, oddsLabel(v), rank!]];
    case "bench":
      if (v === null) return [[`ESPN has no ${p.season} bench lineups`]];
      return [
        [`${pts(v)} pts left on the bench`, `league avg ${pts(f.benchAverage ?? 0)}`],
        f.optimizedSeed === null ? [] : [`Seed: ${ordinal(f.seed)} → Best-lineup seed: ${ordinal(f.optimizedSeed)}`],
      ].filter((line) => line.length);
    case "trades":
      if (!f.trades) return [["No trades"]];
      if (f.tradeNet === null) return [[`${f.trades} trade${f.trades === 1 ? "" : "s"}`, `ESPN has no ${p.season} trade details`, rank!]];
      return [[`${f.trades} trade${f.trades === 1 ? "" : "s"}`, `${signed(f.tradeNet)} pts from them`, rank!]];
    case "streak":
      return [[`Longest streaks W${f.winStreak}, L${f.lossStreak}`, `${rank}${m.last ? " 🥞" : ""}`]];
  }
}

function BenchKey() {
  const swatch = (color: string) => <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="flex items-center gap-1.5">{swatch(GREEN)} Below average</span>
      <span className="flex items-center gap-1.5">{swatch(RED)} Above average</span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-4 border-t border-dashed border-zinc-300" /> League average
      </span>
    </div>
  );
}

// Bars from zero, one per completed season with a number. Positive bars go up, negative down.
function BarChart({
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
  const bars = seasons.flatMap((s) => (s.values[mode] === null ? [] : [{ s, v: s.values[mode]! }]));
  const values = bars.map((b) => b.v);

  let lo: number;
  let hi: number;
  let ticks: number[];
  if (mode === "bench") {
    lo = 0;
    hi = Math.max(100, Math.ceil((Math.max(0, ...values, ...seasons.map((s) => s.facts.benchAverage ?? 0)) * 1.08) / 100) * 100);
    ticks = [0, hi / 2, hi];
  } else {
    // Headroom past the longest bar, so its label (and a pancake) stays inside the chart
    const pad = Math.max(0.5, (Math.max(0, ...values) - Math.min(0, ...values)) * 0.12);
    const ends = values.map((v) => (v > 0 ? v + pad : v < 0 ? v - pad : v));
    ({ lo, hi, ticks } = countAxis(ends));
  }
  const y = (v: number) => (1 - (v - lo) / (hi - lo)) * 100;
  const x = xScale(seasons);
  const tick = (t: number) => (mode === "bench" ? Math.round(t).toLocaleString("en-US") : mode === "streak" ? (t > 0 ? `W${t}` : t < 0 ? `L${-t}` : "0") : mode === "trades" ? String(t) : plusMinus(t, 0));

  const colorOf = (s: SeasonPoint, v: number) => {
    if (mode === "bench") return s.facts.benchAverage === null ? GREY : v < s.facts.benchAverage ? GREEN : v > s.facts.benchAverage ? RED : GREY;
    if (mode === "trades") return s.facts.tradeNet === null || s.facts.tradeNet === 0 ? GREY : s.facts.tradeNet > 0 ? GREEN : RED;
    return v > 0 ? GREEN : v < 0 ? RED : GREY;
  };
  const labelOf = (s: SeasonPoint, v: number) => {
    if (mode === "bench") return String(Math.round(v));
    if (mode === "streak") return v > 0 ? `W${v}` : v < 0 ? `L${-v}` : "0";
    if (mode === "trades") return v === 0 || s.facts.tradeNet === null ? "" : `${s.facts.tradeNet > 0 ? "+" : s.facts.tradeNet < 0 ? "−" : ""}${Math.round(Math.abs(s.facts.tradeNet))}`;
    if (mode === "odds") return oddsLabel(v);
    return plusMinus(v, 1);
  };
  const ariaOf = (s: SeasonPoint) => {
    if (s.live) return `${s.season}: season in progress`;
    const v = s.values[mode];
    if (v === null) return `${s.season}: no number`;
    if (mode === "trades") return `${s.season}: ${v} trade${v === 1 ? "" : "s"}${v ? `, ${labelOf(s, v) ? `${labelOf(s, v)} pts` : "no details"}` : ""}`;
    return `${s.season}: ${labelOf(s, v)}`;
  };

  const picked = seasons.find((s) => s.season === selected);
  const average = mode === "bench" && picked && picked.values.bench !== null ? picked.facts.benchAverage : null;

  return (
    <ChartFrame
      seasons={seasons}
      y={y}
      ticks={ticks.map((t) => ({ value: t, label: tick(t) }))}
      zeroLine={lo < 0}
      selected={selected}
      onSelect={onSelect}
      label={ariaOf}
    >
      {bars.map(({ s, v }) => {
        const top = Math.min(y(v), y(0));
        const height = Math.abs(y(v) - y(0));
        const up = v >= 0;
        const m = s.marks[mode];
        const medal = mode === "bench" ? undefined : medalColor(m);
        const pancake = mode === "streak" && m.last;
        const on = s.season === selected;
        const px = (height / 100) * PLOT_HEIGHT;
        // The medal sits just inside the bar's end, or in its middle when the bar is short
        const dotAt = px >= 16 ? (up ? "6px" : `calc(100% - 6px)`) : "50%";
        return (
          <div key={s.season} className="absolute -translate-x-1/2" style={{ left: `${x(s.season)}%`, top: `${top}%`, height: `${height}%` }} aria-hidden>
            <div className={`h-full w-3 sm:w-4 ${up ? "rounded-t" : "rounded-b"}`} style={{ background: colorOf(s, v), minHeight: v === 0 ? 0 : 2 }} />
            {medal && (
              <span
                className="absolute left-1/2 block h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-zinc-900"
                style={{ top: dotAt, background: medal }}
              />
            )}
            {pancake && <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-[14px] leading-none" style={{ top: up ? 0 : "100%" }}>🥞</span>}
            <span
              className={`absolute left-1/2 -translate-x-1/2 tabular-nums whitespace-nowrap ${on ? "text-[11px] font-bold text-zinc-50" : "text-[9px] text-zinc-400"} ${
                up ? `bottom-full ${pancake ? "mb-2.5" : "mb-1"}` : `top-full ${pancake ? "mt-2.5" : "mt-1"}`
              }`}
            >
              {labelOf(s, v)}
            </span>
          </div>
        );
      })}
      {/* Roster IQ: the league's average that season, only once a bar is selected */}
      {average !== null && picked && (
        <div className="absolute w-11 -translate-x-1/2 border-t border-dashed border-zinc-200" style={{ left: `${x(picked.season)}%`, top: `${y(average)}%` }} aria-hidden />
      )}
    </ChartFrame>
  );
}
