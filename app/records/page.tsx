import { Suspense } from "react";
import { PageTitle } from "@/components/ui";
import { RecordsView, type RecordCard, type RecordEntry, type RecordSet } from "@/components/RecordsView";
import { pts, record, score } from "@/lib/format";
import {
  benchRecords,
  gameRecords,
  getLeague,
  managerBySlug,
  seasonRecords,
  type BenchRecordEntry,
  type Game,
  type GameRecordEntry,
  type League,
  type RecordDef,
  type SeasonRecordEntry,
} from "@/lib/league";

export const metadata = { title: "Records" };

const SINGULAR: Record<string, string> = { wins: "win", losses: "loss", trades: "trade" };
const KIND_LABEL ={ regular: "", playoff: " · playoffs", placement: " · placement", consolation: " · consolation" };
const when = (g: Game) => `${g.season} week ${g.week}${KIND_LABEL[g.kind]}`;

function gameEntry(league: League, key: string, { game: g, value }: GameRecordEntry): RecordEntry {
  const name = (slug: string) => managerBySlug(league, slug)!.nickname;
  const [winner, loser] = g.winner === "AWAY" ? [g.away, g.home] : [g.home, g.away];
  if (key === "blowout" || key === "closest") {
    return {
      who: `${name(winner.person)} def. ${name(loser.person)}`,
      value: `${score(value)} pts`,
      detail: `${score(winner.points)}–${score(loser.points)} · ${when(g)}`,
    };
  }
  if (key === "highest-total" || key === "lowest-total") {
    return {
      who: `${name(g.home.person)} vs ${name(g.away.person)}`,
      value: `${score(value)} pts`,
      detail: `${score(g.home.points)}–${score(g.away.points)} · ${when(g)}`,
    };
  }
  // Single-team scores: the holder is on the home side
  return {
    who: name(g.home.person),
    value: `${score(value)} pts`,
    detail: `vs ${name(g.away.person)} · ${when(g)}`,
  };
}

// The bench records: the holder is on the home side
function benchEntry(league: League, { game: g, bench: b, value }: BenchRecordEntry): RecordEntry {
  const name = (slug: string) => managerBySlug(league, slug)!.nickname;
  const result = g.winner === "HOME" ? "Won" : g.winner === "AWAY" ? "Lost" : "Tied";
  return {
    who: name(g.home.person),
    value: `${score(value)} pts`,
    detail: `${result} ${score(g.home.points)}–${score(g.away.points)}, best lineup ${score(b.best)} · vs ${name(g.away.person)} · ${when(g)}`,
  };
}

const plusMinus = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}`;

function seasonEntry(league: League, def: RecordDef<SeasonRecordEntry>, { teamSeason: t, value }: SeasonRecordEntry): RecordEntry {
  const who = managerBySlug(league, t.person)!.nickname;
  if (def.unit === "luck") {
    return { who, value: `${plusMinus(value)} wins`, detail: `${t.season} · ${t.teamName} · ${record(t.all)}, ${t.expectedWins.toFixed(1)} wins expected` };
  }
  const isPoints = def.unit === "pts";
  return {
    who,
    value: isPoints ? `${pts(value)} pts` : `${value} ${value === 1 ? SINGULAR[def.unit] ?? def.unit : def.unit}`,
    detail: `${t.season} · ${t.teamName} · ${record(t.all)}`,
  };
}

function toCard<E>(def: RecordDef<E>, entry: (e: E) => RecordEntry): RecordCard {
  const [first, ...rest] = def.entries.map(entry);
  return { key: def.key, title: def.title, subtitle: def.subtitle, holder: first ?? null, rest };
}

function recordSet(league: League, counts?: (person: string) => boolean): RecordSet {
  return {
    game: [
      ...gameRecords(league, 5, counts).map((d) => toCard(d, (e) => gameEntry(league, d.key, e))),
      ...benchRecords(league, 5, counts).map((d) => toCard(d, (e) => benchEntry(league, e))),
    ],
    season: seasonRecords(league, 5, counts).map((d) => toCard(d, (e) => seasonEntry(league, d, e))),
  };
}

export default function RecordsPage() {
  const league = getLeague();
  const active = new Set(league.managers.filter((m) => m.active).map((m) => m.slug));
  return (
    <>
      <PageTitle sub="Every game since 2017 counts. Season records use completed seasons only. With Active on, game records count only games between two active managers.">
        Records
      </PageTitle>
      <Suspense>
        <RecordsView all={recordSet(league)} active={recordSet(league, (p) => active.has(p))} />
      </Suspense>
      <p className="mt-4 text-xs text-zinc-500">
        Expected wins: each week, the share of the league a team outscored, added up over the season. Bench: each week&apos;s
        best possible lineup minus the one started, from ESPN&apos;s lineups for 2018–2025 (none for 2021, and 2017 lists starters
        only).
      </p>
    </>
  );
}
