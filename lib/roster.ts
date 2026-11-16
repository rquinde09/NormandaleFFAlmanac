// The Roster box under the Manager Performance chart (the site owner's Round 5, inspired by Luke,
// 2026-11-15): four players from the selected season's team. Lineups come from
// data/raw/lineups/{season}.json, the draft from data/raw/drafts/, players' season points and ESPN's
// preseason projections from data/raw/players/. The season in progress counts its decided weeks.
import fs from "node:fs";
import path from "node:path";
import { isStarter, lineupSides, readLineups } from "@/lib/bench";
import { pts, signed } from "@/lib/format";
import type { TeamSeason } from "@/lib/league";

type RawPick = { overallPickNumber: number; roundId: number; roundPickNumber: number; teamId: number; playerId: number };
type RawDraft = { seasonId: number; picks: RawPick[] };
type RawSeasonPlayer = { playerId: number; fullName: string | null; defaultPositionId: number | null; points: number; projected: number | null };
// `weekly` is false where ESPN gives only season totals (2017), which run through the NFL's last
// week rather than the fantasy season's
type RawPlayers = { seasonId: number; throughScoringPeriod: number; weekly: boolean; players: RawSeasonPlayer[] };

const RAW_DIR = path.join(process.cwd(), "data", "raw");
const cache = new Map<string, unknown>();
function readRaw<T>(dir: string, season: number): T | null {
  const key = `${dir}/${season}`;
  if (!cache.has(key)) {
    const file = path.join(RAW_DIR, dir, `${season}.json`);
    cache.set(key, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null);
  }
  return cache.get(key) as T | null;
}

const POSITION: Record<number, string> = { 1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "D/ST" };

export type RosterPlayer = {
  playerId: number; // ESPN's: the client builds the headshot (or, for a D/ST, the team logo) from it
  name: string;
  position: string;
  stat: string; // under the name
  note?: string; // smaller, under the stat
};

export type RosterKey = "best" | "drafted" | "inconsistent" | "franchise";
export type RosterBox = {
  picks: Record<RosterKey, RosterPlayer | null>;
  missing: string | null; // why some picks are empty that season
};

const cents = (n: number) => Math.round(n * 100);

export function rosterBox(t: TeamSeason): RosterBox {
  const lineups = readLineups(t.season);
  const draft = readRaw<RawDraft>("drafts", t.season);
  const players = readRaw<RawPlayers>("players", t.season);
  const info = new Map((players?.players ?? []).map((p) => [p.playerId, p]));

  // Every week this team started each player: points, starts, and points against ESPN's projection
  type Row = { playerId: number; name: string; position: string; points: number; starts: number; vsProjection: number; projectedStarts: number };
  const rows = new Map<number, Row>();
  for (const { side } of lineupSides(lineups)) {
    if (side.teamId !== t.teamId) continue;
    for (const p of side.lineup.filter(isStarter)) {
      const row = rows.get(p.playerId) ?? {
        playerId: p.playerId,
        name: p.fullName ?? `Player ${p.playerId}`,
        position: POSITION[p.defaultPositionId ?? 0] ?? "",
        points: 0,
        starts: 0,
        vsProjection: 0,
        projectedStarts: 0,
      };
      row.points += cents(p.appliedStatTotal ?? 0);
      row.starts += 1;
      if (p.projectedTotal != null) {
        row.vsProjection += cents(p.appliedStatTotal ?? 0) - cents(p.projectedTotal);
        row.projectedStarts += 1;
      }
      rows.set(p.playerId, row);
    }
  }
  const started = [...rows.values()];
  const first = <T,>(list: T[], compare: (a: T, b: T) => number) => (list.length ? [...list].sort(compare)[0] : null);
  const byName = (a: Row, b: Row) => a.name.localeCompare(b.name);
  const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

  // Best player: the most points while in this team's starting lineup (the MVFP rule)
  const best = first(started, (a, b) => b.points - a.points || byName(a, b));
  // Franchise player: the most starts; a tie goes to ESPN's higher preseason projection
  const franchise = first(started, (a, b) => b.starts - a.starts || (info.get(b.playerId)?.projected ?? 0) - (info.get(a.playerId)?.projected ?? 0) || b.points - a.points || byName(a, b));
  // Inconsistent: the starter furthest below ESPN's weekly projections, added up over his starts
  const inconsistent = first(started.filter((r) => r.projectedStarts > 0 && r.vsProjection < 0), (a, b) => a.vsProjection - b.vsProjection || byName(a, b));
  // Best drafted: the most points that fantasy season by any of this team's picks, wherever he played
  const picks = (draft?.picks ?? []).filter((p) => p.teamId === t.teamId && info.has(p.playerId));
  const drafted = first(picks, (a, b) => cents(info.get(b.playerId)!.points) - cents(info.get(a.playerId)!.points) || a.overallPickNumber - b.overallPickNumber);
  const draftedInfo = drafted ? info.get(drafted.playerId)! : null;

  const hasLineups = started.length > 0;
  const hasProjections = started.some((r) => r.projectedStarts > 0);
  return {
    picks: {
      best: best && { playerId: best.playerId, name: best.name, position: best.position, stat: `${pts(best.points / 100)} pts`, note: plural(best.starts, "start") },
      drafted:
        drafted && draftedInfo
          ? {
              playerId: drafted.playerId,
              name: draftedInfo.fullName ?? `Player ${drafted.playerId}`,
              position: POSITION[draftedInfo.defaultPositionId ?? 0] ?? "",
              stat: `${pts(draftedInfo.points)} pts`,
              note: `Round ${drafted.roundId}`,
            }
          : null,
      inconsistent: inconsistent && {
        playerId: inconsistent.playerId,
        name: inconsistent.name,
        position: inconsistent.position,
        stat: `${signed(inconsistent.vsProjection / 100)} pts`,
        note: "vs projected",
      },
      franchise: franchise && {
        playerId: franchise.playerId,
        name: franchise.name,
        position: franchise.position,
        stat: plural(franchise.starts, "start"),
        note: `${pts(franchise.points / 100)} pts`,
      },
    },
    missing: !hasLineups
      ? `ESPN kept no ${t.season} lineups, so only the draft shows.`
      : !hasProjections
        ? `ESPN has no ${t.season} projections, so no Inconsistent pick.`
        : null,
  };
}
