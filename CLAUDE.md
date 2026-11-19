# NCC Fantasy Football site

Website for Normandale Nation (NCC), a private 14-team ESPN fantasy football league.
2017–2025 are complete; 2026 is season 10. It replaces the hand-maintained Google Site at
nccfantasyfootball.com. The decisions below were made deliberately, so don't relitigate them
without new evidence.

## Architecture (settled)
- Static Next.js (App Router, TypeScript, Tailwind) on Vercel, built from JSON files in `data/`.
- The site never calls ESPN at runtime. A scheduled GitHub Actions job (daily during the season)
  runs a Python script using cwendt94's `espn-api`, writes `data/*.json`, and commits only when
  something changed. Vercel redeploys on the push.
- If ESPN breaks or the cookie expires, the job fails loudly and the site keeps the last good
  data, showing "data as of …".
- Past seasons are fetched once and kept in the repo. Never overwrite a completed season's data
  with an empty or failed fetch.
- The one runtime exception: the Roster box's player photos load from ESPN's image CDN
  (`a.espncdn.com` headshots and D/ST team logos) in the visitor's browser, with initials if one
  fails. Luke OK'd it (2026-11-15). No image is stored in the repo, and no ESPN data API is called.
- Raw ESPN JSON stays in the repo and is never shipped to the browser. `lib/league.ts` reads
  `data/raw/*.json` and `data/managers.json` at build time and computes everything (standings,
  records, champions). Client components get only derived rows. Python only fetches. There is
  one implementation of the counting rules, in TypeScript.
- `data/managers.json` (hand-edited) maps ESPN owner IDs to people: `slug` (the URL,
  `/teams/<slug>`, matching the old site), `name`, `nickname`, `active` and `espnIds`. The site
  shows only `nickname` (the first name). `name` is the full name, never shown (site owner,
  2026-11-14), kept because `npm run check` matches the Sheet copies by it. Stats
  aggregate by person, not by ESPN team (team names change every year). A team whose owners
  aren't in `managers.json` fails the build on purpose, and Vercel then keeps the last good
  deploy. A new manager means adding them here.
- League news and stories are Markdown files that the site owner edits on GitHub's website. Keep
  the format simple enough to edit there: frontmatter plus plain Markdown, no MDX components.
- Accounts: the site owner's personal GitHub (not an org) and Vercel Hobby plan, with Luke as
  collaborator. ESPN access uses one league member's cookies, kept in `.env.local` and Actions
  secrets. Luke knows whose they are; the repo doesn't record it.
- Repo: github.com/rquinde09/NormandaleFFAlmanac. Vercel project `normandale-ff-almanac`, live at
  https://normandale-ff-almanac.vercel.app, with no environment variables.
- Domain: nccfantasyfootball.com is registered at Squarespace Domains (moved from Google Domains;
  renews 2027-09-15), with DNS on Google's `ns-cloud-d*.googledomains.com` nameservers. As of
  2026-11-02 it has one record: `www` CNAME `ghs.googlehosted.com` (the Google Site). The bare
  domain doesn't resolve, and there's no MX or TXT, so no email depends on it. To switch, add both
  names to the Vercel project and set the records Vercel shows. Keep the nameservers. To roll
  back, point `www` at `ghs.googlehosted.com` again.
