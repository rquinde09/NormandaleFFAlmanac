// Checks the site's numbers through the 2025 season:
// - all-time W, L, PF, PA and seasons against the Google Sheet copy (all 23 managers must match)
// - record holders, checked by hand against the raw data. The old Records pages were kept by hand
//   and skip most 2017 entries; where they differ, the old value is noted next to the expectation.
// - championship counts (the stars in the old Teams menu)
// - per-season averages, order and RKΔ against the old Leaderboard copy
// - championship lineups against the final scores, and the hand-entered 2021 one against ESPN's
// - last place against the 2024 pancake news post
// - the Active records rule against the site owner's example
// - the Manager Performance medals against the site owner's 2024 PF example, and the awards
// - luck, bench numbers, playoff brackets and the Pancake Watch's premise
// - Round 5: Odds, trade points, the best-lineup seed and the Roster box
// - Round 6: the Playcall Review against the site owner's 2023 sketch, and the pancake game
// - Round 7: close games and blowouts, their records and career lines
// - Round 8: The One Hit Wonder, Below Zero, the League records, Ice in the Veins and Dunzo, the
//   pancake ladder and chances, record-break news, the standings' W/L and the season pages' Rank Δ
// - Round 9: the Leaderboard's Record sort, the career row and where the home cards go
// Usage: npm run check
import fs from "node:fs";
import path from "node:path";
import {
  BLOWOUT_OVER,
  CLOSE_UNDER,
  DUNZO_OVER,
  ICE_WITHIN,
  careerSplits,
  careerTotals,
  champions,
  gameRecords,
  getLeague,
  homeLinks,
  leagueRecords,
  lineupRecords,
  luck,
  marginCents,
  marginKind,
  odds,
  oneHitWonders,
  seasonRecords,
  type Game,
  type League,
  type RecordDef,
} from "../lib/league";
import { isStarter, lineupSides, readLineups } from "../lib/bench";
import { firstLadder, ladderPlaces, lastOf, nextLadder, pancakeOdds } from "../lib/pancake";
import { FIRST_NEWS_SEASON, recordPosts, weekDate } from "../lib/recordNews";
import { gameEntry, leagueEntry, lineupEntry, seasonEntry } from "../lib/records";
import { VIEWS, rankOrder } from "../lib/standings";
import { championDetails, topStarters } from "../lib/champions";
import { achievements, careerStats, marginCareer, performance } from "../lib/manager";
import { readTrades, regularSeeds } from "../lib/playcalls";
import { rosterBox } from "../lib/roster";
import { rounds, seasonTable } from "../lib/seasons";

const THROUGH = 2025;
const SHEET = path.join(process.cwd(), "data", "reference", "google-sheet-through-2025.csv");
const LEADERBOARD = path.join(process.cwd(), "data", "reference", "google-sheet-leaderboard-through-2025.csv");

const full = getLeague();
const league: League = {
  ...full,
  seasons: full.seasons.filter((s) => s.season <= THROUGH),
  teamSeasons: full.teamSeasons.filter((t) => t.season <= THROUGH),
  games: full.games.filter((g) => g.season <= THROUGH),
  bracket: full.bracket.filter((b) => b.season <= THROUGH),
  bench: full.bench.filter((b) => b.season <= THROUGH),
  upcoming: [],
};

let failures = 0;
const check = (ok: boolean, label: string, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
};
const close = (a: number, b: number, tolerance = 0.005) => Math.abs(a - b) <= tolerance;

// 1. Sheet
const [, ...lines] = fs.readFileSync(SHEET, "utf8").trim().split(/\r?\n/);
const totals = careerTotals(league);
let matched = 0;
for (const line of lines) {
  const [name, w, l, pf, pa, , seasons] = line.split(",");
  const m = league.managers.find((x) => x.name === name);
  const t = m && totals.get(m.slug);
  const ok =
    !!t &&
    t.w === Math.round(+w) &&
    t.l === Math.round(+l) &&
    close(t.pf, +pf, 0.01) &&
    close(t.pa, +pa, 0.01) &&
    t.seasons === Math.round(+seasons);
  if (ok) matched += 1;
  else console.log(`     ${name}: Sheet ${w}-${l} PF ${pf} PA ${pa} seasons ${seasons}; computed ${t ? `${t.w}-${t.l} PF ${t.pf.toFixed(2)} PA ${t.pa.toFixed(2)} seasons ${t.seasons}` : "missing"}`);
}
check(matched === lines.length, `Sheet all-time standings: ${matched}/${lines.length} managers match`);

// 2. Game records: [key, holder(s), value]
const games = Object.fromEntries(gameRecords(league).map((r) => [r.key, r.entries[0]]));
const gameExpect: [string, string[], number, number][] = [
  ["blowout", ["aj"], 119.46, 0.005],
  ["closest", ["aj", "suny"], 0.02, 0.005],
  ["highest-total", ["robel", "randy"], 368.7, 0.05],
  ["lowest-total", ["madison", "troy"], 121.58, 0.005], // old site: Kaden vs Madison 136.78 (2020)
  ["highest-score", ["aj"], 212.44, 0.005],
  ["lowest-score", ["cesar"], 33.72, 0.005], // old site: Jordan 40.44 (2021)
];
for (const [key, people, value, tol] of gameExpect) {
  const e = games[key];
  const who = [e.game.home.person, e.game.away.person];
  check(people.every((p) => who.includes(p)) && close(e.value, value, tol), `game record ${key}`,
    `${who.join(" vs ")} ${e.value.toFixed(2)} in ${e.game.season}`);
}

