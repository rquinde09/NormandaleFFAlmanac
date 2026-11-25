import Link from "next/link";
import { Card, PageTitle } from "@/components/ui";
import { getLeague, managerBySlug } from "@/lib/league";

export const metadata = { title: "Seasons" };

// Every season, newest first, each linking to its standings and brackets (Luke, 2026-11-15)
export default function SeasonsPage() {
  const league = getLeague();
  const name = (slug: string) => managerBySlug(league, slug)!.nickname;

  return (
    <>
      {/* The way back to the all-time standings, which link here (Round 10) */}
      <PageTitle
        sub={
          <Link href="/standings" className="text-zinc-300 underline-offset-2 hover:underline">
            Standings across all seasons →
          </Link>
        }
      >
        Seasons
      </PageTitle>
      <ul className="grid gap-3 md:grid-cols-2">
        {[...league.seasons].reverse().map((info) => {
          const teams = league.teamSeasons.filter((t) => t.season === info.season);
          const champ = teams.find((t) => t.finalRank === 1);
          const second = teams.find((t) => t.finalRank === 2);
          const last = teams.find((t) => t.lastPlace);
          const leader = teams.find((t) => t.seed === 1);
          return (
            <li key={info.season}>
              <Link href={`/seasons/${info.season}`} className="block h-full">
                <Card className="h-full transition-colors hover:border-zinc-700">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-2xl font-bold tabular-nums text-zinc-50">{info.season}</span>
                    <span className="text-xs text-zinc-500">
                      Season {league.seasons.indexOf(info) + 1} · {info.teams} teams
                    </span>
                  </div>
                  {info.complete ? (
                    <div className="mt-2 space-y-0.5 text-sm">
                      {champ && <div className="font-semibold text-amber-400">★ {name(champ.person)}</div>}
                      {second && <div className="text-zinc-400">Runner-up: {name(second.person)}</div>}
                      {last && <div className="text-orange-300">🥞 {name(last.person)}</div>}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-zinc-400">
                      In progress · through week {info.throughWeek}
                      {leader && <> · {name(leader.person)} is the 1 seed</>}
                    </div>
                  )}
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
