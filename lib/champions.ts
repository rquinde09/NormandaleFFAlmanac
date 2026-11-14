// Details behind each title on the Champions page: the championship game's lineup, the season's
// best game, and the player who scored the most points while in the starting lineup. Lineups come
// from data/raw/lineups/{season}.json, fetched once a season is over. 2017 has starters only, all
// in slot 0. ESPN keeps no lineups for 2021, so that champion's lineup was entered by hand from the
// site owner (data/manual/lineups-2021.json), without points.
import fs from "node:fs";
import path from "node:path";
import type { Game, League, TeamSeason } from "@/lib/league";

type ManualPlayer = { slot: string; name: string };
type ManualLineup = { season: number; person: string; starters: ManualPlayer[]; bench: ManualPlayer[] };

const MANUAL_DIR = path.join(process.cwd(), "data", "manual");

function readManual(season: number): ManualLineup | null {
  const file = path.join(MANUAL_DIR, `lineups-${season}.json`);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as ManualLineup) : null;
}

type RawPlayer = {
  playerId: number;
  fullName: string | null;
  defaultPositionId: number | null;
  lineupSlotId: number;
  appliedStatTotal: number | null;
};
type RawSide = { teamId: number; totalPoints: number; lineup: RawPlayer[] };
type RawLineups = { seasonId: number; weeks: { matchupPeriodId: number; games: { home: RawSide; away: RawSide }[] }[] };

const LINEUP_DIR = path.join(process.cwd(), "data", "raw", "lineups");

// lineupSlotId → label, in lineup order. 20 is the bench, 21 IR.
const SLOTS: [number, string][] = [
  [0, "QB"], [2, "RB"], [3, "RB/WR"], [4, "WR"], [5, "WR/TE"], [6, "TE"], [23, "FLEX"], [7, "OP"], [16, "D/ST"], [17, "K"],
];
const BENCH = new Set([20, 21]);
// defaultPositionId → label, in lineup order
const POSITIONS: [number, string][] = [[1, "QB"], [2, "RB"], [3, "WR"], [4, "TE"], [16, "D/ST"], [5, "K"]];
const positionOf = (p: RawPlayer) => POSITIONS.find(([id]) => id === p.defaultPositionId)?.[1] ?? "";

export type LineupPlayer = { name: string; slot: string; points: number | null }; // null: entered by hand
export type ChampionDetails = {
  final: Game | null; // the champion on the home side
  starters: LineupPlayer[] | null; // null when there's no lineup for the season
  bench: LineupPlayer[] | null; // null when ESPN lists starters only
  manual: boolean; // the lineup was entered by hand, without points
  bestGame: Game | null; // the champion on the home side
  bestPlayer: { name: string; position: string; points: number; starts: number } | null;
};

function readLineups(season: number): RawLineups | null {
  const file = path.join(LINEUP_DIR, `${season}.json`);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as RawLineups) : null;
}

// Puts this team on the home side, so details read "champion vs opponent"
function asHome(g: Game, teamId: number): Game {
  if (g.home.teamId === teamId) return g;
  const winner = g.winner === "HOME" ? "AWAY" : g.winner === "AWAY" ? "HOME" : "TIE";
  return { ...g, home: g.away, away: g.home, winner };
}

function sideIn(lineups: RawLineups | null, week: number, teamId: number) {
  const games = lineups?.weeks.find((w) => w.matchupPeriodId === week)?.games ?? [];
  for (const g of games) {
    if (g.home.teamId === teamId) return g.home;
    if (g.away.teamId === teamId) return g.away;
  }
  return null;
}

const player = (p: RawPlayer, slot: string): LineupPlayer => ({
  name: p.fullName ?? `Player ${p.playerId}`,
  slot,
  points: p.appliedStatTotal ?? 0,
});

export type TopStarter = { season: number; person: string; name: string; points: number };

