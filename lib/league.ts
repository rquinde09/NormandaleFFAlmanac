// League data for the site, read at build time from data/raw/*.json and data/managers.json.
// The counting rules live in CLAUDE.md; scripts/check-data.ts checks them against the old Sheet.
import fs from "node:fs";
import path from "node:path";
import type { Career } from "@/lib/standings";

const DATA_DIR = path.join(process.cwd(), "data");

export type Kind = "regular" | "playoff" | "placement" | "consolation";

const KINDS: Record<string, Kind> = {
  NONE: "regular",
  WINNERS_BRACKET: "playoff",
  WINNERS_CONSOLATION_LADDER: "placement",
  LOSERS_CONSOLATION_LADDER: "consolation",
};

export type Manager = {
  slug: string;
  name: string; // full name: matches the Sheet copies in `npm run check`, never shown on the site
  nickname: string; // the first name the site shows
  active: boolean;
  espnIds: string[];
};

export type Side = { person: string; teamId: number; points: number };

export type Game = {
  season: number;
  week: number;
  kind: Kind;
  home: Side;
  away: Side;
  winner: "HOME" | "AWAY" | "TIE";
};

export type Totals = { w: number; l: number; t: number; pf: number; pa: number; games: number };

export type TeamSeason = {
  season: number;
  person: string;
  teamId: number;
  teamName: string;
  seed: number;
  finalRank: number | null; // null while the season is in progress
  lastPlace: boolean; // finished last of the season's teams: the pancake
  regular: Totals; // ESPN's own record: regular season only
  all: Totals; // every decided game, the site's counting rule
  trades: number;
  longestWinStreak: number;
  longestLossStreak: number;
};

export type SeasonInfo = {
  season: number;
  teams: number;
  regularWeeks: number;
  weeks: number; // every matchup period, playoffs included
  complete: boolean;
  throughWeek: number; // last week with a decided game
  share: number; // how much of the season has been played: 1 once complete, else throughWeek / weeks
};

export type League = {
  managers: Manager[];
  seasons: SeasonInfo[];
  teamSeasons: TeamSeason[];
  games: Game[];
  updatedAt: string | null;
};

// Only the fields the site reads.
type RawSide = { teamId: number; totalPoints: number };
type RawGame = {
  matchupPeriodId: number;
  playoffTierType?: string;
  winner: string;
  home: RawSide;
  away?: RawSide;
};
type RawTeam = {
  id: number;
  name?: string;
  location?: string;
  nickname?: string;
  owners?: string[];
  playoffSeed: number;
  rankCalculatedFinal?: number;
  rankFinal?: number;
  transactionCounter?: { trades?: number };
};
type RawSeason = {
  seasonId: number;
  teams: RawTeam[];
  schedule: RawGame[];
  // matchupPeriods lists every period of the season, even ones not yet on the schedule
  settings: { scheduleSettings: { matchupPeriodCount: number; matchupPeriods: Record<string, number[]> } };
};

const norm = (id: string) => id.trim().replace(/^\{|\}$/g, "").toUpperCase();

export const emptyTotals = (): Totals => ({ w: 0, l: 0, t: 0, pf: 0, pa: 0, games: 0 });

export function addGame(totals: Totals, scored: number, allowed: number, result: "W" | "L" | "T") {
  totals.games += 1;
  totals.pf += scored;
  totals.pa += allowed;
  if (result === "W") totals.w += 1;
  else if (result === "L") totals.l += 1;
  else totals.t += 1;
}

export const winPct = (t: Totals) => (t.games ? (t.w + t.t / 2) / t.games : 0);

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function teamName(team: RawTeam) {
  return (team.name || `${team.location ?? ""} ${team.nickname ?? ""}`).trim() || `Team ${team.id}`;
}

