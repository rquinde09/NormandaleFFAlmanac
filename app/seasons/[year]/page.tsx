import Link from "next/link";
import { notFound } from "next/navigation";
import { Bracket } from "@/components/Bracket";
import { Card, PageTitle, SectionLabel } from "@/components/ui";
import { pts, record } from "@/lib/format";
import { getLeague, managerBySlug } from "@/lib/league";
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

const plusMinus = (n: number) => `${n > 0.05 ? "+" : n < -0.05 ? "−" : ""}${Math.abs(n).toFixed(1)}`;

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

  return (
    <div className="space-y-5">
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
        <Table rows={rows} complete={info.complete} playoffTeams={info.playoffTeams} />
        <p className="mt-2 text-xs text-zinc-500">
          {info.complete ? "Final place. " : `Current seed: the top ${info.playoffTeams} make the playoffs. `}
          W-L, PF and PA count every game: regular season, playoffs and consolation. Luck is wins above or below expected, where
          each week a team expects the share of the league it outscored.
          {rows.some((r) => r.t.bench !== null) && " Bench is the points left on the bench: each week's best possible lineup minus the one started."}
        </p>
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

function Table({ rows, complete, playoffTeams }: { rows: SeasonRow[]; complete: boolean; playoffTeams: number }) {
  const bench = rows.some((r) => r.t.bench !== null);
  const th = "px-2 py-2.5 text-right font-medium whitespace-nowrap sm:px-3";
  const td = "px-2 py-2.5 text-right whitespace-nowrap sm:px-3";
  const wide = "hidden sm:table-cell"; // PA and Seed: off on a phone, so Luck and Bench fit
  return (
    <div className="no-scrollbar overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b border-zinc-800 text-xs text-zinc-400">
            <th className="sticky left-0 z-10 bg-zinc-900 px-2.5 py-2.5 text-left font-medium sm:px-3">Manager</th>
            <th className={th}>W-L</th>
            <th className={th}>PF</th>
            <th className={`${th} ${wide}`}>PA</th>
            <th className={th}>Luck</th>
            {bench && <th className={th}>Bench</th>}
            {complete && <th className={`${th} ${wide}`}>Seed</th>}
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
                    {r.t.finalRank === 1 && <span className="ml-1 text-amber-400">★</span>}
                    {r.t.lastPlace && <span className="ml-1">🥞</span>}
                  </span>
                </Link>
              </td>
              <td className={`${td} text-zinc-100`}>{record(r.t.all)}</td>
              <td className={`${td} text-zinc-300`}>{pts(r.t.all.pf)}</td>
              <td className={`${td} ${wide} text-zinc-300`}>{pts(r.t.all.pa)}</td>
              <td className={`${td} ${r.luck > 0.05 ? "text-emerald-400" : r.luck < -0.05 ? "text-red-400" : "text-zinc-400"}`}>{plusMinus(r.luck)}</td>
              {bench && <td className={`${td} text-zinc-300`}>{r.t.bench === null ? "–" : Math.round(r.t.bench).toLocaleString("en-US")}</td>}
              {complete && <td className={`${td} ${wide} text-zinc-400`}>{r.seed}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
