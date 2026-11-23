// What a manager's page shows beyond the standings: the Manager Performance chart with its Playcall
// Review, head-to-head numbers against each opponent and the achievements (the site owner's notes,
// Rounds 2–7, 2026-11-07 to 2026-11-18). Counting rules are in CLAUDE.md.
import { topStarters } from "@/lib/champions";
import { pct, pts, record } from "@/lib/format";
import { DUNZO_OVER, ICE_WITHIN, type Game, type Kind, type League, type TeamSeason, careerTotals, luck, managerBySlug, marginCents, odds, winPct as careerWinPct } from "@/lib/league";
import { rosterBox, type RosterBox } from "@/lib/roster";

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

// ---- Manager Performance and the Playcall Review ----

// Manager Performance's tabs: Finish, Wins, PF, PA
export type ChartMode = "finish" | "wins" | "pf" | "pa";

// Where a season ranked in the league on one tab: 1–3 earn a medal where `medal` allows one, `last`
// the pancake. `place` is null without a number that season.
export type Mark = { place: number | null; medal: boolean; last: boolean };

// What the lines under Manager Performance and the Playcall Review say about the selected season
export type SeasonFacts = {
  record: string; // every decided game
  seed: number;
  optimizedSeed: number | null; // the seed with the best lineup every week; completed seasons only
  trades: number;
};

// The Playcall Review (the site owner's Round 6, 2026-11-17): one season's decisions, each a bar
// from Bad to Good with zero in the middle. Higher is better on every one.
export type ReviewKey = "luck" | "odds" | "iq" | "trades" | "streak";

export type ReviewRow = {
  value: number | null; // null: no number that season (no projections, bench lineups or trade details)
  lo: number; // the league's worst that season, at most 0: the bar's left end
  hi: number; // the league's best that season, at least 0: its right end
  place: number | null; // 1 = the league's best that season; ties share a place
};

export type SeasonPoint = {
  season: number;
  teams: number;
  live: boolean; // the season in progress: on the axis, selectable, but no chart numbers (Round 5)
  values: Record<ChartMode, number | null>; // null: no number that season
  marks: Record<ChartMode, Mark>;
  facts: SeasonFacts;
  roster: RosterBox;
  review: Record<ReviewKey, ReviewRow>; // the season in progress counts its decided weeks
};

// The longer of the season's longest winning and losing streaks, the winning one on a tie: a
// winning streak counts up from zero (W6 = 6), a losing one down (L4 = −4)
export const signedStreak = (t: TeamSeason) => (t.longestLossStreak > t.longestWinStreak ? -t.longestLossStreak : t.longestWinStreak);

const cents = (n: number) => Math.round(n * 100); // compares points without float noise

// How each tab ranks a season against the rest of the league that season (the site owner,
// 2026-11-14: Randy's 2,241.1 PF led 2024, so he gets gold on the PF tab). `better` is strictly
// better, so ties share a place. Finish uses the final standings as they are.
type Ranking = {
  value: (t: TeamSeason) => number | null;
  better?: (a: TeamSeason, b: TeamSeason) => boolean;
};

const RANKINGS: Record<ChartMode, Ranking> = {
  finish: { value: (t) => t.finalRank! },
  // Most wins, ties broken by PF as in the standings
  wins: { value: (t) => t.all.w, better: (a, b) => a.all.w > b.all.w || (a.all.w === b.all.w && cents(a.all.pf) > cents(b.all.pf)) },
  pf: { value: (t) => t.all.pf, better: (a, b) => cents(a.all.pf) > cents(b.all.pf) },
  // Fewest PA is best: most PA is the "It Was Only A Dream" award
  pa: { value: (t) => t.all.pa, better: (a, b) => cents(a.all.pa) < cents(b.all.pa) },
};

