// What a manager's page shows beyond the standings: the Manager Performance chart with its Playcall
// Review, head-to-head numbers against each opponent and the achievements (the site owner's notes,
// Rounds 2–7, 2026-11-07 to 2026-11-18). Counting rules are in CLAUDE.md.
import { seasonAwards, type TradeResult } from "@/lib/acquisitions";
import { topStarters } from "@/lib/champions";
import { ordinal, pct, pts, record, score, signed } from "@/lib/format";
import { DUNZO_OVER, ICE_WITHIN, type Game, type Kind, type League, type TeamSeason, careerTotals, luck, managerBySlug, marginCents, odds, winPct as careerWinPct } from "@/lib/league";
import { DECISIONS, FATE, INJURIES_COUNTED, type ReviewKey } from "@/lib/review";
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

// The Playcall Review (the site owner's Round 6, 2026-11-17): one season's numbers, each a bar from
// Bad to Good with zero in the middle. Higher is better on every one. Round 10 (2026-11-25) split them
// in two (lib/review.ts): the manager's decisions (Draft IQ, Roster IQ, Waiver IQ, Trade IQ) in
// Playcalling Analysis, and what the season was expected to bring (Odds, Luck, Streaks) in Against
// the Odds.
export { DECISIONS, FATE, type ReviewKey };

export type ReviewRow = {
  value: number | null; // null: no number that season (no projections, bench lineups or trade details)
  lo: number; // the league's worst that season, at most 0: the bar's left end
  hi: number; // the league's best that season, at least 0: its right end
  place: number | null; // 1 = the league's best that season; ties share a place
  // Injuries (Round 11): the league's average count that season. The value is the average minus the
  // team's count, so the count is average − value.
  average?: number | null;
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

// The league's average of a number that season, over the teams that have it
function average(field: TeamSeason[], value: (t: TeamSeason) => number | null) {
  const have = field.map(value).filter((v): v is number => v !== null);
  return have.length ? have.reduce((n, v) => n + v, 0) / have.length : null;
}

// Each Playcall Review number for every team of one season (the manager pages and the season pages'
// standings). Draft IQ (Round 10) is the starting-lineup points of the team's draft picks while it had
// them, minus the league's average; Waiver IQ the same for its pickups; Roster IQ the league's average
// points left on the bench minus the team's own. So each adds up to zero over a season, like Luck,
// Odds and Trade IQ. Trade IQ is 0 for a team that made no trade. Injuries (Round 11) is the league's
// average count of injuries minus the team's, so fewer is better, like Roster IQ.
export function playcallValues(field: TeamSeason[]): Map<TeamSeason, Record<ReviewKey, number | null>> {
  const drafted = average(field, (t) => t.draftPoints);
  const picked = average(field, (t) => t.pickupPoints);
  const benched = average(field, (t) => t.bench);
  const hurt = average(field, (t) => t.injuries);
  const minus = (value: number | null, avg: number | null) => (value === null || avg === null ? null : value - avg);
  return new Map(
    field.map((t) => [
      t,
      {
        draft: minus(t.draftPoints, drafted),
        roster: t.bench === null || benched === null ? null : benched - t.bench,
        waiver: minus(t.pickupPoints, picked),
        trade: t.tradeNet,
        odds: odds(t),
        luck: luck(t),
        streak: signedStreak(t),
        injuries: t.injuries === null || hurt === null ? null : hurt - t.injuries,
      },
    ]),
  );
}

const REVIEW_KEYS: ReviewKey[] = [...DECISIONS, ...FATE];

function review(t: TeamSeason, field: TeamSeason[]): Record<ReviewKey, ReviewRow> {
  const all = playcallValues(field);
  const injuries = average(field, (x) => x.injuries);
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
          ...(key === "injuries" ? { average: injuries } : {}),
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

// Three tiers since Round 11 (the site owner, 2026-11-25): GOAT Tier, Season Honors and Pancake Tier
export type Tier = "goat" | "honors" | "pancake";

export type Achievement = {
  key: string;
  tier: Tier;
  icon: string;
  title: string;
  detail: string; // shown when tapped: what earns it, in the site owner's words (Round 11's table)
  fine?: string; // how it's counted
  earned: boolean;
  note?: string; // under the icon once earned: the seasons ("’18 ’23")
  seasons: { season: number; extra?: string }[]; // shown when tapped
};

const short = (seasons: number[]) => (seasons.length ? seasons.map((s) => `’${String(s).slice(2)}`).join(" ") : undefined);
const listed = (seasons: { season: number; extra?: string }[]) => ({
  earned: seasons.length > 0,
  note: short([...new Set(seasons.map((x) => x.season))]),
  seasons,
});
const bySeasons = (seasons: number[]) => listed(seasons.map((season) => ({ season })));
// "A", "A and B", "A, B and C"
const and = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "nobody"));