// 3. Season records: [key, holder, season, value]
const seasons = Object.fromEntries(seasonRecords(league).map((r) => [r.key, r.entries[0]]));
const seasonExpect: [string, string, number, number, number][] = [
  ["best", "nigel", 2022, 15, 0],
  // Most losses since Round 8 (fewest wins before). Cesar's 14 in 2017 has the fewest PF of the four
  // 14-loss seasons (Jordan 2021, Luke 2022 and 2023). The old site's fewest wins: Jordan (2025).
  ["worst", "cesar", 2017, 14, 0],
  ["most-pa", "jordan", 2018, 2159, 0.5],
  ["least-pa", "tom", 2017, 1502.88, 0.005], // old site: Suny 1531 (2017); Suny's is really 1511.04
  ["win-streak", "aj", 2023, 10, 0],
  ["loss-streak", "cesar", 2017, 11, 0], // old site: Jordan 10 (2025)
  ["trades", "aj", 2017, 17, 0], // old site: Robel 15 (2021)
];
for (const [key, person, season, value, tol] of seasonExpect) {
  const e = seasons[key];
  check(e.teamSeason.person === person && e.teamSeason.season === season && close(e.value, value, tol),
    `season record ${key}`, `${e.teamSeason.person} ${e.value.toFixed(2)} in ${e.teamSeason.season}`);
}
const pf = seasons["most-pf"];
console.log(`info season record most-pf (not listed on the old site): ${pf.teamSeason.person} ${pf.value.toFixed(2)} in ${pf.teamSeason.season}`);

// 4. Championships
const counts: Record<string, number> = {};
for (const c of champions(league)) counts[c.person] = (counts[c.person] ?? 0) + 1;
const expected = { aj: 3, jeremy: 2, jordan: 1, nigel: 1, robel: 1, suny: 1 };
check(JSON.stringify(Object.entries(counts).sort()) === JSON.stringify(Object.entries(expected).sort()),
  "championships match the old Teams menu stars", JSON.stringify(counts));

// 5. The old Leaderboard: averages per season for the 14 managers of 2025, in rank order, with
// RKΔ (the change since the end of 2024). The site's Per season standings view.
const [, ...board] = fs.readFileSync(LEADERBOARD, "utf8").trim().split(/\r?\n/);
const perSeason = VIEWS.find((v) => v.key === "season")!;
const slugs: string[] = [];
let boardMatched = 0;
for (const line of board) {
  const [name, w, l, pf, pa, , seasons] = line.split(",");
  const m = league.managers.find((x) => x.name === name);
  const t = m && totals.get(m.slug);
  if (m) slugs.push(m.slug);
  const per = (n: number) => n / t!.seasons;
  // Through 2025 every season is complete, so each counts as one whole season
  const ok = !!t && t.seasons === +seasons && t.seasonWeight === t.seasons && close(per(t.w), +w, 0.001) && close(per(t.l), +l, 0.001) &&
    close(per(t.pf), +pf, 0.001) && close(per(t.pa), +pa, 0.001);
  if (ok) boardMatched += 1;
  else console.log(`     ${name}: Leaderboard ${w} ${l} ${pf} ${pa} over ${seasons}; computed ${t ? [t.w, t.l, t.pf, t.pa].map((n) => per(n).toFixed(4)).join(" ") + ` over ${t.seasons}` : "missing"}`);
}
check(boardMatched === board.length, `Leaderboard per-season averages: ${boardMatched}/${board.length} managers match`);
const before = careerTotals(league, THROUGH - 1);
const nowOrder = rankOrder(perSeason, slugs.map((s) => [s, totals.get(s) ?? null]));
const prevOrder = rankOrder(perSeason, slugs.map((s) => [s, before.get(s) ?? null]));
check(nowOrder.join() === slugs.join(), "Leaderboard order", nowOrder.join(" "));
// The Sheet's RKΔ is typed by hand. Its Ryan +3 and Jordan −4 can't come from one 2024 ranking with
// the other 12 values (Ryan +3 puts him 14th in 2024, where Luke's 0 already is); computed +2 and −3.
const RKD_TYPOS = ["ryan", "jordan"];
const changes = board.map((line) => +line.split(",")[7]);
const computed = slugs.map((s) => prevOrder.indexOf(s) - nowOrder.indexOf(s));
const differ = slugs.filter((_, i) => computed[i] !== changes[i]);
check(differ.join() === RKD_TYPOS.join(), `Leaderboard RKΔ: ${slugs.length - differ.length}/${slugs.length} match, plus the 2 Sheet typos`,
  differ.join(" "));

// 6. Champions page: each final's starters add up to the champion's score. 2021's lineups came
// later (2026-11-15, the seasons endpoint with a 2021 member's cookies); the site owner's hand
// entry from before (data/manual/lineups-2021.json) must match ESPN's final lineup slot for slot.
// The 2023 final matches the old news post (178.68–76.5 over Robel).
const finals = champions(league).map((c) => ({ c, d: championDetails(league, c) }));
const espn = finals.filter(({ d }) => !d.manual);
const adds = espn.filter(({ d }) => d.starters && d.final && close(d.starters.reduce((a, p) => a + (p.points ?? NaN), 0), d.final.home.points, 0.011));
check(adds.length === espn.length && espn.length === finals.length,
  `championship lineups add up to the final score: ${adds.length}/${espn.length} from ESPN`);
const hand = finals.find(({ c }) => c.season === 2021)!;
const typed = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "manual", "lineups-2021.json"), "utf8")) as
  { person: string; starters: { slot: string; name: string }[]; bench: { slot: string; name: string }[] };
