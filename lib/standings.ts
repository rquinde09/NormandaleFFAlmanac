// The Standings' three views (all-time totals, per-season and per-game averages) and how each ranks.
// Round 10 (the site owner, 2026-11-25) named them Career Records, Season Averages and Power Rankings;
// Round 11 (the same day) ordered them Power Rankings, Season Averages, Career Records, left to right.
// No Node imports, so the client-side Standings page uses it directly.
import { pct, pts } from "@/lib/format";

// The per-season and per-game views rank only managers with this many seasons, so a short career
// can't top them. Placeholder until the league picks a number (see CLAUDE.md).
export const MIN_SEASONS = 3;

// One person's totals over a span of seasons. Every decided game counts (CLAUDE.md).
export type Career = {
  w: number;
  l: number;
  t: number;
  pf: number;
  pa: number;
  games: number;
  seasons: number;
  // Seasons for per-season averages: each finished season counts 1, the one in progress counts
  // as the share of its weeks played so far (Luke's call, 2026-11-05)
  seasonWeight: number;
  titles: number;
  lastPlaces: number; // the pancakes
  trades: number;
};

export type ViewKey = "all" | "season" | "game";

export type Stat = {
  key: string;
  label: string; // table header
  name: string; // the full name, on the desktop header's tooltip
  value: (c: Career) => number;
  show: (c: Career) => string;
  tiesOnly?: boolean; // shown only once the league has a tie
  // On a phone, shown in place of the number: All-time's Wins and Losses show the record (the site
  // owner's Round 8 "W/L", Round 9's "Record")
  phone?: { show: (c: Career) => string };
};

// A phone sort option. Record (All-time, Round 9) sorts by one of its stats, picked by a second
// control: Wins or Losses.
export type PhoneSort = { value: string; label: string; within?: { value: string; label: string }[] };

export type View = {
  key: ViewKey;
  label: string;
  rate: boolean; // ranks only managers with MIN_SEASONS seasons
  stats: Stat[];
  rankStat: string; // the default sort, which Rank Δ follows
  rank: (a: Career, b: Career) => number;
  phoneSorts: PhoneSort[];
};

export const winPctOf = (c: Career) => (c.games ? (c.w + c.t / 2) / c.games : 0);
const perSeason = (n: number, c: Career) => (c.seasonWeight ? n / c.seasonWeight : 0);
const perGame = (n: number, c: Career) => (c.games ? n / c.games : 0);
const two = (n: number) => n.toFixed(2);
const recordOf = (c: Career) => (c.t ? `${c.w}-${c.l}-${c.t}` : `${c.w}-${c.l}`);

function stat(key: string, label: string, name: string, value: (c: Career) => number, show: (n: number) => string, tiesOnly = false): Stat {
  return { key, label, name, value, show: (c) => show(value(c)), tiesOnly };
}

const ALL: Stat[] = [
  { ...stat("wins", "W", "Wins", (c) => c.w, String), phone: { show: recordOf } },
  { ...stat("losses", "L", "Losses", (c) => c.l, String), phone: { show: recordOf } },
  stat("ties", "T", "Ties", (c) => c.t, String, true),
  stat("pf", "PF", "Points for", (c) => c.pf, pts),
  stat("pa", "PA", "Points against", (c) => c.pa, pts),
  stat("seasons", "Seasons", "Seasons", (c) => c.seasons, String),
  stat("titles", "Titles", "Titles", (c) => c.titles, String),
  stat("trades", "Trades", "Trades", (c) => c.trades, String),
];

const SEASON: Stat[] = [
  stat("wins", "W/S", "Wins per season", (c) => perSeason(c.w, c), two),
  stat("losses", "L/S", "Losses per season", (c) => perSeason(c.l, c), two),
  stat("ties", "T/S", "Ties per season", (c) => perSeason(c.t, c), two, true),
  stat("pf", "PF/S", "PF per season", (c) => perSeason(c.pf, c), pts),
  stat("pa", "PA/S", "PA per season", (c) => perSeason(c.pa, c), pts),
  stat("seasons", "Seasons", "Seasons", (c) => c.seasons, String),
];

const GAME: Stat[] = [
  stat("winpct", "Win %", "Win %", winPctOf, pct),
  stat("pf", "PF/G", "PF per game", (c) => perGame(c.pf, c), pts),
  stat("pa", "PA/G", "PA per game", (c) => perGame(c.pa, c), pts),
];

const sorts = (...pairs: string[]): PhoneSort[] => pairs.map((p) => ({ value: p.split(":")[0], label: p.split(":")[1] }));

// Round 11 (the site owner, 2026-11-25): Power Rankings, Season Averages, Career Records, left to right
export const VIEWS: View[] = [
  {
    key: "game",
    label: "Power Rankings",
    rate: true,
    stats: GAME,
    rankStat: "winpct",
    rank: (a, b) => winPctOf(b) - winPctOf(a) || perGame(b.pf, b) - perGame(a.pf, a),
    // PDIFF removed in Round 8 (the site owner, 2026-11-20)
    phoneSorts: sorts("winpct:Win %", "pf:PF", "pa:PA"),
  },
  {
    key: "season",
    label: "Season Averages",
    rate: true,
    stats: SEASON,
    rankStat: "wins",
    // Like the old Leaderboard: by wins per season, then points for per season
    rank: (a, b) => perSeason(b.w, b) - perSeason(a.w, a) || perSeason(b.pf, b) - perSeason(a.pf, a),
    phoneSorts: sorts("wins:Wins", "losses:Losses", "pf:PF", "pa:PA"),
  },
  {
    key: "all",
    label: "Career Records",
    rate: false,
    stats: ALL,
    rankStat: "wins",
    // Like the old Sheet: by wins, then points for
    rank: (a, b) => b.w - a.w || b.pf - a.pf,
    // Round 9: "Record", sorted by Wins (the default) or Losses
    phoneSorts: [{ value: "record", label: "Record", within: sorts("wins:Wins", "losses:Losses") }, ...sorts("pf:PF", "pa:PA", "titles:Titles")],
  },
];

// The view a bare /standings shows (the site owner, 2026-11-07; Round 9 calls it "the main
// leaderboard"; Round 10 names it Power Rankings). Every other view has its own ?view= value.
export const DEFAULT_VIEW: ViewKey = "game";

export const qualifies = (view: View, c: Career) => !view.rate || c.seasons >= MIN_SEASONS;

// Ranking order (slugs) of the careers that can be ranked in this view: some games, and enough
// seasons for a rate view.
export function rankOrder(view: View, careers: [string, Career | null][]) {
  return careers
    .filter((e): e is [string, Career] => !!e[1] && e[1].games > 0 && qualifies(view, e[1]))
    .sort(([, a], [, b]) => view.rank(a, b))
    .map(([slug]) => slug);
}
