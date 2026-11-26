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
      {/* No description under the title (the site owner, Round 10) */}
      <PageTitle>Records</PageTitle>
      <Suspense>
        <RecordsView all={recordSet(league)} active={recordSet(league, (p) => active.has(p))} />
      </Suspense>
      {/* Round 11 (the site owner, 2026-11-25): the notes fold away, one point each in his order, and
          the records they explain carry a * */}
      <details className="group mt-4 text-xs text-zinc-500">
        <summary className="flex cursor-pointer list-none items-center gap-1 hover:text-zinc-300 [&::-webkit-details-marker]:hidden">
          * How the starred records are counted
          <span className="transition-transform group-open:rotate-180" aria-hidden>
            ▾
          </span>
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            The One Hit Wonder: the starter with the team&apos;s lowest ESPN projection that week (kickers and D/STs aside) was its top
            scorer.
          </li>
          <li>
            Season projection: in each game, ESPN&apos;s favorite was the starting lineup with the higher projected score, so a team was
            projected to win the games it was favored in. ESPN has projections from 2018 on (none for 2017).
          </li>
          <li>
            Bench: each week&apos;s best possible lineup minus the one started, from ESPN&apos;s lineups for 2018 on (2017 lists starters
            only).
          </li>
          <li>
            A close game is decided by under {CLOSE_UNDER} points and a blowout by more than {BLOWOUT_OVER}; the League records count
            every game, this season&apos;s included, and break ties by the smaller margins added up (close games) or the bigger ones
            (blowouts).
          </li>
          <li>
            Injured starters: players who had started for the team that season and got hurt while on it, counted when they missed
            their NFL team&apos;s next two games. ESPN keeps no injury reports for past weeks, only whether each player played, so a
            suspension or a benching counts too. From 2018, this season included; a tie goes to fewer seasons.
          </li>
        </ul>
      </details>
    </>
  );
}
