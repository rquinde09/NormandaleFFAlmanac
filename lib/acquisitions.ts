// How each team got the players who scored for it (the site owner's Round 10, 2026-11-25): the draft,
// a pickup (off waivers or free agency) or a trade. Draft IQ, Waiver IQ and the waiver, drop, trade
// and fleece awards come from here.
//
// ESPN gives no transaction log for past seasons, so a player's time with a team (a stint) is read
// from the weekly lineups, which list every team's whole roster from 2018 on. A stint starts the first
// week he's on the team's roster and ends the first week the team plays without him. It's a trade if
// one of the season's trades (data/raw/trades/) sent him to the team since its last game; the draft
// if he's on the roster in the team's first week and it drafted him; otherwise a pickup. A stint's
// points are what he scored in the team's starting lineup, every decided game, so a team's stints add
// up to its points for. 2017's lineups list starters only, so only its drafted players can be told
// apart.
import fs from "node:fs";
import path from "node:path";
import { isStarter, readLineups, type RawSide } from "@/lib/bench";
import { readTrades } from "@/lib/playcalls";

// "unknown": a 2017 starter the team didn't draft (a pickup or a trade; ESPN keeps no way to tell)
export type How = "draft" | "pickup" | "trade" | "unknown";

export type Stint = {
  season: number;
  teamId: number;
  playerId: number;
  name: string;
  position: number | null; // defaultPositionId
  how: How;
  // A trade: the team that sent him. A pickup: the team that had him last this season, or that drafted
  // him and let him go before he played for it (null: no team had him). The draft: null.
  from: number | null;
  tradeId: string | null;
  start: number; // scoringPeriodId of his first week with the team
  points: number; // in the team's starting lineup during the stint
  starts: number;
};

export type Acquisitions = { season: number; rosters: boolean; stints: Stint[] };

type RawDraft = { seasonId: number; picks: { teamId: number; playerId: number }[] };

const DRAFT_DIR = path.join(process.cwd(), "data", "raw", "drafts");
const cents = (n: number) => Math.round(n * 100);

function readDraft(season: number): RawDraft | null {
  const file = path.join(DRAFT_DIR, `${season}.json`);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as RawDraft) : null;
}

const cache = new Map<number, Acquisitions>();

export function acquisitions(season: number): Acquisitions {
  const hit = cache.get(season);
  if (hit) return hit;

  const weeks = [...(readLineups(season)?.weeks ?? [])]
    .sort((a, b) => a.scoringPeriodId - b.scoringPeriodId)
    .map((w) => {
      const teams = new Map<number, RawSide>();
      for (const g of w.games) for (const side of [g.home, g.away]) if (side?.lineup.length) teams.set(side.teamId, side);
      return { period: w.scoringPeriodId, teams };
    });
  // Player −1 is a pick nobody entered (2017's offline draft)
  const drafted = new Map((readDraft(season)?.picks ?? []).filter((p) => p.playerId !== -1).map((p) => [p.playerId, p.teamId]));
  const rosters = weeks.some((w) => [...w.teams.values()].some((s) => s.lineup.some((p) => p.lineupSlotId === 20)));

  const stints: Stint[] = [];
  const stint = (teamId: number, p: RawSide["lineup"][number], period: number, how: How, from: number | null, tradeId: string | null): Stint => {
    const s: Stint = { season, teamId, playerId: p.playerId, name: p.fullName ?? `Player ${p.playerId}`, position: p.defaultPositionId, how, from, tradeId, start: period, points: 0, starts: 0 };
    stints.push(s);
    return s;
  };
  const score = (s: Stint, p: RawSide["lineup"][number]) => {
    if (!isStarter(p)) return;
    s.points += cents(p.appliedStatTotal ?? 0);
    s.starts += 1;
  };

  if (!rosters) {
    // Starters only: one entry per team and player, drafted or not
    const seen = new Map<string, Stint>();
    for (const w of weeks) {
      for (const [teamId, side] of w.teams) {
        for (const p of side.lineup.filter(isStarter)) {
          const key = `${teamId}:${p.playerId}`;
          const s = seen.get(key) ?? stint(teamId, p, w.period, drafted.get(p.playerId) === teamId ? "draft" : "unknown", null, null);
          seen.set(key, s);
          score(s, p);
        }
      }
    }
  } else {
    const trades = readTrades(season);
    const legs = (trades?.available ? trades.trades : []).flatMap((t) => t.legs.map((l) => ({ ...l, tradeId: t.id, period: t.scoringPeriodId, used: false })));
    const open = new Map<string, Stint>(); // teamId:playerId → the stint still running
    const lastGame = new Map<number, number>(); // teamId → the period of its last lineup
    const holder = new Map<number, number>(); // playerId → the team of his latest stint
    for (const w of weeks) {
      // A team that plays without a player has let him go
      for (const [teamId, side] of w.teams) {
        const here = new Set(side.lineup.map((p) => p.playerId));
        for (const [key, s] of open) if (s.teamId === teamId && !here.has(s.playerId)) open.delete(key);
      }
      for (const [teamId, side] of w.teams) {
        const prev = lastGame.get(teamId) ?? null;
        for (const p of side.lineup) {
          const key = `${teamId}:${p.playerId}`;
          let s = open.get(key);
          if (!s) {
            // A trade sent him here: his first week on the roster at or after the trade, as Trade IQ
            // counts it (lib/playcalls.ts). A player traded on again before playing for the team
            // (2022: 18 → 2 → 17 in two days) leaves that leg unused.
            const leg = legs.find((l) => !l.used && l.playerId === p.playerId && l.toTeamId === teamId && l.period <= w.period);
            if (leg) {
              leg.used = true;
              s = stint(teamId, p, w.period, "trade", leg.fromTeamId, leg.tradeId);
            } else if (prev === null && drafted.get(p.playerId) === teamId && !holder.has(p.playerId)) {
              s = stint(teamId, p, w.period, "draft", null, null);
            } else {
              s = stint(teamId, p, w.period, "pickup", holder.get(p.playerId) ?? drafted.get(p.playerId) ?? null, null);
            }
            open.set(key, s);
            holder.set(p.playerId, teamId);
          }
          score(s, p);
        }
        lastGame.set(teamId, w.period);
      }
    }
  }

  const out: Acquisitions = { season, rosters, stints: stints.map((s) => ({ ...s, points: s.points / 100 })) };
  cache.set(season, out);
  return out;
}

