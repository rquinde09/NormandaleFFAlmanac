// The Pancake Watch's chances of finishing last (the site owner's Round 8, 2026-11-20; Luke picked
// ESPN's projections). The rest of the season is simulated SIMS times: the regular season's
// remaining games, the seeds they give, and the pancake ladder, whose loser of the last game finishes
// last. Each simulated score centers on the team's best lineup by ESPN's projections for that week
// (data/raw/projections/), corrected by how ESPN's projections have missed since 2018 (`calibration`).
import fs from "node:fs";
import path from "node:path";
import { bestLineup, isStarter, lineupSides, readLineups, type RawPlayer } from "@/lib/bench";
import type { League, SeasonInfo, TeamSeason } from "@/lib/league";
import { regularSeeds } from "@/lib/playcalls";

export const SIMS = 10000;

// ---- The pancake ladder ----

// One ladder game by ESPN team ID; a bye has no loser
export type LadderResult = { winner: number; loser: number | null };
export type LadderPair = [number, number | null]; // null: a bye

// The ladder's first week pairs the seeds in order (9 v 10, 11 v 12, 13 v 14); with an odd count the
// last seed has a bye (2025).
export function firstLadder(bySeed: number[]): LadderPair[] {
  const pairs: LadderPair[] = [];
  for (let i = 0; i < bySeed.length; i += 2) pairs.push([bySeed[i], bySeed[i + 1] ?? null]);
  return pairs;
}

// ESPN's consolation ladder (checked against every season, 2017–2025): with last week's games in
// ESPN's order, the top game's winner meets the second game's winner, each game's loser meets the
// winner two games down, and the last two games' losers meet. A bye counts as a win with no loser,
// so a missing opponent means a bye. The final week's games give the places in order: the top game's
// winner finishes highest, the last game's loser last.
export function nextLadder(prev: LadderResult[]): LadderPair[] {
  const n = prev.length;
  if (n < 2) return prev.map((g) => [g.winner, g.loser]);
  const raw: [number | null, number | null][] = [[prev[0].winner, prev[1].winner]];
  for (let k = 1; k < n - 1; k++) raw.push([prev[k - 1].loser, prev[k + 1].winner]);
  raw.push([prev[n - 2].loser, prev[n - 1].loser]);
  return raw.filter(([a, b]) => a !== null || b !== null).map(([a, b]) => (a === null ? [b!, null] : [a, b]));
}

// Final places from the ladder's last week: first is the best place the ladder plays for
export function ladderPlaces(last: LadderResult[], first: number): Map<number, number> {
  const places = new Map<number, number>();
  last.forEach((g, k) => {
    places.set(g.winner, first + 2 * k);
    if (g.loser !== null) places.set(g.loser, first + 2 * k + 1);
  });
  return places;
}

// The team that finishes last: the last game's loser, or the team with a bye there
export const lastOf = (last: LadderResult[]) => last.at(-1)!.loser ?? last.at(-1)!.winner;

// ---- How ESPN's projections have missed ----

export type Calibration = { mean: number; sd: number; games: number };

// Over every team-week of 2018–2025 (seasons with ESPN's projections for the whole roster): the
// team's score minus its best lineup by projections. The mean is how far teams fall short of that
// lineup; the spread is how far a week can stray from it.
export function calibration(league: League): Calibration {
  const diffs: number[] = [];
  for (const info of league.seasons.filter((s) => s.complete)) {
    for (const { side } of lineupSides(readLineups(info.season))) {
      if (!side.lineup.some((p) => p.lineupSlotId === 20) || !side.lineup.filter(isStarter).some((p) => p.projectedTotal != null)) continue;
      diffs.push(side.totalPoints - projectedBest(side.lineup, info.slots));
    }
  }
  const mean = diffs.reduce((n, d) => n + d, 0) / diffs.length;
  const sd = Math.sqrt(diffs.reduce((n, d) => n + (d - mean) ** 2, 0) / diffs.length);
  return { mean, sd, games: diffs.length };
}