const slots = (list: { slot: string; name: string }[] | null | undefined) => (list ?? []).map((p) => `${p.slot} ${p.name}`).sort().join("; ");
check(hand.c.person === typed.person && slots(hand.d.starters) === slots(typed.starters) && slots(hand.d.bench) === slots(typed.bench),
  "2021 championship lineup entered by hand matches ESPN's", `${hand.c.person}: ${slots(hand.d.starters)}`);
const f2023 = finals.find(({ c }) => c.season === 2023)!.d.final!;
check(close(f2023.home.points, 178.68) && close(f2023.away.points, 76.5) && f2023.away.person === "robel", "2023 final",
  `${f2023.home.points}–${f2023.away.points} vs ${f2023.away.person}`);

// 7. Last place (the pancake) is finalRank equal to the season's team count. The 2024 pancake news
// post names the last-place finishers: 2018 Nigel, 2019 Kaden, 2020 Ryan, 2021 Suny, Luke 2022–23.
// The site owner added Jordan for 2025 (2026-11-10).
const lastExpect: Record<number, string> = { 2018: "nigel", 2019: "kaden", 2020: "ryan", 2021: "suny", 2022: "luke", 2023: "luke", 2025: "jordan" };
const lasts = league.seasons.map((s) => ({ s, who: league.teamSeasons.filter((t) => t.season === s.season && t.lastPlace).map((t) => t.person) }));
check(lasts.every(({ who }) => who.length === 1) && Object.entries(lastExpect).every(([y, p]) => lasts.find(({ s }) => s.season === +y)!.who[0] === p),
  "last place matches the pancake post, one per season", lasts.map(({ s, who }) => `${s.season} ${who.join("+")}`).join(", "));

// 8. Records with Active on count only games between two active managers: the site owner's example
// is The @$$-Whooping, where AJ's win over Jordan (retired) gives way to Luke def. Suny.
const activeSet = new Set(league.managers.filter((m) => m.active).map((m) => m.slug));
const activeBlowout = gameRecords(league, 5, (p) => activeSet.has(p)).find((r) => r.key === "blowout")!.entries[0].game;
const blowWinner = activeBlowout.winner === "AWAY" ? activeBlowout.away : activeBlowout.home;
const blowLoser = activeBlowout.winner === "AWAY" ? activeBlowout.home : activeBlowout.away;
check(blowWinner.person === "luke" && blowLoser.person === "suny", "Active @$$-Whooping is Luke def. Suny",
  `${blowWinner.person} def. ${blowLoser.person} in ${activeBlowout.season}`);

// 9. Manager Performance medals rank each tab against the league that season. The site owner's
// example: in 2024 Randy's 2,241.1 PF led the league, so he gets gold on the PF tab, while Jeremy,
// that year's champion, gets gold only on Finish.
const point = (person: string, season: number) => performance(league, person).find((p) => p.season === season)!;
const randy24 = point("randy", 2024);
const jeremy24 = point("jeremy", 2024);
const randyPf = randy24.values.pf ?? NaN;
const jeremyPf = jeremy24.values.pf ?? NaN;
check(randy24.marks.pf.place === 1 && close(randyPf, 2241.1, 0.05) && jeremy24.marks.pf.place !== 1 && jeremy24.marks.finish.place === 1,
  "2024 PF gold is Randy's 2,241.1, not champion Jeremy's",
  `Randy ${randyPf.toFixed(2)} place ${randy24.marks.pf.place}; Jeremy ${jeremyPf.toFixed(2)} place ${jeremy24.marks.pf.place}`);
// The PF tab's gold and pancake agree with the Manager of the Year and Below Zero awards, the PA
// tab's pancake with It Was Only A Dream
const people = league.managers.map((m) => m.slug);
const award = (key: string) => people.flatMap((p) => achievements(league, p).find((a) => a.key === key)!.seasons.map((s) => `${s.season} ${p}`)).sort();
const tab = (pick: (m: { place: number | null; last: boolean }) => boolean, mode: "pf" | "pa") =>
  people.flatMap((p) => performance(league, p).filter((s) => pick(s.marks[mode])).map((s) => `${s.season} ${p}`)).sort();
check(award("moty").join() === tab((m) => m.place === 1, "pf").join() && award("below-zero").join() === tab((m) => m.last, "pf").join() &&
  award("dream").join() === tab((m) => m.last, "pa").join(), "PF and PA medals match the season awards", award("moty").join(", "));
// MVFP: one per season (2021's since its lineups were fetched, 2026-11-15)
const mvfp = topStarters(league);
check([...mvfp.keys()].sort().join() === "2017,2018,2019,2020,2021,2022,2023,2024,2025" && [...mvfp.values()].every((v) => v.length === 1),
  "MVFP in every season", [...mvfp.values()].flat().map((v) => `${v.season} ${v.person} ${v.name} ${v.points.toFixed(1)}`).join("; "));

// 10. Luck, bench, brackets and the Pancake Watch (Luke, 2026-11-15)
// All-play hands out exactly as many expected wins each week as there are games, so luck adds up
// to zero over each season's teams.
const luckSums = league.seasons.map((s) => league.teamSeasons.filter((t) => t.season === s.season).reduce((n, t) => n + luck(t), 0));
check(luckSums.every((n) => Math.abs(n) < 1e-6), "luck adds up to zero in every season", luckSums.map((n) => n.toFixed(6)).join(" "));
// Bench numbers exist for the seasons whose lineups include the bench, one row per team per game.
// The starters add up to the team's score, and the best lineup is never below the one started.
const benchSeasons = [...new Set(league.bench.map((b) => b.season))].sort();
check(benchSeasons.join() === "2018,2019,2020,2021,2022,2023,2024,2025", "bench numbers for 2018–2025", benchSeasons.join());
const scoreOf = new Map(league.games.flatMap((g) => [g.home, g.away].map((s) => [`${g.season}:${g.week}:${s.teamId}`, s.points] as const)));
const benchRows = league.bench.length;
const gamesInBenchSeasons = league.games.filter((g) => benchSeasons.includes(g.season)).length * 2;
check(benchRows === gamesInBenchSeasons && league.bench.every((b) => close(b.actual, scoreOf.get(`${b.season}:${b.week}:${b.teamId}`) ?? NaN, 0.011)),
  "bench rows match every game, starters add up to the score", `${benchRows} rows, ${gamesInBenchSeasons} team-games`);
