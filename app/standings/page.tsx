import Link from "next/link";
import { Suspense } from "react";
import { PageTitle } from "@/components/ui";
import { StandingsView } from "@/components/StandingsView";
import { getLeague, latestSeason, standingsRows } from "@/lib/league";

export const metadata = { title: "Standings" };

// The all-time standings. Round 9 (the site owner, 2026-11-23) named them the Leaderboard; Round 10
// (2026-11-25) named them Standings again and put them under one nav tab with the Seasons page, each
// page linking to the other. Power Rankings (per game, by Win %) is the main view.
export default function StandingsPage() {
  const league = getLeague();
  const meta = { latest: latestSeason(league).season };
  return (
    <>
      <PageTitle
        sub={
          <Link href="/seasons" className="text-zinc-300 underline-offset-2 hover:underline">
            Standings for each season →
          </Link>
        }
      >
        Standings
      </PageTitle>
      <Suspense>
        <StandingsView rows={standingsRows(league)} meta={meta} />
      </Suspense>
    </>
  );
}
