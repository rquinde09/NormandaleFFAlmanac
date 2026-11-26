"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Segmented } from "@/components/Segmented";
import { RankChange } from "@/components/ui";
import type { ReviewKey } from "@/lib/review";
import { updateParams } from "@/lib/url";

export type SeasonTableRow = {
  person: string;
  nickname: string;
  place: number;
  champion: boolean;
  last: boolean;
  record: string;
  pf: number;
  pa: number;
  rankChange: number | null;
  trades: number; // how many
  injuries: number | null; // injured starters (Round 11); null without ESPN's game logs (2017)
  // The Playcall Review's numbers (null: none that season). Streaks: W6 = 6, L4 = −4.
  review: Record<ReviewKey, number | null>;
};

type Stats = "standard" | "playcall" | "odds";
const STATS: Stats[] = ["standard", "playcall", "odds"];

const plusMinus = (n: number, digits: number) => {
  const r = Math.round(n * 10 ** digits) / 10 ** digits;
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(digits)}`;
};
const toneOf = (n: number, digits: number) => {
  const r = Math.round(n * 10 ** digits);
  return r > 0 ? "text-emerald-400" : r < 0 ? "text-red-400" : "text-zinc-400";
};

// A season's standings with the site owner's stat sets (Round 8, 2026-11-20): Standard (W-L, PF, PA
// and Rank Δ) and Playcall. Round 10 (2026-11-25) made Playcall the manager's decisions (Draft IQ,
// Roster IQ, Waiver IQ, Trade IQ) and added Odds (Odds, Luck, Streaks), as on the manager pages; Round 11
// (2026-11-25) added Injuries to Odds. The choice lives in the URL (?stats=playcall, ?stats=odds).
type Props = { rows: SeasonTableRow[]; complete: boolean; playoffTeams: number };

export function SeasonTable(props: Props) {
  const params = useSearchParams();
  const pathname = usePathname();
  const stats: Stats = STATS.find((v) => v === params.get("stats")) ?? "standard";
  return <SeasonTableView {...props} stats={stats} onChange={(v) => updateParams(pathname, { stats: v === "standard" ? null : v })} />;
}

const HEADERS: Record<Stats, string[]> = {
  standard: ["W-L", "PF", "PA", "Rank Δ"],
  playcall: ["Draft IQ", "Roster IQ", "Waiver IQ", "Trade IQ"],
  odds: ["Odds", "Luck", "Streaks", "Injuries"],
};

const NOTES: Record<Exclude<Stats, "standard">, string> = {
  playcall:
    "Each is the team against the league that season, in points its starting lineup scored. Draft IQ and Waiver IQ: what its draft picks and its pickups scored for it, minus the league’s average. Roster IQ: the league’s average points left on the bench minus the team’s. Trade IQ: what its trades gained or lost. ESPN has bench lineups, pickups and trades from 2018 on.",
  odds:
    "Odds: wins minus ESPN’s projected wins, where ESPN favors the lineup with the higher projected score (from 2018). Luck: wins above or below expected, where each week a team expects the share of the league it outscored. Streaks: the season’s longest winning (W) or losing (L) streak, whichever is longer. Injuries: starters who got hurt while on the team, missing their NFL team’s next two games (from 2018; a suspension or benching counts too), green below the league’s average and red above it.",
};

// The page's static HTML shows the Standard view until it reads its URL
export function SeasonTableView({ rows, complete, playoffTeams, stats, onChange }: Props & { stats: Stats; onChange?: (v: Stats) => void }) {
  // Two-word headers ("Draft IQ") may wrap on a phone, so four Playcall columns fit 375 px
  const th = "px-1.5 py-2.5 text-right leading-tight font-medium sm:px-3 sm:whitespace-nowrap";
  const td = "px-1.5 py-2.5 text-right whitespace-nowrap sm:px-3";
  const headers = HEADERS[stats];
  // The league's average injured starters that season, which colors each count
  const hurt = rows.map((r) => r.injuries).filter((n): n is number => n !== null);
  const average = hurt.length ? hurt.reduce((a, b) => a + b, 0) / hurt.length : null;

  return (
    <div className="space-y-2">
      <Segmented
        label="Stats"
        options={[
          { value: "standard", label: "Standard" },
          { value: "playcall", label: "Playcall" },
          { value: "odds", label: "Odds" },
        ]}
        value={stats}
        onChange={(v) => onChange?.(v)}
      />
      <div className="no-scrollbar overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-zinc-800 text-xs text-zinc-400">
              <th className="sticky left-0 z-10 bg-zinc-900 px-2.5 py-2.5 text-left font-medium sm:px-3">Manager</th>
              {headers.map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.person}
                className={`border-b border-zinc-800/60 last:border-0 ${!complete && i === playoffTeams ? "border-t-2 border-t-zinc-700" : ""}`}
              >
                <td className="sticky left-0 z-10 bg-zinc-900 px-2.5 py-2.5 sm:px-3">
                  <Link href={`/teams/${r.person}`} className="flex items-baseline gap-2 whitespace-nowrap hover:text-white sm:gap-3">
                    <span className="w-5 text-right text-zinc-500">{r.place}</span>
                    <span className="font-medium text-zinc-100">
                      {r.nickname}
                      {r.champion && <span className="ml-1 text-amber-400">★</span>}
                      {r.last && <span className="ml-1">🥞</span>}
                    </span>
                  </Link>
                </td>
                {stats === "standard" ? (
                  <>
                    <td className={`${td} text-zinc-100`}>{r.record}</td>
                    <td className={`${td} text-zinc-300`}>
                      <Points n={r.pf} />
                    </td>
                    <td className={`${td} text-zinc-300`}>
                      <Points n={r.pa} />
                    </td>
                    <td className={td}>{r.rankChange === null ? <span className="text-xs text-zinc-600">–</span> : <RankChange change={r.rankChange} />}</td>
                  </>
                ) : stats === "playcall" ? (
                  <>
                    <Signed td={td} n={r.review.draft} digits={0} />
                    <Signed td={td} n={r.review.roster} digits={0} />
                    <Signed td={td} n={r.review.waiver} digits={0} />
                    <Signed td={td} n={r.trades === 0 ? null : r.review.trade} digits={0} />
                  </>
                ) : (
                  <>
                    <Signed td={td} n={r.review.odds} digits={r.review.odds !== null && !Number.isInteger(r.review.odds) ? 1 : 0} />
                    <Signed td={td} n={r.review.luck} digits={1} />
                    <td className={`${td} ${r.review.streak! > 0 ? "text-emerald-400" : r.review.streak! < 0 ? "text-red-400" : "text-zinc-400"}`}>
                      {r.review.streak! > 0 ? `W${r.review.streak}` : r.review.streak! < 0 ? `L${-r.review.streak!}` : "–"}
                    </td>
                    <Injuries td={td} n={r.injuries} average={average} />
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        {complete ? "Final place. " : `Current seed: the top ${playoffTeams} make the playoffs. `}
        {stats === "standard"
          ? `W-L, PF and PA count every game: regular season, playoffs and consolation. Rank Δ: ${
              complete ? "the final place against the regular-season seed" : "the seed’s change since last week"
            }.`
          : NOTES[stats]}
        {stats === "odds" && average !== null && ` League average: ${average.toFixed(1)} injured starters.`}
      </p>
    </div>
  );
}

// A number above or below the league: green above zero, red below, "–" without one
function Signed({ td, n, digits }: { td: string; n: number | null; digits: number }) {
  if (n === null) return <td className={`${td} text-zinc-600`}>–</td>;
  return <td className={`${td} ${toneOf(n, digits)}`}>{plusMinus(n, digits)}</td>;
}

// A count of injured starters: green below the league's average, red above, "–" without one
function Injuries({ td, n, average }: { td: string; n: number | null; average: number | null }) {
  if (n === null || average === null) return <td className={`${td} text-zinc-600`}>–</td>;
  const tone = Math.round(n * 10) < Math.round(average * 10) ? "text-emerald-400" : Math.round(n * 10) > Math.round(average * 10) ? "text-red-400" : "text-zinc-400";
  return <td className={`${td} ${tone}`}>{n}</td>;
}

// Whole points on a phone, so the four columns fit 375 px; tenths from sm up
function Points({ n }: { n: number }) {
  return (
    <>
      <span className="sm:hidden">{Math.round(n).toLocaleString("en-US")}</span>
      <span className="hidden sm:inline">{n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
    </>
  );
}