// What one trade did for one of its teams (Trade of the Year and Fleece of the Year): what the players
// it got scored in its starting lineup, minus what the players it sent scored for the team that got
// them, each from the trade until he left that roster, as Trade IQ counts a season. A trade's nets add
// up to zero, and a team's nets add up to its Trade IQ.
export type TradeResult = { season: number; tradeId: string; teamId: number; partners: number[]; net: number; got: Stint[]; sent: Stint[] };

const byPoints = (a: Stint, b: Stint) => b.points - a.points || a.name.localeCompare(b.name);

export function tradeResults(season: number): TradeResult[] {
  const byTrade = new Map<string, Stint[]>();
  for (const s of acquisitions(season).stints) if (s.how === "trade") byTrade.set(s.tradeId!, [...(byTrade.get(s.tradeId!) ?? []), s]);
  const out: TradeResult[] = [];
  for (const [tradeId, list] of byTrade) {
    for (const teamId of new Set(list.flatMap((s) => [s.teamId, s.from!]))) {
      const got = list.filter((s) => s.teamId === teamId).sort(byPoints);
      const sent = list.filter((s) => s.from === teamId).sort(byPoints);
      const net = got.reduce((n, s) => n + cents(s.points), 0) - sent.reduce((n, s) => n + cents(s.points), 0);
      const partners = [...new Set([...got.map((s) => s.from!), ...sent.map((s) => s.teamId)])];
      out.push({ season, tradeId, teamId, partners, net: net / 100, got, sent });
    }
  }
  return out;
}

// The season's awards from these (Round 10), all tied entries included. Waiver Pick of the Year: the
// pickup who scored the most for the team that picked him up. Drop of the Year: of the players a team
// let go (drafted, picked up or traded for), the one who then scored the most for the team that picked
// him up; it goes to the team that let him go. Trade of the Year and Fleece of the Year: the biggest
// gain and the biggest loss in one trade. Each needs whole rosters (2018 on), the trades their
// details.
export type SeasonAwards = { waiver: Stint[]; drop: Stint[]; trade: TradeResult[]; fleece: TradeResult[] };

const tops = <T,>(list: T[], value: (x: T) => number) => {
  const best = Math.max(...list.map((x) => cents(value(x))));
  return best > 0 ? list.filter((x) => cents(value(x)) === best) : [];
};

export function seasonAwards(season: number): SeasonAwards {
  const a = acquisitions(season);
  if (!a.rosters) return { waiver: [], drop: [], trade: [], fleece: [] };
  const pickups = a.stints.filter((s) => s.how === "pickup");
  const results = tradeResults(season);
  return {
    waiver: tops(pickups, (s) => s.points),
    // Let go by another team: not one the team itself dropped and picked up again
    drop: tops(pickups.filter((s) => s.from !== null && s.from !== s.teamId), (s) => s.points),
    trade: tops(results, (r) => r.net),
    fleece: tops(results, (r) => -r.net),
  };
}

// Each team's points by how it got the players: the draft, pickups, and (with rosters) trades.
// Without whole rosters (2017) pickups and trades can't be told apart, so only the draft counts.
export function pointsByHow(season: number): Map<number, Record<How, number>> | null {
  const a = acquisitions(season);
  if (!a.stints.length) return null;
  const out = new Map<number, Record<How, number>>();
  for (const s of a.stints) {
    const row = out.get(s.teamId) ?? { draft: 0, pickup: 0, trade: 0, unknown: 0 };
    row[s.how] += cents(s.points);
    out.set(s.teamId, row);
  }
  return new Map([...out].map(([team, r]) => [team, { draft: r.draft / 100, pickup: r.pickup / 100, trade: r.trade / 100, unknown: r.unknown / 100 }]));
}
