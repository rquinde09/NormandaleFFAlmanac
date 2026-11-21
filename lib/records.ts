// What the Records page and the record-break news posts say about each record: its sections, and
// each entry's holder, number and details. The records themselves are counted in lib/league.ts.
import { pts, record, score } from "@/lib/format";
import {
  gameRecords,
  leagueRecords,
  lineupRecords,
  managerBySlug,
  seasonRecords,
  type Game,
  type GameRecordEntry,
  type League,
  type LeagueRecordEntry,
  type LineupRecordEntry,
  type RecordDef,
  type SeasonRecordEntry,
} from "@/lib/league";

export type RecordEntry = {
  holder: string; // who holds it, by first name: "Luke", or "Robel and Randy" for a game total
  who: string; // the line under the number: "Luke def. Suny"
  value: string; // "115.66 pts"
  detail: string; // "193.18–77.52 · 2018 week 12"
  short: string; // the detail on a phone's small card
};
export type RecordCard = {
  key: string;
  title: string;
  subtitle: string;
  brief: string; // the description on a phone's small card: none on the match-up records
  holder: RecordEntry | null;
  rest: RecordEntry[];
};
export type RecordSection = { title: string; cards: RecordCard[] };
export type RecordTab = "game" | "season" | "league";
export type RecordSet = Record<RecordTab, RecordSection[]>;

// The site owner's Round 8 sections (2026-11-20). The match-up cards carry no description in his
// mockup, so `subtitle` is blank there on a phone's small cards.
export const SECTIONS: Record<RecordTab, { title: string; keys: string[] }[]> = {
  game: [
    { title: "Match Up Records", keys: ["blowout", "closest", "highest-total", "lowest-total"] },
    { title: "Individual Records", keys: ["highest-score", "lowest-score", "bench-game", "one-hit"] },
  ],
  season: [
    { title: "Result Records", keys: ["best", "win-streak", "worst", "loss-streak"] },
    { title: "Point Records", keys: ["most-pf", "most-pa", "least-pa", "bench-season"] },
    { title: "Playcall Records", keys: ["trades", "luckiest", "unluckiest"] },
  ],
  league: [{ title: "League Records", keys: ["blowout-wins", "blowout-losses", "close-wins", "close-losses"] }],
};
export const MATCH_UP = new Set(SECTIONS.game[0].keys);

