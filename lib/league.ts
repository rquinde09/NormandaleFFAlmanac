// League data for the site, read at build time from data/raw/*.json and data/managers.json.
// The counting rules live in CLAUDE.md; scripts/check-data.ts checks them against the old Sheet.
import fs from "node:fs";
import path from "node:path";
import { benchGames, readLineups, type BenchGame } from "@/lib/bench";
import { optimizedSeeds, projectedWins, tradeNets } from "@/lib/playcalls";
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

// One team's close games or blowouts (Round 7): W-L-T, and the winning and losing margins added up
export type MarginSplit = { w: number; l: number; t: number; wonBy: number; lostBy: number };

export type TeamSeason = {
  season: number;
  person: string;
  teamId: number;
  teamName: string;
  seed: number;
  division: number; // ESPN's divisionId: two divisions in 2017 and 2018, one since
  finalRank: number | null; // null while the season is in progress
  lastPlace: boolean; // finished last of the season's teams: the pancake
  regular: Totals; // ESPN's own record: regular season only
  all: Totals; // every decided game, the site's counting rule
  trades: number;
  longestWinStreak: number;
  longestLossStreak: number;
  // All-play (Luke, 2026-11-15): each game counts as the share of the week's other teams this one
  // outscored, summed over every decided game. `luck` is wins minus this.
  expectedWins: number;
  bench: number | null; // points left on the bench over the season; null without bench lineups
  // Round 5 (2026-11-15), from lib/playcalls.ts:
  projectedWins: number | null; // games ESPN's projections favored this team in; null without projections
  tradeNet: number | null; // starting-lineup points the season's trades gained (or lost); null without trade details
  optimizedSeed: number | null; // the seed with the best lineup every week; null without bench lineups
  // Round 7 (2026-11-18), every decided game: decided by under 7 points, or by more than 50
  close: MarginSplit;
  blowout: MarginSplit;
};

// A playoff-week schedule entry: the winners bracket, placement games or the consolation ladder.
// Unlike `games` it keeps byes (no away side) and games not yet decided.
export type BracketSide = { person: string; teamId: number; seed: number; points: number };
export type BracketEntry = {
  season: number;
  week: number;
  kind: Kind;
  home: BracketSide;
  away: BracketSide | null; // null: a bye
  winner: Game["winner"] | null; // null until decided
};