check(league.bench.every((b) => b.best >= b.actual - 0.005), "best lineup is never below the one started",
  `${league.bench.filter((b) => b.best < b.actual - 0.005).length} below`);
// The Playcall Review's lowest Roster IQ each season (Round 6) is the Benchwarmer award
check(award("benchwarmer").join() === people.flatMap((p) => performance(league, p).filter((s) => s.review.iq.value !== null && close(s.review.iq.value, s.review.iq.lo, 1e-9)).map((s) => `${s.season} ${p}`)).sort().join(),
  "lowest Roster IQ matches the Benchwarmer award", award("benchwarmer").join(", "));
// Each season's final is in its last week, and its winner is the champion
const finalsOk = league.seasons.filter((s) => s.complete).filter((s) => {
  const final = rounds(league, s, "playoff").at(-1)!;
  const g = final.games[0];
  const winner = g.winner === "HOME" ? g.home : g.away!;
  return final.label === "Final" && final.games.length === 1 && winner.person === champions(league).find((c) => c.season === s.season)!.person;
});
check(finalsOk.length === league.seasons.filter((s) => s.complete).length, "each bracket's final is won by the champion", `${finalsOk.length} seasons`);
// Pancake Watch counts everyone outside the playoff spots: every last-place team missed the playoffs
const lastSeeds = league.teamSeasons.filter((t) => t.lastPlace).map((t) => ({ t, spots: league.seasons.find((s) => s.season === t.season)!.playoffTeams }));
check(lastSeeds.every(({ t, spots }) => t.seed > spots), "every last-place team missed the playoffs",
  lastSeeds.map(({ t, spots }) => `${t.season} seed ${t.seed}/${spots}`).join(", "));

// 11. Round 5 (2026-11-15): Odds, trades, the best-lineup seed and the Roster box
// ESPN's projections cover every game of 2018–2025 (2017 has none).
// Each game's projected win goes to one side (a tie half each), so Odds adds up to zero each season.
// (Checked once against ESPN's own projected team totals: 2026 week 1, 14/14 lineups to the cent.)
const projectedSeasons = league.seasons.filter((s) => league.teamSeasons.some((t) => t.season === s.season && t.projectedWins !== null)).map((s) => s.season);
check(projectedSeasons.join() === "2018,2019,2020,2021,2022,2023,2024,2025", "ESPN projections for 2018–2025", projectedSeasons.join());
const oddsSums = projectedSeasons.map((y) => league.teamSeasons.filter((t) => t.season === y).reduce((n, t) => n + odds(t)!, 0));
check(oddsSums.every((n) => Math.abs(n) < 1e-6), "Odds add up to zero in every season", oddsSums.map((n) => n.toFixed(6)).join(" "));
const horseshoe = seasons["luckiest"];
const blackCat = seasons["unluckiest"];
console.log(`info The Horseshoe: ${horseshoe.teamSeason.person} ${horseshoe.value.toFixed(1)} in ${horseshoe.teamSeason.season}; The Black Cat: ${blackCat.teamSeason.person} ${blackCat.value.toFixed(1)} in ${blackCat.teamSeason.season}`);
// Trades: every trade's players are known for 2018–2023 and 2026 (2024–2025 had none), and each
// team's trades match ESPN's own counter. A trade's nets add up to zero.
const tradeSeasons = full.seasons.map((s) => s.season).filter((y) => full.teamSeasons.some((t) => t.season === y && t.tradeNet !== null));
check(tradeSeasons.join() === full.seasons.map((s) => s.season).filter((y) => y !== 2017).join(), "trade details for every season but 2017", tradeSeasons.join());
const tradeCountsOff = tradeSeasons.flatMap((y) => {
  const file = readTrades(y)!;
  return full.teamSeasons
    .filter((t) => t.season === y)
    .filter((t) => file.trades.filter((tr) => tr.legs.some((l) => l.fromTeamId === t.teamId || l.toTeamId === t.teamId)).length !== t.trades)
    .map((t) => `${y} ${t.person}`);
});
check(tradeCountsOff.length === 0, "each team's trades match ESPN's trade counter", tradeCountsOff.join(", ") || `${tradeSeasons.map((y) => `${y}: ${readTrades(y)!.trades.length}`).join(", ")}`);
const netSums = tradeSeasons.map((y) => full.teamSeasons.filter((t) => t.season === y).reduce((n, t) => n + t.tradeNet!, 0));
check(netSums.every((n) => Math.abs(n) < 1e-6), "trade points add up to zero in every season", netSums.map((n) => n.toFixed(2)).join(" "));
// Roster IQ: replaying the regular season with everyone's actual scores gives ESPN's seeds (wins,
// then total points; in 2017–2018 the two division winners first), and the best lineup every week
// never makes a seed worse.
const seedsOff = league.seasons.filter((s) => s.complete).flatMap((s) => {
  const division = new Map(league.teamSeasons.filter((t) => t.season === s.season).map((t) => [t.teamId, t.division]));
  const seeds = regularSeeds(league.games.filter((g) => g.season === s.season), division);
  return league.teamSeasons.filter((t) => t.season === s.season && seeds.get(t.teamId) !== t.seed).map((t) => `${s.season} ${t.person} ${seeds.get(t.teamId)} vs ${t.seed}`);
});
check(seedsOff.length === 0, "the regular-season replay gives ESPN's seeds", seedsOff.join(", "));
const optimized = league.teamSeasons.filter((t) => t.optimizedSeed !== null);
check(optimized.length === league.teamSeasons.filter((t) => t.bench !== null).length && optimized.every((t) => t.optimizedSeed! <= t.seed),
  "best-lineup seeds for every bench season, never worse than the real seed",
  `${optimized.length} team-seasons, ${optimized.filter((t) => t.optimizedSeed! < t.seed).length} move up`);
