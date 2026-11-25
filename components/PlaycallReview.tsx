"use client";

import { GREEN, GREY, RED, keep, plusMinus } from "@/components/ChartFrame";
import { Toggle } from "@/components/RosterBox";
import { ordinal } from "@/lib/format";
import type { ReviewRow, SeasonPoint } from "@/lib/manager";
import { DECISIONS, FATE, type ReviewKey } from "@/lib/review";

type Tone = "good" | "bad" | "even";

type Stat = {
  key: ReviewKey;
  label: string;
  bad: string; // the bar's left end
  good: string; // its right end
  digits: number; // shown to this many decimals; a number that rounds to zero is "Even"
  format: (v: number) => string;
  words: Record<Tone, [string, string]>; // the verdict and the line after it
  missing?: (p: SeasonPoint) => string; // the row without a number that season
};

const wins = (v: number) => plusMinus(v, Number.isInteger(v) ? 0 : 1);

// The site owner's sketch (Round 6, 2026-11-17): his words for the ends, the verdicts and the lines.
// Round 10 (2026-11-25) added Draft IQ and Waiver IQ, renamed Trades to Trade IQ, and moved Odds,
// Luck and Streaks to a box of their own, each group in his order.
const STATS: Record<ReviewKey, Stat> = {
  draft: {
    key: "draft",
    label: "Draft IQ",
    bad: "Low",
    good: "High",
    digits: 1,
    format: (v) => plusMinus(v, 1),
    words: {
      good: ["High", "Drafted better than league mates"],
      bad: ["Low", "Drafted worse than league mates"],
      even: ["Even", "Drafted like the league average"],
    },
  },
  roster: {
    key: "roster",
    label: "Roster IQ",
    bad: "Low",
    good: "High",
    digits: 1,
    format: (v) => plusMinus(v, 1),
    words: {
      good: ["High", "Made better roster calls than league mates"],
      bad: ["Low", "Made worse roster calls than league mates"],
      even: ["Even", "Made roster calls like the league average"],
    },
    missing: (p) => `ESPN has no ${p.season} bench lineups`,
  },
  waiver: {
    key: "waiver",
    label: "Waiver IQ",
    bad: "Low",
    good: "High",
    digits: 1,
    format: (v) => plusMinus(v, 1),
    words: {
      good: ["High", "Found more on waivers than league mates"],
      bad: ["Low", "Found less on waivers than league mates"],
      even: ["Even", "Found as much on waivers as the league average"],
    },
    missing: (p) => `ESPN has no ${p.season} waiver details`,
  },
  trade: {
    key: "trade",
    label: "Trade IQ",
    bad: "Bust",
    good: "Boom",
    digits: 0,
    format: (v) => plusMinus(v, 0),
    words: {
      good: ["Boom", "Trade helped your season"],
      bad: ["Bust", "Trade did not help your season"],
      even: ["Even", "Trades broke even"],
    },
    missing: (p) => `${p.facts.trades} trade${p.facts.trades === 1 ? "" : "s"} · ESPN has no ${p.season} trade details`,
  },
  odds: {
    key: "odds",
    label: "Odds",
    bad: "Under perform",
    good: "Over perform",
    digits: 1, // whole wins, or a half after a projected tie
    format: wins,
    words: {
      good: ["Over perform", "ESPN rooted against the team"],
      bad: ["Under perform", "ESPN rooted for the team"],
      even: ["Even", "Won as many games as ESPN projected"],
    },
    missing: (p) => `ESPN has no ${p.season} projections`,
  },
  luck: {
    key: "luck",
    label: "Luck",
    bad: "Unlucky",
    good: "Lucky",
    digits: 1,
    format: (v) => plusMinus(v, 1),
    words: {
      good: ["Lucky", "Won more games than expected"],
      bad: ["Unlucky", "Lost more games than expected"],
      even: ["Even", "Won as many games as expected"],
    },
  },
  streak: {
    key: "streak",
    label: "Streaks",
    bad: "Cold",
    good: "Hot",
    digits: 0,
    format: (v) => (v > 0 ? `W${v}` : v < 0 ? `L${-v}` : "0"),
    words: {
      good: ["Hot", "Team showed consistency winning"],
      bad: ["Cold", "Team failed to perform"],
      even: ["Even", ""],
    },
  },
};