- The repo is PUBLIC (decided 2026-11-01). Vercel Hobby deploys a private repo only when the
  commit author is the Hobby account owner ("Collaboration has never been permitted on Hobby
  plans", Vercel KB "Why aren't commits triggering deployments"), so the Actions job's commits
  and Luke's would never deploy. Rewriting commit authors to get past that check was ruled out.
  Consequences:
  - Every committed file is world-readable. Commit nothing personal beyond what the site already
    shows: no ESPN usernames, no notes on whose account the cookies come from, never secrets.
    `fetch_seasons.py` saves members as IDs only.
  - GitHub disables scheduled workflows in a public repo after 60 days with no repo activity.
    The off-season does that every year, so re-enable "Fetch ESPN data" in the Actions tab each
    September.
  - Secrets are safe: Actions secrets aren't exposed to forks or pull requests from forks.
    Don't add `pull_request_target` workflows.

## Secrets (hard rules)
- `ESPN_S2` is a full session for the cookie owner's ESPN account. It lives only in `.env.local`
  (gitignored)
  and GitHub Actions secrets: never in chat, client code, logs or a commit.
- Claude: never read, cat, grep or print `.env.local`. Run `python scripts/check_env.py`, which
  reports only the shape of each value.
- Never give these variables a `NEXT_PUBLIC_` prefix. The Next.js app doesn't need them at all.
- Don't automate the ESPN login. The cookies get refreshed by hand when they expire. Signing out of
  that ESPN account in the Chrome profile they came from may end the session and break the job.
- `SWID` is the cookie owner's ESPN user GUID. It also shows up as an owner ID in league data and
  in `managers.json`, which is fine: `espn_s2` is the credential, `SWID` is an identifier.

Env vars, same names in `.env.local` and in Actions secrets: `ESPN_LEAGUE_ID`, `ESPN_S2`,
`ESPN_SWID`. Template: `.env.example`.

## Known risks
- ESPN's API is unofficial. On 2025-08-01 ESPN restricted access to past-season data; it's
  reportedly still readable with `espn_s2`. Seasons before 2018 use the older `leagueHistory`
  endpoint, so 2017 is the riskiest season.

## ESPN data facts (verified 2026-11-01 on every season, 2017–2026)
- 2017 reads from `leagueHistory`, 2018+ from `seasons/{year}/segments/0/leagues/{id}`, except
  2021, which returns 401 there and is read from `leagueHistory`. espn-api 1.0.1 retries the other
  endpoint on a 401, so this needs no special case.
- Use the `mMatchupScore` view for the schedule. `mMatchup` leaves out `playoffTierType`, and
  espn-api then quietly treats every game as regular season.
- `playoffTierType`: `NONE` = regular season, `WINNERS_BRACKET` = playoffs,
  `WINNERS_CONSOLATION_LADDER` = placement games for teams knocked out of the playoffs,
  `LOSERS_CONSOLATION_LADDER` = consolation for non-playoff teams. It agrees exactly with
  `matchupPeriodId <= settings.scheduleSettings.matchupPeriodCount` in every season.
- Playoff byes are schedule entries with no `away` side and `winner: UNDECIDED`. They are not games.
- ESPN's team `record.overall` (W-L-T, PF, PA) counts regular-season games only.
- Key people by owner GUID. Team IDs and ESPN display names change between seasons; owner GUIDs
  stayed the same from 2017 to 2026.
- A team can list several owner IDs: one person with two ESPN accounts (Jeremy Mitchell, Abdi
  Hayow, Robel Asmelash) or two real co-managers (2017 team #8). `managers.json` maps a list of IDs
  to each person.
- Settings change between seasons, so read them per season: 12 teams in 2019 and 2021 (14
  otherwise); 13 regular-season weeks in 2019–2020 (14 otherwise); 6 playoff teams in 2017–2019,
  8 in 2020–2024 and 2026, 7 in 2025.
- Tie rule is `NONE` (ties stand). There were no ties and no score adjustments in 2017–2025, and
  every playoff matchup was one week long.
- `rankCalculatedFinal` gives each team's final place (1 = champion).
- `transactionCounter.trades` is 0 for every team in 2024 and 2025. The site owner confirmed
  there were no trades those years (2026-11-14), so the zeros are real.
- 2017 and 2018 had two divisions (one since). ESPN seeds the division winners first, then
  everyone by wins and total points (`playoffSeedingRule` `TOTAL_POINTS_SCORED`). Replaying the
  regular season that way gives ESPN's `playoffSeed` for every team in 2017–2025.
- Checked 2026-11-15 with the current cookies:
  - Weekly player projections (stats with `statSourceId` 1, `statSplitTypeId` 1, the week's
    `scoringPeriodId`) come back in box scores for 2018–2026, not 2017 (leagueHistory, starters
    with season totals only). A lineup's starters' projections add up to ESPN's own
    `totalProjectedPoints` (2026 week 1: 14/14 to the cent).
  - Drafts (`mDraftDetail`) exist for every season. Player `-1` is a pick nobody entered (the last
    round of 2017's offline draft); D/ST player IDs are −16000 − `proTeamId`.
  - Trades with their players: `mTransactions2` leaves other teams' legs out and the
    `communication` endpoint returns nothing for past seasons, but player cards
    (`kona_playercard`) list every executed `TRADE_ACCEPT` with its `TRADE` legs from 2019 on.
    2018's trades are executed `TRADE_UPHOLD` rows, which only `mTransactions2` returns (one
    duplicate). leagueHistory gives no trade details (2017, and 2021 read that way). Per-team counts match
    `transactionCounter.trades` in every season with details. Rebuilding trades from roster
    changes doesn't work: waiver swaps look like trades.
  - `kona_player_info` gives each player's weekly and season points (and ESPN's preseason
    projection) for the seasons endpoint; leagueHistory seasons give season totals only.
  - The seasons endpoint 401s for 2021 with the site's cookies, which then fall back to
    leagueHistory: no lineups, projections, weekly points or trade details. A 2021 league
    member's cookies read it (2026-11-15) and gave all of them, all 21 trades included.
- Player lineups (fetched for 2017–2025 on 2026-11-05): views `mMatchupScore` + `mScoreboard`
  with `scoringPeriodId` and an `x-fantasy-filter` on the matchup period return each side's
  `rosterForCurrentScoringPeriod` (whole roster, with `lineupSlotId` and points) for 2018+, and
  only `rosterForMatchupPeriod` for 2017: starters only, every one with `lineupSlotId` 0. 2021
  through leagueHistory returns no lineups at all (`mRoster` there gives only the end-of-season
  roster); through the seasons endpoint it returns whole rosters, but with 0.0 points for every
  player, as ESPN's own 2021 box score pages show. The week's actual stat rows have the points
  (fetched 2026-11-15). In every season, every lineup's starters add up to the team score. `lineupSlotId` 20 = bench, 21 = IR,
  23 = FLEX. `defaultPositionId`: 1 QB, 2 RB, 3 WR, 4 TE, 5 K, 16 D/ST.
- `fetch_seasons.py` drops personal settings, team-private lists and live/projection fields
  (`DROP_KEYS`) before saving, so the repo holds no private data and unchanged days don't commit.

## Scripts and commands
- Node 26 LTS. Run `npm install`, then `npm run build` and `npm start`, or `npm run dev`. npm 11
  blocks esbuild's install script; `tsx` works without it, so leave it blocked.
- `npm run check` (`scripts/check-data.ts`): through 2025, all-time totals must match the Sheet
  copy 23/23, plus the 13 record holders, the championship counts, the old Leaderboard's
  per-season averages and order 14/14, each championship lineup against the final score (and the
  hand-entered 2021 lineup against ESPN's, slot for slot), last place against the pancake post,
  and the Active records example.
  It also checks the extras: luck adds up to zero each season, the bench rows cover every game
  of 2018–2025 (starters add up to the score, the best lineup is never below the one
  started), each bracket's final is won by the champion, and every last-place team missed the
  playoffs. Round 5 adds: projections cover 2018–2025 and Odds adds up to zero each
  season; trade details for every season but 2017, per-team counts match ESPN's, and
  trade points add up to zero; the regular-season replay gives ESPN's seeds and the best-lineup
  seed is never worse; each MVFP is his team's Best Player; the Roster box has every pick its
  data allows. Round 6 adds: Roster IQ adds up to zero each season and its lowest is the
  Benchwarmer; every Playcall Review number sits between the league's worst and best; AJ's and
  Luke's 2023 reviews come out as sketched; 2017's rows say what's missing and the season in
  progress has every number; the pancake ladder's last game decides last place. Round 7 adds:
  close, normal and blowout games add up to every decided game; each is about a sixth of the
  games; Ice in the Veins and Got Blown Out go to the Escape Artist's and Punching Bag's top
  holders each season; the four new records' holders and the close-win tie order; and Kyle's,
  Randy's and AJ's career lines through 2025 (Kyle 15-4 and 4-11, Randy 8-15 and 8-14, AJ 8-16
  and 27-11). Run it after any change to `lib/league.ts`, `lib/standings.ts`, `lib/champions.ts`,
  `lib/manager.ts`, `lib/bench.ts`, `lib/seasons.ts`, `lib/playcalls.ts` or `lib/roster.ts`.
- Python lives in `.venv` (`python -m venv .venv`, then `.venv/Scripts/python -m pip install -r
  requirements.txt`). `scripts/check_env.py` checks `.env.local` without printing values.
  `scripts/probe.py [season ...]` prints a season summary, with owner IDs cut to 8 characters.
- `scripts/fetch_seasons.py [season ...] [--force] [--force-extras] [--env FILE]` writes
  `data/raw/{season}.json`. It skips completed seasons that already have a file, and saves only
  responses that pass checks. Per season it also keeps (Round 5, 2026-11-15):
  - `data/raw/lineups/{season}.json`: each week's lineups, keeping each player's ID, name,
    position, slot, points and ESPN's projection for that week (`projectedTotal`; about 1.1 MB a
    season). A finished season's file is written once (one ESPN gives no lineups for is saved
    empty, so it isn't asked for again). While a season is on, each week is added once all its games are decided (one
    request), and fetched again if ESPN later corrects a score. If a player's points come back
    0.0, the week's actual stat row fills them in (2021); starters must still add
    up to the team score.
  - `data/raw/drafts/{season}.json`: the picks, once.
  - `data/raw/players/{season}.json`: every drafted or rostered player's name, position, points
    over the fantasy season's weeks (ESPN's season total where only that exists: 2017) and
    preseason projection. Once a season is over; weekly while on.
  - `data/raw/trades/{season}.json`: executed trades with every player (`available: false` for
    2017). Once a season is over; while it's on, whenever ESPN's trade count changes. A
    completed season's per-team counts must match `transactionCounter.trades`.
  `--force-extras` refetches those four files without touching the season files, and never
  replaces one with an emptier one (no lineups, season totals only, no trade details), so a run
  with the site's cookies keeps 2021's. `--env FILE` reads cookies from another file
  (environment variables still win). It also writes
  `data/meta.json` (`updatedAt`, the last time data changed), which the footer shows.
