import { Suspense } from "react";
import { PageTitle } from "@/components/ui";
import { RecordsView, type RecordCard, type RecordEntry, type RecordSet } from "@/components/RecordsView";
import { pts, record, score } from "@/lib/format";
import {
  BLOWOUT_OVER,
  CLOSE_UNDER,
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

// The win records add up the winning margins, the loss records the losing ones
const MARGIN_RECORDS: Record<string, { kind: "close" | "blowout"; wins: boolean; label: string }> = {
  "blowout-wins": { kind: "blowout", wins: true, label: "blowouts" },
  "blowout-losses": { kind: "blowout", wins: false, label: "blowouts" },
  "close-wins": { kind: "close", wins: true, label: "close games" },
  "close-losses": { kind: "close", wins: false, label: "close games" },
};

const plusMinus =(n: number, digits = 1) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(digits)}`;

function seasonEntry(league: League, def: RecordDef<SeasonRecordEntry>, { teamSeason: t, value }: SeasonRecordEntry): RecordEntry {
  const who = managerBySlug(league, t.person)!.nickname;
  // Odds: wins above or below what ESPN's projections expected (Round 5)
  if (def.unit === "odds") {
    const projected = t.projectedWins!;
    const wins = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
    return {
      who,
      value: `${plusMinus(value, Number.isInteger(value) ? 0 : 1)} wins`,
      detail: `${t.season} · ${t.teamName} · ${record(t.all)}, ESPN projected ${wins(projected)}-${wins(t.all.games - projected)}`,
    };
  }
  // Close games and blowouts (Round 7): the season's W-L in them and the margins added up, which
  // break ties, before the team name so a phone's truncated rows still show them
  const margin = MARGIN_RECORDS[def.key];
  if (margin) {
    const split = t[margin.kind];
    const by = margin.wins ? split.wonBy : split.lostBy;
    return {
      who,
      value: `${value} ${value === 1 ? SINGULAR[def.unit] : def.unit}`,
      detail: `${t.season} · ${record(split)} in ${margin.label}, by ${pts(by)} total · ${t.teamName}`,
    };
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
        Season projection: in each game, ESPN&apos;s favorite was the starting lineup with the higher projected score, so a team was
        projected to win the games it was favored in. ESPN has projections from 2018 on (none for 2017). Bench: each
        week&apos;s best possible lineup minus the one started, from ESPN&apos;s lineups for 2018 on (2017 lists starters only).
        A close game is decided by under {CLOSE_UNDER} points and a blowout by more than {BLOWOUT_OVER}. Ties in those records go to
        the smaller margins added up (close games) or the bigger ones (blowouts).
      </p>
    </>
  );
}