const SINGULAR: Record<string, string> = { wins: "win", losses: "loss", trades: "trade" };
const KIND_LABEL = { regular: "", playoff: " · playoffs", placement: " · placement", consolation: " · consolation" };
export const when = (g: Game) => `${g.season} week ${g.week}${KIND_LABEL[g.kind]}`;
const plusMinus = (n: number, digits = 1) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(digits)}`;
const count = (n: number, unit: string) => `${n} ${n === 1 ? (SINGULAR[unit] ?? unit) : unit}`;

export function gameEntry(league: League, key: string, { game: g, value }: GameRecordEntry): RecordEntry {
  const name = (slug: string) => managerBySlug(league, slug)!.nickname;
  const [winner, loser] = g.winner === "AWAY" ? [g.away, g.home] : [g.home, g.away];
  if (key === "blowout" || key === "closest") {
    const detail = `${score(winner.points)}–${score(loser.points)} · ${when(g)}`;
    return { holder: name(winner.person), who: `${name(winner.person)} def. ${name(loser.person)}`, value: `${score(value)} pts`, detail, short: detail };
  }
  if (key === "highest-total" || key === "lowest-total") {
    const detail = `${score(g.home.points)}–${score(g.away.points)} · ${when(g)}`;
    return { holder: `${name(g.home.person)} and ${name(g.away.person)}`, who: `${name(g.home.person)} vs ${name(g.away.person)}`, value: `${score(value)} pts`, detail, short: detail };
  }
  // Single-team scores: the holder is on the home side
  const detail = `vs ${name(g.away.person)} · ${when(g)}`;
  return { holder: name(g.home.person), who: name(g.home.person), value: `${score(value)} pts`, detail, short: detail };
}

// Riding the Pine and The One Hit Wonder: the holder is on the home side
export function lineupEntry(league: League, { game: g, bench: b, player, value }: LineupRecordEntry): RecordEntry {
  const name = (slug: string) => managerBySlug(league, slug)!.nickname;
  const who = name(g.home.person);
  if (player) {
    return {
      holder: who,
      who,
      value: `${score(value)} pts`,
      detail: `${player.name}, projected ${score(player.projected)} · vs ${name(g.away.person)} · ${when(g)}`,
      short: `${player.name} · ${g.season} week ${g.week}`,
    };
  }
  const result = g.winner === "HOME" ? "Won" : g.winner === "AWAY" ? "Lost" : "Tied";
  return {
    holder: who,
    who,
    value: `${score(value)} pts`,
    detail: `${result} ${score(g.home.points)}–${score(g.away.points)}, best lineup ${score(b!.best)} · vs ${name(g.away.person)} · ${when(g)}`,
    short: `vs ${name(g.away.person)} · ${when(g)}`,
  };
}

export function seasonEntry(league: League, def: RecordDef<SeasonRecordEntry>, { teamSeason: t, value }: SeasonRecordEntry): RecordEntry {
  const who = managerBySlug(league, t.person)!.nickname;
  // Odds: wins above or below what ESPN's projections expected (Round 5)
  if (def.unit === "odds") {
    const projected = t.projectedWins!;
    const wins = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
    const vs = `${record(t.all)}, ESPN projected ${wins(projected)}-${wins(t.all.games - projected)}`;
    return { holder: who, who, value: `${plusMinus(value, Number.isInteger(value) ? 0 : 1)} wins`, detail: `${t.season} · ${t.teamName} · ${vs}`, short: `${t.season} · ${vs}` };
  }
  return {
    holder: who,
    who,
    value: def.unit === "pts" ? `${pts(value)} pts` : count(value, def.unit),
    detail: `${t.season} · ${t.teamName} · ${record(t.all)}`,
    short: `${t.season} · ${record(t.all)}`,
  };
}

// All-time close games and blowouts: the career W-L in them, with the margins added up (which break
// ties) before the seasons, so a phone's truncated rows still show them
export function leagueEntry(league: League, def: RecordDef<LeagueRecordEntry>, { person, split, value }: LeagueRecordEntry): RecordEntry {
  const who = managerBySlug(league, person)!.nickname;
  const label = def.key.startsWith("close") ? "close games" : "blowouts";
  const by = def.key.endsWith("wins") ? split.wonBy : split.lostBy;
  return {
    holder: who,
    who,
    value: count(value, def.unit),
    detail: `${record(split)} in ${label}, by ${pts(by)} total · ${split.seasons} season${split.seasons === 1 ? "" : "s"}`,
    short: `${record(split)} in ${label} · ${split.seasons} season${split.seasons === 1 ? "" : "s"}`,
  };
}

function toCard<E>(def: RecordDef<E>, entry: (e: E) => RecordEntry): RecordCard {
  const [first, ...rest] = def.entries.map(entry);
  return { key: def.key, title: def.title, subtitle: def.subtitle, brief: MATCH_UP.has(def.key) ? "" : def.subtitle, holder: first ?? null, rest };
}

// Every record as cards, in the site owner's sections. `counts` limits them to the Active managers.
export function recordSet(league: League, counts?: (person: string) => boolean): RecordSet {
  const cards = [
    ...gameRecords(league, 5, counts).map((d) => toCard(d, (e) => gameEntry(league, d.key, e))),
    ...lineupRecords(league, 5, counts).map((d) => toCard(d, (e) => lineupEntry(league, e))),
    ...seasonRecords(league, 5, counts).map((d) => toCard(d, (e) => seasonEntry(league, d, e))),
    ...leagueRecords(league, 5, counts).map((d) => toCard(d, (e) => leagueEntry(league, d, e))),
  ];
  const byKey = new Map(cards.map((c) => [c.key, c]));
  const sections = (tab: RecordTab) => SECTIONS[tab].map((s) => ({ title: s.title, cards: s.keys.map((k) => byKey.get(k)!) }));
  return { game: sections("game"), season: sections("season"), league: sections("league") };
}
