// Checks the site's numbers through the 2025 season:
// - all-time W, L, PF, PA and seasons against the Google Sheet copy (all 23 managers must match)
// - record holders, checked by hand against the raw data. The old Records pages were kept by hand
//   and skip most 2017 entries; where they differ, the old value is noted next to the expectation.
// - championship counts (the stars in the old Teams menu)
// - per-season averages, order and RKΔ against the old Leaderboard copy
// - championship lineups against the final scores
// Usage: npm run check
import fs from "node:fs";
import path from "node:path";
import { careerTotals, champions, gameRecords, getLeague, seasonRecords, type League } from "../lib/league";
import { VIEWS, rankOrder } from "../lib/standings";
import { championDetails } from "../lib/champions";

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

// 6. Champions page: each final's starters add up to the champion's score (ESPN has no 2021
// lineups), and the 2023 final matches the old news post (178.68–76.5 over Robel)
const finals = champions(league).map((c) => ({ c, d: championDetails(league, c) }));
const adds = finals.filter(({ d }) => d.starters && d.final && close(d.starters.reduce((a, p) => a + p.points, 0), d.final.home.points, 0.011));
check(adds.length === finals.length - 1 && !finals.find(({ c }) => c.season === 2021)!.d.starters,
  `championship lineups add up to the final score: ${adds.length}/${finals.length}, no 2021 lineups`);
const f2023 = finals.find(({ c }) => c.season === 2023)!.d.final!;
check(close(f2023.home.points, 178.68) && close(f2023.away.points, 76.5) && f2023.away.person === "robel", "2023 final",
  `${f2023.home.points}–${f2023.away.points} vs ${f2023.away.person}`);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
