// League data for the site, read at build time from data/raw/*.json and data/managers.json.
// The counting rules live in CLAUDE.md; scripts/check-data.ts checks them against the old Sheet.
import fs from "node:fs";
import path from "node:path";
import { acquisitions, pointsByHow } from "@/lib/acquisitions";
import { benchGames, isStarter, lineupSides, readLineups, type BenchGame } from "@/lib/bench";
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
  // Round 10 (2026-11-25), from lib/acquisitions.ts: starting-lineup points by players the team
  // drafted, and by players it picked up (waivers or free agency) while it had them. With trades they
  // add up to the team's points for. null without lineups; pickups also null without whole rosters
  // (2017).
  draftPoints: number | null;
  pickupPoints: number | null;
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
  slots: [number, number][]; // starting lineup slots ([lineupSlotId, count]), from the season's settings
};

// A game on the schedule that isn't decided yet (the season in progress), by ESPN team ID
export type Upcoming = { season: number; week: number; kind: Kind; homeTeamId: number; awayTeamId: number };

export type League = {
  managers: Manager[];
  seasons: SeasonInfo[];
  teamSeasons: TeamSeason[];
  games: Game[];
  bracket: BracketEntry[];
  bench: BenchGame[];
  upcoming: Upcoming[];
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

// Round 8's two achievements (the site owner, 2026-11-20). Ice in the Veins: won a game "within a
// point", by 1.00 or less (one game was decided by exactly 1.00: 2021 week 8). Dunzo: lost a game by
// more than DUNZO_OVER, chosen so that as many games were decided by more than it as by a point or
// less: 26 of the 1,088 decided games from 2017 to 2026 week 10 each (2.39%), and 25 of 1,018 each
// through 2025 (2.46%). He guessed "something over 60"; more than 60 is 10.8% of games.
export const ICE_WITHIN = 1;
export const DUNZO_OVER = 84;

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
  const upcoming: Upcoming[] = [];

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
    for (const g of real.filter((x) => !decided.includes(x))) {
      upcoming.push({ season: s.seasonId, week: g.matchupPeriodId, kind: KINDS[g.playoffTierType ?? "NONE"], homeTeamId: g.home.teamId, awayTeamId: g.away!.teamId });
    }

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
    const how = pointsByHow(s.seasonId);
    const rosters = acquisitions(s.seasonId).rosters;
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
      slots,
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
        draftPoints: how ? (how.get(team.id)?.draft ?? 0) : null,
        pickupPoints: how && rosters ? (how.get(team.id)?.pickup ?? 0) : null,
        close: inPoints(splits.close),
        blowout: inPoints(splits.blowout),
      });
    }
  }

  const metaFile = path.join(DATA_DIR, "meta.json");
  const updatedAt = fs.existsSync(metaFile) ? readJson<{ updatedAt: string }>(metaFile).updatedAt : null;

  cached = { managers, seasons, teamSeasons, games, bracket, bench, upcoming, updatedAt };
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

/// Season records count completed seasons only, so a half-played season can't hold "fewest points against".
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
    // Most losses since Round 8 (the site owner, 2026-11-20; it was fewest wins). Ties go to the
    // fewer points for, as fewest wins did.
    { key: "worst", title: "Below Zero", subtitle: "Most losses in a season", unit: "losses",
      entries: pick((t) => t.all.l, (a, b) => b.all.l - a.all.l || a.all.pf - b.all.pf) },
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
  ];
}

// ---- League records (Round 8): close games and blowouts over a whole career ----

// Round 7 made these four season records; Round 8 (the site owner, 2026-11-20) moved them to their
// own League tab as all-time totals. Every decided game counts, the season in progress included,
// like the career line on the manager pages. Ties go to the margins added up (Luke's Round 7 pick):
// the closer games first on the close-game records, the bigger margins first on the blowout records.
export type CareerSplit = MarginSplit & { seasons: number };
export type LeagueRecordEntry = { person: string; split: CareerSplit; value: number };

// Counted from the games, so a league cut at any week (the record-break news) counts to that week.
// `seasons` are the seasons the person has played a game in.
export function careerSplits(league: League, kind: "close" | "blowout"): Map<string, CareerSplit> {
  const out = new Map<string, MarginSplit & { years: Set<number> }>();
  for (const g of league.games) {
    for (const side of ["home", "away"] as const) {
      const me = g[side].person;
      const row = out.get(me) ?? { w: 0, l: 0, t: 0, wonBy: 0, lostBy: 0, years: new Set<number>() };
      row.years.add(g.season);
      out.set(me, row);
      if (marginKind(g) !== kind) continue;
      if (g.winner === "TIE") row.t += 1;
      else if (g.winner === side.toUpperCase()) {
        row.w += 1;
        row.wonBy += marginCents(g);
      } else {
        row.l += 1;
        row.lostBy += marginCents(g);
      }
    }
  }
  return new Map([...out].map(([p, { years, ...r }]) => [p, { ...r, wonBy: r.wonBy / 100, lostBy: r.lostBy / 100, seasons: years.size }]));
}

