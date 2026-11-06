import { Suspense } from "react";
import { PageTitle } from "@/components/ui";
import { StandingsView } from "@/components/StandingsView";
import { getLeague, latestSeason, standingsRows } from "@/lib/league";

export const metadata = { title: "Standings" };

export default function StandingsPage() {
  const league = getLeague();
  const latest = latestSeason(league);
  const meta = {
    first: league.seasons[0].season,
    latest: latest.season,
    latestComplete: latest.complete,
    throughWeek: latest.throughWeek,
    weeks: latest.weeks,
  };
  return (
    <>
      <PageTitle>Standings</PageTitle>
      <Suspense>
        <StandingsView rows={standingsRows(league)} meta={meta} />
      </Suspense>
    </>
  );
}
