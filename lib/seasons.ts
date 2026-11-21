// Season pages and the home page's Pancake Watch (Luke, 2026-11-15; Round 8, 2026-11-20)
import { luck, managerBySlug, type BracketEntry, type League, type SeasonInfo, type TeamSeason } from "@/lib/league";
import { signedStreak } from "@/lib/manager";
import { pancakeOdds } from "@/lib/pancake";
import { regularSeeds } from "@/lib/playcalls";

export type Round = { week: number; label: string; games: BracketEntry[] };

// One round per playoff week, in ESPN's bracket order. The winners bracket names its rounds; the
// pancake ladder (the consolation ladder, where the teams that missed the playoffs play for last
// place) goes by week.
export function rounds(league: League, info: SeasonInfo, kind: "playoff" | "consolation"): Round[] {
  const entries = league.bracket.filter((b) => b.season === info.season && b.kind === kind);
  const weeks = [...new Set(entries.map((b) => b.week))].sort((a, b) => a - b);
  return weeks.map((week) => {
    const after = info.weeks - week; // playoff weeks still to come
    const label =
      kind === "consolation" ? `Week ${week}` : after === 0 ? "Final" : after === 1 ? "Semifinals" : after === 2 ? "Quarterfinals" : `Week ${week}`;
    return { week, label, games: entries.filter((b) => b.week === week) };
  });
}

export type SeasonRow = {
  person: string;
  nickname: string;
  teamName: string;
  place: number; // the final place once the season is over, else the current seed
  seed: number;
  t: TeamSeason;
  luck: number;
  // Rank Change (Round 8, Luke's pick): while the season is on, the seed's change since the week
  // before (the regular season's last two weeks once it's over); a finished season, the
  // regular-season seed against the final place. Up is positive. null in week 1.
  rankChange: number | null;
  streak: number; // the Playcall Review's Streaks: W6 = 6, L4 = −4
};

// Regular-season seeds as they stood after `week`, replayed as ESPN seeds them
function seedsAfter(league: League, info: SeasonInfo, week: number) {
  const teams = league.teamSeasons.filter((t) => t.season === info.season);
  const games = league.games.filter((g) => g.season === info.season && g.kind === "regular" && g.week <= week);
  return regularSeeds(games, new Map(teams.map((t) => [t.teamId, t.division])));
}

// Final standings, or the current ones while the season is on
export function seasonTable(league: League, info: SeasonInfo): SeasonRow[] {
  const lastWeek = Math.min(info.throughWeek, info.regularWeeks);
  const before = !info.complete && lastWeek >= 2 ? seedsAfter(league, info, lastWeek - 1) : null;
  return league.teamSeasons
    .filter((t) => t.season === info.season)
    .map((t) => ({
      person: t.person,
      nickname: managerBySlug(league, t.person)!.nickname,
      teamName: t.teamName,
      place: info.complete ? t.finalRank! : t.seed,
      seed: t.seed,
      t,
      luck: luck(t),
      rankChange: info.complete ? t.seed - t.finalRank! : before ? before.get(t.teamId)! - t.seed : null,
      streak: signedStreak(t),
    }))
    .sort((a, b) => a.place - b.place);
}

export type WatchRow = {
  person: string;
  nickname: string;
  seed: number;
  w: number; // regular season
  l: number;
  t: number;
  chance: number; // of finishing last, from the simulation (lib/pancake.ts)
  safe: boolean; // can't finish last any more
};

export type PancakeWatch =
  | {
      phase: "regular";
      season: number;
      weeksLeft: number; // in the whole season, playoffs included
      regularLeft: number;
      playoffTeams: number;
      line: WatchRow; // the last playoff spot
      rows: WatchRow[]; // below the line, worst seed first
      above: WatchRow[]; // above the line (the line team aside) with a chance, most likely first
    }
  | { phase: "ladder"; season: number; weeksLeft: number; rows: WatchRow[]; ladder: Round[]; final: boolean }; // final: the latest round is the season's last week

// While a season is on: who's outside the playoff spots, worst first, each with a chance of
// finishing last (Round 8). Every team that misses the playoffs plays in the consolation ladder, and
// its last game's loser takes the pancakes, so even the first team out can finish last (2019's 7
// seed did). Once the regular season is over, the ladder's teams and the ladder itself. Seeds are
// ESPN's, which break ties by total points.
export function pancakeWatch(league: League): PancakeWatch | null {
  const info = league.seasons[league.seasons.length - 1];
  const odds = pancakeOdds(league);
  if (info.complete || !odds) return null;
  const teams = league.teamSeasons.filter((t) => t.season === info.season).sort((a, b) => a.seed - b.seed);
  const row = (t: TeamSeason): WatchRow => ({
    person: t.person,
    nickname: managerBySlug(league, t.person)!.nickname,
    seed: t.seed,
    w: t.regular.w,
    l: t.regular.l,
    t: t.regular.t,
    chance: odds.chance.get(t.person) ?? 0,
    safe: odds.safe.has(t.person),
  });
  const weeksLeft = info.weeks - info.throughWeek;
  const byChance = (a: WatchRow, b: WatchRow) => b.chance - a.chance || b.seed - a.seed;
  if (info.throughWeek >= info.regularWeeks) {
    const ladder = rounds(league, info, "consolation");
    return {
      phase: "ladder",
      season: info.season,
      weeksLeft,
      rows: teams.slice(info.playoffTeams).map(row).sort(byChance),
      ladder,
      final: ladder.at(-1)?.week === info.weeks,
    };
  }
  const line = teams[info.playoffTeams - 1];
  return {
    phase: "regular",
    season: info.season,
    weeksLeft,
    regularLeft: info.regularWeeks - info.throughWeek,
    playoffTeams: info.playoffTeams,
    line: row(line),
    rows: teams.slice(info.playoffTeams).reverse().map(row),
    above: teams.slice(0, info.playoffTeams - 1).map(row).filter((r) => r.chance > 0).sort(byChance),
  };
}
