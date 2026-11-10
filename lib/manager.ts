// What a manager's page shows beyond the standings: head-to-head numbers against each opponent and
// the achievements (the site owner's Round 2 notes, 2026-11-07). Counting rules are in CLAUDE.md.
import { type Game, type Kind, type League, managerBySlug } from "@/lib/league";

export type OpponentLine = {
  slug: string;
  nickname: string;
  games: number;
  w: number;
  l: number;
  t: number;
  pf: number; // this manager's points in those games
  pa: number; // the opponent's
};

export type GameLine = {
  season: number;
  week: number;
  kind: Kind;
  opponentSlug: string;
  opponent: string;
  pf: number;
  pa: number;
};

export type OpponentKey = "faced" | "easiest" | "toughest" | "pf" | "pa";

export type Opponents = {
  picks: Record<OpponentKey, OpponentLine | null>;
  bestWin: GameLine | null; // the win with the most points
  worstLoss: GameLine | null; // the loss with the fewest points
};

const winPct = (o: OpponentLine) => (o.games ? (o.w + o.t / 2) / o.games : 0);

// Every decided game counts, the season in progress included. `counts` limits the opponents (the
// Active switch, on by default: the site owner, 2026-11-10).
export function opponents(league: League, person: string, counts: (opponent: string) => boolean = () => true): Opponents {
  const lines = new Map<string, OpponentLine>();
  let bestWin: GameLine | null = null;
  let worstLoss: GameLine | null = null;
  const nickname = (slug: string) => managerBySlug(league, slug)!.nickname;

  for (const g of league.games) {
    const side = g.home.person === person ? "home" : g.away.person === person ? "away" : null;
    if (!side) continue;
    const me = g[side];
    const them = g[side === "home" ? "away" : "home"];
    if (!counts(them.person)) continue;
    const result = g.winner === "TIE" ? "T" : g.winner === side.toUpperCase() ? "W" : "L";
    const o = lines.get(them.person) ?? { slug: them.person, nickname: nickname(them.person), games: 0, w: 0, l: 0, t: 0, pf: 0, pa: 0 };
    o.games += 1;
    o.pf += me.points;
    o.pa += them.points;
    if (result === "W") o.w += 1;
    else if (result === "L") o.l += 1;
    else o.t += 1;
    lines.set(them.person, o);

    const line = (x: Game): GameLine => ({
      season: x.season,
      week: x.week,
      kind: x.kind,
      opponentSlug: them.person,
      opponent: nickname(them.person),
      pf: me.points,
      pa: them.points,
    });
    if (result === "W" && (!bestWin || me.points > bestWin.pf)) bestWin = line(g);
    if (result === "L" && (!worstLoss || me.points < worstLoss.pf)) worstLoss = line(g);
  }

  const all = [...lines.values()];
  const top = (compare: (a: OpponentLine, b: OpponentLine) => number) =>
    all.length ? [...all].sort((a, b) => compare(a, b) || a.nickname.localeCompare(b.nickname))[0] : null;
  return {
    picks: {
      faced: top((a, b) => b.games - a.games || b.w - a.w),
      easiest: top((a, b) => b.w - a.w || winPct(b) - winPct(a)),
      toughest: top((a, b) => b.l - a.l || winPct(a) - winPct(b)),
      pf: top((a, b) => b.pf - a.pf),
      pa: top((a, b) => b.pa - a.pa),
    },
    bestWin,
    worstLoss,
  };
}

export type Achievement = {
  key: string;
  icon: string;
  title: string;
  detail: string; // what earns it
  earned: boolean;
  note?: string; // under the icon once earned: the seasons ("’18 ’23"), or a count ("12 trades")
};

const short = (seasons: number[]) => (seasons.length ? seasons.map((s) => `’${String(s).slice(2)}`).join(" ") : undefined);
const bySeasons = (seasons: number[]) => ({ earned: seasons.length > 0, note: short(seasons) });

// Earned in any one season lights the icon. Finishes, seeds and season PF/PA count completed
// seasons only; a trade counts as soon as it's made.
export function achievements(league: League, person: string): Achievement[] {
  const complete = new Set(league.seasons.filter((s) => s.complete).map((s) => s.season));
  const mine = league.teamSeasons.filter((t) => t.person === person).sort((a, b) => a.season - b.season);
  const done = mine.filter((t) => complete.has(t.season));
  const years = (pick: (t: (typeof mine)[number]) => boolean, from = done) => from.filter(pick).map((t) => t.season);

  // Best in the league that season, every game counted (CLAUDE.md); ties share it
  const leads = (value: (t: (typeof mine)[number]) => number, most: boolean) =>
    years((t) => {
      const field = league.teamSeasons.filter((x) => x.season === t.season).map(value);
      return value(t) === (most ? Math.max(...field) : Math.min(...field));
    });

  const trades = mine.reduce((n, t) => n + t.trades, 0);

  return [
    { key: "goat", icon: "🐐", title: "The Mahaan Bakaree", detail: "Goat Award: won the championship", ...bySeasons(years((t) => t.finalRank === 1)) },
    { key: "pancake", icon: "🥞", title: "The Pancake House", detail: "Pancake Award: finished last", ...bySeasons(years((t) => t.lastPlace)) },
    { key: "smoked", icon: "🔥", title: "Smoked the Competition", detail: "Most points for in a season, regular season and playoffs", ...bySeasons(leads((t) => t.all.pf, true)) },
    { key: "choke", icon: "🧑‍🎨", title: "The Choke Artist", detail: "Runner-up", ...bySeasons(years((t) => t.finalRank === 2)) },
    { key: "below-zero", icon: "🥶", title: "The Below Zero", detail: "Fewest points against in a season, regular season and playoffs", ...bySeasons(leads((t) => t.all.pa, false)) },
    { key: "seed", icon: "🥇", title: "The #1 Seed", detail: "1st place in the regular season", ...bySeasons(years((t) => t.seed === 1)) },
    { key: "trade", icon: "🤝", title: "Trade", detail: "Made a trade", earned: trades > 0, note: trades ? `${trades} trade${trades === 1 ? "" : "s"}` : undefined },
    // Kept by hand in managers.json: ESPN data doesn't say who ran the league
    { key: "commish", icon: "🫡", title: "The Commish", detail: "Commissioner of the league", earned: !!managerBySlug(league, person)?.commish },
  ];
}