export type SeasonInfo = {
  season: number;
  teams: number;
  playoffTeams: number;
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
  bracket: BracketEntry[];
  bench: BenchGame[];
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
  divisionId?: number;
  rankCalculatedFinal?: number;
  rankFinal?: number;
  transactionCounter?: { trades?: number };
};
type RawSeason = {
  seasonId: number;
  teams: RawTeam[];
  schedule: RawGame[];
  settings: {
    // matchupPeriods lists every period of the season, even ones not yet on the schedule
    scheduleSettings: { matchupPeriodCount: number; playoffTeamCount: number; matchupPeriods: Record<string, number[]> };
    rosterSettings?: { lineupSlotCounts?: Record<string, number> };
  };
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

// Wins above (or below) what the team's scores earned against the whole league each week
export const luck = (t: TeamSeason) => t.all.w + t.all.t / 2 - t.expectedWins;

// Odds (the site owner's Round 5): wins above (or below) what ESPN's projections expected. Positive:
// ESPN doubted the team; negative: ESPN gave it false hope.
export const odds = (t: TeamSeason) => (t.projectedWins === null ? null : t.all.w + t.all.t / 2 - t.projectedWins);

const cents = (n: number) => Math.round(n * 100); // compares points without float noise

// Close games and blowouts (the site owner, Round 7, 2026-11-18). Over the 1,088 decided games from
// 2017 to 2026 week 10 the winning margin averages 29.3 points with a standard deviation of 22.4,
// so one SD either side is 6.9–51.7. A close game is decided by under 7 points (about 1 SD below
// the average), a blowout by more than 50 (about 1 SD above); compared in cents.
export const CLOSE_UNDER = 7;
export const BLOWOUT_OVER = 50;
export type MarginKind = "close" | "normal" | "blowout";
export const marginCents = (g: Game) => Math.abs(cents(g.home.points) - cents(g.away.points));
export function marginKind(g: Game): MarginKind {
  const m = marginCents(g);
  return m < CLOSE_UNDER * 100 ? "close" : m > BLOWOUT_OVER * 100 ? "blowout" : "normal";
}
const emptySplit = (): MarginSplit => ({ w: 0, l: 0, t: 0, wonBy: 0, lostBy: 0 });

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
  const bracket: BracketEntry[] = [];
  const bench: BenchGame[] = [];

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

    // All-play: each week, the share of the other teams that played that this team outscored
    const expected = new Map<number, number>();
    for (const week of new Set(seasonGames.map((g) => g.week))) {
      const sides = seasonGames.filter((g) => g.week === week).flatMap((g) => [g.home, g.away]);
      for (const me of sides) {
        const others = sides.filter((o) => o !== me);
        const beat = others.reduce((n, o) => n + (cents(me.points) > cents(o.points) ? 1 : cents(me.points) === cents(o.points) ? 0.5 : 0), 0);
        expected.set(me.teamId, (expected.get(me.teamId) ?? 0) + (others.length ? beat / others.length : 0));
      }
    }

    // Points left on the bench, for seasons whose lineups include the bench
    const slots = Object.entries(s.settings.rosterSettings?.lineupSlotCounts ?? {})
      .map(([slot, count]) => [Number(slot), count] as [number, number])
      .filter(([slot, count]) => count > 0 && slot !== 20 && slot !== 21);
    const seasonBench = benchGames(s.seasonId, slots, (teamId) => credit.get(teamId)!);
    bench.push(...seasonBench);

    const lineups = readLineups(s.seasonId);
    const projected = projectedWins(seasonGames, lineups);
    const nets = tradeNets(s.seasonId, lineups);
    const division = new Map(s.teams.map((t) => [t.id, t.divisionId ?? 0]));
    const optimized = complete && seasonBench.length ? optimizedSeeds(seasonGames, seasonBench, division) : null;

    // Playoff weeks as scheduled, byes and undecided games included, in ESPN's (bracket) order
    const seed = new Map(s.teams.map((t) => [t.id, t.playoffSeed]));
    const bracketSide = (r: RawSide): BracketSide => ({ person: credit.get(r.teamId)!, teamId: r.teamId, seed: seed.get(r.teamId)!, points: r.totalPoints });
    for (const g of s.schedule.filter((x) => x.matchupPeriodId > regularWeeks)) {
      bracket.push({
        season: s.seasonId,
        week: g.matchupPeriodId,
        kind: KINDS[g.playoffTierType ?? "NONE"],
        home: bracketSide(g.home),
        away: g.away ? bracketSide(g.away) : null,
        winner: g.away && (g.winner === "HOME" || g.winner === "AWAY" || g.winner === "TIE") ? g.winner : null,
      });
    }

    const weeks = Object.keys(s.settings.scheduleSettings.matchupPeriods).length;
    const throughWeek = Math.max(0, ...seasonGames.map((g) => g.week));
    seasons.push({
      season: s.seasonId,
      teams: s.teams.length,
      playoffTeams: s.settings.scheduleSettings.playoffTeamCount,
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
      const splits = { close: emptySplit(), blowout: emptySplit() };
      for (const g of seasonGames) {
        const side = g.home.teamId === team.id ? "home" : g.away.teamId === team.id ? "away" : null;
        if (!side) continue;
        const other = side === "home" ? "away" : "home";
        const result = g.winner === "TIE" ? "T" : g.winner === side.toUpperCase() ? "W" : "L";
        addGame(all, g[side].points, g[other].points, result);
        if (g.kind === "regular") addGame(regular, g[side].points, g[other].points, result);
        results.push(result);
        const kind = marginKind(g);
        if (kind !== "normal") {
          const split = splits[kind]; // margins in cents until the season is counted
          if (result === "W") {
            split.w += 1;
            split.wonBy += marginCents(g);
          } else if (result === "L") {
            split.l += 1;
            split.lostBy += marginCents(g);
          } else split.t += 1;
        }
      }
      const inPoints = (s: MarginSplit): MarginSplit => ({ ...s, wonBy: s.wonBy / 100, lostBy: s.lostBy / 100 });
      const finalRank = complete ? (team.rankCalculatedFinal || team.rankFinal || null) : null;
      teamSeasons.push({
        season: s.seasonId,
        person: credit.get(team.id)!,
        teamId: team.id,
        teamName: teamName(team),
        seed: team.playoffSeed,
        division: team.divisionId ?? 0,
        finalRank,
        lastPlace: finalRank === s.teams.length,
        regular,
        all,
        trades: team.transactionCounter?.trades ?? 0,
        longestWinStreak: longestRun(results, "W"),
        longestLossStreak: longestRun(results, "L"),
        expectedWins: expected.get(team.id) ?? 0,
        bench: seasonBench.length
          ? seasonBench.filter((b) => b.teamId === team.id).reduce((n, b) => n + cents(b.left), 0) / 100
          : null,
        projectedWins: projected ? (projected.get(team.id) ?? 0) : null,
        tradeNet: nets ? (nets.get(team.id) ?? 0) : null,
        optimizedSeed: optimized?.get(team.id) ?? null,
        close: inPoints(splits.close),
        blowout: inPoints(splits.blowout),
      });
    }
  }

  const metaFile = path.join(DATA_DIR, "meta.json");
  const updatedAt = fs.existsSync(metaFile) ? readJson<{ updatedAt: string }>(metaFile).updatedAt : null;

  cached = { managers, seasons, teamSeasons, games, bracket, bench, updatedAt };
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
  const pick = (value: (ts: TeamSeason) => number, compare: (a: TeamSeason, b: TeamSeason) => number, from = rows) =>
    [...from].sort(compare).slice(0, top).map((teamSeason) => ({ teamSeason, value: value(teamSeason) }));
  const benched = rows.filter((t) => t.bench !== null);
  const projectedRows = rows.filter((t) => t.projectedWins !== null);
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
    // Added by Luke, 2026-11-15. Round 5 (the same day) describes these two as results against
    // ESPN's projections, so they count Odds, over the seasons with projections.
    { key: "luckiest", title: "The Horseshoe", subtitle: "Outperformed season projection", unit: "odds",
      entries: pick((t) => odds(t)!, (a, b) => odds(b)! - odds(a)!, projectedRows) },
    { key: "unluckiest", title: "The Black Cat", subtitle: "Underperformed season projection", unit: "odds",
      entries: pick((t) => odds(t)!, (a, b) => odds(a)! - odds(b)!, projectedRows) },
    { key: "bench-season", title: "Asleep at the Wheel", subtitle: "Most points left on the bench", unit: "pts",
      entries: pick((t) => t.bench!, (a, b) => b.bench! - a.bench!, benched) },
    // Round 7 (2026-11-18): close games and blowouts. The counts are small, so ties are common:
    // Luke's pick breaks them by the margins added up, the closer games first on the close-game
    // records and the bigger margins first on the blowout records.
    { key: "blowout-wins", title: "The Steamroller", subtitle: "Most wins by more than 50 points", unit: "wins",
      entries: pick((t) => t.blowout.w, (a, b) => b.blowout.w - a.blowout.w || cents(b.blowout.wonBy) - cents(a.blowout.wonBy)) },
    { key: "blowout-losses", title: "The Punching Bag", subtitle: "Most losses by more than 50 points", unit: "losses",
      entries: pick((t) => t.blowout.l, (a, b) => b.blowout.l - a.blowout.l || cents(b.blowout.lostBy) - cents(a.blowout.lostBy)) },
    { key: "close-wins", title: "The Escape Artist", subtitle: "Most wins by under 7 points", unit: "wins",
      entries: pick((t) => t.close.w, (a, b) => b.close.w - a.close.w || cents(a.close.wonBy) - cents(b.close.wonBy)) },
    { key: "close-losses", title: "Heartbreak Hotel", subtitle: "Most losses by under 7 points", unit: "losses",
      entries: pick((t) => t.close.l, (a, b) => b.close.l - a.close.l || cents(a.close.lostBy) - cents(b.close.lostBy)) },
  ];
}