function mark(mode: ChartMode, t: TeamSeason, everyone: TeamSeason[]): Mark {
  if (mode === "finish") return { place: t.finalRank, medal: true, last: t.lastPlace };
  const better = RANKINGS[mode].better!;
  const place = 1 + everyone.filter((o) => better(o, t)).length;
  return { place, medal: true, last: !everyone.some((o) => better(t, o)) };
}

const MODES = Object.keys(RANKINGS) as ChartMode[];

// Each Playcall Review number for every team of one season. Roster IQ is the league's average
// points left on the bench minus the team's own, so it adds up to zero each season, like Luck, Odds
// and Trades. Trades is 0 for a team that made none.
function reviewValues(field: TeamSeason[]): Map<TeamSeason, Record<ReviewKey, number | null>> {
  const benched = field.filter((o) => o.bench !== null);
  const average = benched.length ? benched.reduce((n, o) => n + o.bench!, 0) / benched.length : null;
  return new Map(
    field.map((t) => [
      t,
      {
        luck: luck(t),
        odds: odds(t),
        iq: average === null || t.bench === null ? null : average - t.bench,
        trades: t.tradeNet,
        streak: signedStreak(t),
      },
    ]),
  );
}

const REVIEW_KEYS: ReviewKey[] = ["luck", "odds", "iq", "trades", "streak"];

function review(t: TeamSeason, field: TeamSeason[]): Record<ReviewKey, ReviewRow> {
  const all = reviewValues(field);
  return Object.fromEntries(
    REVIEW_KEYS.map((key) => {
      const value = all.get(t)![key];
      const others = [...all.values()].map((v) => v[key]).filter((v): v is number => v !== null);
      return [
        key,
        {
          value,
          lo: Math.min(0, ...others),
          hi: Math.max(0, ...others),
          place: value === null ? null : 1 + others.filter((o) => cents(o) > cents(value)).length,
        },
      ];
    }),
  ) as Record<ReviewKey, ReviewRow>;
}

// One point per season the manager played. Completed seasons carry the chart numbers; the season in
// progress is on the axis with none (half a season's PF would flatten the rest), but its Roster box
// and Playcall Review count the weeks decided so far.
export function performance(league: League, person: string): SeasonPoint[] {
  const info = new Map(league.seasons.map((s) => [s.season, s]));
  return league.teamSeasons
    .filter((t) => t.person === person)
    .sort((a, b) => a.season - b.season)
    .map((t) => {
      const season = info.get(t.season)!;
      const field = league.teamSeasons.filter((o) => o.season === t.season);
      const live = !season.complete;
      return {
        season: t.season,
        teams: season.teams,
        live,
        values: Object.fromEntries(MODES.map((m) => [m, live ? null : RANKINGS[m].value(t)])) as Record<ChartMode, number | null>,
        marks: Object.fromEntries(MODES.map((m) => [m, live ? { place: null, medal: false, last: false } : mark(m, t, field)])) as Record<ChartMode, Mark>,
        facts: { record: record(t.all), seed: t.seed, optimizedSeed: t.optimizedSeed, trades: t.trades },
        roster: rosterBox(t),
        review: review(t, field),
      };
    });
}

// ---- Close games and blowouts (Round 7) ----

export type WLT = { w: number; l: number; t: number };

// The Career stats line, "Close games 16-4 · Blowouts 7-11": every decided game, the season in
// progress included like the rest of the career numbers. Pass a league cut at a season to stop there.
export function marginCareer(league: League, person: string): { close: WLT; blowout: WLT } {
  const sum = { close: { w: 0, l: 0, t: 0 }, blowout: { w: 0, l: 0, t: 0 } };
  for (const t of league.teamSeasons.filter((x) => x.person === person)) {
    for (const kind of ["close", "blowout"] as const) {
      sum[kind].w += t[kind].w;
      sum[kind].l += t[kind].l;
      sum[kind].t += t[kind].t;
    }
  }
  return sum;
}