// Roster box: the best player of each MVFP's team is the MVFP; Inconsistent exists wherever there
// are projections; the best drafted player is one of the team's picks.
const mvfpOff = [...mvfp.values()].flat().filter((v) => {
  const t = league.teamSeasons.find((x) => x.season === v.season && x.person === v.person)!;
  return rosterBox(t).picks.best?.name !== v.name;
});
check(mvfpOff.length === 0, "each MVFP is his team's Best Player", mvfpOff.map((v) => `${v.season} ${v.person}`).join(", "));
const boxes = league.teamSeasons.map((t) => ({ t, box: rosterBox(t) }));
check(boxes.every(({ t, box }) => (box.picks.inconsistent !== null) === projectedSeasons.includes(t.season)) &&
  boxes.every(({ box }) => box.picks.drafted !== null) &&
  boxes.every(({ box }) => box.picks.best !== null && box.picks.franchise !== null),
  "Roster box: every pick where its data exists",
  `${boxes.filter(({ box }) => box.picks.inconsistent).length} Inconsistent, ${boxes.filter(({ box }) => box.picks.drafted).length} drafted of ${boxes.length}`);

// 12. Round 6 (2026-11-17): the Playcall Review and the compact Pancake Watch
// Roster IQ is the league's average points left on the bench minus the team's, so it adds up to
// zero each season, like Luck, Odds and Trades.
const reviews = people.flatMap((p) => performance(full, p).map((s) => ({ p, s })));
const iqSums = benchSeasons.map((y) => reviews.filter(({ s }) => s.season === y).reduce((n, { s }) => n + s.review.iq.value!, 0));
check(iqSums.every((n) => Math.abs(n) < 1e-6), "Roster IQ adds up to zero in every season", iqSums.map((n) => n.toFixed(6)).join(" "));
// Every bar's ends are the league's worst and best that season with zero between them, the
// season's number lies between the ends, and its rank is within the league
const rowsOff = reviews.flatMap(({ p, s }) =>
  Object.entries(s.review)
    .filter(([, r]) => r.lo > 0 || r.hi < 0 || (r.value !== null && (r.value < r.lo - 1e-9 || r.value > r.hi + 1e-9 || r.place! < 1 || r.place! > s.teams)))
    .map(([k]) => `${s.season} ${p} ${k}`),
);
check(rowsOff.length === 0, "Playcall Review: every number sits between the league's worst and best", rowsOff.join(", ") || `${reviews.length} seasons`);
// The site owner's sketch: AJ and Luke in 2023, as drawn. His Roster IQ numbers, 54.6 and −99.4,
// were read off the old chart; the site's are 54.1 and −100.8.
const review23 = (p: string) => reviews.find((r) => r.p === p && r.s.season === 2023)!.s.review;
const drawn = (r: ReturnType<typeof review23>) =>
  [r.luck.value!.toFixed(1), r.odds.value!, r.iq.value!.toFixed(1), Math.round(r.trades.value!), r.streak.value!].join(" ");
check(drawn(review23("aj")) === "1.3 2 54.1 -76 10" && drawn(review23("luke")) === "-1.3 -1 -100.8 24 -8", "2023 Playcall Reviews match the sketch (AJ, Luke)",
  `AJ ${drawn(review23("aj"))}; Luke ${drawn(review23("luke"))}`);
// 2017 has no projections, bench lineups or trade details; the season in progress has every number
const r17 = reviews.filter(({ s }) => s.season === 2017);
const live = reviews.filter(({ s }) => s.live);
check(r17.every(({ s }) => s.review.odds.value === null && s.review.iq.value === null && s.review.trades.value === null) &&
  live.every(({ s }) => Object.values(s.review).every((r) => r.value !== null)),
  "2017 rows say so; the season in progress has a review so far", `${r17.length} in 2017, ${live.length} live`);
// The Pancake Watch's pancake game: in the ladder's last week, ESPN lists the last-place game last,
// and its loser (or the team with that bye) finished last
const pancakeGames = league.seasons.filter((s) => s.complete).filter((s) => {
  const g = rounds(league, s, "consolation").at(-1)!.games.at(-1)!;
  const loser = !g.away ? g.home : g.winner === "HOME" ? g.away : g.home;
  return loser.person === league.teamSeasons.find((t) => t.season === s.season && t.lastPlace)!.person;
});
check(pancakeGames.length === league.seasons.filter((s) => s.complete).length, "the ladder's last game decides last place", `${pancakeGames.length} seasons`);

// 13. Round 7 (2026-11-18): close games (decided by under 7) and blowouts (by more than 50)
// Every decided game is close, normal or a blowout, and each team-season's close and blowout
// games are its share of them
const kinds = { close: 0, normal: 0, blowout: 0 };
for (const g of full.games) kinds[marginKind(g)] += 1;
const sideCount = (kind: "close" | "blowout") => full.teamSeasons.reduce((n, t) => n + t[kind].w + t[kind].l + t[kind].t, 0);
check(kinds.close + kinds.normal + kinds.blowout === full.games.length && sideCount("close") === 2 * kinds.close && sideCount("blowout") === 2 * kinds.blowout &&
  full.teamSeasons.every((t) => t.close.w + t.close.l + t.close.t + t.blowout.w + t.blowout.l + t.blowout.t <= t.all.games),
  "close + normal + blowout games add up to every decided game", `${kinds.close} + ${kinds.normal} + ${kinds.blowout} = ${full.games.length}`);
