import { Suspense } from "react";
import { PageTitle } from "@/components/ui";
import { RecordsView } from "@/components/RecordsView";
import { BLOWOUT_OVER, CLOSE_UNDER, getLeague } from "@/lib/league";
import { recordSet } from "@/lib/records";

export const metadata = { title: "Records" };

export default function RecordsPage() {
  const league = getLeague();
  const active = new Set(league.managers.filter((m) => m.active).map((m) => m.slug));
  return (
    <>
      <PageTitle sub="Every game since 2017 counts. Season records use completed seasons only; League records are all-time totals. With Active on, game records count only games between two active managers.">
        Records
      </PageTitle>
      <Suspense>
        <RecordsView all={recordSet(league)} active={recordSet(league, (p) => active.has(p))} />
      </Suspense>
      <p className="mt-4 text-xs text-zinc-500">
        The One Hit Wonder: the starter with the team&apos;s lowest ESPN projection that week (kickers and D/STs aside) was its
        top scorer. Season projection: in each game, ESPN&apos;s favorite was the starting lineup with the higher projected score,
        so a team was projected to win the games it was favored in. ESPN has projections from 2018 on (none for 2017). Bench:
        each week&apos;s best possible lineup minus the one started, from ESPN&apos;s lineups for 2018 on (2017 lists starters only).
        A close game is decided by under {CLOSE_UNDER} points and a blowout by more than {BLOWOUT_OVER}; the League records count
        every game, this season&apos;s included, and break ties by the smaller margins added up (close games) or the bigger ones
        (blowouts).
      </p>
    </>
  );
}
