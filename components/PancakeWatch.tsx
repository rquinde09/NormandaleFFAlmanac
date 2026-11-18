import Link from "next/link";
import { Bracket } from "@/components/Bracket";
import { Card, SectionLabel } from "@/components/ui";
import { record } from "@/lib/format";
import type { PancakeWatch as Watch, WatchRow } from "@/lib/seasons";

// The home page's race for last place while a season is on (Luke, 2026-11-15). Compact since the
// site owner's Round 6 (2026-11-17): folded shut, it shows only who's in danger of last place, in
// large red type with a pancake and a red light; tapping it opens the rest. During the regular
// season that's the team at the bottom of the standings, and the rest is everyone outside the
// playoff spots, worst first. After it, the bottom game of the pancake ladder (in its last week, the
// game whose loser finishes last), and the rest is the ladder itself.
export function PancakeWatch({ watch, name }: { watch: Watch; name: (slug: string) => string }) {
  const danger = inDanger(watch, name);
  return (
    <section>
      <SectionLabel>Pancake Watch 🥞</SectionLabel>
      <Card>
        <details className="group">
          <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
            {danger.people.length > 0 && <RedLight />}
            <div className="min-w-0 flex-1">
              {danger.people.length > 0 && (
                <div className="truncate text-3xl font-bold tracking-tight text-red-500">
                  {danger.people.map((p, i) => (
                    <span key={p}>
                      {i > 0 && <span className="text-lg font-medium text-zinc-500"> vs </span>}
                      {p}
                    </span>
                  ))}{" "}
                  🥞
                </div>
              )}
              <div className="mt-0.5 text-sm text-zinc-400">{danger.note}</div>
            </div>
            <span className="mt-2 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" aria-hidden>
              ▾
            </span>
          </summary>

          <div className="mt-4 border-t border-zinc-800 pt-3">
            {watch.phase === "regular" ? (
              <>
                <p className="text-sm text-zinc-400">
                  Miss the top {watch.playoffTeams} and you play in the pancake ladder, where last place takes the pancakes.{" "}
                  {watch.weeksLeft} regular-season week{watch.weeksLeft === 1 ? "" : "s"} left.
                </p>
                <ol className="mt-3 divide-y divide-zinc-800">
                  {watch.rows.map((r) => (
                    <Row key={r.person} r={r} />
                  ))}
                </ol>
                <div className="mt-2 border-t border-dashed border-zinc-700 pt-2 text-xs text-zinc-500">
                  Playoff line: {watch.line.seed}. {watch.line.nickname} {record(watch.line)}
                </div>
              </>
            ) : watch.ladder.length ? (
              <>
                <p className="mb-3 text-sm text-zinc-400">The teams that missed the playoffs play for last place. The loser takes the pancakes.</p>
                <Bracket rounds={watch.ladder} name={name} />
              </>
            ) : (
              <p className="text-sm text-zinc-400">The teams that missed the playoffs play for last place. The loser takes the pancakes.</p>
            )}
            <Link href={`/seasons/${watch.season}`} className="mt-3 block text-sm text-zinc-300 underline-offset-2 hover:underline">
              {watch.season} standings and brackets →
            </Link>
          </div>
        </details>
      </Card>
    </section>
  );
}

// Who the folded watch shows, and the small line under the names
function inDanger(watch: Watch, name: (slug: string) => string): { people: string[]; note: string } {
  if (watch.phase === "regular") {
    const [last, ...rest] = watch.rows;
    if (!last) return { people: [], note: "No one is outside the playoff spots yet." };
    const tied = rest.filter((r) => r.w === last.w && r.l === last.l && r.t === last.t).map((r) => r.nickname);
    const weeks = `${watch.weeksLeft} week${watch.weeksLeft === 1 ? "" : "s"} left`; // kept on one line
    return {
      people: [last.nickname],
      note: `Last at ${record(last)}${tied.length ? `, tied with ${tied.join(" and ")}` : ""} · ${weeks}`,
    };
  }
  const round = watch.ladder.at(-1);
  const game = round?.games.at(-1);
  if (!round || !game) return { people: [], note: "The regular season is over. The pancake ladder starts next week." };
  // In the ladder's last week, ESPN lists the last-place game last (every season, 2017–2025)
  if (!game.away) return { people: [name(game.home.person)], note: watch.final ? "A bye in the last week: last place" : `Bottom of the pancake ladder, week ${round.week} (bye)` };
  const loser = game.winner === "HOME" ? game.away : game.winner === "AWAY" ? game.home : null;
  if (watch.final && loser) return { people: [name(loser.person)], note: "Lost the pancake game: last place" };
  return {
    people: [name(game.home.person), name(game.away.person)],
    note: watch.final ? "The pancake game: the loser finishes last" : `Bottom game of the pancake ladder, week ${round.week}`,
  };
}

// A red light, pulsing unless the visitor asked for less motion
function RedLight() {
  return (
    <span className="relative mt-3 flex h-3 w-3 shrink-0" aria-hidden>
      <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 motion-safe:animate-ping" />
      <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
    </span>
  );
}

const gamesBack = (n: number) => (n === 0 ? "Tied, out on points" : `${Number.isInteger(n) ? n : n.toFixed(1)} back`);

function Row({ r }: { r: WatchRow }) {
  return (
    <li>
      <Link href={`/teams/${r.person}`} className="flex items-baseline gap-2 py-2 hover:text-white">
        <span className="w-6 shrink-0 text-right text-sm tabular-nums text-zinc-500">{r.seed}.</span>
        <span className="min-w-0 flex-1 truncate font-semibold text-zinc-50">{r.nickname}</span>
        <span className="shrink-0 text-sm tabular-nums text-zinc-300">{record(r)}</span>
        <span className="w-28 shrink-0 text-right text-xs text-zinc-500">
          {r.out ? <span className="rounded-md bg-orange-950 px-1.5 py-0.5 text-orange-300">No playoffs</span> : gamesBack(r.behind)}
        </span>
      </Link>
    </li>
  );
}