// ---- Bench records (Luke, 2026-11-15) ----

// The holder is on the home side of `game`, as in the other single-team records
export type BenchRecordEntry = GameRecordEntry & { bench: BenchGame };

// Same Active rule as the game records: both managers must count.
export function benchRecords(league: League, top = 5, counts: (person: string) => boolean = () => true): RecordDef<BenchRecordEntry>[] {
  const gameOf = new Map<string, Game>();
  for (const g of league.games) {
    gameOf.set(`${g.season}:${g.week}:${g.home.teamId}`, g);
    gameOf.set(`${g.season}:${g.week}:${g.away.teamId}`, { ...g, home: g.away, away: g.home, winner: flip(g.winner) });
  }
  const rows = league.bench
    .map((bench) => ({ bench, game: gameOf.get(`${bench.season}:${bench.week}:${bench.teamId}`)! }))
    .filter(({ game }) => game && counts(game.home.person) && counts(game.away.person));
  const list = (from: typeof rows, value: (r: (typeof rows)[number]) => number) =>
    from
      .map((r) => ({ ...r, value: value(r) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, top);
  // Lost, though the best lineup would have outscored the opponent
  const blown = rows.filter(({ game, bench }) => game.winner === "AWAY" && cents(bench.best) > cents(game.away.points));
  return [
    { key: "bench-game", title: "Riding the Pine", subtitle: "Most points left on the bench", unit: "pts",
      entries: list(rows, (r) => r.bench.left) },
    // The site owner's wording (Round 5); ranked by how much the best lineup would have won by
    { key: "bench-loss", title: "Self-Inflicted", subtitle: "Lost, but the best lineup would have won them the game", unit: "pts",
      entries: list(blown, (r) => r.bench.best - r.game.away.points) },
  ];
}

export function champions(league: League) {
  return league.teamSeasons
    .filter((ts) => ts.finalRank === 1)
    .sort((a, b) => b.season - a.season);
}