// A roster's best lineup by ESPN's weekly projections (no projection counts as 0)
function projectedBest(players: { playerId: number; defaultPositionId: number | null; lineupSlotId: number; projectedTotal?: number | null }[], slots: [number, number][]) {
  const asPoints: RawPlayer[] = players.map((p) => ({ playerId: p.playerId, fullName: null, defaultPositionId: p.defaultPositionId, lineupSlotId: p.lineupSlotId, appliedStatTotal: p.projectedTotal ?? 0 }));
  return bestLineup(asPoints, slots);
}

// ---- Projections for the weeks still to come ----

type ProjectedPlayer = { playerId: number; defaultPositionId: number | null; lineupSlotId: number; projectedTotal: number | null };
type RawProjections = { seasonId: number; weeks: { matchupPeriodId: number; scoringPeriodId: number; teams: { teamId: number; players: ProjectedPlayer[] }[] }[] };

function readProjections(season: number): RawProjections | null {
  const file = path.join(process.cwd(), "data", "raw", "projections", `${season}.json`);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as RawProjections) : null;
}

// Each team's expected score each week still to come: its best projected lineup plus the
// calibration's mean. Without a projection (no file, or a week ESPN hasn't projected), the team's
// average score this season.
function expectedScores(league: League, info: SeasonInfo, teams: TeamSeason[], cal: Calibration) {
  const file = readProjections(info.season);
  const projected = new Map<string, number>();
  for (const w of file?.weeks ?? []) {
    for (const t of w.teams) {
      if (t.players.some((p) => p.projectedTotal)) projected.set(`${w.matchupPeriodId}:${t.teamId}`, projectedBest(t.players, info.slots) + cal.mean);
    }
  }
  const average = new Map(teams.map((t) => [t.teamId, t.all.games ? t.all.pf / t.all.games : 0]));
  return (week: number, teamId: number) => projected.get(`${week}:${teamId}`) ?? average.get(teamId)!;
}

// ---- The simulation ----

export type PancakeOdds = {
  season: number;
  sims: number;
  chance: Map<string, number>; // person → share of the simulations they finished last in
  safe: Set<string>; // can't finish last any more, whatever happens
  projected: boolean; // ESPN's projections were found for the season
  calibration: Calibration;
};

// A small seeded random generator (mulberry32), so a build gives the same numbers for the same data
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let cachedOdds: { league: League; odds: PancakeOdds | null } | null = null;

// The season in progress only; null once it's over
export function pancakeOdds(league: League): PancakeOdds | null {
  if (cachedOdds?.league === league) return cachedOdds.odds;
  const odds = computeOdds(league);
  cachedOdds = { league, odds };
  return odds;
}

