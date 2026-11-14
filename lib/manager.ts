// What a manager's page shows beyond the standings: the Manager Performance chart, head-to-head
// numbers against each opponent and the achievements (the site owner's Round 2 and Round 3 notes,
// 2026-11-07 and 2026-11-14). Counting rules are in CLAUDE.md.
import { topStarters } from "@/lib/champions";
import { pts } from "@/lib/format";
import { type Game, type Kind, type League, type TeamSeason, managerBySlug } from "@/lib/league";

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

// Every decided game counts, the season in progress included. Only games against active managers
// count: the Active switch was on by default (the site owner, 2026-11-10), and Round 4
// (2026-11-14) removed the switch and kept it on.
export function opponents(league: League, person: string): Opponents {
  const lines = new Map<string, OpponentLine>();
  let bestWin: GameLine | null = null;
  let worstLoss: GameLine | null = null;
  const nickname = (slug: string) => managerBySlug(league, slug)!.nickname;

  for (const g of league.games) {
    const side = g.home.person === person ? "home" : g.away.person === person ? "away" : null;
    if (!side) continue;
    const me = g[side];
    const them = g[side === "home" ? "away" : "home"];
    if (!managerBySlug(league, them.person)?.active) continue;
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

// ---- Manager Performance chart ----

export type ChartMode = "finish" | "wins" | "pf" | "pa" | "streak" | "trades";

// Where a season ranked in the league on one tab: 1–3 earn a medal, `last` the pancake
export type Mark = { place: number | null; last: boolean };

export type SeasonPoint = {
  season: number;
  teams: number;
  values: Record<ChartMode, number>;
  marks: Record<ChartMode, Mark>;
};

// The longer of the season's longest winning and losing streaks, the winning one on a tie: a
// winning streak counts up from zero (W6 = 6), a losing one down (L4 = −4)
export const signedStreak = (t: TeamSeason) => (t.longestLossStreak > t.longestWinStreak ? -t.longestLossStreak : t.longestWinStreak);

const cents = (n: number) => Math.round(n * 100); // compares points without float noise

// How each tab ranks a season against the rest of the league that season (the site owner,
// 2026-11-14: Randy's 2,241.1 PF led 2024, so he gets gold on the PF tab). `better` is strictly
// better, so ties share a place. Finish uses the final standings as they are.
type Ranking = {
  value: (t: TeamSeason) => number;
  better?: (a: TeamSeason, b: TeamSeason) => boolean;
  pancake: boolean; // whether the last place gets the pancake
  medals?: (t: TeamSeason) => boolean; // whether this season can earn a medal at all
};

const RANKINGS: Record<ChartMode, Ranking> = {
  finish: { value: (t) => t.finalRank!, pancake: true },
  // Most wins, ties broken by PF as in the standings
  wins: { value: (t) => t.all.w, better: (a, b) => a.all.w > b.all.w || (a.all.w === b.all.w && cents(a.all.pf) > cents(b.all.pf)), pancake: true },
  pf: { value: (t) => t.all.pf, better: (a, b) => cents(a.all.pf) > cents(b.all.pf), pancake: true },
  // Fewest PA is best: most PA is the "It Was Only A Dream" award
  pa: { value: (t) => t.all.pa, better: (a, b) => cents(a.all.pa) < cents(b.all.pa), pancake: true },
  // Longest winning streak is best, longest losing streak last
  streak: { value: signedStreak, better: (a, b) => signedStreak(a) > signedStreak(b), pancake: true },
  // Most trades is best; no pancake for not trading, and no medal without a trade
  trades: { value: (t) => t.trades, better: (a, b) => a.trades > b.trades, pancake: false, medals: (t) => t.trades > 0 },
};

function mark(mode: ChartMode, t: TeamSeason, field: TeamSeason[]): Mark {
  if (mode === "finish") return { place: t.finalRank, last: t.lastPlace };
  const r = RANKINGS[mode];
  if (r.medals && !r.medals(t)) return { place: null, last: false };
  const place = 1 + field.filter((o) => r.better!(o, t)).length;
  const last = r.pancake && !field.some((o) => r.better!(t, o));
  return { place, last };
}

// One point per completed season. The season in progress stays off the chart: half a season's
// PF would flatten the rest.
export function performance(league: League, person: string): SeasonPoint[] {
  const complete = new Map(league.seasons.filter((s) => s.complete).map((s) => [s.season, s]));
  const modes = Object.keys(RANKINGS) as ChartMode[];
  return league.teamSeasons
    .filter((t) => t.person === person && complete.has(t.season))
    .sort((a, b) => a.season - b.season)
    .map((t) => {
      const field = league.teamSeasons.filter((o) => o.season === t.season);
      return {
        season: t.season,
        teams: complete.get(t.season)!.teams,
        values: Object.fromEntries(modes.map((m) => [m, RANKINGS[m].value(t)])) as Record<ChartMode, number>,
        marks: Object.fromEntries(modes.map((m) => [m, mark(m, t, field)])) as Record<ChartMode, Mark>,
      };
    });
}

// ---- Achievements ----

export type Tier = "goat" | "pancake";

export type Achievement = {
  key: string;
  tier: Tier;
  icon: string;
  title: string;
  detail: string; // shown when tapped: what earns it, in the site owner's words (2026-11-14)
  fine?: string; // how it's counted
  earned: boolean;
  note?: string; // under the icon once earned: the seasons ("’18 ’23")
  seasons: { season: number; extra?: string }[]; // shown when tapped
};

const short = (seasons: number[]) => (seasons.length ? seasons.map((s) => `’${String(s).slice(2)}`).join(" ") : undefined);
const bySeasons = (seasons: number[]) => ({ earned: seasons.length > 0, note: short(seasons), seasons: seasons.map((season) => ({ season })) });

// Two tiers, switched by tabs (the site owner, 2026-11-14). Earned in any completed season lights
// the icon; season PF and PA count every game that season, and ties share an award.
export function achievements(league: League, person: string): Achievement[] {
  const complete = new Set(league.seasons.filter((s) => s.complete).map((s) => s.season));
  const done = league.teamSeasons.filter((t) => t.person === person && complete.has(t.season)).sort((a, b) => a.season - b.season);
  const years = (pick: (t: TeamSeason) => boolean) => done.filter(pick).map((t) => t.season);

  // Best (or worst) in the league that season
  const leads = (value: (t: TeamSeason) => number, most: boolean) =>
    years((t) => {
      const field = league.teamSeasons.filter((x) => x.season === t.season).map((x) => cents(value(x)));
      return cents(value(t)) === (most ? Math.max(...field) : Math.min(...field));
    });

  const mvfp = [...topStarters(league).values()].flat().filter((p) => p.person === person).sort((a, b) => a.season - b.season);
  const EVERY_GAME = "In one season, every game counted: regular season and playoffs.";

  return [
    { key: "goat", tier: "goat", icon: "🐐", title: "The Mahaan Bakaree", detail: "Won a Championship", ...bySeasons(years((t) => t.finalRank === 1)) },
    { key: "moty", tier: "goat", icon: "🔥", title: "Manager of the Year", detail: "Scored the Most Points For", fine: EVERY_GAME, ...bySeasons(leads((t) => t.all.pf, true)) },
    { key: "seed", tier: "goat", icon: "🥇", title: "The #1 Seed", detail: "1st Place in the Regular Season", ...bySeasons(years((t) => t.seed === 1)) },
    {
      key: "mvfp",
      tier: "goat",
      icon: "💪",
      title: "MVFP",
      detail: "Had the highest scoring player in the league",
      fine: "Most points by one player in a team's starting lineup that season, playoffs included. ESPN has no 2021 lineups.",
      earned: mvfp.length > 0,
      note: short([...new Set(mvfp.map((p) => p.season))]),
      seasons: mvfp.map((p) => ({ season: p.season, extra: `${p.name}, ${pts(p.points)} pts` })),
    },
    { key: "pancake", tier: "pancake", icon: "🥞", title: "The Pancake House", detail: "Last Place", ...bySeasons(years((t) => t.lastPlace)) },
    { key: "choke", tier: "pancake", icon: "🧑‍🎨", title: "The Choke Artist", detail: "Runner Up", ...bySeasons(years((t) => t.finalRank === 2)) },
    { key: "below-zero", tier: "pancake", icon: "🥶", title: "Below Zero", detail: "Scored the Least Points For", fine: EVERY_GAME, ...bySeasons(leads((t) => t.all.pf, false)) },
    { key: "dream", tier: "pancake", icon: "😢", title: "It Was Only A Dream", detail: "Most Points Against in a Season", fine: EVERY_GAME, ...bySeasons(leads((t) => t.all.pa, true)) },
  ];
}
