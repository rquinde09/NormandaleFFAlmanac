// Season pages and the home page's Pancake Watch (Luke, 2026-11-15)
import { luck, managerBySlug, type BracketEntry, type League, type SeasonInfo, type TeamSeason } from "@/lib/league";

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
};

// Final standings, or the current ones while the season is on
export function seasonTable(league: League, info: SeasonInfo): SeasonRow[] {
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
    }))
    .sort((a, b) => a.place - b.place);
}

export type WatchRow = {
  person: string;
  nickname: string;
  seed: number;
  w: number;
  l: number;
  t: number;
  behind: number; // games behind the last playoff spot
  out: boolean; // can't reach a playoff spot any more: headed for the pancake ladder
};

export type PancakeWatch =
  | { phase: "regular"; season: number; weeksLeft: number; playoffTeams: number; line: WatchRow; rows: WatchRow[] }
  | { phase: "ladder"; season: number; ladder: Round[]; final: boolean }; // final: the latest round is the season's last week

// While a season is on: who's outside the playoff spots, worst first. Every team that misses the
// playoffs plays in the consolation ladder, and its loser takes the pancakes, so even the first
// team out can finish last (2019's 7 seed did). Once the regular season is over, the ladder itself.
// Seeds are ESPN's, which break ties by total points.
export function pancakeWatch(league: League): PancakeWatch | null {
  const info = league.seasons[league.seasons.length - 1];
  if (info.complete) return null;
  if (info.throughWeek >= info.regularWeeks) {
    const ladder = rounds(league, info, "consolation");
    return { phase: "ladder", season: info.season, ladder, final: ladder.at(-1)?.week === info.weeks };
  }

  const teams = league.teamSeasons.filter((t) => t.season === info.season).sort((a, b) => a.seed - b.seed);
  const wins = (t: TeamSeason) => t.regular.w + t.regular.t / 2;
  const row = (t: TeamSeason, line: TeamSeason): WatchRow => {
    const left = info.regularWeeks - t.regular.games;
    // Out once at least as many teams as there are playoff spots already have more wins than this
    // one can reach. Equal wins go to the points tiebreak, so they don't count.
    const ahead = teams.filter((o) => o !== t && wins(o) > wins(t) + left).length;
    return {
      person: t.person,
      nickname: managerBySlug(league, t.person)!.nickname,
      seed: t.seed,
      w: t.regular.w,
      l: t.regular.l,
      t: t.regular.t,
      behind: (wins(line) - wins(t) + (t.regular.l + t.regular.t / 2) - (line.regular.l + line.regular.t / 2)) / 2,
      out: ahead >= info.playoffTeams,
    };
  };
  const line = teams[info.playoffTeams - 1];
  return {
    phase: "regular",
    season: info.season,
    weeksLeft: info.regularWeeks - info.throughWeek,
    playoffTeams: info.playoffTeams,
    line: row(line, line),
    rows: teams.slice(info.playoffTeams).reverse().map((t) => row(t, line)),
  };
}
