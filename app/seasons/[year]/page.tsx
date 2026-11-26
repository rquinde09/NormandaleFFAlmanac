import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Bracket } from "@/components/Bracket";
import { FromHomePills } from "@/components/HomePills";
import { SeasonTable, SeasonTableView, type SeasonTableRow } from "@/components/SeasonTable";
import { Card, PageTitle, SectionLabel } from "@/components/ui";
import { record } from "@/lib/format";
import { getLeague, homeLinks, managerBySlug } from "@/lib/league";
import { rounds, seasonTable, type SeasonRow } from "@/lib/seasons";

type Params = { params: Promise<{ year: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getLeague().seasons.map((s) => ({ year: String(s.season) }));
}

export async function generateMetadata({ params }: Params) {
  const { year } = await params;
  return { title: `${year} season` };
}

// One season (Luke, 2026-11-15): its standings, the playoff bracket and the pancake ladder
export default async function SeasonPage({ params }: Params) {
  const { year } = await params;
  const league = getLeague();
  const info = league.seasons.find((s) => String(s.season) === year);
  if (!info) notFound();

  const rows = seasonTable(league, info);
  const name = (slug: string) => managerBySlug(league, slug)!.nickname;
  const champ = rows.find((r) => r.t.finalRank === 1);
  const second = rows.find((r) => r.t.finalRank === 2);
  const last = rows.find((r) => r.t.lastPlace);
  const playoffs = rounds(league, info, "playoff");
  const ladder = rounds(league, info, "consolation");
  const number = league.seasons.indexOf(info) + 1;
  const status = info.complete ? "Final" : `Through week ${info.throughWeek} of ${info.weeks}`;
  const tableRows: SeasonTableRow[] = rows.map((r) => ({
    person: r.person,
    nickname: r.nickname,
    place: r.place,
    champion: r.t.finalRank === 1,
    last: r.t.lastPlace,
    record: record(r.t.all),
    pf: r.t.all.pf,
    pa: r.t.all.pa,
    rankChange: r.rankChange,
    trades: r.t.trades,
    injuries: r.t.injuries,
    review: r.review,
  }));

  return (
    <div className="space-y-5">
      {/* Opened from the home page's 2026 Season card: the other three cards (Round 9) */}
      <FromHomePills current="standings" links={homeLinks(league)} />
      <div>
        <Link href="/seasons" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Seasons
        </Link>
        <div className="mt-3">
          <PageTitle sub={`Season ${number} · ${info.teams} teams, ${info.playoffTeams} make the playoffs · ${status}`}>
            {info.season} season
          </PageTitle>
        </div>
      </div>

      {info.complete && champ && (
        <Card>
          <div className="space-y-1 text-sm">
            <Podium label="Champion" className="text-amber-400" row={champ} icon="★" />
            {second && <Podium label="Runner-up" className="text-zinc-300" row={second} />}
            {last && <Podium label="Last place" className="text-orange-300" row={last} icon="🥞" />}
          </div>
        </Card>
      )}

      <section>
        <SectionLabel>{info.complete ? "Final standings" : "Standings"}</SectionLabel>
        {/* The Standard view renders before the page reads its URL */}
        <Suspense fallback={<SeasonTableView rows={tableRows} complete={info.complete} playoffTeams={info.playoffTeams} stats="standard" />}>
          <SeasonTable rows={tableRows} complete={info.complete} playoffTeams={info.playoffTeams} />
        </Suspense>
      </section>

      <section>
        <SectionLabel>Playoffs</SectionLabel>
        {playoffs.length ? (
          <Bracket rounds={playoffs} name={name} mark={champ ? { person: champ.person, icon: "★" } : undefined} />
        ) : (
          <Card>
            <p className="text-sm text-zinc-400">The playoffs start in week {info.regularWeeks + 1}.</p>
          </Card>
        )}
      </section>

      {ladder.length > 0 && (
        <section>
          <SectionLabel>Pancake ladder</SectionLabel>
          <p className="mb-3 text-sm text-zinc-400">The teams that missed the playoffs play for last place. The loser takes the pancakes.</p>
          <Bracket rounds={ladder} name={name} mark={last ? { person: last.person, icon: "🥞" } : undefined} />
        </section>
      )}
    </div>
  );
}

function Podium({ label, row, icon, className }: { label: string; row: SeasonRow; icon?: string; className: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-20 shrink-0 text-xs text-zinc-500">{label}</span>
      <Link href={`/teams/${row.person}`} className={`min-w-0 truncate font-semibold hover:text-white ${className}`}>
        {row.nickname}
        {icon && <span className="ml-1">{icon}</span>}
      </Link>
      <span className="min-w-0 truncate text-xs text-zinc-500">{row.teamName}</span>
    </div>
  );
}