// The two boxes (Round 10): the manager's decisions, and what the season was expected to bring.
// "Against the Odds" is a placeholder name until the site owner picks one.
export type ReviewGroup = "decisions" | "fate";

const GROUPS: Record<ReviewGroup, { title: string; keys: ReviewKey[]; counted: string[] }> = {
  decisions: {
    title: "Playcalling Analysis",
    keys: DECISIONS,
    counted: [
      "Every point a team scores comes from a player it drafted, picked up or traded for. Points count in its starting lineup, every game, while it had the player.",
      "Draft IQ: what the team’s draft picks scored for it, minus the league’s average that season. Players traded away or dropped count only for their time on the team.",
      "Roster IQ: the league’s average points left on the bench minus the team’s. The bench is each week’s best possible lineup minus the one started. From 2018.",
      "Waiver IQ: what the players it picked up (off waivers or free agency, kickers and D/STs included) scored for it, minus the league’s average. From 2018.",
      "Trade IQ: what the players received scored in the starting lineup, minus what the players sent away scored for their new team, from the trade on. From 2018.",
    ],
  },
  fate: {
    title: "Against the Odds",
    keys: FATE,
    counted: [
      "Odds: wins minus ESPN’s projected wins. ESPN’s favorite each game is the lineup with the higher projected score. From 2018.",
      "Luck: wins minus expected wins. Each week a team expects the share of the league it outscored.",
      "Streaks: the season’s longest winning (W) or losing (L) streak, whichever is longer.",
    ],
  },
};

const TONE_TEXT: Record<Tone | "none", string> = { good: "text-emerald-400", bad: "text-red-400", even: "text-zinc-400", none: "text-zinc-500" };
const TONE_FILL: Record<Tone, string> = { good: GREEN, bad: RED, even: GREY };

