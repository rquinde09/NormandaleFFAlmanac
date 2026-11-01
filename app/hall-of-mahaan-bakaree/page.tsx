import Link from "next/link";
import { Card, PageTitle, Stars } from "@/components/ui";
import { pts, record } from "@/lib/format";
import { champions, getLeague, managerBySlug } from "@/lib/league";

export const metadata = { title: "Hall of Mahaan Bakaree" };

export default function HallPage() {
  const league = getLeague();
  const champs = champions(league);
  const runnerUp = (season: number) => league.teamSeasons.find((t) => t.season === season && t.finalRank === 2);
  const counts = new Map<string, number>();
  for (const c of champs) counts.set(c.person, (counts.get(c.person) ?? 0) + 1);
  const leaders = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const name = (slug: string) => managerBySlug(league, slug)!.nickname;

  return (
    <>
      <PageTitle sub="Every Normandale Nation champion">Hall of Mahaan Bakaree</PageTitle>
      <div className="mb-4 flex flex-wrap gap-2">
        {leaders.map(([slug, n]) => (
          <Link
            key={slug}
            href={`/teams/${slug}`}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-700"
          >
            {name(slug)} <Stars count={n} />
          </Link>
        ))}
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {champs.map((c) => {
          const second = runnerUp(c.season);
          return (
            <li key={c.season}>
              <Link href={`/teams/${c.person}`} className="block">
                <Card className="transition-colors hover:border-zinc-700">
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-bold tabular-nums text-amber-400">{c.season}</span>
                    <span className="text-sm tabular-nums text-zinc-400">
                      {record(c.all)} · {pts(c.all.pf)} PF
                    </span>
                  </div>
                  <div className="mt-2 text-xl font-semibold text-zinc-50">{name(c.person)}</div>
                  <div className="text-sm text-zinc-400">{c.teamName}</div>
                  {second && <div className="mt-2 text-xs text-zinc-500">Runner-up: {name(second.person)}</div>}
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