// The thresholds are about one standard deviation either side of the average winning margin, so
// close games and blowouts are each about a sixth of the games (15.4% and 16.3% at exactly 1 SD)
const margins = league.games.map((g) => marginCents(g) / 100);
const meanMargin = margins.reduce((n, m) => n + m, 0) / margins.length;
const sdMargin = Math.sqrt(margins.reduce((n, m) => n + (m - meanMargin) ** 2, 0) / margins.length);
const closeShare = league.games.filter((g) => marginKind(g) === "close").length / league.games.length;
const blowoutShare = league.games.filter((g) => marginKind(g) === "blowout").length / league.games.length;
check(Math.abs(closeShare - 0.154) < 0.025 && Math.abs(blowoutShare - 0.163) < 0.025 && Math.abs(meanMargin - sdMargin - CLOSE_UNDER) < 1 && Math.abs(meanMargin + sdMargin - BLOWOUT_OVER) < 3,
  "close games and blowouts are each about a sixth of the games",
  `${(closeShare * 100).toFixed(1)}% close, ${(blowoutShare * 100).toFixed(1)}% blowouts; margin ${meanMargin.toFixed(1)} ± ${sdMargin.toFixed(1)} through ${THROUGH}`);
// Round 8 moved the four close-game and blowout records to the League tab as all-time totals, and
// changed the two awards (section 14). The career totals through 2025, ties broken by the margins
// added up (Luke's Round 7 pick): Kyle's 15 close wins (by 48.0 in all) beat Abdi's 15 (by 61.2).
const leagueTops = (counts?: (p: string) => boolean) => Object.fromEntries(leagueRecords(league, 5, counts).map((r) => [r.key, r.entries]));
const careerAll = leagueTops();
const careerActive = leagueTops((p) => activeSet.has(p));
const careerExpect: [string, string, number][] = [
  ["blowout-wins", "aj", 27],
  ["blowout-losses", "jordan", 20],
  ["close-wins", "kyle", 15],
  ["close-losses", "aj", 16],
];
for (const [key, person, value] of careerExpect) {
  const e = careerAll[key][0];
  check(e.person === person && e.value === value, `league record ${key} through 2025`, `${e.person} ${e.value}`);
}
check(careerAll["close-wins"].slice(0, 2).map((e) => e.person).join() === "kyle,abdi" && careerActive["blowout-losses"][0].person === "kaden",
  "close-win ties go to the closer games; with Active on Kaden holds The Punching Bag",
  `${careerAll["close-wins"].map((e) => `${e.person} ${e.value} by ${e.split.wonBy.toFixed(1)}`).join(", ")}; active ${careerActive["blowout-losses"][0].person}`);
// The League records count the same games as each manager's career line, live season included
const splitsOff = full.managers.filter((m) => {
  const line = marginCareer(full, m.slug);
  const close = careerSplits(full, "close").get(m.slug);
  const blow = careerSplits(full, "blowout").get(m.slug);
  return !close || !blow || close.w !== line.close.w || close.l !== line.close.l || blow.w !== line.blowout.w || blow.l !== line.blowout.l;
});
check(splitsOff.length === 0, "League records match every career close-game and blowout line", splitsOff.map((m) => m.slug).join(", ") || `${full.managers.length} managers`);
// Career lines through 2025, so the season in progress doesn't move them
const lineOf = (p: string) => {
  const m = marginCareer(league, p);
  return `${m.close.w}-${m.close.l} ${m.blowout.w}-${m.blowout.l}`;
};
const lineExpect: Record<string, string> = { kyle: "15-4 4-11", randy: "8-15 8-14", aj: "8-16 27-11" };
check(Object.entries(lineExpect).every(([p, s]) => lineOf(p) === s), "career close-game and blowout lines through 2025",
  Object.keys(lineExpect).map((p) => `${p} ${lineOf(p)}`).join("; "));

// 14. Round 8 (2026-11-20)
// Self-Inflicted is gone; The One Hit Wonder took its place. Each entry's player was the team's
// lowest-projected starter (kickers, D/STs and projections of 0 aside) and its top scorer that week.
const lineupKeys = lineupRecords(full).map((r) => r.key).join();
const hits = oneHitWonders(full);
const lineupOf = (season: number, week: number, teamId: number) =>
  lineupSides(readLineups(season)).find((s) => s.week === week && s.side.teamId === teamId)?.side.lineup.filter(isStarter) ?? [];
const hitsOff = hits.filter((h) => {
  const starters = lineupOf(h.game.season, h.game.week, h.game.home.teamId);
  const pool = starters.filter((p) => p.defaultPositionId !== 5 && p.defaultPositionId !== 16 && Math.round((p.projectedTotal ?? 0) * 100) > 0);
  const low = Math.min(...pool.map((p) => p.projectedTotal!));
  const top = Math.max(...starters.map((p) => p.appliedStatTotal ?? 0));
  return !close(h.player!.projected, low) || !close(h.value, top) || h.player!.position === 5 || h.player!.position === 16;
});
check(lineupKeys === "bench-game,one-hit" && hitsOff.length === 0 && hits.every((h) => h.game.season >= 2018),
  "The One Hit Wonder replaces Self-Inflicted; every entry is the lowest projection and the top score", `${hits.length} games, ${hitsOff.length} off`);
