"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Segmented } from "@/components/Segmented";
import { FoldNotes, RankChange } from "@/components/ui";
import { INJURIES_COUNTED, type ReviewKey } from "@/lib/review";
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
  injuries: number | null; // injuries (Round 11, lib/injuries.ts); null without ESPN's game logs (2017)
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

const LABELS: Record<Stats, string> = { standard: "Standard", playcall: "Playcall", odds: "Odds" };

// How each stat set is counted, folded away under the table like the Records page's notes (the site
// owner, 2026-11-27: "replicate the * How the starred records are counted ... for standard, playcall,
// and odds"), one point a column
function counted(stats: Stats, complete: boolean, playoffTeams: number): string[] {
  if (stats === "standard")
    return [
      complete
        ? "The number by each name: the final place, from the playoffs and the pancake ladder."
        : `The number by each name: the current seed, as ESPN seeds it (wins, then total points). The top ${playoffTeams} make the playoffs; the line marks the cut.`,
      "W-L: every decided game, regular season, playoffs, placement and consolation alike. ESPN’s own record counts the regular season only.",
      "PF and PA: the points the team scored and allowed in those games.",
      complete
        ? "Rank Δ: the final place against the regular-season seed, so a 6 seed who wins it all shows ▲5."
        : "Rank Δ: the seed’s change since last week.",
    ];
  if (stats === "playcall")
    return [
      "Each is the team against the league that season, in points its starting lineup scored, so each column adds up to zero.",
      "Draft IQ: what the team’s draft picks scored for it, minus the league’s average. Players traded away or dropped count only for their time on the team.",
      "Roster IQ: the league’s average points left on the bench minus the team’s. The bench is each week’s best possible lineup minus the one started. From 2018.",
      "Waiver IQ: what the players it picked up (off waivers or free agency) scored for it, minus the league’s average. From 2018.",
      "Trade IQ: what the players it received scored for it, minus what the players it sent away scored for their new team, from the trade on; – without a trade. From 2018.",
    ];
  return [
    "Odds: wins minus ESPN’s projected wins. ESPN’s favorite each game is the lineup with the higher projected score. From 2018.",
    "Luck: wins minus expected wins. Each week a team expects the share of the league it outscored.",
    "Streaks: the season’s longest winning (W) or losing (L) streak, whichever is longer.",
    `${INJURIES_COUNTED} Green is below the league’s average, red above.`,
  ];
}

// The page's static HTML shows the Standard view until it reads its URL
export function SeasonTableView({ rows, complete, playoffTeams, stats, onChange }: Props & { stats: Stats; onChange?: (v: Stats) => void }) {
  // Two-word headers ("Draft IQ") may wrap on a phone, so four Playcall columns fit 375 px
  const th = "px-1.5 py-2.5 text-right leading-tight font-medium sm:px-3 sm:whitespace-nowrap";
  const td = "px-1.5 py-2.5 text-right whitespace-nowrap sm:px-3";
  const headers = HEADERS[stats];
  // The league's average injuries that season, which colors each count
  const hurt = rows.map((r) => r.injuries).filter((n): n is number => n !== null);
  const average = hurt.length ? hurt.reduce((a, b) => a + b, 0) / hurt.length : null;

  return (
    <div className="space-y-2">
      <Segmented
        label="Stats"
        options={STATS.map((v) => ({ value: v, label: LABELS[v] }))}
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
        {complete ? "Final place." : `Current seed: the top ${playoffTeams} make the playoffs.`}
        {stats === "odds" && average !== null && ` League average: ${average.toFixed(1)} injuries.`}
      </p>
      <FoldNotes summary={`How the ${LABELS[stats]} stats are counted`}>
        {counted(stats, complete, playoffTeams).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </FoldNotes>
    </div>
  );
}

// A number above or below the league: green above zero, red below, "–" without one
function Signed({ td, n, digits }: { td: string; n: number | null; digits: number }) {
  if (n === null) return <td className={`${td} text-zinc-600`}>–</td>;
  return <td className={`${td} ${toneOf(n, digits)}`}>{plusMinus(n, digits)}</td>;
}

// A count of injuries: green below the league's average, red above, "–" without one
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
