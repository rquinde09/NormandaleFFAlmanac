// Playcall Review numbers that need lineups or trades (the site owner's Round 5, 2026-11-15):
// ESPN's projected wins (Odds), what each season's trades gained or lost, and the seed a team would
// have had with its best lineup every week (Roster IQ).
import fs from "node:fs";
import path from "node:path";
import { isStarter, lineupSides, type BenchGame, type RawLineups, type RawSide } from "@/lib/bench";
import type { Game } from "@/lib/league";

const cents = (n: number) => Math.round(n * 100); // compares points without float noise

// ---- Odds ----

// Each lineup's projected score: its starters' ESPN projections for that week. Lineups without
// projections (2017) are left out.
function projectedScores(lineups: RawLineups | null): Map<string, number> {
  const out = new Map<string, number>();
  for (const { week, side } of lineupSides(lineups)) {
    const starters = side.lineup.filter(isStarter);
    if (!starters.some((p) => p.projectedTotal != null)) continue;
    out.set(`${week}:${side.teamId}`, starters.reduce((n, p) => n + cents(p.projectedTotal ?? 0), 0) / 100);
  }
  return out;
}

// ESPN's favorite in each game is the lineup with the higher projected score; a tie counts half.
// Every decided game counts, as in W-L. A team's projected wins are the games it was favored in.
// null when any of the season's games lacks projections.
export function projectedWins(seasonGames: Game[], lineups: RawLineups | null): Map<number, number> | null {
  const projected = projectedScores(lineups);
  const wins = new Map<number, number>();
  for (const g of seasonGames) {
    const home = projected.get(`${g.week}:${g.home.teamId}`);
    const away = projected.get(`${g.week}:${g.away.teamId}`);
    if (home === undefined || away === undefined) return null;
    const share = cents(home) > cents(away) ? 1 : cents(home) === cents(away) ? 0.5 : 0;
    wins.set(g.home.teamId, (wins.get(g.home.teamId) ?? 0) + share);
    wins.set(g.away.teamId, (wins.get(g.away.teamId) ?? 0) + 1 - share);
  }
  return seasonGames.length ? wins : null;
}

// ---- Trades ----

export type TradeLeg = { playerId: number; fromTeamId: number; toTeamId: number };
export type RawTrade = { id: string; scoringPeriodId: number; processDate: number | null; legs: TradeLeg[] };
// `available` is false for seasons ESPN keeps no trade details for (2017)
export type RawTrades = { seasonId: number; available: boolean; trades: RawTrade[] };

const TRADE_DIR = path.join(process.cwd(), "data", "raw", "trades");

export function readTrades(season: number): RawTrades | null {
  const file = path.join(TRADE_DIR, `${season}.json`);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as RawTrades) : null;
}

// What a season's trades did for each team, in points that counted (Luke, 2026-11-15): every
// player received scores for his new team in the weeks he started for it, from the trade until he
// leaves its roster, playoffs included. The team that sent him away is charged the same points.
// A team's net is what it received minus what it sent, so the nets of each trade add up to zero.
// null when ESPN has no trade details for the season.
export function tradeNets(season: number, lineups: RawLineups | null): Map<number, number> | null {
  const file = readTrades(season);
  if (!file?.available) return null;
  const weeks = (lineups?.weeks ?? []).map((w) => {
    const teams = new Map<number, RawSide>();
    for (const g of w.games) for (const side of [g.home, g.away]) if (side?.lineup.length) teams.set(side.teamId, side);
    return { scoringPeriod: w.scoringPeriodId, teams };
  });
  const net = new Map<number, number>();
  for (const trade of file.trades) {
    for (const leg of trade.legs) {
      let points = 0;
      let joined = false;
      for (const w of weeks) {
        if (w.scoringPeriod < trade.scoringPeriodId) continue;
        const side = w.teams.get(leg.toTeamId);
        if (!side) continue; // a playoff bye, or the week isn't decided yet
        const p = side.lineup.find((x) => x.playerId === leg.playerId);
        if (!p) {
          if (joined) break; // gone from the roster: his time with this team is over
          continue; // the trade went through after that week's lineups locked
        }
        joined = true;
        if (isStarter(p)) points += cents(p.appliedStatTotal ?? 0);
      }
      net.set(leg.toTeamId, (net.get(leg.toTeamId) ?? 0) + points);
      net.set(leg.fromTeamId, (net.get(leg.fromTeamId) ?? 0) - points);
    }
  }
  return new Map([...net].map(([team, n]) => [team, n / 100]));
}

// ---- Roster IQ: the seed with the best lineup every week ----

// Regular-season seeds as ESPN ranks them: wins (a tie counts half), then total points
// (playoffSeedingRule TOTAL_POINTS_SCORED). In 2017 and 2018 the league had two divisions, and
// the division winners took the top seeds. `score` can replace a team's scores.
export function regularSeeds(
  games: Game[],
  division: Map<number, number>, // teamId → divisionId
  score: (teamId: number, week: number, actual: number) => number = (_t, _w, a) => a,
) {
  const table = new Map<number, { wins: number; pf: number }>();
  const row = (teamId: number) => table.get(teamId) ?? table.set(teamId, { wins: 0, pf: 0 }).get(teamId)!;
  for (const g of games.filter((x) => x.kind === "regular")) {
    const home = cents(score(g.home.teamId, g.week, g.home.points));
    const away = cents(score(g.away.teamId, g.week, g.away.points));
    row(g.home.teamId).pf += home;
    row(g.away.teamId).pf += away;
    row(g.home.teamId).wins += home > away ? 1 : home === away ? 0.5 : 0;
    row(g.away.teamId).wins += away > home ? 1 : home === away ? 0.5 : 0;
  }
  const order = [...table].sort(([, a], [, b]) => b.wins - a.wins || b.pf - a.pf).map(([team]) => team);
  const divisions = new Set(order.map((team) => division.get(team)));
  const winners = divisions.size > 1 ? [...divisions].map((d) => order.find((team) => division.get(team) === d)!) : [];
  const seeded = [...order.filter((team) => winners.includes(team)), ...order.filter((team) => !winners.includes(team))];
  return new Map(seeded.map((team, i) => [team, i + 1]));
}

// The seed each team would have had with its best possible lineup every regular-season week, with
// every other team's scores as they were (Round 5, Luke's pick of the site owner's "optimized
// finish", 2026-11-15). Games against it can change the other teams' records too. Only for seasons
// whose lineups include the bench.
export function optimizedSeeds(seasonGames: Game[], bench: BenchGame[], division: Map<number, number>): Map<number, number> {
  const best = new Map(bench.map((b) => [`${b.week}:${b.teamId}`, b.best]));
  const out = new Map<number, number>();
  const regular = seasonGames.filter((g) => g.kind === "regular");
  const teams = new Set(regular.flatMap((g) => [g.home.teamId, g.away.teamId]));
  for (const team of teams) {
    if (!regular.every((g) => (g.home.teamId !== team && g.away.teamId !== team) || best.has(`${g.week}:${team}`))) continue;
    const seeds = regularSeeds(regular, division, (t, week, actual) => (t === team ? best.get(`${week}:${team}`)! : actual));
    out.set(team, seeds.get(team)!);
  }
  return out;
}