const oneHit = lineupRecords(league).find((r) => r.key === "one-hit")!.entries[0];
check(oneHit.game.home.person === "ryan" && oneHit.game.season === 2024 && oneHit.game.week === 11 && oneHit.player!.name === "Taysom Hill" && close(oneHit.value, 41.52),
  "The One Hit Wonder through 2025: Ryan's Taysom Hill, 41.52 in 2024 week 11", `${oneHit.game.home.person} ${oneHit.player!.name} ${oneHit.value}`);
// The site owner's example, Tre Tucker in 2025 week 3, can't be one: nobody had him that week (he was
// picked up for week 5). Tucker Kraft's 33.3 for Nigel in 2025 week 8 is one.
const treWeek3 = lineupSides(readLineups(2025)).filter((s) => s.week === 3 && s.side.lineup.some((p) => p.fullName === "Tre Tucker"));
const kraft = hits.find((h) => h.game.season === 2025 && h.game.week === 8 && h.player!.name === "Tucker Kraft");
check(treWeek3.length === 0 && !!kraft && kraft.game.home.person === "nigel", "Tre Tucker wasn't on a roster in 2025 week 3; Tucker Kraft's 2025 week 8 is a One Hit Wonder",
  kraft ? `${kraft.game.home.person} ${kraft.value}` : "Kraft missing");

// Below Zero is most losses now (it was fewest wins): checked with the season records above.

// Ice in the Veins: a win by a point or less; Dunzo: a loss by more than DUNZO_OVER, picked so that
// as many games fall beyond it as within a point (25 each through 2025, 2.46%).
const within = (games: Game[]) => games.filter((g) => marginCents(g) <= ICE_WITHIN * 100).length;
const beyond = (games: Game[]) => games.filter((g) => marginCents(g) > DUNZO_OVER * 100).length;
check(within(league.games) === 25 && beyond(league.games) === 25 && Math.abs(within(full.games) - beyond(full.games)) <= 2,
  `Dunzo's ${DUNZO_OVER} matches the share of games won within a point`,
  `through 2025: ${within(league.games)} and ${beyond(league.games)} of ${league.games.length} (${((within(league.games) / league.games.length) * 100).toFixed(2)}%); now ${within(full.games)} and ${beyond(full.games)} of ${full.games.length}`);
// Each award goes to every completed season with such a game, against anyone; 2021 week 8's game
// decided by exactly 1.00 counts for its winner
const sideOf = (g: Game, won: boolean) => (g.winner === "HOME") === won ? g.home : g.away;
const earned = (pick: (g: Game) => boolean, won: boolean) =>
  [...new Set(league.games.filter((g) => g.winner !== "TIE" && pick(g)).map((g) => `${g.season} ${sideOf(g, won).person}`))].sort().join(", ");
const exactlyOne = league.games.find((g) => marginCents(g) === 100)!;
check(award("ice").join(", ") === earned((g) => marginCents(g) <= ICE_WITHIN * 100, true) && award("ice").includes(`2021 ${sideOf(exactlyOne, true).person}`),
  "Ice in the Veins: every season with a win by a point or less, 1.00 included", `${award("ice").length} awards; 1.00: ${exactlyOne.season} week ${exactlyOne.week}`);
check(award("dunzo").join(", ") === earned((g) => marginCents(g) > DUNZO_OVER * 100, false), "Dunzo: every season with a loss by more than 84", `${award("dunzo").length} awards`);

// The pancake ladder: ESPN's pairings and final places in every completed season, from the rule
const ladderOff = league.seasons.filter((s) => s.complete).filter((s) => {
  const weeks = rounds(league, s, "consolation");
  const teams = league.teamSeasons.filter((t) => t.season === s.season);
  const bySeed = teams.filter((t) => t.seed > s.playoffTeams).sort((a, b) => a.seed - b.seed).map((t) => t.teamId);
  const pairsOf = (r: (typeof weeks)[number]) => r.games.map((g) => [g.home.teamId, g.away?.teamId ?? null].sort().join("v")).join(" ");
  const asPairs = (p: [number, number | null][]) => p.map(([a, b]) => [a, b].sort().join("v")).join(" ");
  let prev: { winner: number; loser: number | null }[] | null = null;
  for (const r of weeks) {
    const expected = prev ? nextLadder(prev) : firstLadder(bySeed);
    if (asPairs(expected) !== pairsOf(r)) return true;
    prev = r.games.map((g) => (!g.away ? { winner: g.home.teamId, loser: null } : g.winner === "AWAY" ? { winner: g.away.teamId, loser: g.home.teamId } : { winner: g.home.teamId, loser: g.away.teamId }));
  }
  const places = ladderPlaces(prev!, s.playoffTeams + 1);
  return teams.some((t) => places.has(t.teamId) && places.get(t.teamId) !== t.finalRank) || teams.find((t) => t.lastPlace)!.teamId !== lastOf(prev!);
});
check(ladderOff.length === 0, "the pancake ladder rule gives ESPN's pairings and places in every season", ladderOff.map((s) => s.season).join(", ") || `${league.seasons.filter((s) => s.complete).length} seasons`);
// The chances: they add up to 100% over the season's teams, a safe team never finishes last, and the
// replay of the decided games gives ESPN's live seeds (the simulation's starting point)
const odds8 = pancakeOdds(full);
const liveInfo = full.seasons.at(-1)!;
if (odds8) {
  const total = [...odds8.chance.values()].reduce((n, c) => n + c, 0);
  const safeOff = [...odds8.safe].filter((p) => (odds8.chance.get(p) ?? 0) > 0);
  const liveTeams = full.teamSeasons.filter((t) => t.season === liveInfo.season);
  const liveSeeds = regularSeeds(full.games.filter((g) => g.season === liveInfo.season), new Map(liveTeams.map((t) => [t.teamId, t.division])));
  check(Math.abs(total - 1) < 1e-9 && safeOff.length === 0 && liveTeams.every((t) => liveSeeds.get(t.teamId) === t.seed),
    "pancake chances add up to 100%, safe teams never finish last, the replay gives ESPN's live seeds",
    `${odds8.sims} runs; ${liveTeams.map((t) => `${t.person} ${(odds8.chance.get(t.person)! * 100).toFixed(1)}%`).join(", ")}; projections ${odds8.projected ? "found" : "missing"}; miss ${odds8.calibration.mean.toFixed(1)} ± ${odds8.calibration.sd.toFixed(1)}`);
} else {
  console.log("info no season in progress: no pancake chances");
}

