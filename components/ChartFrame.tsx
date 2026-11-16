"use client";

import type { ReactNode } from "react";
import { ordinal } from "@/lib/format";
import type { SeasonPoint } from "@/lib/manager";

// Shared by the Manager Performance line chart and the Manager Playcalls bar chart: the axis, the
// selected season's band, the years along the bottom and a tap target for every season.

// Clicks inside elements with this attribute keep the selected season (points, tabs, the boxes
// that describe the selection); a click anywhere else clears it (Round 4)
export const KEEP = "data-keeps-season";
export const keep = { [KEEP]: "" };

export const MEDALS: Record<number, string> = { 1: "#fbbf24", 2: "#d4d4d8", 3: "#cd7f32" };
export const RED = "#ef4444"; // red-500, the site's accent
export const GREEN = "#10b981"; // emerald-500
export const GREY = "#52525b"; // zinc-600
export const PLOT_HEIGHT = 176; // px, the frame's h-44

export type Tick = { value: number; label: string };

// Each season's x in percent. The season in progress has a column too (Round 5).
export function xScale(seasons: SeasonPoint[]) {
  const first = seasons[0]?.season ?? 0;
  const last = seasons[seasons.length - 1]?.season ?? 0;
  const span = Math.max(1, last - first);
  return (season: number) => (first === last ? 50 : 4 + ((season - first) / span) * 92);
}

// A count axis from 0 (or below, for negative values) to a round top
export function countAxis(values: number[]) {
  const hi = Math.max(2, Math.ceil(Math.max(0, ...values) / 2) * 2);
  const lo = Math.min(0, Math.floor(Math.min(0, ...values) / 2) * 2);
  return { lo, hi, ticks: lo < 0 ? [lo, 0, hi] : [0, hi / 2, hi] };
}

export const plusMinus = (v: number, digits: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}`;

// Medal dot or pancake for a mark: gold, silver and bronze for 1st–3rd, the pancake for last
export function medalColor(m: { place: number | null; medal: boolean; last: boolean }) {
  return m.place !== null && m.medal && !m.last ? MEDALS[m.place] : undefined;
}

export function ChartFrame({
  seasons,
  y,
  ticks,
  zeroLine = false,
  selected,
  onSelect,
  label,
  children,
}: {
  seasons: SeasonPoint[];
  y: (v: number) => number; // percent from the top
  ticks: Tick[];
  zeroLine?: boolean; // draw 0 stronger (values around zero)
  selected: number | null;
  onSelect: (season: number) => void;
  label: (s: SeasonPoint) => string; // each tap target's accessible name
  children: ReactNode; // the marks, positioned in percent
}) {
  const x = xScale(seasons);
  const short = seasons.length > 5;
  return (
    <div className="relative mt-7 mr-2 mb-7 ml-10 h-44">
      {/* A faint band behind the selected season, from its label down to its year */}
      {selected !== null && seasons.some((s) => s.season === selected) && (
        <div
          className="pointer-events-none absolute -top-5 -bottom-7 w-7 -translate-x-1/2 rounded-lg bg-zinc-800/70"
          style={{ left: `${x(selected)}%` }}
          aria-hidden
        />
      )}

      {ticks.map((t) => (
        <div
          key={t.value}
          className={`pointer-events-none absolute right-0 left-0 border-t ${zeroLine && t.value === 0 ? "border-zinc-600" : "border-zinc-800"}`}
          style={{ top: `${y(t.value)}%` }}
        >
          <span className="absolute right-full mr-2 -translate-y-1/2 text-[10px] tabular-nums whitespace-nowrap text-zinc-500">{t.label}</span>
        </div>
      ))}

      <div className="pointer-events-none absolute inset-0">{children}</div>

      {/* Years along the bottom; the selected one is highlighted */}
      {seasons.map((s) => (
        <span
          key={s.season}
          className={`pointer-events-none absolute top-full mt-2 -translate-x-1/2 rounded px-1 text-[10px] tabular-nums ${
            s.season === selected ? "bg-red-500 font-semibold text-white" : s.live ? "text-zinc-400" : "text-zinc-500"
          }`}
          style={{ left: `${x(s.season)}%` }}
          aria-hidden
        >
          {short ? `’${String(s.season).slice(2)}` : s.season}
        </span>
      ))}

      {/* A 28 px tap target over each season's whole column, its year included */}
      <ul aria-label="Seasons">
        {seasons.map((s) => (
          <li key={s.season} className="absolute -top-5 -bottom-7 w-7 -translate-x-1/2" style={{ left: `${x(s.season)}%` }}>
            <button
              type="button"
              {...keep}
              onClick={() => onSelect(s.season)}
              aria-pressed={s.season === selected}
              aria-label={label(s)}
              className="h-full w-full cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-zinc-400"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

// The small line under a chart about the selected season (Round 5): its year, then what it shows
export function SeasonLine({ season, parts }: { season: number; parts: string[] }) {
  return (
    <p className="text-center text-xs text-zinc-400">
      <span className="font-semibold text-zinc-50">{season}</span>
      {parts.map((p, i) => (
        <span key={i}> · {p}</span>
      ))}
    </p>
  );
}

export const rankOf = (place: number | null, teams: number) => (place === null ? null : `${ordinal(place)} of ${teams}`);

export function MedalKey({ pancake }: { pancake: boolean }) {
  const dot = (color: string) => <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />;
  return (
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
  );
}
