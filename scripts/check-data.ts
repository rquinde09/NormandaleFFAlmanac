// Checks the site's numbers through the 2025 season:
// - all-time W, L, PF, PA and seasons against the Google Sheet copy (all 23 managers must match)
// - record holders, checked by hand against the raw data. The old Records pages were kept by hand
//   and skip most 2017 entries; where they differ, the old value is noted next to the expectation.
// - championship counts (the stars in the old Teams menu)
// - per-season averages, order and RKΔ against the old Leaderboard copy
// - championship lineups against the final scores, and the hand-entered 2021 one
// - last place against the 2024 pancake news post
// - the Active records rule against the site owner's example
// - the Manager Performance medals against the site owner's 2024 PF example, and the awards
// Usage: npm run check
import fs from "node:fs";
import path from "node:path";
import { careerTotals, champions, gameRecords, getLeague, seasonRecords, type League } from "../lib/league";
import { VIEWS, rankOrder } from "../lib/standings";
import { championDetails, topStarters } from "../lib/champions";
import { achievements, performance } from "../lib/manager";

const THROUGH = 2025;
const SHEET = path.join(process.cwd(), "data", "reference", "google-sheet-through-2025.csv");
const LEADERBOARD = path.join(process.cwd(), "data", "reference", "google-sheet-leaderboard-through-2025.csv");

const full = getLeague();
const league: League = {
  ...full,
  seasons: full.seasons.filter((s) => s.season <= THROUGH),
  teamSeasons: full.teamSeasons.filter((t) => t.season <= THROUGH),
  games: full.games.filter((g) => g.season <= THROUGH),
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

// 6. Champions page: each final's starters add up to the champion's score. ESPN has no 2021
// lineups; that one was entered by hand from the site owner (9 starters, 4 bench, no points). The
// 2023 final matches the old news post (178.68–76.5 over Robel).
const finals = champions(league).map((c) => ({ c, d: championDetails(league, c) }));
const espn = finals.filter(({ d }) => !d.manual);
const adds = espn.filter(({ d }) => d.starters && d.final && close(d.starters.reduce((a, p) => a + (p.points ?? NaN), 0), d.final.home.points, 0.011));
check(adds.length === espn.length && espn.length === finals.length - 1,
  `championship lineups add up to the final score: ${adds.length}/${espn.length} from ESPN`);
const hand = finals.find(({ c }) => c.season === 2021)!;
check(hand.c.person === "robel" && hand.d.manual && hand.d.starters?.length === 9 && hand.d.bench?.length === 4 &&
  [...hand.d.starters, ...hand.d.bench].every((p) => p.points === null), "2021 championship roster entered by hand",
  `${hand.c.person}: ${hand.d.starters?.length} starters, ${hand.d.bench?.length} bench`);
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
check(randy24.marks.pf.place === 1 && close(randy24.values.pf, 2241.1, 0.05) && jeremy24.marks.pf.place !== 1 && jeremy24.marks.finish.place === 1,
  "2024 PF gold is Randy's 2,241.1, not champion Jeremy's",
  `Randy ${randy24.values.pf.toFixed(2)} place ${randy24.marks.pf.place}; Jeremy ${jeremy24.values.pf.toFixed(2)} place ${jeremy24.marks.pf.place}`);
// The PF tab's gold and pancake agree with the Manager of the Year and Below Zero awards, the PA
// tab's pancake with It Was Only A Dream
const people = league.managers.map((m) => m.slug);
const award = (key: string) => people.flatMap((p) => achievements(league, p).find((a) => a.key === key)!.seasons.map((s) => `${s.season} ${p}`)).sort();
const tab = (pick: (m: { place: number | null; last: boolean }) => boolean, mode: "pf" | "pa") =>
  people.flatMap((p) => performance(league, p).filter((s) => pick(s.marks[mode])).map((s) => `${s.season} ${p}`)).sort();
check(award("moty").join() === tab((m) => m.place === 1, "pf").join() && award("below-zero").join() === tab((m) => m.last, "pf").join() &&
  award("dream").join() === tab((m) => m.last, "pa").join(), "PF and PA medals match the season awards", award("moty").join(", "));
// MVFP: one per season with lineups; ESPN kept none for 2021
const mvfp = topStarters(league);
check([...mvfp.keys()].sort().join() === "2017,2018,2019,2020,2022,2023,2024,2025" && [...mvfp.values()].every((v) => v.length === 1),
  "MVFP in every season but 2021", [...mvfp.values()].flat().map((v) => `${v.season} ${v.person} ${v.name} ${v.points.toFixed(1)}`).join("; "));

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
