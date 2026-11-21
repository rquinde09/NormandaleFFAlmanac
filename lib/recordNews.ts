// News posts for broken records (the site owner's Round 8, 2026-11-20; Luke's answers the same day):
// every record on the Records page broken from FIRST_NEWS_SEASON on, counting every manager (the
// true record, so a change only the Active view sees doesn't post). Built from the data at build
// time and listed with the Markdown posts. A game record (and a League record) is checked when each
// week is decided, a season record when the season ends. Each post is dated the Tuesday after the
// NFL week that decided it.
import { isStarter, lineupSides, readLineups, type RawPlayer } from "@/lib/bench";
import { score } from "@/lib/format";
import { gameRecords, leagueRecords, lineupRecords, managerBySlug, seasonRecords, type Game, type League, type RecordDef } from "@/lib/league";
import { gameEntry, leagueEntry, lineupEntry, seasonEntry, type RecordEntry } from "@/lib/records";

export const FIRST_NEWS_SEASON = 2026;

export type RecordPost = {
  slug: string;
  title: string;
  date: string; // YYYY-MM-DD
  excerpt: string;
  html: string;
  record: { key: string; title: string };
  season: number;
  week: number | null; // null: a season record, posted when the season ended
  entry: RecordEntry;
  previous: RecordEntry;
};

// The NFL season opens on the Thursday after Labor Day (the first Monday of September), and each
// fantasy week is that NFL week. A week is decided after Monday night, so its posts go out on Tuesday.
export function weekDate(season: number, week: number) {
  const sept1 = new Date(Date.UTC(season, 8, 1));
  const laborDay = 1 + ((8 - sept1.getUTCDay()) % 7);
  const tuesday = new Date(Date.UTC(season, 8, laborDay + 3 + 7 * (week - 1) + 5));
  return tuesday.toISOString().slice(0, 10);
}

const cents = (n: number) => Math.round(n * 100);
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The league as it stood after one week (games, bench rows and seasons through it)
function through(league: League, season: number, week: number): League {
  const upTo = (s: number, w: number) => s < season || (s === season && w <= week);
  return {
    ...league,
    seasons: league.seasons.filter((s) => s.season <= season),
    teamSeasons: league.teamSeasons.filter((t) => t.season <= season),
    games: league.games.filter((g) => upTo(g.season, g.week)),
    bench: league.bench.filter((b) => upTo(b.season, b.week)),
  };
}

type Tracked = { tab: "game" | "season" | "league"; def: RecordDef<unknown>; entry: (e: unknown) => RecordEntry; first: unknown | undefined };

function tracked(league: League, tab: Tracked["tab"]): Tracked[] {
  const wrap = <E,>(defs: RecordDef<E>[], entry: (d: RecordDef<E>, e: E) => RecordEntry): Tracked[] =>
    defs.map((d) => ({ tab, def: d as RecordDef<unknown>, entry: (e) => entry(d, e as E), first: d.entries[0] }));
  if (tab === "game") {
    return [
      ...wrap(gameRecords(league, 1), (d, e) => gameEntry(league, d.key, e)),
      ...wrap(lineupRecords(league, 1), (_d, e) => lineupEntry(league, e)),
    ];
  }
  if (tab === "league") return wrap(leagueRecords(league, 1), (d, e) => leagueEntry(league, d, e));
  return wrap(seasonRecords(league, 1), (d, e) => seasonEntry(league, d, e));
}

// Whether `after` beats `before` outright: a new game or season at the top with a different number
// (ties keep the older holder, who stays first), or, for a League record, another manager passing
// the leader's count.
function broken(tab: Tracked["tab"], before: unknown, after: unknown, season: number, week: number | null): boolean {
  if (!before || !after) return false;
  if (tab === "league") {
    const b = before as { person: string; value: number };
    const a = after as { person: string; value: number };
    return a.person !== b.person && a.value > b.value;
  }
  if (tab === "season") {
    const a = after as { teamSeason: { season: number }; value: number };
    const b = before as { value: number };
    return a.teamSeason.season === season && cents(a.value) !== cents(b.value);
  }
  const a = after as { game: Game; value: number };
  const b = before as { value: number };
  return a.game.season === season && a.game.week === week && cents(a.value) !== cents(b.value);
}

// The holder's top scorer that week, for a bit of color in the post
function topScorer(season: number, week: number, teamId: number): RawPlayer | null {
  const side = lineupSides(readLineups(season)).find((s) => s.week === week && s.side.teamId === teamId)?.side;
  const starters = (side?.lineup ?? []).filter(isStarter);
  return starters.length ? starters.reduce((a, b) => ((b.appliedStatTotal ?? 0) > (a.appliedStatTotal ?? 0) ? b : a)) : null;
}

