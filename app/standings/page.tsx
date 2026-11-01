import { Suspense } from "react";
import { PageTitle } from "@/components/ui";
import { StandingsView, type StandingsRow } from "@/components/StandingsView";
import { allTimeStandings, getLeague, latestSeason, winPct } from "@/lib/league";

export const metadata = { title: "Standings" };

export default function StandingsPage() {
  const league = getLeague();
  const latest = latestSeason(league);
  const rows: StandingsRow[] = allTimeStandings(league).map((r) => ({
    slug: r.slug,
    name: r.name,
    nickname: r.nickname,
    active: r.active,
    w: r.w,
    l: r.l,
    t: r.t,
    pf: r.pf,
    pa: r.pa,
    seasons: r.seasons,
    titles: r.titles,
    rankChange: r.rankChange,
    winPct: winPct(r),
    pfPerGame: r.games ? r.pf / r.games : 0,
    pdiff: r.pf - r.pa,
  }));
  const first = league.seasons[0].season;
  return (
    <>
      <PageTitle
        sub={`Every game since ${first}: regular season, playoffs and consolation${
          latest.complete ? "" : `. ${latest.season} through week ${latest.throughWeek}`
        }.`}
      >
        All-time standings
      </PageTitle>
      <Suspense>
        <StandingsView rows={rows} />
      </Suspense>
    </>
  );
}
