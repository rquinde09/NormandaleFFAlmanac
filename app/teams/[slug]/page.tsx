import Link from "next/link";
import { notFound } from "next/navigation";
import { Achievements } from "@/components/Achievements";
import { ManagerPerformance } from "@/components/ManagerPerformance";
import { Opponents } from "@/components/Opponents";
import { Card, Pancakes, Stars, Stat } from "@/components/ui";
import { pct, pts, record } from "@/lib/format";
import { careerTotals, getLeague, managerBySlug, winPct } from "@/lib/league";
import { achievements, opponents, performance } from "@/lib/manager";

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

  const career = careerTotals(league).get(slug)!;
  const seasons = league.teamSeasons.filter((ts) => ts.person === slug).sort((a, b) => a.season - b.season);
  const titleYears = seasons.filter((s) => s.finalRank === 1).map((s) => s.season);
  const lastYears = seasons.filter((s) => s.lastPlace).map((s) => s.season);

  return (
    <div className="space-y-4">
      <Link href="/teams" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Teams
      </Link>

      {/* Name, titles and status up front; the career numbers fold out (the site owner, 2026-11-07) */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            {manager.nickname} <Stars count={career.titles} /> <Pancakes count={career.lastPlaces} />
          </h1>
          <span
            className={`shrink-0 rounded-lg border px-2 py-1 text-xs ${
              manager.active ? "border-emerald-900 text-emerald-400" : "border-zinc-700 text-zinc-400"
            }`}
          >
            {manager.active ? "Active" : "Retired"}
          </span>
        </div>
        {(titleYears.length > 0 || lastYears.length > 0) && (
          <div className="mt-3 space-y-0.5 text-sm">
            {titleYears.length > 0 && <p className="text-amber-400">Champion: {titleYears.join(", ")}</p>}
            {lastYears.length > 0 && <p className="text-orange-300">Loser: {lastYears.join(", ")}</p>}
          </div>
        )}

        <details className="group mt-3 border-t border-zinc-800 pt-3">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-zinc-300 hover:text-zinc-100 [&::-webkit-details-marker]:hidden">
            Career stats
            <span className="text-zinc-500 transition-transform group-open:rotate-180" aria-hidden>
              ▾
            </span>
          </summary>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-zinc-50">{record(career)}</span>
            <span className="text-sm text-zinc-400">all-time</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Seasons" value={career.seasons} />
            <Stat label="Win %" value={pct(winPct(career))} />
            <Stat label="PF/G" value={pts(career.games ? career.pf / career.games : 0)} />
            <Stat label="Total PF" value={pts(career.pf)} />
          </div>
        </details>
      </Card>

      <ManagerPerformance seasons={performance(league, slug)} />
      <Opponents data={opponents(league, slug)} />
      <Achievements list={achievements(league, slug)} />
    </div>
  );
}
