import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, SectionLabel, Stars, Stat } from "@/components/ui";
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
  const live = new Set(league.seasons.filter((s) => !s.complete).map((s) => s.season));

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

      <section>
        <SectionLabel>Season by season</SectionLabel>
        <ul className="grid gap-2 md:grid-cols-2">
          {seasons.map((s) => (
            <li key={s.season}>
              <Card className="h-full">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-zinc-400">{s.season}</div>
                    <div className="truncate font-semibold text-zinc-50">{s.teamName}</div>
                  </div>
                  <Finish rank={s.finalRank} live={live.has(s.season)} />
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                  <Cell label="Regular" value={record(s.regular)} />
                  <Cell label="Seed" value={live.has(s.season) ? "–" : String(s.seed)} />
                  <Cell label="All games" value={record(s.all)} />
                  <Cell label="PF/G" value={pts(s.all.games ? s.all.pf / s.all.games : 0)} />
                  <Cell label="PF" value={pts(s.all.pf)} />
                  <Cell label="PA" value={pts(s.all.pa)} />
                  <Cell label="Trades" value={String(s.trades)} />
                  <Cell label="Best streak" value={`W${s.longestWinStreak}`} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Finish({ rank, live }: { rank: number | null; live: boolean }) {
  if (live) return <span className="shrink-0 text-xs text-zinc-400">In progress</span>;
  if (rank === 1) return <span className="shrink-0 text-sm font-semibold text-amber-400">★ Champion</span>;
  return <span className="shrink-0 text-sm text-zinc-300">{rank ? ordinal(rank) : "–"}</span>;
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-zinc-500">{label}</div>
      <div className="truncate font-medium tabular-nums text-zinc-200">{value}</div>
    </div>
  );
}
