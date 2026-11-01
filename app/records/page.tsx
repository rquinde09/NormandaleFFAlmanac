import { Suspense } from "react";
import { PageTitle } from "@/components/ui";
import { RecordsView, type RecordCard, type RecordEntry } from "@/components/RecordsView";
import { pts, record, score } from "@/lib/format";
import {
  gameRecords,
  getLeague,
  managerBySlug,
  seasonRecords,
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

function seasonEntry(league: League, def: RecordDef<SeasonRecordEntry>, { teamSeason: t, value }: SeasonRecordEntry): RecordEntry {
  const isPoints = def.unit === "pts";
  return {
    who: managerBySlug(league, t.person)!.nickname,
    value: isPoints ? `${pts(value)} pts` : `${value} ${value === 1 ? SINGULAR[def.unit] ?? def.unit : def.unit}`,
    detail: `${t.season} · ${t.teamName} · ${record(t.all)}`,
  };
}

function toCard<E>(def: RecordDef<E>, entry: (e: E) => RecordEntry): RecordCard {
  const [first, ...rest] = def.entries.map(entry);
  return { key: def.key, title: def.title, subtitle: def.subtitle, holder: first, rest };
}

export default function RecordsPage() {
  const league = getLeague();
  const game = gameRecords(league).map((d) => toCard(d, (e) => gameEntry(league, d.key, e)));
  const season = seasonRecords(league).map((d) => toCard(d, (e) => seasonEntry(league, d, e)));
  return (
    <>
      <PageTitle sub="Every game since 2017 counts. Season records use completed seasons only.">Records</PageTitle>
      <Suspense>
        <RecordsView game={game} season={season} />
      </Suspense>
    </>
  );
}
