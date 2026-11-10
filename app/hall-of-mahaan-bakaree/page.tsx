import Link from "next/link";
import type { ReactNode } from "react";
import { Card, PageTitle, Stars } from "@/components/ui";
import { pts, record, score } from "@/lib/format";
import { championDetails, type ChampionDetails, type LineupPlayer } from "@/lib/champions";
import { champions, getLeague, managerBySlug, type Game } from "@/lib/league";

export const metadata = { title: "Hall of Mahaan Bakaree" };

const KIND_LABEL = { regular: "", playoff: " · playoffs", placement: " · placement", consolation: " · consolation" };

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
      <ul className="grid items-start gap-3 md:grid-cols-2">
        {champs.map((c) => {
          const second = runnerUp(c.season);
          return (
            <li key={c.season}>
              <Card>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-bold tabular-nums text-amber-400">{c.season}</span>
                  <span className="text-sm tabular-nums text-zinc-400">
                    {record(c.all)} · {pts(c.all.pf)} PF
                  </span>
                </div>
                <Link href={`/teams/${c.person}`} className="mt-2 block text-xl font-semibold text-zinc-50 hover:text-white">
                  {name(c.person)}
                </Link>
                <div className="text-sm text-zinc-400">{c.teamName}</div>
                {second && <div className="mt-2 text-xs text-zinc-500">Runner-up: {name(second.person)}</div>}
                <Details season={c.season} details={championDetails(league, c)} name={name} />
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Details({ season, details: d, name }: { season: number; details: ChampionDetails; name: (slug: string) => string }) {
  const versus = (g: Game) => `${score(g.home.points)}–${score(g.away.points)} vs ${name(g.away.person)} · week ${g.week}${KIND_LABEL[g.kind]}`;
  return (
    <details className="group mt-3 border-t border-zinc-800 pt-3">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-zinc-300 hover:text-zinc-100 [&::-webkit-details-marker]:hidden">
        Championship details
        <span className="text-zinc-500 transition-transform group-open:rotate-180" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="mt-3 space-y-4 text-sm">
        {d.final && (
          <section>
            <Label>Championship game</Label>
            <div className="text-zinc-200">{versus(d.final)}</div>
            {d.manual && (
              <p className="mt-1 text-xs text-zinc-500">
                Lineup entered by hand. ESPN has no player points for {season}.
              </p>
            )}
            {d.starters ? (
              <>
                <Lineup players={d.starters} />
                {d.bench && (
                  <>
                    <div className="mt-2 text-xs text-zinc-500">Bench</div>
                    <Lineup players={d.bench} muted />
                  </>
                )}
              </>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">ESPN doesn&apos;t have lineups for {season}.</p>
            )}
          </section>
        )}
        {d.bestGame && (
          <section>
            <Label>Best game</Label>
            <div className="text-zinc-200">{versus(d.bestGame)}</div>
          </section>
        )}
        <section>
          <Label>Best player</Label>
          {d.bestPlayer ? (
            <div className="text-zinc-200">
              {d.bestPlayer.name}
              {d.bestPlayer.position && <span className="text-zinc-500"> · {d.bestPlayer.position}</span>}
              <div className="text-xs text-zinc-500">
                {pts(d.bestPlayer.points)} pts in {d.bestPlayer.starts} start{d.bestPlayer.starts === 1 ? "" : "s"}, playoffs included
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">
              {d.manual ? `ESPN has no player points for ${season}.` : `ESPN doesn't have lineups for ${season}.`}
            </p>
          )}
        </section>
      </div>
    </details>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">{children}</div>;
}

function Lineup({ players, muted = false }: { players: LineupPlayer[]; muted?: boolean }) {
  return (
    <ul className="mt-1.5 space-y-1">
      {players.map((p, i) => (
        <li key={i} className={`flex items-baseline gap-3 ${muted ? "text-zinc-500" : "text-zinc-300"}`}>
          <span className="w-12 shrink-0 text-xs text-zinc-500">{p.slot}</span>
          <span className="min-w-0 flex-1 truncate">{p.name}</span>
          {p.points !== null && <span className="shrink-0 tabular-nums">{score(p.points)}</span>}
        </li>
      ))}
    </ul>
  );
}