// `counts` keeps the managers the Active switch shows, as on the season records
export function leagueRecords(league: League, top = 5, counts: (person: string) => boolean = () => true): RecordDef<LeagueRecordEntry>[] {
  const list = (kind: "close" | "blowout", value: (s: CareerSplit) => number, tie: (a: CareerSplit, b: CareerSplit) => number) =>
    [...careerSplits(league, kind)]
      .filter(([person, s]) => counts(person) && value(s) > 0)
      .sort(([pa, a], [pb, b]) => value(b) - value(a) || tie(a, b) || pa.localeCompare(pb))
      .slice(0, top)
      .map(([person, split]) => ({ person, split, value: value(split) }));
  return [
    { key: "blowout-wins", title: "The Steamroller", subtitle: `Most wins by more than ${BLOWOUT_OVER} points`, unit: "wins",
      entries: list("blowout", (s) => s.w, (a, b) => cents(b.wonBy) - cents(a.wonBy)) },
    { key: "blowout-losses", title: "The Punching Bag", subtitle: `Most losses by more than ${BLOWOUT_OVER} points`, unit: "losses",
      entries: list("blowout", (s) => s.l, (a, b) => cents(b.lostBy) - cents(a.lostBy)) },
    { key: "close-wins", title: "The Escape Artist", subtitle: `Most wins by under ${CLOSE_UNDER} points`, unit: "wins",
      entries: list("close", (s) => s.w, (a, b) => cents(a.wonBy) - cents(b.wonBy)) },
    { key: "close-losses", title: "Heartbreak Hotel", subtitle: `Most losses by under ${CLOSE_UNDER} points`, unit: "losses",
      entries: list("close", (s) => s.l, (a, b) => cents(a.lostBy) - cents(b.lostBy)) },
  ];
}

// ---- Lineup records: Riding the Pine (Luke, 2026-11-15) and The One Hit Wonder (Round 8) ----

// The holder is on the home side of `game`, as in the other single-team records
export type LineupRecordEntry = GameRecordEntry & {
  bench?: BenchGame;
  player?: { name: string; position: number | null; projected: number; points: number };
};

// The One Hit Wonder (the site owner, Round 8): a team's starter with the lowest ESPN projection
// that week was its highest scorer. Kickers and D/STs are left out (they usually have the lowest
// projections, so they'd fill the list), and so are projections of exactly 0 (ESPN expected the
// player not to play, or, all over 2023 week 1, had no projection). A tie for the lowest projection
// or the most points still counts. Ranked by his points. Projections exist from 2018 on.
const NOT_ONE_HIT = new Set([5, 16]); // defaultPositionId: K, D/ST
const oneHitCache = new WeakMap<Game[], LineupRecordEntry[]>();
export function oneHitWonders(league: League): LineupRecordEntry[] {
  const cached = oneHitCache.get(league.games);
  if (cached) return cached;
  const out: LineupRecordEntry[] = [];
  const bySeason = new Map<number, Game[]>();
  for (const g of league.games) bySeason.set(g.season, [...(bySeason.get(g.season) ?? []), g]);
  for (const [season, seasonGames] of bySeason) {
    const lineup = new Map(lineupSides(readLineups(season)).map(({ week, side }) => [`${week}:${side.teamId}`, side.lineup]));
    for (const g of seasonGames) {
      for (const holder of [g, { ...g, home: g.away, away: g.home, winner: flip(g.winner) }]) {
        const starters = (lineup.get(`${g.week}:${holder.home.teamId}`) ?? []).filter(isStarter);
        const pool = starters.filter((p) => !NOT_ONE_HIT.has(p.defaultPositionId ?? -1) && cents(p.projectedTotal ?? 0) > 0);
        if (!pool.length) continue;
        const low = Math.min(...pool.map((p) => cents(p.projectedTotal!)));
        const top = Math.max(...starters.map((p) => cents(p.appliedStatTotal ?? 0)));
        for (const p of pool.filter((x) => cents(x.projectedTotal!) === low && cents(x.appliedStatTotal ?? 0) === top && top > 0)) {
          const points = top / 100;
          out.push({ game: holder, value: points, player: { name: p.fullName ?? `Player ${p.playerId}`, position: p.defaultPositionId, projected: low / 100, points } });
        }
      }
    }
  }
  oneHitCache.set(league.games, out);
  return out;
}

// Same Active rule as the game records: both managers must count.
export function lineupRecords(league: League, top = 5, counts: (person: string) => boolean = () => true): RecordDef<LineupRecordEntry>[] {
  const gameOf = new Map<string, Game>();
  for (const g of league.games) {
    gameOf.set(`${g.season}:${g.week}:${g.home.teamId}`, g);
    gameOf.set(`${g.season}:${g.week}:${g.away.teamId}`, { ...g, home: g.away, away: g.home, winner: flip(g.winner) });
  }
  const both = (g: Game) => counts(g.home.person) && counts(g.away.person);
  const benched = league.bench
    .map((bench) => ({ bench, game: gameOf.get(`${bench.season}:${bench.week}:${bench.teamId}`)!, value: bench.left }))
    .filter(({ game }) => game && both(game))
    .sort((a, b) => b.value - a.value)
    .slice(0, top);
  const hits = oneHitWonders(league)
    .filter((e) => both(e.game))
    .sort((a, b) => b.value - a.value || a.player!.projected - b.player!.projected)
    .slice(0, top);
  return [
    { key: "bench-game", title: "Riding the Pine", subtitle: "Most points left on the bench", unit: "pts", entries: benched },
    // No description: the site owner says the name explains it
    { key: "one-hit", title: "The One Hit Wonder", subtitle: "", unit: "pts", entries: hits },
  ];
}

export function champions(league: League) {
  return league.teamSeasons
    .filter((ts) => ts.finalRank === 1)
    .sort((a, b) => b.season - a.season);
}

// Where the home page's 2026 Standings and The Mahaan Bakaree cards go (Round 9): the latest
// season's page and the reigning champion's page
export function homeLinks(league: League) {
  return { season: latestSeason(league).season, champ: champions(league)[0]?.person ?? null };
}