function longestRun(results: string[], target: string) {
  let best = 0;
  let run = 0;
  for (const r of results) {
    run = r === target ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

let cached: League | null = null;

export function getLeague(): League {
  if (cached) return cached;

  const managers = readJson<Manager[]>(path.join(DATA_DIR, "managers.json"));
  const personById = new Map<string, string>();
  for (const m of managers) for (const id of m.espnIds) personById.set(norm(id), m.slug);

  const rawDir = path.join(DATA_DIR, "raw");
  const raw = fs
    .readdirSync(rawDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => readJson<RawSeason>(path.join(rawDir, f)));

  const seasons: SeasonInfo[] = [];
  const teamSeasons: TeamSeason[] = [];
  const games: Game[] = [];

  for (const s of raw) {
    // Each team-season goes to the one person in managers.json among its owner IDs.
    const credit = new Map<number, string>();
    for (const team of s.teams) {
      const people = new Set(
        (team.owners ?? []).map((o) => personById.get(norm(o))).filter((p): p is string => !!p),
      );
      if (people.size !== 1) {
        const problem = people.size ? `several people (${[...people].join(", ")})` : "no owner in managers.json";
        throw new Error(`${s.seasonId} team #${team.id}: ${problem}`);
      }
      credit.set(team.id, [...people][0]);
    }

    const regularWeeks = s.settings.scheduleSettings.matchupPeriodCount;
    const real = s.schedule.filter((g) => g.away); // entries without an away side are byes
    const decided = real.filter((g) => g.winner === "HOME" || g.winner === "AWAY" || g.winner === "TIE");
    const complete = decided.length === real.length && real.some((g) => g.matchupPeriodId > regularWeeks);

    const seasonGames: Game[] = decided
      .map((g) => ({
        season: s.seasonId,
        week: g.matchupPeriodId,
        kind: KINDS[g.playoffTierType ?? "NONE"],
        home: { person: credit.get(g.home.teamId)!, teamId: g.home.teamId, points: g.home.totalPoints },
        away: { person: credit.get(g.away!.teamId)!, teamId: g.away!.teamId, points: g.away!.totalPoints },
        winner: g.winner as Game["winner"],
      }))
      .sort((a, b) => a.week - b.week);
    games.push(...seasonGames);

    const weeks = Object.keys(s.settings.scheduleSettings.matchupPeriods).length;
    const throughWeek = Math.max(0, ...seasonGames.map((g) => g.week));
    seasons.push({
      season: s.seasonId,
      teams: s.teams.length,
      regularWeeks,
      weeks,
      complete,
      throughWeek,
      share: complete ? 1 : Math.min(1, throughWeek / weeks),
    });

    for (const team of s.teams) {
      const regular = emptyTotals();
      const all = emptyTotals();
      const results: string[] = [];
      for (const g of seasonGames) {
        const side = g.home.teamId === team.id ? "home" : g.away.teamId === team.id ? "away" : null;
        if (!side) continue;
        const other = side === "home" ? "away" : "home";
        const result = g.winner === "TIE" ? "T" : g.winner === side.toUpperCase() ? "W" : "L";
        addGame(all, g[side].points, g[other].points, result);
        if (g.kind === "regular") addGame(regular, g[side].points, g[other].points, result);
        results.push(result);
      }
      const finalRank = complete ? (team.rankCalculatedFinal || team.rankFinal || null) : null;
      teamSeasons.push({
        season: s.seasonId,
        person: credit.get(team.id)!,
        teamId: team.id,
        teamName: teamName(team),
        seed: team.playoffSeed,
        finalRank,
        lastPlace: finalRank === s.teams.length,
        regular,
        all,
        trades: team.transactionCounter?.trades ?? 0,
        longestWinStreak: longestRun(results, "W"),
        longestLossStreak: longestRun(results, "L"),
      });
    }
  }

  const metaFile = path.join(DATA_DIR, "meta.json");
  const updatedAt = fs.existsSync(metaFile) ? readJson<{ updatedAt: string }>(metaFile).updatedAt : null;

  cached = { managers, seasons, teamSeasons, games, updatedAt };
  return cached;
}

export const latestSeason = (league: League) => league.seasons[league.seasons.length - 1];

export function managerBySlug(league: League, slug: string) {
  return league.managers.find((m) => m.slug === slug);
}

export function titles(league: League, person: string) {
  return league.teamSeasons.filter((ts) => ts.person === person && ts.finalRank === 1).map((ts) => ts.season);
}

// Career totals per person over every decided game through `through` (default: everything, live).
export function careerTotals(league: League, through?: number) {
  const share = new Map(league.seasons.map((s) => [s.season, s.share]));
  const totals = new Map<string, Career>();
  for (const ts of league.teamSeasons) {
    if (through !== undefined && ts.season > through) continue;
    const row = totals.get(ts.person) ?? { ...emptyTotals(), seasons: 0, seasonWeight: 0, titles: 0, lastPlaces: 0, trades: 0 };
    row.w += ts.all.w;
    row.l += ts.all.l;
    row.t += ts.all.t;
    row.pf += ts.all.pf;
    row.pa += ts.all.pa;
    row.games += ts.all.games;
    row.seasons += 1;
    row.seasonWeight += share.get(ts.season) ?? 1;
    row.trades += ts.trades;
    if (ts.finalRank === 1) row.titles += 1;
    if (ts.lastPlace) row.lastPlaces += 1;
    totals.set(ts.person, row);
  }
  return totals;
}

// Each person's career for the standings page, live (`now`) and at the end of the previous
// season (`prev`, for Rank Δ). All three views count the season in progress. The site shows
// first names only (the site owner, 2026-11-14), so the full name isn't sent to the page.
export type StandingsRow = {
  slug: string;
  nickname: string;
  active: boolean;
  now: Career;
  prev: Career | null;
};

export function standingsRows(league: League): StandingsRow[] {
  const latest = latestSeason(league).season;
  const now = careerTotals(league);
  const prev = careerTotals(league, latest - 1);
  return league.managers
    .filter((m) => now.has(m.slug))
    .map((m) => ({
      slug: m.slug,
      nickname: m.nickname,
      active: m.active,
      now: now.get(m.slug)!,
      prev: prev.get(m.slug) ?? null,
    }));
}

// ---- Records (the old site's names) ----

export type GameRecordEntry = { game: Game; value: number };
export type SeasonRecordEntry = { teamSeason: TeamSeason; value: number };

export type RecordDef<E> = {
  key: string;
  title: string;
  subtitle: string;
  entries: E[];
  unit: string;
};

const margin = (g: Game) => Math.abs(g.home.points - g.away.points);
const total = (g: Game) => g.home.points + g.away.points;

// `counts` limits the lists to certain people (the Active only switch): a game counts only when
// both its managers do, so a record set against a retired manager drops out (the site owner,
// 2026-11-07). A margin record belongs to the winner, a game total to both managers, a score to
// whoever scored it.
export function gameRecords(league: League, top = 5, counts: (person: string) => boolean = () => true): RecordDef<GameRecordEntry>[] {
  const g = league.games.filter((x) => counts(x.home.person) && counts(x.away.person));
  const by = (value: (x: Game) => number, desc: boolean) =>
    g
      .map((game) => ({ game, value: value(game) }))
      .sort((a, b) => (desc ? b.value - a.value : a.value - b.value))
      .slice(0, top);
  const sides = g.flatMap((game) => [
    { game, side: game.home, value: game.home.points },
    { game, side: game.away, value: game.away.points },
  ]);
  const bySide = (desc: boolean) =>
    [...sides]
      .sort((a, b) => (desc ? b.value - a.value : a.value - b.value))
      .slice(0, top)
      // Put the record holder on the home side so the entry reads "holder vs opponent"
      .map(({ game, side, value }) => ({
        game: side === game.home ? game : { ...game, home: game.away, away: game.home, winner: flip(game.winner) },
        value,
      }));
  return [
    { key: "blowout", title: "The @$$-Whooping", subtitle: "Biggest point difference", entries: by(margin, true), unit: "pts" },
    { key: "closest", title: "The Clincher", subtitle: "Closest point difference", entries: by(margin, false), unit: "pts" },
    { key: "highest-total", title: "Clash of Titans", subtitle: "Highest game total", entries: by(total, true), unit: "pts" },
    { key: "lowest-total", title: "The Snooze Fest", subtitle: "Lowest game total", entries: by(total, false), unit: "pts" },
    { key: "highest-score", title: "Mr. Clean", subtitle: "Most points scored", entries: bySide(true), unit: "pts" },
    { key: "lowest-score", title: "The Vega", subtitle: "Fewest points scored", entries: bySide(false), unit: "pts" },
  ];
}

const flip = (w: Game["winner"]): Game["winner"] => (w === "HOME" ? "AWAY" : w === "AWAY" ? "HOME" : "TIE");

// Season records count completed seasons only, so a half-played season can't hold "fewest points against".
export function seasonRecords(league: League, top = 5, counts: (person: string) => boolean = () => true): RecordDef<SeasonRecordEntry>[] {
  const complete = new Set(league.seasons.filter((s) => s.complete).map((s) => s.season));
  const rows = league.teamSeasons.filter((ts) => complete.has(ts.season) && counts(ts.person));
  const pick = (value: (ts: TeamSeason) => number, compare: (a: TeamSeason, b: TeamSeason) => number) =>
    [...rows].sort(compare).slice(0, top).map((teamSeason) => ({ teamSeason, value: value(teamSeason) }));
  return [
    { key: "best", title: "The Special One", subtitle: "Most wins in a season", unit: "wins",
      entries: pick((t) => t.all.w, (a, b) => b.all.w - a.all.w || b.all.pf - a.all.pf) },
    { key: "worst", title: "Below Zero", subtitle: "Fewest wins in a season", unit: "wins",
      entries: pick((t) => t.all.w, (a, b) => a.all.w - b.all.w || a.all.pf - b.all.pf) },
    { key: "most-pf", title: "The Warrior", subtitle: "Most points for", unit: "pts",
      entries: pick((t) => t.all.pf, (a, b) => b.all.pf - a.all.pf) },
    { key: "most-pa", title: "The Baby Zebra", subtitle: "Most points against", unit: "pts",
      entries: pick((t) => t.all.pa, (a, b) => b.all.pa - a.all.pa) },
    { key: "least-pa", title: "The Lucky One", subtitle: "Fewest points against", unit: "pts",
      entries: pick((t) => t.all.pa, (a, b) => a.all.pa - b.all.pa) },
    { key: "win-streak", title: "The Relentless", subtitle: "Longest winning streak", unit: "wins",
      entries: pick((t) => t.longestWinStreak, (a, b) => b.longestWinStreak - a.longestWinStreak) },
    { key: "loss-streak", title: "The Cursed", subtitle: "Longest losing streak", unit: "losses",
      entries: pick((t) => t.longestLossStreak, (a, b) => b.longestLossStreak - a.longestLossStreak) },
    { key: "trades", title: "The Peaky Blinders", subtitle: "Most trades", unit: "trades",
      entries: pick((t) => t.trades, (a, b) => b.trades - a.trades) },
  ];
}

export function champions(league: League) {
  return league.teamSeasons
    .filter((ts) => ts.finalRank === 1)
    .sort((a, b) => b.season - a.season);
}
