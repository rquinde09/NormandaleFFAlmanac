import Link from "next/link";
import { Bracket } from "@/components/Bracket";
import { record } from "@/lib/format";
import type { PancakeWatch as Watch, WatchRow } from "@/lib/seasons";

// The home page's race for last place while a season is on (Luke, 2026-11-15), as the site owner's
// Round 8 card (2026-11-20): who's in danger of last place, and, opened, each team's chance of
// finishing last. During the regular season "in danger" is the team at the bottom of the standings;
// after it, the bottom game of the pancake ladder (in its last week, the game whose loser finishes last).
export function inDanger(watch: Watch, name: (slug: string) => string): { people: string[]; note: string } {
  const weeks = `${watch.weeksLeft} week${watch.weeksLeft === 1 ? "" : "s"} left`;
  if (watch.phase === "regular") {
    const last = watch.rows[0];
    return last ? { people: [last.nickname], note: weeks } : { people: [], note: weeks };
  }
  const round = watch.ladder.at(-1);
  const game = round?.games.at(-1);
  if (!round || !game) return { people: [], note: "The pancake ladder starts next week" };
  // In the ladder's last week, ESPN lists the last-place game last (every season, 2017–2025)
  if (!game.away) return { people: [name(game.home.person)], note: watch.final ? "A bye in the last week: last place" : weeks };
  const loser = game.winner === "HOME" ? game.away : game.winner === "AWAY" ? game.home : null;
  if (watch.final && loser) return { people: [name(loser.person)], note: "Lost the pancake game: last place" };
  return { people: [name(game.home.person), name(game.away.person)], note: watch.final ? "The pancake game: the loser finishes last" : weeks };
}

// A red light, pulsing unless the visitor asked for less motion
export function RedLight({ className = "" }: { className?: string }) {
  return (
    <span className={`relative flex h-2.5 w-2.5 shrink-0 ${className}`} aria-hidden>
      <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 motion-safe:animate-ping" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
    </span>
  );
}

// "34%"; under half a percent "<1%"; a team that can't finish last any more "0%", in green
function chance(r: WatchRow) {
  if (r.safe) return "0%";
  const p = Math.round(r.chance * 100);
  return r.chance > 0 && p === 0 ? "<1%" : r.chance < 1 && p === 100 ? ">99%" : `${p}%`;
}

// Opened (Round 8): "7 weeks left", then one row per team below the playoff line, last place first
// and largest (its W-L and chance as large as its name since Round 9), each with its chance of
// finishing last, and the playoff line under a dashed rule.
// After the regular season, the ladder's teams, most likely first, and the ladder itself.
export function PancakeWatchView({ watch, name }: { watch: Watch; name: (slug: string) => string }) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900 px-4 py-5 sm:px-6">
      <div className="text-center text-base text-zinc-300">
        {watch.weeksLeft} week{watch.weeksLeft === 1 ? "" : "s"} left
      </div>
      <ol className="mt-3 divide-y divide-zinc-800">
        {watch.rows.map((r, i) => (
          <Row key={r.person} r={r} big={i === 0 && !r.safe} />
        ))}
      </ol>
      {watch.phase === "regular" ? (
        <div className="mt-2 border-t border-dashed border-zinc-700 pt-3 text-zinc-500">
          <div className="text-sm">
            Playoff line: {watch.line.seed}. {watch.line.nickname} {record(watch.line)}
            {(watch.line.chance > 0 || watch.line.safe) && <span className={watch.line.safe ? "text-emerald-400" : ""}> · {chance(watch.line)}</span>}
          </div>
          {watch.above.length > 0 && (
            <div className="mt-1 text-xs">
              Above the line: {watch.above.map((r) => `${r.nickname} ${chance(r)}`).join(" · ")}
            </div>
          )}
          <p className="mt-2 text-[11px] leading-snug">
            Miss the top {watch.playoffTeams} and you play in the pancake ladder, where last place takes the pancakes.{" "}
            {watch.regularLeft} regular-season week{watch.regularLeft === 1 ? "" : "s"} left. % is the chance of finishing last, from
            ESPN&apos;s projections.
          </p>
        </div>
      ) : (
        <div className="mt-2 border-t border-dashed border-zinc-700 pt-3">
          <p className="mb-3 text-[11px] leading-snug text-zinc-500">
            The teams that missed the playoffs play for last place; the last game&apos;s loser takes the pancakes. % is the chance of
            finishing last, from ESPN&apos;s projections.
          </p>
          {watch.ladder.length > 0 && <Bracket rounds={watch.ladder} name={name} />}
        </div>
      )}
    </div>
  );
}

// The W-L sits in the middle of the card (the site owner, Round 10): the name and the chance take
// equal columns on either side, so every row's record lines up at the center
function Row({ r, big }: { r: WatchRow; big: boolean }) {
  const tone = r.safe ? "text-emerald-400" : big ? "text-red-500" : "text-zinc-50";
  return (
    <li>
      <Link href={`/teams/${r.person}`} className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-baseline gap-2 hover:opacity-90 ${big ? "py-3" : "py-2.5"}`}>
        <span className="flex min-w-0 items-baseline gap-2">
          <span className={`shrink-0 text-right tabular-nums ${big ? "w-9 text-2xl text-red-500" : `w-9 text-base ${r.safe ? "text-emerald-600" : "text-zinc-500"}`}`}>
            {r.seed}.
          </span>
          <span className={`min-w-0 truncate font-semibold ${tone} ${big ? "text-2xl" : "text-lg"}`}>{r.nickname}</span>
        </span>
        <span className={`w-[4.5rem] text-center tabular-nums ${big ? "text-2xl" : "text-base"} ${r.safe ? "text-emerald-400" : "text-zinc-200"}`}>{record(r)}</span>
        <span className={`text-right tabular-nums ${big ? "text-2xl font-semibold text-red-500" : r.safe ? "text-emerald-400" : "text-zinc-400"}`}>
          {chance(r)}
        </span>
      </Link>
    </li>
  );
}
