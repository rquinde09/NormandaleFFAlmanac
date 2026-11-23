import Link from "next/link";
import { notFound } from "next/navigation";
import { Achievements } from "@/components/Achievements";
import { FromHomePills } from "@/components/HomePills";
import { ManagerCharts } from "@/components/ManagerCharts";
import { Opponents } from "@/components/Opponents";
import { Card, Pancakes, Stars } from "@/components/ui";
import { record } from "@/lib/format";
import { BLOWOUT_OVER, CLOSE_UNDER, careerTotals, getLeague, homeLinks, managerBySlug } from "@/lib/league";
import { achievements, careerStats, opponents, performance } from "@/lib/manager";

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
      {/* Opened from the home page's Mahaan Bakaree card: the other three cards (Round 9) */}
      <FromHomePills current="champ" links={homeLinks(league)} />
      <Link href="/teams" className="block text-sm text-zinc-400 hover:text-zinc-200">
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
            {titleYears.length > 0 && <p className="text-lg text-amber-400">Champion: {titleYears.join(", ")}</p>}
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
          {/* All side by side, on a phone too (the site owner, Round 8: "I intentionally want the stats all
              next to each other"), in his Round 9 order; Close games and Blowouts are Round 7's W-L over
              every decided game */}
          <dl className="mt-3 flex items-start justify-between gap-1.5 sm:justify-start sm:gap-8">
            {careerStats(league, slug).map((s) => (
              <CareerStat key={s.label} label={s.label} value={s.value} />
            ))}
          </dl>
          <p className="mt-2 text-xs text-zinc-500">
            Close games: by under {CLOSE_UNDER} points · Blowouts: by over {BLOWOUT_OVER}
          </p>
        </details>
      </Card>

      <ManagerCharts seasons={performance(league, slug)} />
      <Opponents data={opponents(league, slug)} />
      <Achievements list={achievements(league, slug)} />
    </div>
  );
}

function CareerStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 shrink-0">
      <dt className="text-[10px] whitespace-nowrap text-zinc-400 sm:text-xs">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-semibold whitespace-nowrap tabular-nums text-zinc-50 sm:text-lg">{value}</dd>
    </div>
  );
}
