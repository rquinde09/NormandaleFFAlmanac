"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Segmented } from "@/components/Segmented";
import { RankChange } from "@/components/ui";
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
  luck: number;
  bench: number | null;
  trades: number; // how many
  tradeNet: number | null; // null: no trade details that season
  streak: number; // W6 = 6, L4 = −4
};

type Stats = "standard" | "playcall";

const plusMinus = (n: number, digits: number) => {
  const r = Math.round(n * 10 ** digits) / 10 ** digits;
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(digits)}`;
};
const toneOf = (n: number, digits: number) => {
  const r = Math.round(n * 10 ** digits);
  return r > 0 ? "text-emerald-400" : r < 0 ? "text-red-400" : "text-zinc-400";
};

// A season's standings with the site owner's two stat sets (Round 8, 2026-11-20): Standard (W-L, PF,
// PA and Rank Δ) and Playcall (Luck, Bench, Trades and Streaks, the Playcall Review's numbers). The
// choice lives in the URL (?stats=playcall).
type Props = { rows: SeasonTableRow[]; complete: boolean; playoffTeams: number };

export function SeasonTable(props: Props) {
  const params = useSearchParams();
  const pathname = usePathname();
  const stats: Stats = params.get("stats") === "playcall" ? "playcall" : "standard";
  return <SeasonTableView {...props} stats={stats} onChange={(v) => updateParams(pathname, { stats: v === "standard" ? null : v })} />;
}

// The page's static HTML shows the Standard view until it reads its URL
export function SeasonTableView({ rows, complete, playoffTeams, stats, onChange }: Props & { stats: Stats; onChange?: (v: Stats) => void }) {
  const th = "px-1.5 py-2.5 text-right font-medium whitespace-nowrap sm:px-3";
  const td = "px-1.5 py-2.5 text-right whitespace-nowrap sm:px-3";
  const headers = stats === "standard" ? ["W-L", "PF", "PA", "Rank Δ"] : ["Luck", "Bench", "Trades", "Streaks"];

  return (
    <div className="space-y-2">
      <Segmented
        label="Stats"
        options={[
          { value: "standard", label: "Standard" },
          { value: "playcall", label: "Playcall" },
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
                ) : (
                  <>
                    <td className={`${td} ${toneOf(r.luck, 1)}`}>{plusMinus(r.luck, 1)}</td>
                    <td className={`${td} ${r.bench === null ? "text-zinc-600" : "text-zinc-300"}`}>{r.bench === null ? "–" : Math.round(r.bench).toLocaleString("en-US")}</td>
                    <td className={`${td} ${r.tradeNet === null || r.trades === 0 ? "text-zinc-600" : toneOf(r.tradeNet, 0)}`}>
                      {r.tradeNet === null || r.trades === 0 ? "–" : plusMinus(r.tradeNet, 0)}
                    </td>
                    <td className={`${td} ${r.streak > 0 ? "text-emerald-400" : r.streak < 0 ? "text-red-400" : "text-zinc-400"}`}>
                      {r.streak > 0 ? `W${r.streak}` : r.streak < 0 ? `L${-r.streak}` : "–"}
                    </td>
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
              complete ? "the final place against the regular-season seed" : "the seed's change since last week"
            }.`
          : "Luck is wins above or below expected, where each week a team expects the share of the league it outscored. Bench is the points left on the bench: each week's best possible lineup minus the one started (from 2018). Trades are the points a team's trades gained or lost in its starting lineups (from 2018). Streaks: the season's longest winning (W) or losing (L) streak, whichever is longer."}
      </p>
    </div>
  );
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
