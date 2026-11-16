// Weekly lineups from data/raw/lineups/{season}.json (a finished season's fetched once; the season in
// progress gains each week once it's decided), and the points each team left on its bench (Luke,
// 2026-11-15): every week's best possible lineup from the players it had, minus the lineup it
// started. 2017 lists starters only, so it has no bench numbers.
import fs from "node:fs";
import path from "node:path";

export type RawPlayer = {
  playerId: number;
  fullName: string | null;
  defaultPositionId: number | null;
  lineupSlotId: number;
  appliedStatTotal: number | null;
  projectedTotal?: number | null; // ESPN's projection for that week: 2018 on, none for 2017
};
export type RawSide = { teamId: number; totalPoints: number; lineup: RawPlayer[] };
export type RawWeek = { matchupPeriodId: number; scoringPeriodId: number; games: { home: RawSide; away: RawSide | null }[] };
export type RawLineups = { seasonId: number; weeks: RawWeek[] };

const LINEUP_DIR = path.join(process.cwd(), "data", "raw", "lineups");

// lineupSlotId 20 is the bench, 21 IR
export const BENCH = new Set([20, 21]);

const cache = new Map<number, RawLineups | null>();
export function readLineups(season: number): RawLineups | null {
  if (!cache.has(season)) {
    const file = path.join(LINEUP_DIR, `${season}.json`);
    cache.set(season, fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as RawLineups) : null);
  }
  return cache.get(season)!;
}

// Every team's lineup in every week of the file, without byes or empty lineups
export function lineupSides(lineups: RawLineups | null) {
  return (lineups?.weeks ?? []).flatMap((w) =>
    w.games
      .flatMap((g) => [g.home, g.away])
      .filter((s): s is RawSide => !!s?.lineup.length)
      .map((side) => ({ week: w.matchupPeriodId, scoringPeriod: w.scoringPeriodId, side })),
  );
}

export const isStarter = (p: RawPlayer) => !BENCH.has(p.lineupSlotId);

// Starting slot → the positions (defaultPositionId: 1 QB, 2 RB, 3 WR, 4 TE, 5 K, 16 D/ST) that fill it
const FILLS: Record<number, number[]> = {
  0: [1], 2: [2], 4: [3], 6: [4], 16: [16], 17: [5],
  3: [2, 3], 5: [3, 4], 23: [2, 3, 4], 7: [1, 2, 3, 4],
};

const cents = (n: number) => Math.round(n * 100);

// The most points the team's players could have scored that week. One-position slots are filled
// first with the best players, then the flex slots, narrowest first, with the best left over. With
// this league's slots (QB, 2 RB, 2 WR, TE, FLEX, D/ST, K) that is the best lineup. A player can
// also fill the slot he actually started in, in case ESPN let him play outside his listed position.
// Players on IR can't start.
export function bestLineup(lineup: RawPlayer[], slots: [number, number][]): number {
  const pool = lineup
    .filter((p) => p.lineupSlotId !== 21)
    .map((p) => ({ p, points: cents(p.appliedStatTotal ?? 0) }))
    .sort((a, b) => b.points - a.points);
  const used = new Set<RawPlayer>();
  const order = [...slots].sort(([a], [b]) => (FILLS[a]?.length ?? 9) - (FILLS[b]?.length ?? 9));
  let total = 0;
  for (const [slot, count] of order) {
    for (let i = 0; i < count; i++) {
      const pick = pool.find(
        ({ p }) => !used.has(p) && ((p.defaultPositionId !== null && FILLS[slot]?.includes(p.defaultPositionId)) || p.lineupSlotId === slot),
      );
      if (!pick) break;
      used.add(pick.p);
      total += pick.points;
    }
  }
  return total / 100;
}

export type BenchGame = {
  season: number;
  week: number;
  teamId: number;
  person: string;
  actual: number; // the starters' points, which add up to the team's score
  best: number; // the best possible lineup
  left: number; // points left on the bench: best − actual, never below 0
};

// One row per team per week, for a season whose lineups include the bench. `slots` are the season's
// starting slots ([lineupSlotId, count]), from its settings.
export function benchGames(season: number, slots: [number, number][], person: (teamId: number) => string): BenchGame[] {
  const sides = lineupSides(readLineups(season));
  if (!sides.some(({ side }) => side.lineup.some((p) => p.lineupSlotId === 20))) return [];
  return sides.map(({ week, side }) => {
    const actual = side.lineup.filter((p) => !BENCH.has(p.lineupSlotId)).reduce((n, p) => n + cents(p.appliedStatTotal ?? 0), 0) / 100;
    const best = bestLineup(side.lineup, slots);
    return { season, week, teamId: side.teamId, person: person(side.teamId), actual, best, left: Math.max(0, cents(best) - cents(actual)) / 100 };
  });
}