// Earned in any completed season lights the icon; season PF and PA count every game that season, and
// ties share an award. Each tier is in the order of the site owner's Round 11 table, with his criteria
// as the descriptions.
export function achievements(league: League, person: string): Achievement[] {
  const complete = new Set(league.seasons.filter((s) => s.complete).map((s) => s.season));
  const info = new Map(league.seasons.map((s) => [s.season, s]));
  const done = league.teamSeasons.filter((t) => t.person === person && complete.has(t.season)).sort((a, b) => a.season - b.season);
  const years = (pick: (t: TeamSeason) => boolean) => done.filter(pick).map((t) => t.season);
  const won = <T,>(pick: (t: TeamSeason) => T[], extra: (x: T, t: TeamSeason) => string) =>
    done.flatMap((t) => pick(t).map((x) => ({ season: t.season, extra: extra(x, t) })));
  const nick = (season: number, teamId: number) => {
    const slug = league.teamSeasons.find((x) => x.season === season && x.teamId === teamId)?.person;
    return (slug && managerBySlug(league, slug)?.nickname) ?? "another team";
  };
  const before = (t: TeamSeason) => league.teamSeasons.find((x) => x.person === t.person && x.season === t.season - 1);

  // Best (or worst) in the league that season
  const leads = (value: (t: TeamSeason) => number, most: boolean) =>
    years((t) => {
      const field = league.teamSeasons.filter((x) => x.season === t.season).map((x) => cents(value(x)));
      return cents(value(t)) === (most ? Math.max(...field) : Math.min(...field));
    });
  // The games a team won (or lost) that season, against anyone, retired managers included (Round 8)
  const gamesOf = (t: TeamSeason, pick: (g: Game, won: boolean) => boolean) =>
    league.games.filter((g) => {
      if (g.season !== t.season || g.winner === "TIE") return false;
      const side = g.home.teamId === t.teamId ? "HOME" : g.away.teamId === t.teamId ? "AWAY" : null;
      return side !== null && pick(g, g.winner === side);
    });
  const MARGINS = "Every game counts: regular season and playoffs, against anyone.";
  const EVERY_GAME = "In one season, every game counted: regular season and playoffs.";
  const ROSTERS = "ESPN has whole rosters from 2018 on.";

  // Round 11: the third championship and every one after it make a Dynasty Manager
  const titles = done.filter((t) => t.finalRank === 1);
  const dynasty = titles.slice(2).map((t, i) => ({ season: t.season, extra: `${ordinal(i + 3)} title` }));

  // Comeback Manager (Round 11): of the managers who missed the playoffs the season before, the
  // biggest climb in the final standings
  const climb = (t: TeamSeason) => {
    const prev = before(t);
    const cut = info.get(t.season - 1)?.playoffTeams;
    return prev?.finalRank && t.finalRank && cut !== undefined && prev.seed > cut ? prev.finalRank - t.finalRank : null;
  };
  const comebacks = won(
    (t) => {
      const mine = climb(t);
      if (mine === null || mine <= 0) return [];
      const best = Math.max(...league.teamSeasons.filter((x) => x.season === t.season).map((x) => climb(x) ?? 0));
      return mine === best ? [before(t)!] : [];
    },
    (prev, t) => `${ordinal(prev.finalRank!)} in ${prev.season} → ${ordinal(t.finalRank!)}`,
  );

  const mvfp = [...topStarters(league).values()].flat().filter((p) => p.person === person).sort((a, b) => a.season - b.season);

  // Round 10's awards (lib/acquisitions.ts). Round 11: Waiver Pick and Drop count RBs, WRs and TEs
  // only, and a trade names every player in it.
  const waiverPicks = won((t) => seasonAwards(t.season).waiver.filter((x) => x.teamId === t.teamId), (x) => `${x.name}, ${pts(x.points)} pts`);
  const drops = won((t) => seasonAwards(t.season).drop.filter((x) => x.from === t.teamId), (x, t) => `${x.name}, ${pts(x.points)} pts for ${nick(t.season, x.teamId)}`);
  const partners = (r: TradeResult) => r.partners.map((team) => nick(r.season, team)).join(" and ");
  const bestTrades = won((t) => seasonAwards(t.season).trade.filter((r) => r.teamId === t.teamId), (r) => `got ${and(r.received)} from ${partners(r)} for ${and(r.gave)}: ${signed(r.net)} pts`);
  const fleeces = won((t) => seasonAwards(t.season).fleece.filter((r) => r.teamId === t.teamId), (r) => `sent ${and(r.gave)} to ${partners(r)} for ${and(r.received)}: ${signed(r.net)} pts`);

  // Dunzo (Round 11: "include who they lost to and what the score was")
  const dunzos = won(
    (t) => gamesOf(t, (g, w) => !w && marginCents(g) > DUNZO_OVER * 100),
    (g, t) => {
      const [me, them] = g.home.teamId === t.teamId ? [g.home, g.away] : [g.away, g.home];
      return `lost ${score(me.points)}–${score(them.points)} to ${managerBySlug(league, them.person)!.nickname}, week ${g.week}`;
    },
  );

  // Injury Bug (Round 11): the most injuries that season (lib/injuries.ts)
  const injuryBug = won(
    (t) => {
      const field = league.teamSeasons.filter((x) => x.season === t.season && x.injuries !== null).map((x) => x.injuries!);
      return t.injuries !== null && t.injuries > 0 && t.injuries === Math.max(...field) ? [t] : [];
    },
    (t) => `${t.injuries} injuries`,
  );

  return [
    // GOAT Tier
    { key: "goat", tier: "goat", icon: "🐐", title: "The Mahaan Bakaree", detail: "Wins the championship", ...bySeasons(titles.map((t) => t.season)) },
    { key: "dynasty", tier: "goat", icon: "🏰", title: "Dynasty Manager", detail: "Wins 3+ championships", fine: "Earned with the third title, and again with each one after it.", ...listed(dynasty) },
    {
      key: "cinderella",
      tier: "goat",
      icon: "👠",
      title: "Playoff Cinderella",
      detail: "Wins as the lowest playoff seed",
      fine: "The champion was the last of that season’s playoff seeds: 6th of 6 in 2017–2019, 8th of 8 in 2020–2024, 7th of 7 in 2025.",
      ...listed(won((t) => (t.finalRank === 1 && t.seed === info.get(t.season)!.playoffTeams ? [t] : []), (t) => `${ordinal(t.seed)} seed of ${t.seed}`)),
    },
    {
      key: "revenge",
      tier: "goat",
      icon: "⚔️",
      title: "Revenge Tour",
      detail: "Wins after finishing last the previous season",
      ...listed(won((t) => (t.finalRank === 1 && before(t)?.lastPlace ? [before(t)!] : []), (prev) => `last in ${prev.season}`)),
    },
    { key: "moty", tier: "goat", icon: "🔥", title: "Manager of the Year", detail: "Scores the most points in a season", fine: EVERY_GAME, ...bySeasons(leads((t) => t.all.pf, true)) },
    { key: "seed", tier: "goat", icon: "🥇", title: "The #1 Seed", detail: "Finishes regular season with the best record", fine: "ESPN’s #1 seed: a tie goes to the most points.", ...bySeasons(years((t) => t.seed === 1)) },

    // Season Honors
    {
      key: "mvfp",
      tier: "honors",
      icon: "💪",
      title: "MVFP",
      detail: "Owns the league’s Most Valuable Fantasy Player",
      fine: "Most points by one player in a team’s starting lineup that season, playoffs included.",
      ...listed(mvfp.map((p) => ({ season: p.season, extra: `${p.name}, ${pts(p.points)} pts` }))),
    },
    // Round 7 (2026-11-18); Round 8 made it any win within a point (2026-11-20)
    { key: "ice", tier: "honors", icon: "🧊", title: "Ice in the Veins", detail: "Wins a matchup by a point or less",
      fine: `Won by ${ICE_WITHIN} point or less. ${MARGINS}`, ...bySeasons(years((t) => gamesOf(t, (g, w) => w && marginCents(g) <= ICE_WITHIN * 100).length > 0)) },
    { key: "waiver", tier: "honors", icon: "💎", title: "Waiver Pick of the Year", detail: "Makes the most impactful waiver acquisition",
      fine: `The running back, receiver or tight end picked up (off waivers or free agency) who scored the most for his new team that season: in its starting lineup, every game, while it had him. ${ROSTERS}`,
      ...listed(waiverPicks) },
    { key: "trade", tier: "honors", icon: "🤝", title: "Trade of the Year", detail: "Makes the most impactful trade",
      fine: "The season’s biggest gain in one trade: what the players received scored in the starting lineup, minus what the players sent scored for their new team, each until he left that roster. ESPN has trade details from 2018 on.",
      ...listed(bestTrades) },
    { key: "choke", tier: "honors", icon: "🧑‍🎨", title: "Choke Artist", detail: "Finishes second in the championship", ...bySeasons(years((t) => t.finalRank === 2)) },
    { key: "comeback", tier: "honors", icon: "📈", title: "Comeback Manager", detail: "Biggest improvement after a poor season",
      fine: "Of the managers who missed the playoffs the season before, the biggest climb in the final standings. From 2018.", ...listed(comebacks) },

    // Pancake Tier
    { key: "pancake", tier: "pancake", icon: "🥞", title: "The Pancake House", detail: "Finishes last in final standings", ...bySeasons(years((t) => t.lastPlace)) },
    { key: "lowest-scoring", tier: "pancake", icon: "🥶", title: "Lowest Scoring Season", detail: "Scores the fewest points in a season", fine: EVERY_GAME, ...bySeasons(leads((t) => t.all.pf, false)) },
    { key: "dream", tier: "pancake", icon: "😢", title: "It Was Only a Dream", detail: "Allows the most points in a season", fine: EVERY_GAME, ...bySeasons(leads((t) => t.all.pa, true)) },
    // Luke, 2026-11-15
    {
      key: "benchwarmer",
      tier: "pancake",
      icon: "🪑",
      title: "The Benchwarmer",
      detail: "Leaves the most potential points on the bench",
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
    { key: "dunzo", tier: "pancake", icon: "💥", title: "Dunzo", detail: `Loses a matchup by more than ${DUNZO_OVER} points`,
      fine: `As rare as a game won within a point. ${MARGINS}`, ...listed(dunzos) },
    { key: "drop", tier: "pancake", icon: "🗑️", title: "Drop of the Year", detail: "Drops a player who scores the most points for their new team",
      fine: `Of every running back, receiver and tight end let go that season (drafted, picked up or traded for), the one who then scored the most for the team that picked him up. ${ROSTERS}`,
      ...listed(drops) },
    { key: "injury", tier: "pancake", icon: "🐛", title: "Injury Bug", detail: "Has the most players suffer significant injuries",
      fine: `The most injuries that season. ${INJURIES_COUNTED}`,
      ...listed(injuryBug) },
    { key: "fleece", tier: "pancake", icon: "🐑", title: "Fleece of the Year", detail: "Gets fleeced in a trade",
      fine: "The other side of the season’s most lopsided trade: what the players sent scored for their new team, minus what the players received scored in the starting lineup. ESPN has trade details from 2018 on.",
      ...listed(fleeces) },
  ];
}
