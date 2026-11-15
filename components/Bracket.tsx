import Link from "next/link";
import { score } from "@/lib/format";
import type { BracketEntry, BracketSide } from "@/lib/league";
import type { Round } from "@/lib/seasons";

// Rounds side by side on a wide screen (later rounds centered between earlier ones, like a
// bracket), stacked on a phone. `mark` puts an icon after one person's name in the last round: the
// champion's star, or the pancakes for last place.
export function Bracket({
  rounds,
  name,
  mark,
}: {
  rounds: Round[];
  name: (slug: string) => string;
  mark?: { person: string; icon: string };
}) {
  const cols = rounds.length >= 3 ? "md:grid-cols-3" : rounds.length === 2 ? "md:grid-cols-2" : "";
  return (
    <div className={`grid gap-4 ${cols}`}>
      {rounds.map((r, i) => (
        <section key={r.week} className="flex flex-col">
          <div className="mb-1.5 text-xs font-medium text-zinc-400">
            {r.label}
            {r.label !== `Week ${r.week}` && <span className="text-zinc-600"> · week {r.week}</span>}
          </div>
          <ul className="flex flex-1 flex-col justify-around gap-2">
            {r.games.map((g) => (
              <li key={`${g.home.teamId}-${g.away?.teamId ?? "bye"}`}>
                <Matchup g={g} name={name} mark={i === rounds.length - 1 ? mark : undefined} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Matchup({ g, name, mark }: { g: BracketEntry; name: (slug: string) => string; mark?: { person: string; icon: string } }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/40 text-sm">
      <Line side={g.home} result={g.winner === null ? null : g.winner === "HOME"} name={name} mark={mark} />
      {g.away ? (
        <Line side={g.away} result={g.winner === null ? null : g.winner === "AWAY"} name={name} mark={mark} />
      ) : (
        <div className="border-t border-zinc-800 px-3 py-1.5 text-xs text-zinc-500">Bye</div>
      )}
    </div>
  );
}

// `result`: true for the winner, false for the loser, null before the game (or on a bye)
function Line({
  side,
  result,
  name,
  mark,
}: {
  side: BracketSide;
  result: boolean | null;
  name: (slug: string) => string;
  mark?: { person: string; icon: string };
}) {
  return (
    <Link
      href={`/teams/${side.person}`}
      className={`flex items-baseline gap-2 border-zinc-800 px-3 py-1.5 not-first:border-t hover:bg-zinc-800/50 ${
        result === false ? "text-zinc-500" : "text-zinc-100"
      }`}
    >
      <span className="w-4 shrink-0 text-right text-xs tabular-nums text-zinc-500">{side.seed}</span>
      <span className={`min-w-0 flex-1 truncate ${result ? "font-semibold" : ""}`}>
        {name(side.person)}
        {mark?.person === side.person && <span className="ml-1">{mark.icon}</span>}
      </span>
      {result !== null && <span className={`shrink-0 tabular-nums ${result ? "font-semibold" : ""}`}>{score(side.points)}</span>}
    </Link>
  );
}
