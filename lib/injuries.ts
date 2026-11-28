// Injuries (the site owner's Round 11, 2026-11-25, redefined on 2026-11-27): "the total count of
// injured players a manager had rostered regardless in the starting line up or bench or IR spot". How
// he counted them: "look at the player's schedule and notice if they had missed any weeks that had no
// stats and then I confirmed if that player was rostered by the manager that same week".
//
// ESPN keeps no injury reports for past weeks (a box score's injury status is the player's current
// one), but its game logs say, week by week, whether each player played, missed a game his NFL team
// played, or had a bye (data/raw/players/{season}.json, `games`; from 2018 on, as 2017 gives season
// totals only). So an injury here is a stretch of missed NFL games: byes don't break it, a game played
// ends it. It counts once for every team that had him on its roster (starting lineup, bench or IR) in a
// week he missed, so a player traded or picked up while out counts for both teams, and one hurt again
// after he came back counts again ("AJ Brown is a three count").
//
// A team that let him go before he missed a game is charged only if he never played again that
// season, which is how the site owner checked a player "on IR and dropped" ("I checked the status of
// the player to confirm if it said they were out for the season"): the game logs can't tell a player
// dropped because he got hurt from one dropped healthy, and nobody knows who's out for the season
// until it's over. So those count once the season is over (2023's Chubb and Burrow, 2018's Alex
// Smith). A missed game also covers a suspension or a healthy scratch. D/STs are left out.
import fs from "node:fs";
import path from "node:path";
import { readLineups } from "@/lib/bench";

type RawPlayer = {
  playerId: number;
  fullName: string | null;
  defaultPositionId: number | null;
  points: number;
  projected: number | null;
  // One letter per scoring period of the fantasy season so far: P played, M his NFL team played
  // without him, - no game (a bye). Only where ESPN gives weekly stats (2018 on).
  games?: string;
};
export type RawPlayers = { seasonId: number; throughScoringPeriod: number; weekly: boolean; players: RawPlayer[] };

const PLAYER_DIR = path.join(process.cwd(), "data", "raw", "players");
const cache = new Map<number, RawPlayers | null>();
export function readPlayers(season: number): RawPlayers | null {
  if (!cache.has(season)) {
    const file = path.join(PLAYER_DIR, `${season}.json`);
    cache.set(season, fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as RawPlayers) : null);
  }
  return cache.get(season)!;
}

export type Injury = {
  season: number;
  week: number; // when it counted: the first game he missed while on the team, or the season's last week (letGo)
  // When he became the team's injury: the game he got hurt in if he was on the team for it, otherwise
  // `week` (picked up or traded for while out). The latest injury is the one with the latest `since`.
  since: number;
  hurt: number | null; // his last game before the missed ones; null if he hadn't played that season
  letGo: boolean; // the team let him go after his last game, and he never played again that season
  teamId: number;
  playerId: number;
  name: string;
};

const D_ST = 16;

// The season's injuries, oldest first; null without game logs (2017). `complete`: the season is over.
export function injuries(season: number, complete: boolean): Injury[] | null {
  const players = readPlayers(season);
  const lineups = readLineups(season);
  if (!players?.weekly || !lineups?.weeks.length || players.players.some((p) => p.games === undefined)) return null;

  // Whose roster each player was on, week by week (any slot)
  const held = new Map<number, Map<number, number>>();
  for (const w of lineups.weeks) {
    for (const side of w.games.flatMap((g) => [g.home, g.away])) {
      for (const p of side?.lineup ?? []) {
        if (p.defaultPositionId === D_ST) continue;
        if (!held.has(p.playerId)) held.set(p.playerId, new Map());
        held.get(p.playerId)!.set(w.scoringPeriodId, side!.teamId);
      }
    }
  }

  const out: Injury[] = [];
  for (const p of players.players) {
    const teams = held.get(p.playerId);
    if (!teams || p.defaultPositionId === D_ST) continue;
    const log = p.games!;
    let hurt: number | null = null; // his last game played
    let charged = new Set<number>(); // the teams this stretch of missed games already counts for
    for (let period = 1; period <= log.length; period++) {
      if (log[period - 1] === "P") {
        hurt = period;
        charged = new Set();
        continue;
      }
      const teamId = teams.get(period);
      if (log[period - 1] !== "M" || teamId === undefined || charged.has(teamId)) continue;
      charged.add(teamId);
      const since = hurt !== null && teams.get(hurt) === teamId ? hurt : period;
      out.push({ season, week: period, since, hurt, letGo: false, teamId, playerId: p.playerId, name: p.fullName ?? `Player ${p.playerId}` });
    }
    // Out for the season: the team that had him in his last game, if it let him go before he missed one
    const letGo = hurt === null ? undefined : teams.get(hurt);
    if (complete && letGo !== undefined && !charged.has(letGo) && log.slice(hurt!).includes("M")) {
      out.push({ season, week: log.length, since: hurt!, hurt, letGo: true, teamId: letGo, playerId: p.playerId, name: p.fullName ?? `Player ${p.playerId}` });
    }
  }
  return out.sort((a, b) => a.since - b.since || a.week - b.week || a.name.localeCompare(b.name));
}