// The site owner's "Playcall Review" (Round 6, 2026-11-17): the selected season's numbers, under the
// Roster box like its players. Since Round 8 it opens and closes from its title line, and since Round 9
// (2026-11-23) the title is "Playcalling Analysis · 2025". Round 10 (2026-11-25) split it into two
// boxes, Playcalling Analysis and Against the Odds. Each bar has zero in the middle and runs from that
// season's league worst on the left to its best on the right, filled from zero to the season's number.
export function PlaycallReview({ point, group, open, onToggle }: { point: SeasonPoint; group: ReviewGroup; open: boolean; onToggle: () => void }) {
  const g = GROUPS[group];
  return (
    <div className="mt-4 border-t border-zinc-800 pt-3" {...keep}>
      <Toggle open={open} onToggle={onToggle}>
        <span className="text-zinc-200">{g.title}</span>
        <span className="text-zinc-400">
          {" "}
          · {point.season}
          {point.live ? " so far" : ""}
        </span>
      </Toggle>
      {open && (
        <>
          <ul className="mt-3 space-y-4">
            {g.keys.map((key) => (
              <Row key={key} stat={STATS[key]} row={point.review[key]} point={point} />
            ))}
          </ul>
          <details className="group mt-4">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 [&::-webkit-details-marker]:hidden">
              How it&rsquo;s counted
              <span className="transition-transform group-open:rotate-180" aria-hidden>
                ▾
              </span>
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-zinc-500">
              <li>Each bar: zero in the middle, the league&rsquo;s worst that season on the left, its best on the right. The rank is among the league that season.</li>
              {g.counted.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}

function Row({ stat, row, point }: { stat: Stat; row: ReviewRow; point: SeasonPoint }) {
  const noTrades = stat.key === "trade" && point.facts.trades === 0;
  const v = noTrades || row.value === null ? null : Math.round(row.value * 10 ** stat.digits) / 10 ** stat.digits;
  const tone: Tone | null = v === null ? null : v > 0 ? "good" : v < 0 ? "bad" : "even";
  const [verdict, line] = tone === null ? [noTrades ? "No trades" : (stat.missing?.(point) ?? ""), ""] : stat.words[tone];
  // Trades: "Trades helped your season" after more than one
  const said = stat.key === "trade" && point.facts.trades > 1 ? line.replace(/^Trade /, "Trades ") : line;
  const show = (n: number) => (n === 0 ? "0" : stat.format(n));
  // The Roster IQ seed line (Round 5), kept where the best lineup would have moved the seed up
  const seed =
    stat.key === "roster" && v !== null && point.facts.optimizedSeed !== null && point.facts.optimizedSeed < point.facts.seed
      ? `Best lineup every week: seed ${ordinal(point.facts.seed)} → ${ordinal(point.facts.optimizedSeed)}`
      : null;

  return (
    <li className="grid gap-x-6 gap-y-1 sm:grid-cols-2 sm:items-center">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-zinc-100">{stat.label}</span>
          {v !== null && (
            <span className="tabular-nums whitespace-nowrap">
              <span className={`text-sm font-bold ${TONE_TEXT[tone!]}`}>{show(v)}</span>
              {row.place !== null && (
                <span className="ml-1.5 text-[10px] text-zinc-500">
                  {ordinal(row.place)} of {point.teams}
                </span>
              )}
            </span>
          )}
        </div>
        <Bar row={row} value={v} tone={tone} label={`${stat.label}: ${v === null ? verdict : `${show(v)}, ${verdict}`}`} />
        <div className="relative mt-1 h-3.5 text-[10px] leading-none tabular-nums text-zinc-500">
          <span className="absolute left-0">
            {v !== null && <span className="text-zinc-400">{show(row.lo)} </span>}
            <span className="uppercase tracking-wide">{stat.bad}</span>
          </span>
          <span className="absolute left-1/2 -translate-x-1/2 text-zinc-600">0</span>
          <span className="absolute right-0 text-right">
            <span className="uppercase tracking-wide">{stat.good}</span>
            {v !== null && <span className="text-zinc-400"> {show(row.hi)}</span>}
          </span>
        </div>
      </div>
      <div className="text-xs">
        <p className="text-zinc-400">
          <span className={`font-semibold ${TONE_TEXT[tone ?? "none"]}`}>{verdict}</span>
          {said && <> – {said}</>}
        </p>
        {seed && <p className="mt-0.5 text-[11px] text-zinc-500">{seed}</p>}
      </div>
    </li>
  );
}

// A thin bar with zero in the middle. Each half runs to the league's extreme on its side that
// season, so a full half is the league's best (or worst).
function Bar({ row, value, tone, label }: { row: ReviewRow; value: number | null; tone: Tone | null; label: string }) {
  const half = value === null || value === 0 ? 0 : value > 0 ? (row.hi ? value / row.hi : 0) : row.lo ? value / row.lo : 0;
  const width = `${Math.min(1, half) * 50}%`;
  return (
    <div className="relative mt-1.5 h-2.5 rounded-full bg-zinc-800" role="img" aria-label={label}>
      {half > 0 && (
        <div
          className={`absolute inset-y-0 ${value! > 0 ? "left-1/2 rounded-r-full" : "right-1/2 rounded-l-full"}`}
          style={{ width, minWidth: 2, background: TONE_FILL[tone!] }}
        />
      )}
      <div className="absolute -inset-y-0.5 left-1/2 w-px -translate-x-1/2 bg-zinc-500" aria-hidden />
    </div>
  );
}
