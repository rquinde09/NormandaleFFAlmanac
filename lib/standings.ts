// The three standings views (all-time totals, per-season and per-game averages) and how each
// ranks. No Node imports, so the client-side standings page uses it directly.
import { pct, pts, signed } from "@/lib/format";

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
  name: string; // phone label under the big number
  value: (c: Career) => number;
  show: (c: Career) => string;
  tiesOnly?: boolean; // shown only once the league has a tie
};

export type View = {
  key: ViewKey;
  label: string;
  rate: boolean; // ranks only managers with MIN_SEASONS seasons
  stats: Stat[];
  rankStat: string; // the default sort, which Rank Δ follows
  rank: (a: Career, b: Career) => number;
  phoneSorts: { value: string; label: string }[];
  // Small stats on each phone card: the first four that aren't the sorted stat (shown big)
  phoneMinis: { key: string; label: string; show: (c: Career) => string }[];
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
  stat("wins", "W", "Wins", (c) => c.w, String),
  stat("losses", "L", "Losses", (c) => c.l, String),
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
  stat("pdiff", "PDIFF/G", "PDIFF per game", (c) => perGame(c.pf - c.pa, c), signed),
];

const mini = (stats: Stat[], key: string, label: string) => ({ key, label, show: stats.find((s) => s.key === key)!.show });
const RECORD = { key: "record", label: "Record", show: recordOf };
const sorts = (...pairs: string[]) => pairs.map((p) => ({ value: p.split(":")[0], label: p.split(":")[1] }));

export const VIEWS: View[] = [
  {
    key: "all",
    label: "All-time",
    rate: false,
    stats: ALL,
    rankStat: "wins",
    // Like the old Sheet: by wins, then points for
    rank: (a, b) => b.w - a.w || b.pf - a.pf,
    phoneSorts: sorts("wins:Wins", "pf:PF", "pa:PA", "titles:Titles"),
    phoneMinis: [RECORD, mini(ALL, "pf", "PF"), mini(ALL, "pa", "PA"), mini(ALL, "trades", "Trades"), mini(ALL, "titles", "Titles")],
  },
  {
    key: "season",
    label: "Per season",
    rate: true,
    stats: SEASON,
    rankStat: "wins",
    // Like the old Leaderboard: by wins per season, then points for per season
    rank: (a, b) => perSeason(b.w, b) - perSeason(a.w, a) || perSeason(b.pf, b) - perSeason(a.pf, a),
    phoneSorts: sorts("wins:Wins", "losses:Losses", "pf:PF", "pa:PA"),
    phoneMinis: [mini(SEASON, "wins", "W/S"), mini(SEASON, "losses", "L/S"), mini(SEASON, "pf", "PF/S"), mini(SEASON, "pa", "PA/S"), RECORD],
  },
  {
    key: "game",
    label: "Per game",
    rate: true,
    stats: GAME,
    rankStat: "winpct",
    rank: (a, b) => winPctOf(b) - winPctOf(a) || perGame(b.pf, b) - perGame(a.pf, a),
    phoneSorts: sorts("winpct:Win %", "pf:PF", "pa:PA", "pdiff:PDIFF"),
    phoneMinis: [mini(GAME, "winpct", "Win %"), mini(GAME, "pf", "PF/G"), mini(GAME, "pa", "PA/G"), mini(GAME, "pdiff", "PDIFF/G"), RECORD],
  },
];

// The view a bare /standings shows (the site owner, 2026-11-07). Every other view, All-time
// included, has its own ?view= value.
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