- 2021's lineups, players and trades came from a one-off run (2026-11-15) with a 2021 league
  member's cookies in a separate gitignored env file: `fetch_seasons.py 2021 --force-extras --env
  FILE`, after `python scripts/check_env.py FILE`. The 2021 season file stayed as it was. Those
  cookies never go in the Actions secrets.
- `.github/workflows/fetch-espn.yml` runs the fetch daily at 10:00 UTC, September–January (plus
  manual runs). It commits `data/` only when something changed. Secrets: `ESPN_LEAGUE_ID`,
  `ESPN_S2`, `ESPN_SWID`. Collaborators on a personal repo can add them.

## Site
- Routes: `/` (season status, Pancake Watch while a season is on, the reigning champion under
  "Reigning Mahaan Bakaree Champion (The Great Goat)", news), `/standings` (`?view=all|season`;
  no `view` is Per game), `/teams`, `/teams/[slug]`, `/records` (`?view=season`),
  `/hall-of-mahaan-bakaree` (champions computed from final ranks; the nav tab says "Champions"),
  `/seasons` and `/seasons/[year]`, `/news/[slug]`. Seasons has no nav tab (a sixth doesn't fit a
  375 px phone): the home page's season card, the Champions page (each year and "Every season")
  and the Standings page link to it.
- Old Google Sites URLs redirect in `next.config.ts`: `/home`, `/league-history` (to
  `/standings?view=all`), `/leaderboard` (to `?view=season`), `/retired-teams`,
  `/records/game-records`, `/records/season-records`. `/teams/<name>` and
  `/hall-of-mahaan-bakaree` keep their old paths. The Teams tab stays "Teams" (site owner,
  2026-11-05).
- Standings has three views, defined in `lib/standings.ts`: All-time totals (W, L, PF, PA,
  Seasons, Titles, Trades), Per season averages (W, L, PF, PA per season, Seasons; through 2025
  its numbers match the old Leaderboard page), and Per game averages (Win %, PF, PA, PDIFF per
  game). Per game is the default (`DEFAULT_VIEW`, site owner 2026-11-07); All-time is
  `?view=all`. All three count live. Each ends with Rank Δ: the change in that view's ranking since the
  end of the previous season, counted among the managers shown, so the Active switch renumbers.
  Active only is on by default (`active=0` turns it off). First names only, with stars and
  pancakes (site owner, 2026-11-14). "No last names" covers how the site shows managers; the old
  news posts keep their wording and the record "The Vega" keeps its name. On a phone, Compact (on by default, `compact=0` turns it off)
  replaced the name search: one line per manager, "1. Jeremy ★★ 🥞 ▲2 58.8%", the number being
  the sorted stat and ▲2 the view's Rank Δ (Round 5, 2026-11-15). The small stats show only with
  Compact off. The desktop table has no
  Compact switch. View, sort, direction, Compact and Active live in the URL, updated with
  `window.history.replaceState` (`lib/url.ts`), which Next keeps in sync with `useSearchParams`.
  Per season and Per game rank only managers with `MIN_SEASONS` (3, a placeholder) seasons;
  shorter careers list after them.
- Teams page: name, stars, pancakes and seasons only, no rank or record, in two columns so every
  active manager fits on one phone screen. Retired managers sit in a collapsed "Retired" row
  (`<details>`) below (site owner, 2026-11-10).
- Manager pages (the site owner's Round 2 spec, 2026-11-07, answers 2026-11-10; Round 3,
  2026-11-14; Round 4, 2026-11-14; Round 5, 2026-11-15, with Luke's answers the same day), top
  to bottom:
  - First card: first name with stars and pancakes, Active/Retired, "Champion: years" and "Loser:
    years" (last place). No full name. The career numbers fold out under "Career stats": the
    all-time record, then Seasons, Win %, PF/G and Total PF, left to right. No rank, best finish
    or PDIFF. Round 7 (2026-11-18) added one line under them, "Close games 16-4 · Blowouts 7-11"
    (`marginCareer` in `lib/manager.ts`): W-L in close games and blowouts over every decided
    game, the season in progress included; 0-0 without any. A small line under it gives the
    definitions ("Close: by under 7 points · Blowout: by over 50"), one line each at 375 px.
  - Manager Performance (`components/ManagerPerformance.tsx`, `performance` in `lib/manager.ts`,
    the shared axis in `components/ChartFrame.tsx`): one red line, with tabs for Finish, Wins, PF
    and PA (Round 5 moved the rest to Manager Playcalls, which Round 6 replaced with the Playcall
    Review), and one y axis that follows the tab
    (Finish has 1st at the top). Every point is labeled. Each season's marker shows where that
    season ranked in the league on that tab: gold, silver and bronze for 1st–3rd and a pancake
    for last. Finish uses the final standings. Wins: most is 1st, ties broken by PF. PF: most is
    1st. PA: fewest is 1st, most is last. Other ties share the place. `npm run check` tests the
    site owner's example: Randy's 2,241.1 PF gets 2024's PF gold, champion Jeremy's 2,208 silver.
    Points for completed seasons only, since half a season's PF flattens the rest; the season in
    progress has a column with no point. No year picker or season card (removed in Round 3).
    Tapping a season selects it (Round 4): its year turns into a red pill, a faint band runs
    behind its column, and its number goes bold. Each season's tap target is a 28 px column over
    its point and year. The selection stays when the tab changes, and the Roster box and Playcall
    Review below follow it (`components/ManagerCharts.tsx` holds it); tapping it again, or anywhere outside the points,
    tabs and the boxes about the selection, clears it. Round 5: the page opens with the season in
    progress selected (a retired manager's last season), and a line under the chart says where
    the selected season ranked ("2019 · 7 wins (7-9) · 6th of 12"; the season in progress: "Season
    in progress").
  - Roster box (`lib/roster.ts`, `components/RosterBox.tsx`, Round 5, inspired by Luke): inside
    Manager Performance, open while a season is selected. Four players side by side, title above,
    photo, name and stat below. Best Player: most points in his starting lineup (the MVFP rule).
    Best Drafted: the most points that fantasy season by one of his draft picks, wherever he
    played. Inconsistent (Luke's pick over "Most Hated"): the starter furthest below ESPN's
    weekly projections, added up over his starts there (2018–2025 and 2026; none for 2017).
    Franchise Player: the most starts; a tie goes to ESPN's higher preseason projection. The
    season in progress counts its decided weeks. 2017 has no Inconsistent (no projections).
  - Playcall Review (`components/PlaycallReview.tsx`, `review` in `lib/manager.ts`; the site
    owner's Round 6 sketch, 2026-11-17, with his answers relayed by Luke the same day). It
    replaced Round 5's Manager Playcalls box (five tabs of season-by-season bar charts with
    medals), which the site owner found confusing. Inside Manager Performance under the Roster
    box, open while a season is selected, like the players: "AJ's Playcall Review · 2023", or
    "· 2026 so far" for the season in progress, which counts its decided weeks. Five rows, each
    a thin bar with zero in the middle: the bad word and that season's league worst at the left
    end, the good word and its best at the right (the site owner's pick; his sketch's end numbers
    came off the old Luck chart). Each half is scaled to its own end, so a full half is the
    league's best or worst that season. The bar fills from zero to the number, green when good
    and red when bad; a number that rounds to zero is grey, "Even". Then the verdict word and his
    line. A small rank beside the number ("2nd of 14", higher is better on every row, ties share
    a place); no medals or pancakes (site owner). On wider screens the verdicts sit right of the
    bars, as sketched. A folded "How it's counted" explains each number. The rows, in his words:
    - Luck, Unlucky ↔ Lucky: "Lucky – Won more games than expected" / "Unlucky – Lost more games
      than expected". All-play wins above expected (`luck`). (The site owner first asked to
      rename Luck to Odds; once he understood all-play he kept it, 2026-11-15.)
    - Odds, Under perform ↔ Over perform: "Over perform – ESPN rooted against the team" / "Under
      perform – ESPN rooted for the team". Wins above what ESPN projected (`odds`,
      `projectedWins`): each game, ESPN's favorite is the starting lineup with the higher
      projected score (a tie counts half); a team's projected wins are the games it was favored
      in, over every decided game like W-L. Round 5's example: projected 5-12, finished 9-8, so
      +4. 2017's row says "ESPN has no 2017 projections".
    - Roster IQ, Low ↔ High: "High – Made better roster calls than league mates" / "Low – Made
      worse roster calls than league mates". The league's average points left on the bench that
      season minus the team's own (Bench, below), so it adds up to zero each season and the
      lowest is the Benchwarmer. Under it, where the best lineup would have moved the seed up:
      "Best lineup every week: seed 14th → 11th" (`optimizedSeeds` in `lib/playcalls.ts`, Luke's
      pick of the site owner's Round 5 "optimized finish": the regular season replayed with this
      team's best lineup every week and everyone else's actual scores, seeded as ESPN does; games
      against it can change other teams' records too; no playoff replay; completed seasons
      only). 2017's row says "ESPN has no 2017 bench lineups".
    - Trades, Bust ↔ Boom: "Boom – Trade helped your season" / "Bust – Trade did not help your
      season" ("Trades" after more than one). The net points (`tradeNets`, Luke's pick of the
      rule): every player received scores for his new team in the weeks he started there, from
      the trade until he leaves its roster, playoffs included; the team that sent him is charged
      the same points. A team without a trade counts as 0 for the ends and ranks, and its row
      says "No trades" in grey. 2017: "17 trades · ESPN has no 2017 trade details".
    - Streaks, Cold ↔ Hot: "Hot – Team showed consistency winning" / "Cold – Team failed to
      perform". The longer of the season's longest winning and losing streaks (the winning one on
      a tie), shown as W10 or L8. He wrote 14 at both ends; the ends are the league's, like the
      other rows.
    `npm run check` tests his sketch, 2023: AJ +1.3, +2, +54.1, −76, W10; Luke −1.3, −1, −100.8,
    +24, L8 (his 54.6 and −99.4 were read off the old chart).
  - Opponents (`lib/manager.ts`, `components/Opponents.tsx`): head-to-head over every decided
    game, live season included, in seven tabs. Faced (most games), Easiest (most wins against),
    Toughest (most losses against), Most PF and Most PA (totals over every game against that
    opponent, not per game), Best win (most points in a win) and Worst loss (fewest points in a
    loss). The first five show a ring and the opponent's name only (Round 3), centered in the box
    (Round 4). The ring's middle holds games, wins, losses, or the PF or PA total; its red arc is
    the win share (Faced, Easiest), loss share (Toughest) or points share. Best win and Worst loss
    show the game. Round 5: on every tab the ring sits in the middle of the box with the name or
    the game under it, and every tab is the same height. Retired opponents are always left out:
    Round 4 removed this
    box's Active switch and kept it on (`opponents` filters them). Every manager, retired ones
    included, still has active opponents on all seven tabs. The Active switches on Standings and
    Records stay.
  - Achievements (`achievements` in `lib/manager.ts`, `components/Achievements.tsx`): two tabs,
    GOAT Tier and Pancake Tier, of emoji icons greyed out until earned in a completed season.
    Tapping one shows the site owner's description and the seasons earned. GOAT Tier: 🐐 The
    Mahaan Bakaree (Won a Championship), 🔥 Manager of the Year (Scored the Most Points For),
    🥇 The #1 Seed (`playoffSeed` 1), 💪 MVFP (had the league's highest scoring player: the most
    points one player scored for one team while in its starting lineup that season, playoffs
    included; `topStarters` in `lib/champions.ts`).
    Pancake Tier: 🥞 The Pancake House (Last Place), 🧑‍🎨 The Choke Artist (Runner Up), 🥶 Below
    Zero (fewest PF in the league that season), 😢 It Was Only A Dream (most PA) and 🪑 The
    Benchwarmer (most points left on the bench that season; Luke, 2026-11-15, its name a
    placeholder for the site owner). Season PF
    and PA count every game that season, so a playoff bye's missing game is part of the game
    (site owner); ties share the award. The Trade and Commish awards were removed in Round 3.
    The Below Zero award isn't the "Below Zero" season record (fewest wins).
    Round 7 (2026-11-18) added one to each tier, both names placeholders until the site owner
    names them: GOAT Tier 🧊 Ice in the Veins ("Won the Most Close Games": most close-game wins
    that season) and Pancake Tier 💥 Got Blown Out ("Lost the Most Blowouts": most blowout
    losses). Completed seasons only, ties share it (2018's top was 2 close wins, so seven teams
    share that one), and a season where nobody has any awards nobody. Tapping one shows each
    season's count ("2020 (3 close wins)").
- Champions page (`/hall-of-mahaan-bakaree`): each title expands (`<details>`) to the
  championship game's lineup with the bench, the season's best game (the champion's highest
  score), and the best player (most points while in the starting lineup, playoffs included).
  `lib/champions.ts` computes these from `data/raw/lineups/`. 2017 shows starters by position
  with no bench. Before ESPN's 2021 lineups were fetched, that champion's final lineup was
  entered by hand from the site owner (`data/manual/lineups-2021.json`, 2026-11-07; Trey Lance
  started at QB, Lamar Jackson was on the bench). ESPN's (2026-11-15) matches it slot for slot,
  with points, and is shown; `npm run check` compares them. A hand-entered lineup
  (`data/manual/lineups-{season}.json`, same shape) is used only when ESPN has none for that
  champion.
- Records use the old site's 14 names. On a phone, Compact (on by default, `compact=0` turns it
  off; Round 5) shows one line per record: its name and description with the holder's number
  beside them; tapping it shows who holds it ("Luke def. Suny") and the game or season. Without
  Compact, and on wider screens, each card lists 1st to 5th (no fold-out). Game records count every decided game, live season
  included. Season records count completed seasons only. They're computed over all seasons,
  2017 included. The old hand-kept Records pages skipped most 2017 entries, so 6 holders differ
  from the old site, for example Cesar Vega's 33.72 in 2017 holds "The Vega".
  `scripts/check-data.ts` notes each old value. Each card shows the holder; 2nd–5th fold out
  (`<details>`). Active only is on by default. With it on, a game record counts only games between
  two active managers, so a record set against a retired manager drops out (site owner,
  2026-11-07: the @$$-Whooping becomes Luke def. Suny). Season records count the manager.
  Luke added five more on 2026-11-15, each listed after the old site's: game records Riding the
  Pine (most points left on the bench) and Self-Inflicted, and season records The Horseshoe, The
  Black Cat and Asleep at the Wheel (most points left on the bench). Their names are
  placeholders until the site owner names them. The bench ones cover 2018 on.
  Round 5 descriptions: Self-Inflicted "Lost, but the best lineup would have won them the game"
  (ranked by how much it would have won by); The Horseshoe "Outperformed season projection" and
  The Black Cat "Underperformed season projection", which therefore count Odds (2018–2025), not
  all-play luck.
  Round 7 (2026-11-18) added four season records after those, names placeholders (Luke's pick):
  The Steamroller "Most wins by more than 50 points", The Punching Bag "Most losses by more than
  50 points", The Escape Artist "Most wins by under 7 points" and Heartbreak Hotel "Most losses by
  under 7 points". Same rules as the other season records (completed seasons, 2017 included, top
  5, Active counts the manager). The counts are small (at most 6 close games or 7 blowouts in a
  season), so ties are common; Luke's tie-break is the margins added up: the smaller total
  first on the close-game records, the bigger first on the blowout records. Jeremy's 4 close wins
  in 2019 (by 14.3 in all) hold The Escape Artist over Abdi's 2023 (17.5) and 2021 (19.1). The
  detail reads "2019 · 4-0 in close games, by 14.3 total · team", the margin before the team name
  so a phone's truncated 2nd–5th rows still show it. Through 2025 the holders are AJ 2018 (5),
  Tom 2018 (6, by 474.0 over Jordan 2021's 455.8), Jeremy 2019 (4) and Madison 2019 (5); with
  Active on, Kaden 2019 and Robel 2024 hold the two loss records. The card grid is
  `grid-cols-1` on a phone so a long detail line can't widen the page.
- Luck (`luck` and `TeamSeason.expectedWins` in `lib/league.ts`, Luke 2026-11-15): all-play
  expected wins. Each week a team earns the share of the other teams that played that it
  outscored (ties count half), over every decided game, as with W-L. Luck is wins (ties half)
  minus that, so each season's luck adds up to zero.
- Odds (`odds`, `TeamSeason.projectedWins`, `lib/playcalls.ts`; the site owner's Round 5 with
  Luke, 2026-11-15): see the Playcall Review. Each season's Odds add up to zero. The Horseshoe:
  Luke 2025, 9-8 when ESPN projected 1-16 (+8).
- Bench (`lib/bench.ts`, Luke 2026-11-15): each week's best possible lineup from the team's
  players, minus the starters' points. One-position slots fill first with the best players, then
  FLEX with the best left over (optimal for this league's QB, 2 RB, 2 WR, TE, FLEX, D/ST, K). A
  player may also fill the slot he actually started in; IR players can't start. Slot counts come
  from each season's `rosterSettings.lineupSlotCounts`. Only seasons whose lineups include the
  bench count: 2018–2025 and the season in
  progress, whose decided weeks are fetched weekly since Round 5 (so the season page's Bench
  column and the game records count it live). `lib/bench.ts` also reads the lineup files for
  `lib/champions.ts`, `lib/playcalls.ts` and `lib/roster.ts`.
- Season pages (`lib/seasons.ts`, `components/Bracket.tsx`, Luke 2026-11-15). `/seasons` lists
  every season with champion, runner-up and last place. `/seasons/[year]` has:
  - the podium
  - the standings table: final place, or the current seed while the season is on, with a line
    under the last playoff spot. W-L, PF and PA count every game. Luck and Bench, plus PA and Seed
    on wider screens.
  - the playoff bracket: rounds named Quarterfinals, Semifinals, Final by weeks left, in ESPN's
    schedule order, byes shown, the champion starred
  - the pancake ladder (`LOSERS_CONSOLATION_LADDER`)

  `league.bracket` keeps every playoff-week schedule entry, byes and undecided games included.
- Pancake Watch (`pancakeWatch` in `lib/seasons.ts`, `components/PancakeWatch.tsx`, home page,
  only while a season is on). Last place isn't the worst regular-season team: every team that
  misses the playoffs plays the consolation ladder for it (2019's 7 seed and 2018's and 2021's
  first teams out finished last). So the watch lists everyone below the playoff line, worst first:
  regular-season W-L, games behind the last playoff spot ("Tied, out on points" when level), and
  "No playoffs" once a team can't catch enough teams to make it (ties at equal wins count as
  catchable). Seeds are ESPN's live `playoffSeed`, which breaks ties on total points. After the
  regular season it shows the ladder.
  Round 6 (site owner, 2026-11-17) made it compact: folded shut (`<details>`), it shows only
  who's in danger of last place, the name large in red with a pancake and a pulsing red light
  (steady with reduced motion), and one line ("Last at 2-7, tied with Randy · 5 weeks left").
  Tapping it opens the list above. During the regular season that's the bottom of the standings
  (ESPN's last seed). After it, the bottom game of the ladder's latest week. In the ladder's last
  week ESPN lists the last-place game last (every season 2017–2025; `npm run check` tests it), so
  that game reads "The pancake game: the loser finishes last", and a bye there is last place.
- PWA: `app/manifest.ts`, with icons generated by `app/icon.tsx` and `app/apple-icon.tsx`.

## Counting rules (settled 2026-11-01: they reproduce the Sheet exactly for all 23 managers)
- W, L, PF and PA count every decided game: regular season, playoffs, placement and consolation.
  This differs from ESPN's own team record, which is regular season only.
- Byes and undecided games are not games.
- The current season counts live: all-time standings include each game of the season in
  progress once ESPN marks it decided (Luke's call, 2026-11-01). Pages show which week the data
  runs through, e.g. "through Week 7, 2026".
- Seasons = seasons in which the person owned a team. The season in progress counts as one.
- Per-season averages divide by seasons with the season in progress weighted by how much of it
  has been played: weeks with decided games ÷ all its weeks, playoffs included (8/17 after week 8
  of 2026), so the view updates weekly (Luke's call, 2026-11-05). That's `seasonWeight` in
  `careerTotals`; a finished season counts 1.
- Each team-season goes to the one person in `managers.json` among its owner IDs. Tommy P.
  co-managed 2017 team #8 with Jordan German and is left out of `managers.json` on purpose, so
  Jordan gets the credit, as in the Sheet.
- Troy Montoya played 2017–2019 on an ESPN account in another name (owner ID `AAB17ECA…`). The
  mapping was confirmed by his Sheet row matching to the hundredth of a point.
- Ties: none so far. Default if one happens: show W-L-T, and Win % counts a tie as half a win.
- Close games and blowouts (the site owner, Round 7, 2026-11-18; `marginKind`, `CLOSE_UNDER`,
  `BLOWOUT_OVER` and `TeamSeason.close`/`.blowout` in `lib/league.ts`): a close game is decided
  by under 7 points, a blowout by more than 50, compared in cents. Every decided game counts, as
  with W-L; byes and undecided games don't. Why these numbers: over the 1,088 decided games from
  2017 to 2026 week 10, the winning margin averages 29.3 points with a standard deviation of
  22.4. One SD either side is 6.9–51.7 and holds 68.3% of games, so close means more than 1 SD
  below the average (15.4% of games) and a blowout more than 1 SD above it (16.3%); the round
  numbers give 15.7% close and 17.9% blowouts. A margin of exactly 7 or 50 is neither (one game:
  Randy's 148.98–98.98 over Kenny, 2018 week 16). The site owner picked these over an
  alternative based on bench swaps. A team plays a median of 3 close games and 3 blowouts a
  season, so there are no per-season bar charts (considered and rejected).
- Last place (the league's "Loser", punished with pancakes) is `finalRank` equal to the season's
  team count (`lastPlace` on each team-season). It matches the 2024 pancake news post: 2018 Nigel,
  2019 Kaden, 2020 Ryan, 2021 Suny, Luke 2022–23; `npm run check` tests it. Pancakes (🥞) show
  like the title stars (★).
- The Sheet sorts by Wins. Its RKΔ column wasn't updated after 2025 (it matches the 2023→2024
  movement for 19/23), so the site computes rank change itself: the change since the end of the
  previous completed season.
- Reference copy of the Sheet: `data/reference/google-sheet-through-2025.csv`, pulled from the
  published chart at
  https://docs.google.com/spreadsheets/d/e/2CAIWO3elYE8W_c2VwP9gBh1ecyuU6tZduutEV4U5dgiTmtvh254fR_9Z_2CqC9g5Bl_VFWGZQsVzrlXtp_Q/gviz/chartiframe?oid=820605052
  (the data is embedded in the iframe HTML; the sheet itself isn't published).

## Design
Copy the food logger (https://food-logger-rust.vercel.app/): page `#09090b`, cards
`bg-zinc-900 border border-zinc-800 rounded-2xl`, Inter, segmented-control toggles, thin
progress bars, PWA manifest. Mobile first: nothing should need a rotated phone.

