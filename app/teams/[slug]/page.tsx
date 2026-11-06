import Link from "next/link";
import { notFound } from "next/navigation";
import { ManagerSeasons, type SeasonRow } from "@/components/ManagerSeasons";
import { Card, Stars, Stat } from "@/components/ui";
import { ordinal, pct, pts, record, signed } from "@/lib/format";
import { allTimeStandings, getLeague, managerBySlug, winPct } from "@/lib/league";

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getLeague().managers.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  return { title: managerBySlug(getLeague(), slug)?.nickname };
}

export default async function ManagerPage({ params }: Params) {
  const { slug } = await params;
  const league = getLeague();
  const manager = managerBySlug(league, slug);
  if (!manager) notFound();

  const standings = allTimeStandings(league);
  const career = standings.find((r) => r.slug === slug)!;
  const seasons = league.teamSeasons.filter((ts) => ts.person === slug).sort((a, b) => b.season - a.season);
  const finishes = seasons.map((s) => s.finalRank).filter((r): r is number => r !== null);
  const best = finishes.length ? Math.min(...finishes) : null;
  const titleYears = seasons.filter((s) => s.finalRank === 1).map((s) => s.season).reverse();
  const info = new Map(league.seasons.map((s) => [s.season, s]));
  const rows: SeasonRow[] = seasons.map((s) => ({
    season: s.season,
    teamName: s.teamName,
    finalRank: s.finalRank,
    live: !info.get(s.season)!.complete,
    teams: info.get(s.season)!.teams,
    seed: s.seed,
    regular: s.regular,
    all: s.all,
    trades: s.trades,
    longestWinStreak: s.longestWinStreak,
  }));

  return (
    <div className="space-y-4">
      <Link href="/teams" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Teams
      </Link>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
              {manager.nickname} <Stars count={career.titles} />
            </h1>
            <p className="text-sm text-zinc-400">{manager.name}</p>
          </div>
          <span
            className={`shrink-0 rounded-lg border px-2 py-1 text-xs ${
              manager.active ? "border-emerald-900 text-emerald-400" : "border-zinc-700 text-zinc-400"
            }`}
          >
            {manager.active ? "Active" : "Retired"}
          </span>
        </div>

        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-4xl font-bold tabular-nums text-zinc-50">{record(career)}</span>
          <span className="text-sm text-zinc-400">
            all-time · #{career.rank} of {standings.length}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-6">
          <Stat label="Win %" value={pct(winPct(career))} />
          <Stat label="PF/G" value={pts(career.games ? career.pf / career.games : 0)} />
          <Stat label="PDIFF" value={signed(career.pf - career.pa)} tone={career.pf >= career.pa ? "up" : "down"} />
          <Stat label="Points for" value={pts(career.pf)} />
          <Stat label="Seasons" value={career.seasons} />
          <Stat label="Best finish" value={best ? ordinal(best) : "–"} />
        </div>
        {titleYears.length > 0 && (
          <p className="mt-4 text-sm text-amber-400">Champion: {titleYears.join(", ")}</p>
        )}
      </Card>

      <ManagerSeasons seasons={rows} />
    </div>
  );
}
