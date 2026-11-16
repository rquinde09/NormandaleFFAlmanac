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
// Usage: npm run check
import fs from "node:fs";
import path from "node:path";
import { careerTotals, champions, gameRecords, getLeague, luck, odds, seasonRecords, type League } from "../lib/league";
import { VIEWS, rankOrder } from "../lib/standings";
import { championDetails, topStarters } from "../lib/champions";
import { achievements, performance } from "../lib/manager";
import { readTrades, regularSeeds } from "../lib/playcalls";
import { rosterBox } from "../lib/roster";
import { rounds } from "../lib/seasons";

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
  ["worst", "cesar", 2017, 3, 0], // old site: Jordan (2025); same 3 wins, Cesar has lower PF
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
// The Bench tab's pancakes agree with the Benchwarmer award
check(award("benchwarmer").join() === people.flatMap((p) => performance(league, p).filter((s) => s.marks.bench.last).map((s) => `${s.season} ${p}`)).sort().join(),
  "Bench pancakes match the Benchwarmer award", award("benchwarmer").join(", "));
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

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