## Standings UX
- Phone: a sort control (four stats per view), an up/down toggle, and Compact (one line each,
  on by default) or cards.
- Desktop: a table whose name column stays put while the other columns scroll.
- An "Active only" switch. No name search (removed in Round 3). Sort and filter state live in
  the URL.
- Rate views need a minimum-seasons rule (threshold TBD, placeholder 3), or a 2-season 22-12
  manager outranks a 9-season 90-61 one.

## Old site (Google Sites)
Home (welcome text and 6 news posts, 2020–2026; the text is ported to `content/news`, the ~10
photos aren't, by the site owner's choice), Hall of Mahaan Bakaree (11 images, not ported; the new page is computed), Teams
(first-name pages with embedded Sheet charts; titles shown as stars), Retired Teams, League
History (the Sheet chart), Leaderboard (a Sheet chart of per-season averages, copied to
`data/reference/google-sheet-leaderboard-through-2025.csv`; its RKΔ has 2 hand-typed errors),
Records (game and season subpages, kept by hand, "Will Update End of Season").

## Stages
1. Get the league ID and the `espn_s2` and `SWID` cookies into `.env.local`. Done 2026-11-01.
2. Test script: pull 2017 and 2025. Confirm owner IDs come back and that regular-season, playoff
   and consolation games can be told apart. Done 2026-11-01; see "ESPN data facts". If the
   cookies ever switch to another account, rerun `probe.py 2017 2025`, because access to 2017
   may depend on the account.