// The row under the all-time record in Career stats, in the site owner's Round 9 order (2026-11-23):
// Seasons, Win %, Total PF, Close games, Blowouts. Round 9 removed PF/G.
export function careerStats(league: League, person: string): { label: string; value: string }[] {
  const career = careerTotals(league).get(person)!;
  const margins = marginCareer(league, person);
  return [
    { label: "Seasons", value: String(career.seasons) },
    { label: "Win %", value: pct(careerWinPct(career)) },
    { label: "Total PF", value: pts(career.pf) },
    { label: "Close games", value: record(margins.close) },
    { label: "Blowouts", value: record(margins.blowout) },
  ];
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
  // Round 8 (the site owner, 2026-11-20): a season with any game won by a point or less (Ice in the
  // Veins), or lost by more than DUNZO_OVER (Dunzo), against anyone, retired managers included
  const anyGame = (pick: (g: Game, won: boolean) => boolean) =>
    years((t) =>
      league.games.some((g) => {
        if (g.season !== t.season || g.winner === "TIE") return false;
        const side = g.home.teamId === t.teamId ? "HOME" : g.away.teamId === t.teamId ? "AWAY" : null;
        return side !== null && pick(g, g.winner === side);
      }),
    );
  const MARGINS = "Every game counts: regular season and playoffs, against anyone.";

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
      fine: "Most points by one player in a team's starting lineup that season, playoffs included.",
      earned: mvfp.length > 0,
      note: short([...new Set(mvfp.map((p) => p.season))]),
      seasons: mvfp.map((p) => ({ season: p.season, extra: `${p.name}, ${pts(p.points)} pts` })),
    },
    // Round 7 (2026-11-18); Round 8 made it any win within a point (2026-11-20)
    { key: "ice", tier: "goat", icon: "🧊", title: "Ice in the Veins", detail: "Won a Game Within a Point",
      fine: `Won by ${ICE_WITHIN} point or less. ${MARGINS}`, ...bySeasons(anyGame((g, won) => won && marginCents(g) <= ICE_WITHIN * 100)) },
    { key: "pancake", tier: "pancake", icon: "🥞", title: "The Pancake House", detail: "Last Place", ...bySeasons(years((t) => t.lastPlace)) },
    { key: "choke", tier: "pancake", icon: "🧑‍🎨", title: "The Choke Artist", detail: "Runner Up", ...bySeasons(years((t) => t.finalRank === 2)) },
    { key: "below-zero", tier: "pancake", icon: "🥶", title: "Below Zero", detail: "Scored the Least Points For", fine: EVERY_GAME, ...bySeasons(leads((t) => t.all.pf, false)) },
    { key: "dream", tier: "pancake", icon: "😢", title: "It Was Only A Dream", detail: "Most Points Against in a Season", fine: EVERY_GAME, ...bySeasons(leads((t) => t.all.pa, true)) },
    // Luke, 2026-11-15
    {
      key: "benchwarmer",
      tier: "pancake",
      icon: "🪑",
      title: "The Benchwarmer",
      detail: "Left the Most Points on the Bench",
      fine: "In one season, every game counted: the best possible lineup each week minus the one started. ESPN has bench lineups from 2018 on.",
      ...bySeasons(
        years((t) => {
          const field = league.teamSeasons.filter((x) => x.season === t.season && x.bench !== null).map((x) => cents(x.bench!));
          return t.bench !== null && cents(t.bench) === Math.max(...field);
        }),
      ),
    },
    // Round 7's Got Blown Out, renamed Dunzo in Round 8: any loss by more than DUNZO_OVER, as rare as a
    // game decided by a point or less (2026-11-20)
    { key: "dunzo", tier: "pancake", icon: "💥", title: "Dunzo", detail: `Lost a Game by More Than ${DUNZO_OVER} Points`,
      fine: `As rare as a game won within a point. ${MARGINS}`, ...bySeasons(anyGame((g, won) => !won && marginCents(g) > DUNZO_OVER * 100)) },
  ];
}
