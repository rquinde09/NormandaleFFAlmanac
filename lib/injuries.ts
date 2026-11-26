// Injured starters (the site owner's Round 11, 2026-11-25): "count the number of players that got
// injured on the starting lineup throughout the season and compare it with the league average".
//
// ESPN keeps no injury reports for past weeks (a box score's injury status is the player's current
// one), but its game logs say, week by week, whether each player played, missed a game his NFL team
// played, or had a bye (data/raw/players/{season}.json, `games`; from 2018 on, as 2017 gives season
// totals only). So an injury here is a player who had started for the team that season, then played
// a game while on its roster and missed his NFL team's next two games (byes skipped). He counts once
// per team-season, even if he's hurt again, and for the team he was on when he got hurt, whether or
// not it kept him. A missed game also covers a suspension or an NFL starter benched for a backup,
// which the game logs can't tell from an injury. D/STs are left out.
import fs from "node:fs";
import path from "node:path";
import { isStarter, readLineups } from "@/lib/bench";

// The two straight missed games that make an injury "significant" (Injury Bug's word)
export const MISSED_IN_A_ROW = 2;

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
  week: number; // when it counted: the week of his second missed game
  hurt: number; // the week of his last game before them
  teamId: number;
  playerId: number;
  name: string;
};

const D_ST = 16;

// The season's injured starters, oldest first; null without game logs (2017)
export function injuries(season: number): Injury[] | null {
  const players = readPlayers(season);
  const lineups = readLineups(season);
  if (!players?.weekly || !lineups?.weeks.length || players.players.some((p) => p.games === undefined)) return null;
  const games = new Map(players.players.map((p) => [p.playerId, p.games!]));

  const started = new Set<string>(); // teamId:playerId, once he's started for the team
  const out = new Map<string, Injury>();
  for (const w of [...lineups.weeks].sort((a, b) => a.scoringPeriodId - b.scoringPeriodId)) {
    for (const side of w.games.flatMap((g) => [g.home, g.away])) {
      if (!side?.lineup.length) continue;
      for (const p of side.lineup) {
        const key = `${side.teamId}:${p.playerId}`;
        if (isStarter(p)) started.add(key);
        if (!started.has(key) || out.has(key) || p.defaultPositionId === D_ST) continue;
        const log = games.get(p.playerId) ?? "";
        if (log[w.scoringPeriodId - 1] !== "P") continue;
        // His NFL team's next games, byes skipped
        const next = [...log.slice(w.scoringPeriodId)].map((c, i) => ({ c, period: w.scoringPeriodId + 1 + i })).filter((x) => x.c !== "-").slice(0, MISSED_IN_A_ROW);
        if (next.length < MISSED_IN_A_ROW || next.some((x) => x.c !== "M")) continue;
        out.set(key, { season, week: next[next.length - 1].period, hurt: w.scoringPeriodId, teamId: side.teamId, playerId: p.playerId, name: p.fullName ?? `Player ${p.playerId}` });
      }
    }
  }
  return [...out.values()].sort((a, b) => a.week - b.week || a.hurt - b.hurt || a.name.localeCompare(b.name));
}