function computeOdds(league: League): PancakeOdds | null {
  const info = league.seasons.at(-1)!;
  if (info.complete) return null;
  const teams = league.teamSeasons.filter((t) => t.season === info.season);
  const person = new Map(teams.map((t) => [t.teamId, t.person]));
  const division = new Map(teams.map((t) => [t.teamId, t.division]));
  const cal = calibration(league);
  const expected = expectedScores(league, info, teams, cal);
  const decided = league.games.filter((g) => g.season === info.season && g.kind === "regular");
  const left = league.upcoming.filter((u) => u.season === info.season && u.kind === "regular");
  const regularOver = left.length === 0 && info.throughWeek >= info.regularWeeks;
  const ladderWeeks = Array.from({ length: info.weeks - info.regularWeeks }, (_, i) => info.regularWeeks + 1 + i);
  const scheduled = league.bracket.filter((b) => b.season === info.season && b.kind === "consolation");

  const rand = random(info.season * 1000 + info.throughWeek);
  let spare: number | null = null;
  const normal = () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    const u = 1 - rand();
    const v = rand();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
  const score = (week: number, teamId: number) => expected(week, teamId) + cal.sd * normal();
  const play = (week: number, a: number, b: number): LadderResult => {
    const sa = score(week, a);
    const sb = score(week, b);
    return sa >= sb ? { winner: a, loser: b } : { winner: b, loser: a };
  };

  const lastCount = new Map<number, number>();
  for (let i = 0; i < SIMS; i++) {
    let bySeed: number[];
    if (regularOver) {
      bySeed = [...teams].sort((a, b) => a.seed - b.seed).map((t) => t.teamId);
    } else {
      const simulated = left.map((u) => {
        const home = score(u.week, u.homeTeamId);
        const away = score(u.week, u.awayTeamId);
        return {
          season: u.season,
          week: u.week,
          kind: u.kind,
          home: { person: person.get(u.homeTeamId)!, teamId: u.homeTeamId, points: Math.round(home * 100) / 100 },
          away: { person: person.get(u.awayTeamId)!, teamId: u.awayTeamId, points: Math.round(away * 100) / 100 },
          winner: home >= away ? ("HOME" as const) : ("AWAY" as const),
        };
      });
      const seeds = regularSeeds([...decided, ...simulated], division);
      bySeed = [...seeds].sort(([, a], [, b]) => a - b).map(([team]) => team);
    }
    let prev: LadderResult[] | null = null;
    for (const week of ladderWeeks) {
      const listed = regularOver ? scheduled.filter((b) => b.week === week) : [];
      const pairs: LadderPair[] = listed.length
        ? listed.map((b) => [b.home.teamId, b.away?.teamId ?? null])
        : prev
          ? nextLadder(prev)
          : firstLadder(bySeed.slice(info.playoffTeams));
      prev = pairs.map(([a, b], k) => {
        if (b === null) return { winner: a, loser: null };
        const entry = listed[k];
        if (entry?.winner) {
          const home = entry.home.teamId;
          const away = entry.away!.teamId;
          return entry.winner === "AWAY" ? { winner: away, loser: home } : { winner: home, loser: away };
        }
        return play(week, a, b);
      });
    }
    const last = lastOf(prev!);
    lastCount.set(last, (lastCount.get(last) ?? 0) + 1);
  }

  const safe = new Set(teams.filter((t) => !canFinishLast(league, info, teams, t, regularOver, scheduled, ladderWeeks)).map((t) => t.person));
  return {
    season: info.season,
    sims: SIMS,
    chance: new Map(teams.map((t) => [t.person, (lastCount.get(t.teamId) ?? 0) / SIMS])),
    safe,
    projected: readProjections(info.season) !== null,
    calibration: cal,
  };
}

// Whether a team can still finish last. During the regular season every team that can still miss the
// playoffs can (losing every ladder game ends in the last game); a team has clinched once fewer
// teams than there are playoff spots can reach its wins even if it loses out. After the regular
// season, every outcome of the ladder's remaining games is played out.
function canFinishLast(
  league: League,
  info: SeasonInfo,
  teams: TeamSeason[],
  t: TeamSeason,
  regularOver: boolean,
  scheduled: League["bracket"],
  ladderWeeks: number[],
): boolean {
  const wins = (x: TeamSeason) => x.regular.w + x.regular.t / 2;
  if (!regularOver) {
    const reach = teams.filter((o) => o !== t && wins(o) + (info.regularWeeks - o.regular.games) >= wins(t)).length;
    return reach >= info.playoffTeams;
  }
  if (t.seed <= info.playoffTeams) return false;
  const possible = new Set<number>();
  const walk = (i: number, prev: LadderResult[] | null) => {
    if (i === ladderWeeks.length) {
      possible.add(lastOf(prev!));
      return;
    }
    const week = ladderWeeks[i];
    const listed = scheduled.filter((b) => b.week === week);
    const bySeed = [...teams].sort((a, b) => a.seed - b.seed).map((x) => x.teamId).slice(info.playoffTeams);
    const pairs: LadderPair[] = listed.length ? listed.map((b) => [b.home.teamId, b.away?.teamId ?? null]) : prev ? nextLadder(prev) : firstLadder(bySeed);
    const options: LadderResult[][] = pairs.map(([a, b], k) => {
      if (b === null) return [{ winner: a, loser: null }];
      const entry = listed[k];
      if (entry?.winner) return [entry.winner === "AWAY" ? { winner: b, loser: a } : { winner: a, loser: b }];
      return [{ winner: a, loser: b }, { winner: b, loser: a }];
    });
    const combine = (k: number, acc: LadderResult[]) => {
      if (k === options.length) return walk(i + 1, acc);
      for (const o of options[k]) combine(k + 1, [...acc, o]);
    };
    combine(0, []);
  };
  walk(0, null);
  return possible.has(t.teamId);
}