3. Download every season to raw JSON, compute all-time standings, reconcile with the Google Sheet
   (typo or counting choice for each difference), and write the counting rules above. Done
   2026-11-01: no typos, one counting choice (all games count).
4. v1 site: all-time standings, manager pages (career totals and each season), records, news.
   Then the scheduled Actions job. Then point nccfantasyfootball.com at Vercel, keeping the
   Google Site up until the new one checks out. ← current. Live on Vercel 2026-11-02: repo
   pushed, Actions secrets set, and the scheduled job's commits deploy on their own (checked
   2026-11-04). The site owner's notes are built (standings views, records and standings Active
   default, manager chart and year picker, Champions tab with expandable details, old news
   posts). He withdrew the Leaderboard-page request and doesn't want the old photos for now.
   Round 2 (2026-11-07, answers 2026-11-10) is built: home label, Per game default, Teams page,
   manager page boxes (Manager Performance, Opponents, Achievements), records fold-out and Active
   rule, and the hand-entered 2021 lineup. Round 3 (2026-11-14) is built: first names only,
   Compact standings with pancakes, the chart's Streak and Trades tabs with league-ranked medals,
   the trimmed Opponents box, and the GOAT and Pancake achievement tiers. The site owner accepted
   every proposed answer to its 8 questions the same day (all recorded above). Round 4
   (2026-11-14) is built: tapping a chart point selects its season, the Opponents ring and name
   are centered, and the Opponents box lost its Active switch (always active). Luke's extras
   (2026-11-15) are built: luck, points left on the bench, Pancake Watch and season pages.
   Round 5 (2026-11-15) is built: Manager Performance trimmed to four tabs with the 2026
   default, the rank line and the Roster box; Manager Playcalls (Luck, Odds, Roster IQ, Trades,
   Streak); centered Opponents; Records Compact and new descriptions; Rank Δ in Compact
   standings. Luke answered its 4 questions the same day (recorded above). The 2021 data
   (lineups, projections, trades) came in with a 2021 member's cookies the same day. Round 6
   (2026-11-17) is built: the one-season Playcall Review under the Roster box replaced Manager
   Playcalls, and the Pancake Watch is compact. The site owner answered its 4 questions through
   Luke the same day (recorded above). Round 7 (2026-11-18) is built: close games and blowouts
   (the career line, Ice in the Veins and Got Blown Out, and four season records). Luke picked
   the record names and the tie-break the same day (recorded above). Next: the domain.

Later, not v1: head-to-head records, photos for the Hall.

Don't overbuild v1. Build the stage in front of you.
