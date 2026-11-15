import Link from "next/link";
import { Bracket } from "@/components/Bracket";
import { Card, SectionLabel } from "@/components/ui";
import { record } from "@/lib/format";
import type { PancakeWatch as Watch, WatchRow } from "@/lib/seasons";

// The home page's race for last place while a season is on (Luke, 2026-11-15): during the regular
// season, everyone outside the playoff spots, worst first; after it, the pancake ladder itself.
export function PancakeWatch({ watch, name }: { watch: Watch; name: (slug: string) => string }) {
  return (
    <section>
      <SectionLabel>Pancake Watch 🥞</SectionLabel>
      <Card>
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
          <p className="text-sm text-zinc-400">The regular season is over. The pancake ladder starts next week.</p>
        )}
        <Link href={`/seasons/${watch.season}`} className="mt-3 block text-sm text-zinc-300 underline-offset-2 hover:underline">
          {watch.season} standings and brackets →
        </Link>
      </Card>
    </section>
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