// Record-break news: posts in date order, and each post's record is that record's holder as of that
// date. Checked over the history from 2018 too, so the rule is tested before 2026's breaks come in.
const history = recordPosts(full, 2018);
const cutAt = (season: number, week: number | null): League => ({
  ...full,
  seasons: full.seasons.filter((s) => s.season <= season),
  teamSeasons: full.teamSeasons.filter((t) => t.season <= season),
  games: full.games.filter((g) => g.season < season || (g.season === season && (week === null || g.week <= week))),
  bench: full.bench.filter((b) => b.season < season || (b.season === season && (week === null || b.week <= week))),
});
const holderAt = (post: (typeof history)[number]) => {
  const at = cutAt(post.season, post.week);
  const find = <E,>(defs: RecordDef<E>[], entry: (d: RecordDef<E>, e: E) => { who: string; value: string }) => {
    const d = defs.find((x) => x.key === post.record.key);
    return d && d.entries[0] ? entry(d, d.entries[0]) : null;
  };
  return post.week === null
    ? find(seasonRecords(at, 1), (d, e) => seasonEntry(at, d, e))
    : (find(gameRecords(at, 1), (d, e) => gameEntry(at, d.key, e)) ??
        find(lineupRecords(at, 1), (_d, e) => lineupEntry(at, e)) ??
        find(leagueRecords(at, 1), (d, e) => leagueEntry(at, d, e)));
};
const postsOff = history.filter((p) => {
  const h = holderAt(p);
  return !h || h.who !== p.entry.who || h.value !== p.entry.value || p.date !== (p.week === null ? weekDate(p.season, full.seasons.find((s) => s.season === p.season)!.weeks) : weekDate(p.season, p.week));
});
const ordered = history.every((p, i) => i === 0 || history[i - 1].date <= p.date);
const current = recordPosts(full);
check(ordered && postsOff.length === 0 && current.map((p) => p.slug).join() === history.filter((p) => p.season >= FIRST_NEWS_SEASON).map((p) => p.slug).join(),
  "record-break posts are in date order and each names the record's holder as of its date",
  postsOff.map((p) => p.slug).join(", ") || `${history.length} since 2018, ${current.length} from ${FIRST_NEWS_SEASON}: ${current.map((p) => `${p.date} ${p.title}`).join("; ")}`);
check(weekDate(2026, 1) === "2026-09-15" && weekDate(2026, 10) === "2026-11-17" && weekDate(2025, 1) === "2025-09-09",
  "posts are dated the Tuesday after each NFL week", `${weekDate(2026, 1)}, ${weekDate(2026, 10)}, ${weekDate(2025, 1)}`);

// Leaderboard: Per game lost PDIFF (Round 8); All-time's phone sort Record (Round 9, was W/L) sorts by
// Wins (the default) or Losses, and shows the record either way
const game = VIEWS.find((v) => v.key === "game")!;
const allTime = VIEWS.find((v) => v.key === "all")!;
const recordSort = allTime.phoneSorts[0];
const ajLine = `${totals.get("aj")!.w}-${totals.get("aj")!.l}`;
const recordShows = ["wins", "losses"].map((k) => allTime.stats.find((s) => s.key === k)!.phone?.show(totals.get("aj")!));
check(!game.stats.some((s) => s.key === "pdiff") && !game.phoneSorts.some((s) => s.value === "pdiff") && recordSort.label === "Record" &&
  recordSort.within?.map((o) => `${o.value}:${o.label}`).join() === "wins:Wins,losses:Losses" && allTime.rankStat === "wins" &&
  recordShows.every((r) => r === ajLine) && !VIEWS.some((v) => v.phoneSorts.some((s) => s.label === "W/L")),
  "Per game has no PDIFF; All-time's Record sorts by Wins or Losses and shows the record", `${recordSort.label}: ${recordShows.join(", ")}`);

// Round 9: the career row is Seasons, Win %, Total PF, Close games, Blowouts (no PF/G); the home
// page's Mahaan Bakaree card opens the reigning champion's page and 2026 Standings the latest season
const row = careerStats(full, "aj").map((s) => s.label).join(", ");
const links = homeLinks(full);
check(row === "Seasons, Win %, Total PF, Close games, Blowouts", "the career row is in the Round 9 order, without PF/G", row);
check(links.champ === champions(full)[0].person && links.season === full.seasons.at(-1)!.season,
  "the home cards go to the reigning champion's page and the latest season", `${links.champ}, ${links.season}`);

// Season pages: Rank Δ moves add up to zero (every seed is someone's place)
const rankOff = full.seasons.filter((s) => seasonTable(full, s).reduce((n, r) => n + (r.rankChange ?? 0), 0) !== 0);
check(rankOff.length === 0, "season-page Rank Δ adds up to zero in every season", rankOff.map((s) => s.season).join(", ") || `${full.seasons.length} seasons`);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