// The MVFP award (the site owner, 2026-11-14): each completed season's player who scored the most
// points for one team while in its starting lineup, every game counted, playoffs included. Ties
// share it. A season without lineups (2021) has none.
let topStartersCache: Map<number, TopStarter[]> | null = null;
export function topStarters(league: League): Map<number, TopStarter[]> {
  if (topStartersCache) return topStartersCache;
  const out = new Map<number, TopStarter[]>();
  for (const info of league.seasons.filter((s) => s.complete)) {
    const lineups = readLineups(info.season);
    const person = new Map(league.teamSeasons.filter((t) => t.season === info.season).map((t) => [t.teamId, t.person]));
    const totals = new Map<string, TopStarter>();
    for (const week of lineups?.weeks ?? []) {
      for (const g of week.games) {
        for (const side of [g.home, g.away]) {
          for (const p of side?.lineup ?? []) {
            if (BENCH.has(p.lineupSlotId)) continue;
            const key = `${side.teamId}:${p.playerId}`;
            const row = totals.get(key) ?? { season: info.season, person: person.get(side.teamId)!, name: p.fullName ?? `Player ${p.playerId}`, points: 0 };
            row.points += p.appliedStatTotal ?? 0;
            totals.set(key, row);
          }
        }
      }
    }
    const cents = (n: number) => Math.round(n * 100);
    const best = Math.max(0, ...[...totals.values()].map((r) => cents(r.points)));
    if (best > 0) out.set(info.season, [...totals.values()].filter((r) => cents(r.points) === best));
  }
  topStartersCache = out;
  return out;
}

export function championDetails(league: League, champ: TeamSeason): ChampionDetails {
  const games = league.games
    .filter((g) => g.season === champ.season && (g.home.teamId === champ.teamId || g.away.teamId === champ.teamId))
    .map((g) => asHome(g, champ.teamId));
  // The champion's last game is the final
  const final = games.length ? games.reduce((a, b) => (b.week > a.week ? b : a)) : null;
  const bestGame = games.length ? games.reduce((a, b) => (b.home.points > a.home.points ? b : a)) : null;

  const lineups = readLineups(champ.season);
  const hasLineups = !!lineups?.weeks.some((w) => w.games.some((g) => g.home.lineup.length || g.away.lineup.length));
  const finalSide = final && hasLineups ? sideIn(lineups, final.week, champ.teamId) : null;
  // 2017 lists starters only, every one in slot 0, so those are labeled by position instead
  const slotsKnown = !!finalSide?.lineup.some((p) => p.lineupSlotId !== 0);
  const starters = !finalSide
    ? null
    : slotsKnown
      ? SLOTS.flatMap(([id, label]) => finalSide.lineup.filter((p) => p.lineupSlotId === id).map((p) => player(p, label)))
      : POSITIONS.flatMap(([id, label]) => finalSide.lineup.filter((p) => p.defaultPositionId === id).map((p) => player(p, label)));
  const benched = finalSide?.lineup.filter((p) => BENCH.has(p.lineupSlotId)) ?? [];
  const bench = benched.length ? benched.map((p) => player(p, p.lineupSlotId === 21 ? "IR" : positionOf(p))) : null;

  // Points scored for the champion: each player's points in the weeks they started, every game counted
  const totals = new Map<number, { p: RawPlayer; points: number; starts: number }>();
  if (hasLineups) {
    for (const g of games) {
      for (const p of sideIn(lineups, g.week, champ.teamId)?.lineup ?? []) {
        if (BENCH.has(p.lineupSlotId)) continue;
        const row = totals.get(p.playerId) ?? { p, points: 0, starts: 0 };
        row.points += p.appliedStatTotal ?? 0;
        row.starts += 1;
        totals.set(p.playerId, row);
      }
    }
  }
  const top = [...totals.values()].sort((a, b) => b.points - a.points)[0];
  const bestPlayer = top
    ? {
        name: top.p.fullName ?? `Player ${top.p.playerId}`,
        position: positionOf(top.p),
        points: top.points,
        starts: top.starts,
      }
    : null;

  // No ESPN lineup: use one entered by hand, if there is one for this champion
  const manual = !starters ? readManual(champ.season) : null;
  if (manual && manual.person === champ.person) {
    const hand = (players: ManualPlayer[]) => players.map((p) => ({ name: p.name, slot: p.slot, points: null }));
    return { final, starters: hand(manual.starters), bench: manual.bench.length ? hand(manual.bench) : null, manual: true, bestGame, bestPlayer };
  }

  return { final, starters, bench, manual: false, bestGame, bestPlayer };
}