function post(league: League, t: Tracked, after: unknown, previous: RecordEntry, season: number, week: number | null, date: string): RecordPost {
  const entry = t.entry(after);
  const { def } = t;
  const about = def.subtitle ? ` (${def.subtitle.charAt(0).toLowerCase()}${def.subtitle.slice(1)})` : "";
  const paragraphs = [
    `New record for <strong>${escape(def.title)}</strong>${escape(about)}: ${escape(entry.who)}, ${escape(entry.value)}. ${escape(entry.detail)}.`,
    `The old record: ${escape(previous.who)}, ${escape(previous.value)} (${escape(previous.detail)}).`,
  ];
  // A League record: the game that took the lead
  const person = (after as { person?: string }).person;
  if (person && week !== null) {
    const g = league.games.find((x) => x.season === season && x.week === week && (x.home.person === person || x.away.person === person));
    if (g) {
      const [me, them] = g.home.person === person ? [g.home, g.away] : [g.away, g.home];
      const result = cents(me.points) > cents(them.points) ? "win over" : cents(me.points) < cents(them.points) ? "loss to" : "tie with";
      paragraphs.push(`It came in week ${week} of ${season}: a ${score(me.points)}–${score(them.points)} ${result} ${escape(managerBySlug(league, them.person)!.nickname)}.`);
    }
  }
  const game = (after as { game?: Game }).game;
  if (game && t.def.key !== "one-hit") {
    const sides = def.key === "highest-total" || def.key === "lowest-total" ? [game.home, game.away] : [game.winner === "AWAY" && (def.key === "blowout" || def.key === "closest") ? game.away : game.home];
    for (const side of sides) {
      const p = topScorer(game.season, game.week, side.teamId);
      if (p) paragraphs.push(`${escape(managerBySlug(league, side.person)!.nickname)}&rsquo;s top scorer: ${escape(p.fullName ?? "")}, ${score(p.appliedStatTotal ?? 0)} pts.`);
    }
  }
  paragraphs.push(`<a href="/records${t.tab === "game" ? "" : `?view=${t.tab}`}">Every record →</a>`);
  return {
    slug: `record-${season}${week === null ? "" : `-week-${week}`}-${def.key}`,
    title: `${entry.holder} ${entry.holder.includes(" and ") ? "break" : "breaks"} ${def.title}`,
    date,
    excerpt: `${entry.who}: ${entry.value} · ${entry.short}`,
    html: paragraphs.map((p) => `<p>${p}</p>`).join("\n"),
    record: { key: def.key, title: def.title },
    season,
    week,
    entry,
    previous,
  };
}

// Every record broken from `from` on, oldest first
export function recordPosts(league: League, from = FIRST_NEWS_SEASON): RecordPost[] {
  const posts: RecordPost[] = [];
  const weeks = [...new Set(league.games.filter((g) => g.season >= from).map((g) => `${g.season}:${g.week}`))]
    .map((k) => k.split(":").map(Number))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let prevCut: League | null = null;
  for (const [season, week] of weeks) {
    const cut = through(league, season, week);
    // Before this week: the previous decided week (or the end of the season before)
    const before = prevCut ?? through(league, season, week - 1);
    for (const tab of ["game", "league"] as const) {
      const old = tracked(before, tab);
      for (const now of tracked(cut, tab)) {
        const was = old.find((o) => o.def.key === now.def.key);
        if (was && broken(tab, was.first, now.first, season, week)) posts.push(post(cut, now, now.first, was.entry(was.first), season, week, weekDate(season, week)));
      }
    }
    prevCut = cut;
  }
  // Season records, once each season from `from` on is complete
  for (const info of league.seasons.filter((s) => s.season >= from && s.complete)) {
    const cutAt = (complete: boolean): League => ({
      ...league,
      seasons: league.seasons.filter((s) => s.season <= info.season).map((s) => (s.season === info.season ? { ...s, complete } : s)),
      teamSeasons: league.teamSeasons.filter((t) => t.season <= info.season),
    });
    const old = tracked(cutAt(false), "season");
    for (const now of tracked(cutAt(true), "season")) {
      const was = old.find((o) => o.def.key === now.def.key);
      if (was && broken("season", was.first, now.first, info.season, null)) {
        posts.push(post(league, now, now.first, was.entry(was.first), info.season, null, weekDate(info.season, info.weeks)));
      }
    }
  }
  return posts.sort((a, b) => a.date.localeCompare(b.date));
}
