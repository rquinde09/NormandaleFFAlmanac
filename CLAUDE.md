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
  Record-break posts (Round 8) are made from the data at build time (`lib/recordNews.ts`) and
  listed with them; nothing is written to `content/news`.
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
- Checked 2026-11-20 (Round 8): for the weeks still to come, `mRoster` with a future
  `scoringPeriodId` returns every team's current roster (ESPN carries the lineup forward) with
  each player's projection for that week, through the season's last week; box scores give
  `totalProjectedPoints` for the matchups already scheduled. Teams' `currentSimulationResults` are
  ESPN's playoff odds (`playoffPct`, `rank`), with no last-place odds. ESPN schedules each week of
  the pancake ladder only once the week before is decided; its pairings follow a fixed rule (see
  Pancake Watch), checked against every season 2017–2025.
- Checked 2026-11-25 (Round 10): with no transaction log for past seasons, how a team got each
  player is read from the weekly whole rosters (2018 on) and the trades file
  (`lib/acquisitions.ts`). Drafted + picked-up + traded-for starter points equal every
  team-season's PF in 2018–2026, and the traded-for part equals what Trade IQ credits. Trade legs
  nobody played under are re-trades inside a week (2022: 18 → 2 → 17 in two days). The IR slot
  (`lineupSlotId` 21) exists only from 2025, one per team (`lineupSlotCounts["21"]` is 0 before);
  the saved lineups keep no injury status.
- Checked 2026-11-25 (Round 11): a box score's `injuryStatus` is the player's status now, the same
  in every week of a past season, and a past season's `proTeamId` on a player is a later snapshot
  (2023 had Barkley on PHI). But `kona_player_info`'s weekly actual rows (statSourceId 0,
  statSplitTypeId 1) tell each NFL game apart, 2018–2026 (2021 with a 2021 member's cookies): no
  row in his team's bye week, a row with his stats when he played, and a row without them when his
  team played without him (2018's rows then hold only the team's result, stats 155–157). Each row's
  `proTeamId` is that game's team. Checked on 2023's Jefferson, Burrow, Chubb, Walker, Allen and
  Cooper and 2018's Alex Smith. 2017 (leagueHistory) gives season totals only.
- `fetch_seasons.py` drops personal settings, team-private lists and live/projection fields
  (`DROP_KEYS`) before saving, so the repo holds no private data and unchanged days don't commit.
  The projections the Pancake Watch needs go in their own file (below), which does change daily.

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
  games; and Kyle's, Randy's and AJ's career lines through 2025 (Kyle 15-4 and 4-11, Randy 8-15
  and 8-14, AJ 8-16 and 27-11). Round 8 adds: every One Hit Wonder is the team's lowest
  projection and top score, the holder through 2025 is Ryan's Taysom Hill (41.52, 2024 week 11),
  Tre Tucker wasn't on a 2025 week 3 roster and Tucker Kraft's 2025 week 8 counts; Below Zero's
  most losses (Cesar 2017, 14); the four League records through 2025 (AJ 27, Jordan 20, Kyle 15
  over Abdi's 15 on margins, AJ 16; Active: Kaden) and that they match every career line; Dunzo's
  84 against the within-a-point share (25 games each through 2025) and both awards' holders; the
  ladder rule against every season's pairings and places; the pancake chances add up to 100%,
  safe teams never finish last and the replay gives ESPN's live seeds; record-break posts are in
  date order and each names the record's holder as of its date (checked over every break since
  2018); post dates; Per game has no PDIFF; the season pages' Rank Δ adds up to zero. Round 9
  adds: All-time's Record sorts by Wins or Losses and shows the record either way (no W/L sort
  left); the career row is Seasons, Win %, Total PF, Close games, Blowouts, with no PF/G; the home
  cards go to the latest season and the reigning champion. Round 10 adds: drafted, picked-up and
  traded-for points add up to PF in every team-season (2017: drafted or not); each trade's nets add
  up to zero and each team's to its Trade IQ; Draft IQ and Waiver IQ add up to zero each season
  (Waiver IQ from 2018); every completed season from 2018 has a Waiver Pick and a Drop of the Year,
  and Trade and Fleece of the Year are one trade's two sides; the Standings' view names. Round 11
  adds: injured starters' known cases (2023's Jefferson, Chubb, Burrow and Walker, 2018's Alex
  Smith, 2025's Kamara; none for Kaden in 2023, whose Stafford missed one game and then had his
  bye), a count for every team-season from 2018, Injuries adding up to zero each season, The
  Infirmary against the seasons' counts, Injury Bug; the three tiers in his order; Dynasty Manager
  (AJ 2025), no Playoff Cinderella or Revenge Tour through 2025, Comeback Manager each season;
  waiver and drop RBs, WRs and TEs only (2025: Rico Dowdle); every player named in a Trade of the
  Year; the starred records; the Standings' order. Run it
  after any change to `lib/league.ts`, `lib/standings.ts`, `lib/acquisitions.ts`, `lib/injuries.ts`,
  `lib/champions.ts`, `lib/manager.ts`, `lib/bench.ts`, `lib/seasons.ts`, `lib/playcalls.ts`,
  `lib/roster.ts`, `lib/pancake.ts`, `lib/records.ts` or `lib/recordNews.ts`.
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
    preseason projection. Once a season is over; weekly while on. Since Round 11 (2026-11-25), with
    weekly stats (2018 on), `games`: one letter per scoring period so far, P played, M his NFL team
    played without him, - a bye (or no team). A file without it is fetched once more; 2018–2026
    were (2021 with the 2021 member's cookies, below).
  - `data/raw/trades/{season}.json`: executed trades with every player (`available: false` for
    2017). Once a season is over; while it's on, whenever ESPN's trade count changes. A
    completed season's per-team counts must match `transactionCounter.trades`.
  - `data/raw/projections/{season}.json` (Round 8, 2026-11-20): while a season is on, every
    team's roster for each week not yet decided, each player with his slot, position and ESPN's
    projection for that week (`mRoster` with that `scoringPeriodId`; about 240 KB). Fetched on every
    run, so the bot commits most days in season. Nothing is saved unless the week coming up has a
    projection for every team. A finished season's file is left as it was; the site no longer
    reads it.
  `--force-extras` refetches the first four files without touching the season files, and never
  replaces one with an emptier one (no lineups, season totals only, no trade details), so a run
  with the site's cookies keeps 2021's. `--env FILE` reads cookies from another file
  (environment variables still win). It also writes
  `data/meta.json` (`updatedAt`, the last time data changed), which the footer shows.
- 2021's lineups, players and trades came from a one-off run (2026-11-15) with a 2021 league
  member's cookies in a separate gitignored env file: `fetch_seasons.py 2021 --force-extras --env
  FILE`, after `python scripts/check_env.py FILE`. The 2021 season file stayed as it was. Those
  cookies never go in the Actions secrets. Round 11's `games` for 2021 came the same way
  (`fetch_seasons.py 2021 --env FILE`, 2026-11-25), which only refetched the players file.
- `.github/workflows/fetch-espn.yml` runs the fetch daily at 10:00 UTC, September–January (plus
  manual runs). It commits `data/` only when something changed. Secrets: `ESPN_LEAGUE_ID`,
  `ESPN_S2`, `ESPN_SWID`. Collaborators on a personal repo can add them.

## Site
- Routes: `/` (four cards and the menu boxes; `?view=pancake` and `?view=news` open two of the
  cards in place, see Home page), `/standings` (`?view=all|season`; no `view` is Power Rankings;
  it was `/leaderboard` in Round 9), `/teams`, `/teams/[slug]`, `/records`
  (`?view=season|league`), `/hall-of-mahaan-bakaree` (champions computed from final ranks; the nav
  tab says "Champions"), `/seasons` and `/seasons/[year]` (`?stats=playcall|odds`),
  `/news/[slug]`. `?from=home` on a season page or a manager page adds the home pills (see Home
  page).
- Nav (`components/Nav.tsx`): Home, Standings, Teams, Records, Champions. Round 10 (the site owner,
  2026-11-25) put the all-time standings and the Seasons pages under the one Standings tab ("revert
  back to Standings and combine them"), which is lit on both; Round 9's Seasons tab is gone. Each
  page links to the other: "Standings for each season →" on Standings, "Standings across all
  seasons →" on Seasons (his "Standings for league records →", which he said to change). With five
  tabs, phones are back to 13px with 8px padding; a narrower screen scrolls them sideways. The home
  page shows no tabs (Round 9) until a card opens in place; every other page has them. The
  Champions page (each year and "Every season") also links to `/seasons`.
- Home page (`app/page.tsx`, `components/Home.tsx`; the site owner's Round 8 mockup, 2026-11-20,
  Round 9, 2026-11-23, and Round 10, 2026-11-25). The home page is the site's menu: the site
  title, no nav tabs, four smaller boxes for the other pages and four square cards (two by two on a
  phone, one row on wider screens; a card grows taller only if its content needs it). He left the
  old home page's other parts out on purpose.
  - "2026 Season" ("2026 Standings" until Round 10, so it isn't confused with the Standings page):
    the red N, "Season 10", "Week 10 of 14 complete" and a thin red bar (during the playoffs
    "Playoffs · week 16 of 17", then "Final"). Opens `/seasons/<year>?from=home`.
  - "The Mahaan Bakaree": 👑, "Reigning champion", the name with stars, the team name and that
    season's W-L. Opens the reigning champion's page, `/teams/<slug>?from=home` (Round 9: "I
    changed my mind … taken to AJ's page"; `homeLinks` in `lib/league.ts` computes it from the
    champion, so it follows next year's). With no champion yet it opens the Champions page.
  - "Pancake Watch": 🥞, a pulsing red light and the name of whoever is in danger of last place
    (as Round 6 defined it, below), and "7 weeks left" (weeks left in the season, playoffs
    included). In the off-season (default): the last season's last place, "2025 last place".
  - "News": 📰, the latest post's title and date.
  - Pancake Watch and News open in place (`?view=pancake`, `?view=news`; opening one pushes a
    history entry, so Back returns to the grid), and the nav tabs come back. The other three cards
    become pills along the top (the mockup's News view repeated NEWS there; the third pill is
    Pancake Watch), and the title reads "PANCAKE WATCH 🥞" or "NEWS". Opened views are at most
    `max-w-2xl` wide on big screens. News shows every post in full, newest first (a written post
    before record posts on the same day); each title links to its own page, whose back link
    returns to the opened News.
  - Round 9 (note 1.1, Luke's pick of the reading, 2026-11-23): the season's page and the
    champion's page show the same row of pills, the other three cards, under the nav when opened
    from home, so a visitor can switch between the four home views. The home links add
    `?from=home`, which those pages read once they load (`components/HomePills.tsx`), so they stay
    static; the pages themselves are unchanged. Opening those two in place on the home page was
    the alternative.
  - The menu boxes (Round 9): an icon and a name each. The site owner asked for the Leaderboard,
    Hall of Mahaan Bakaree and Records; Luke added Teams (2026-11-23), since without the nav every
    manager page would be two taps from home. Round 10 renamed the Leaderboard box Standings 📊
    and moved the boxes above the cards, in his order: Standings, Teams 👥, Records 📜, Hall of
    Mahaan Bakaree 🏆. Wider screens: all four in one row above the cards. Phone: Standings and
    Teams above the cards, Records and the Hall below them (his sketch moved only the first two up).
    Every row is as tall as three lines, since "Hall of Mahaan Bakaree" takes three on a phone.
  - The static page renders the grid, without tabs; the URL is read once the page loads.
- Record-break news (`lib/recordNews.ts`; the site owner's Round 8, Luke's answers 2026-11-20).
  A post for every record on the Records page broken from 2026 on (`FIRST_NEWS_SEASON`, this
  season back-filled to week 1), counting every manager: the true record, so a change only the
  Active view sees doesn't post. Built from the data at build time, so nothing new is committed.
  A game record or a League record is checked as each week is decided, a season record when the
  season ends. Broken means beaten outright: a new game (or season) at the top with a different
  number, or, on a League record, another manager passing the leader's count. Ties don't post,
  even when the tie-break hands the record over (2026: Abdi passed Kyle's 15 close wins in week 3
  and got a post; Kyle later reached 16 too and holds it on margins, without one). Each post is
  dated the Tuesday after that NFL week (the season opens the Thursday after Labor Day), and
  says what the record is, the new holder, number and game or season, the old record, and the
  holder's top scorer that week (game records) or the game that took the lead (League records).
  Title: "Abdi breaks The Escape Artist". Through 2026 week 10 there are two, both League records
  in week 3 (Abdi's Escape Artist, Randy's Heartbreak Hotel); since 2018 there would be 42.
- Old Google Sites URLs redirect in `next.config.ts`: `/home`, `/league-history` (to
  `/standings?view=all`), `/leaderboard` (to `/standings`, its query carried over),
  `/retired-teams`, `/records/game-records`, `/records/season-records`. `/teams/<name>` and
  `/hall-of-mahaan-bakaree` keep their old paths. The old Leaderboard was the per-season averages;
  its links open the default view, Power Rankings, which the site owner calls the main leaderboard
  (Luke's pick, 2026-11-23). Round 9 had `/standings` redirect to `/leaderboard`; Vercel served
  that 308 with `Cache-Control: max-age=0`, so browsers didn't keep it and reversing it can't loop
  (checked 2026-11-25). The Teams tab stays "Teams" (site owner, 2026-11-05).
- Standings (`app/standings/page.tsx`, `components/StandingsView.tsx`): the all-time standings,
  "Standings" again since Round 10 (the Leaderboard in Round 9), in the nav, the title and links.
  Its three views, defined in `lib/standings.ts`, are named by Round 10 and in Round 11's order,
  left to right: Power Rankings (`game`: Win %, PF and PA per game; Round 8 removed PDIFF
  everywhere), Season Averages (`season`: W, L, PF, PA per season, Seasons; through 2025 its numbers
  match the old Leaderboard page) and Career Records (`all`: W, L, PF, PA, Seasons, Titles,
  Trades). The tabs use the
  small segmented control so the three names fit a phone. No description under the tabs (Round
  10). Power Rankings is the default (`DEFAULT_VIEW`, site owner 2026-11-07); Career Records is
  `?view=all`. All three count live. Each ends with Rank Δ: the change in that view's ranking since the
  end of the previous season, counted among the managers shown, so the Active switch renumbers.
  Active only is on by default (`active=0` turns it off). First names only, with stars and
  pancakes (site owner, 2026-11-14). "No last names" covers how the site shows managers; the old
  news posts keep their wording and the record "The Vega" keeps its name. On a phone, one line per
  manager (Compact, Round 5, which replaced the name search): "1. Jeremy ★★ 🥞 ▲2 58.8%", the
  number being the sorted stat and ▲2 the view's Rank Δ. Round 9 hid the Compact switch ("I think
  all look really good"), so phones always get these lines; the cards with small stats that
  `compact=0` showed are gone, and so is the parameter. Career Records' phone sorts are Record, PF,
  PA and Titles. Round 8 made the first one "W/L"; Round 9 renamed it "Record" with a second control
  beside High/Low that picks Wins (the default) or Losses (`PhoneSort.within`) and keeps the
  direction (default), so "Losses, high to low" puts the most losses first. Either way the line
  shows the record ("84-76") in place of the number (`Stat.phone`), and the URL holds it like any
  sort (`sort=losses`). Season Averages keeps
  separate Wins and Losses sorts. The desktop table keeps its W and L columns and has neither
  control. The site owner called the rest of the page "perfect as it is" (Round 8), so the season
  pages' stat switch isn't here. View, sort, direction and Active live in the URL, updated with
  `window.history.replaceState` (`lib/url.ts`), which Next keeps in sync with `useSearchParams`.
  Season Averages and Power Rankings rank only managers with `MIN_SEASONS` (3, a placeholder)
  seasons; shorter careers list after them.
- Teams page: name, stars, pancakes and seasons only, no rank or record, in two columns so every
  active manager fits on one phone screen. Retired managers sit in a collapsed "Retired" row
  (`<details>`) below (site owner, 2026-11-10).
- Manager pages (the site owner's Round 2 spec, 2026-11-07, answers 2026-11-10; Round 3,
  2026-11-14; Round 4, 2026-11-14; Round 5, 2026-11-15, with Luke's answers the same day; Round 8,
  2026-11-20, from his mockup of AJ's page at phone width; Round 9, 2026-11-23; Round 10,
  2026-11-25), top to bottom (the home pills first when opened from home):
  - First card: first name with stars and pancakes, Active/Retired, "Champion: years" (gold,
    larger since Round 8) and "Loser: years" (last place). No full name. The career numbers fold
    out under "Career stats": the all-time record large, then the stats in one row on a phone
    too (Round 8: "I intentionally want the stats all next to each other"), in Round 9's order:
    Seasons, Win %, Total PF, Close games, Blowouts (`careerStats` in `lib/manager.ts`). Round 9
    removed PF/G. No rank, best finish or PDIFF. Close games and Blowouts
    (Round 7, `marginCareer` in `lib/manager.ts`) are W-L over every decided game, the season in
    progress included; 0-0 without any. A small line under them gives the definitions ("Close
    games: by under 7 points · Blowouts: by over 50"). It all fits 375 px.
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
    tabs and the boxes about the selection, clears it. Round 8: the Roster box and the Playcall
    Review each open and close from a title line, shut when the page opens; once opened, each
    stays open as other seasons are selected. Round 9 renamed the title lines (the site owner):
    "Players to Remember · 2025 ▾" (was "2025 roster") and "Playcalling Analysis · 2025 ▾" (was
    "AJ's Playcall Review · 2025"), "· 2026 so far" for the season in progress. The year stays,
    since they follow the selected season; the component names stayed. Round 10 split the
    Playcall Review into two such boxes: "Playcalling Analysis" and "Against the Odds" (below),
    each opened on its own. Round 5: the page opens with the season in
    progress selected (a retired manager's last season), and a line under the chart says where
    the selected season ranked ("2019 · 7 wins (7-9) · 6th of 12"; the season in progress: "Season
    in progress").
  - Players to Remember, the Roster box (`lib/roster.ts`, `components/RosterBox.tsx`, Round 5,
    inspired by Luke; titled "Players to Remember" since Round 9): inside Manager Performance
    while a season is selected, opened from its title line. Four players side by side, title above,
    photo, name and stat below. Best Player: most points in his starting lineup (the MVFP rule).
    Best Drafted: the most points that fantasy season by one of his draft picks, wherever he
    played. Inconsistent (Luke's pick over "Most Hated"): the starter furthest below ESPN's
    weekly projections, added up over his starts there (2018–2025 and 2026; none for 2017).
    Franchise Player: the most starts; a tie goes to ESPN's higher preseason projection. The
    season in progress counts its decided weeks. 2017 has no Inconsistent (no projections).
  - The Playcall Review (`components/PlaycallReview.tsx`, `review` and `playcallValues` in
    `lib/manager.ts`, the groups in `lib/review.ts`; the site owner's Round 6 sketch, 2026-11-17,
    with his answers relayed by Luke the same day). It replaced Round 5's Manager Playcalls box
    (five tabs of season-by-season bar charts with medals), which the site owner found confusing.
    Round 10 (2026-11-25) split it into two boxes inside Manager Performance, under the Roster box
    while a season is selected, each opened from its own title line:
    - "Playcalling Analysis · 2023" (Round 9's title): the decisions the manager made, in his
      order: Draft IQ, Roster IQ, Waiver IQ, Trade IQ.
    - "Against the Odds · 2023": "not based on how the manager decided … but the destiny or
      expectation of how their season should have resulted", in his order: Odds, Luck, Streaks,
      and Round 11's Injuries. He didn't have a name ("something to do with going up against the odds or the expectations
      or projections of ESPN"); "Against the Odds" is a placeholder until he picks one.
    "· 2026 so far" for the season in progress, which counts its decided weeks. Each row is
    a thin bar with zero in the middle: the bad word and that season's league worst at the left
    end, the good word and its best at the right (the site owner's pick; his sketch's end numbers
    came off the old Luck chart). Each half is scaled to its own end, so a full half is the
    league's best or worst that season. The bar fills from zero to the number, green when good
    and red when bad; a number that rounds to zero is grey, "Even". Then the verdict word and his
    line. A small rank beside the number ("2nd of 14", higher is better on every row, ties share
    a place); no medals or pancakes (site owner). On wider screens the verdicts sit right of the
    bars, as sketched. A folded "How it's counted" in each box explains its numbers. (Round 8's
    order, one box, was Roster IQ, Odds, Trades, Streaks, Luck.) The rows, in his words:
    - Draft IQ, Low ↔ High (Round 10): "High – Drafted better than league mates" / "Low – Drafted
      worse than league mates". What the team's draft picks scored for it, minus
      the league's average that season (`TeamSeason.draftPoints`): "If they traded them away or
      dropped the player, I only want to count the points that score for them, we are not going
      to subtract it". Points scored for the team means in its starting lineup, every decided
      game, from the draft until the player left the roster (`lib/acquisitions.ts`). 2017 counts
      too: its lineups list starters only, which is all this needs.
    - Waiver IQ, Low ↔ High (Round 10): "High – Found more on waivers than league mates" / "Low –
      Found less on waivers than league mates". The same for every player the team picked up
      (`TeamSeason.pickupPoints`), off waivers or free agency, kickers and D/STs included, as he
      asked. ESPN keeps no transactions for past seasons, so a pickup is any stint on the roster
      that isn't the draft or a trade (see `lib/acquisitions.ts`). 2017's row says "ESPN has no
      2017 waiver details": with starters only, pickups can't be told from trades. Draft points,
      pickup points and the points of players traded for add up to the team's PF.
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
    - Trade IQ (named Trades until Round 10), Bust ↔ Boom: "Boom – Trade helped your season" /
      "Bust – Trade did not help your season" ("Trades" after more than one). The net points
      (`tradeNets`, Luke's pick of the
      rule): every player received scores for his new team in the weeks he started there, from
      the trade until he leaves its roster, playoffs included; the team that sent him is charged
      the same points. A team without a trade counts as 0 for the ends and ranks, and its row
      says "No trades" in grey. 2017: "17 trades · ESPN has no 2017 trade details".
    - Streaks, Cold ↔ Hot: "Hot – Team showed consistency winning" / "Cold – Team failed to
      perform". The longer of the season's longest winning and losing streaks (the winning one on
      a tie), shown as W10 or L8. He wrote 14 at both ends; the ends are the league's, like the
      other rows.
    - Injuries, Banged up ↔ Healthy (Round 11, 2026-11-25: "count the number of players that got
      injured on the starting lineup throughout the season and compare it with the league
      average"; the words are ours). The value is the league's average injured starters that
      season minus the team's (like Roster IQ, so it adds up to zero and fewest ranks 1st), but the
      row shows counts: the team's, the league's most and fewest at the ends and "avg 4.1" in the
      middle (`counts` in `PlaycallReview.tsx`, `ReviewRow.average`). 2017: "ESPN has no 2017 game
      logs". The rule is under Injured starters, below.
    `npm run check` tests his sketch, 2023: AJ +1.3, +2, +54.1, −76, W10; Luke −1.3, −1, −100.8,
    +24, L8 (his 54.6 and −99.4 were read off the old chart).
  - Opponents (`lib/manager.ts`, `components/Opponents.tsx`): head-to-head over every decided
    game, live season included, in four tabs since Round 8 (his mockup): Favorites holds Faced
    (most games), Easiest (most wins against) and Toughest (most losses against) as three small
    rings side by side, each with its label above and the opponent's name below; Points holds Most
    PF and Most PA (totals over every game against that opponent, not per game) the same way; Best
    win (most points in a win) and Worst loss (fewest points in a loss) show the game with its
    ring. The ring's middle holds games, wins, losses, or the PF or PA total; its red arc is the
    win share (Faced, Easiest), loss share (Toughest) or points share. Every tab is the same
    height. Retired opponents are always left out: Round 4 removed this box's Active switch and
    kept it on (`opponents` filters them). The Active switches on the Standings and Records stay.
  - Achievements (`achievements` in `lib/manager.ts`, `components/Achievements.tsx`): emoji icons
    greyed out until earned in a completed season, behind tier tabs. Tapping one shows the site
    owner's description, how it's counted and the seasons earned (one to a line when each has a
    detail: a player, a trade, a game). Round 11 (2026-11-25) made three tiers, GOAT Tier, Season
    Honors and Pancake Tier, from his table: its titles, order and criteria (the descriptions). Six
    icons sit in two rows of three, eight in two rows of four as before (he wrote "keep the 2 rows
    and 3 columns" for eight; read as keeping the old four). Season PF and PA count every game
    that season, so a playoff bye's missing game is part of the game (site owner, Round 3); ties
    share an award. The Trade and Commish awards were removed in Round 3.
    - GOAT Tier: 🐐 The Mahaan Bakaree ("Wins the championship"); 🏰 Dynasty Manager ("Wins 3+
      championships": earned with the third title and each after it; AJ 2025); 👠 Playoff
      Cinderella ("Wins as the lowest playoff seed": the champion was the season's last playoff
      seed; nobody yet, Robel's 6 of 8 in 2021 is the lowest); ⚔️ Revenge Tour ("Wins after
      finishing last the previous season"; nobody yet); 🔥 Manager of the Year (most PF that
      season, every game; his table says "regular-season points", which would change 5 of 9
      winners, so it's an open question); 🥇 The #1 Seed ("Finishes regular season with the best
      record": `playoffSeed` 1, ties to the most points).
    - Season Honors: 💪 MVFP (he wrote "MVPF"; "Owns the league's Most Valuable Fantasy Player":
      the most points one player scored for one team while in its starting lineup that season,
      playoffs included; `topStarters` in `lib/champions.ts`); 🧊 Ice in the Veins (won a game by
      1.00 or less, against anyone, retired managers included; one game was decided by exactly
      1.00, Ryan over Suny in 2021 week 8, so the description says "a point or less" where his
      says "less than one point"); 💎 Waiver Pick of the Year; 🤝 Trade of the Year; 🧑‍🎨 Choke
      Artist (runner-up; Pancake Tier until Round 11); 📈 Comeback Manager ("Biggest improvement
      after a poor season": of the managers who missed the playoffs the season before, the
      biggest climb in final place, from 2018; "13th in 2017 → 4th"; AJ and Abdi tied in 2023).
    - Pancake Tier: 🥞 The Pancake House (last place); 🥶 Lowest Scoring Season (fewest PF; Below
      Zero until Round 11, which also ends its clash with the Below Zero season record); 😢 It Was
      Only a Dream (most PA); 🪑 The Benchwarmer (most points left on the bench; Luke,
      2026-11-15); 💥 Dunzo; 🗑️ Drop of the Year; 🐛 Injury Bug ("Has the most players suffer
      significant injuries": the most injured starters that season, from 2018; ties shared); 🐑
      Fleece of the Year. He also offered a GOAT award for the fewest injuries, but his table
      leaves it out (and the fewest is often shared: four teams in 2018), so there is none.
    Round 7 added Ice in the Veins and Dunzo; Round 8 (2026-11-20) redefined both. Dunzo, Round
    7's Got Blown Out renamed ("Lost a Game by More Than 84 Points"): 84 (`DUNZO_OVER`) makes a loss
    that big as rare as a win within a point (`ICE_WITHIN`), as he asked: 26 of the 1,088 decided
    games from 2017 to 2026 week 10 each (2.39%), and 25 of 1,018 each through 2025 (2.46%). He
    guessed "something over 60", but more than 60 is 10.8% of games. Both count completed seasons
    only. Ice in the Veins shows the years; since Round 11 Dunzo lists each loss with the opponent
    and score ("lost 60.04–147.78 to Khalid, week 16").
    Round 10 (2026-11-25) added the waiver, trade, drop and fleece awards (`seasonAwards` in
    `lib/acquisitions.ts`), none of them on the Records page, as he asked. Completed seasons, 2018
    on (whole rosters); points count in the starting lineup, every game, while the team had the
    player. Waiver Pick of the Year: the pickup who scored the most for the team that picked him
    up. Trade of the Year: the biggest net gain in one trade, counted as Trade IQ counts a season.
    Drop of the Year: of every player a team let go (drafted, picked up or traded for), the one
    who then scored the most for the team that picked him up; it goes to the team that let him
    go, not to one that dropped and re-added its own player. Fleece of the Year: the other side of
    the Trade of the Year (every trade so far was between two teams). Round 11: Waiver Pick and
    Drop count running backs, receivers and tight ends only (`AWARD_POSITIONS`: "Its too easy for
    QBs to score a ton of points"), and Trade and Fleece of the Year name every player in the
    trade, both ways, those who scored most first ("got Tony Pollard, Diontae Johnson and Cam
    Akers from Robel for Deebo Samuel: +361.5 pts"). Through 2025: Waiver Pick 2018 AJ (James
    Conner) to 2025 Randy (Rico Dowdle); in 2020 and 2022–2024 the Waiver Pick was the same year's
    Drop. Trade and Fleece only in 2018–2023 (no trades in 2024–2025). The rules are a reading of
    his wording, with questions open (see Stages).
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
- Records (`lib/league.ts` counts them; `lib/records.ts` words them and holds the sections;
  `components/RecordsView.tsx`). The old site's names, plus Luke's and the rounds' additions. No
  description under the title since Round 10 (the site owner; the fine print at the bottom stays).
  Round 11 (2026-11-25) folded that fine print into "* How the starred records are counted"
  (`<details>`, shut by default), one bullet each in his order (The One Hit Wonder, season
  projection, bench, close games and blowouts, then injured starters), and marked the records it
  explains with a * (`STARRED` in `lib/records.ts`).
  Three tabs since Round 8 (the site owner, 2026-11-20), in his sections:
  - Game: Match Up Records (The @$$-Whooping, The Clincher, Clash of Titans, The Snooze Fest) and
    Individual Records (Mr. Clean, The Vega, Riding the Pine, The One Hit Wonder).
  - Season: Result Records (The Special One, The Relentless, Below Zero, The Cursed), Point
    Records (The Warrior, The Baby Zebra, The Lucky One, Asleep at the Wheel) and Playcall Records
    (The Peaky Blinders, The Horseshoe, The Black Cat).
  - League: League Records, the four Round 7 close-game and blowout records as all-time totals,
    and Round 11's The Infirmary ("add whoever had the most injuries as a league record"; the name
    is a placeholder): the most injured starters over a career, from 2018, the season in progress
    included; a tie goes to fewer seasons (`careerInjuries`, counted from `league.injuries`, so the
    record-break news cuts it at each week). Through 2026 week 11: AJ 58, Jeremy 51, Jordan 46.

  On a phone, small cards two to a row, as in his mockup: the name in red capitals, the
  description (none on the Match Up records, as mocked), the number, the holder ("Luke def.
  Suny") and a small line with the game or season. Tapping a card opens a panel under its row
  with the holder's whole detail line and 2nd–5th. Round 9 hid the Compact switch, so phones
  always get the small cards (the `compact` parameter is gone). On wider screens the same
  sections hold cards listing 1st to 5th. Game
  records count every decided game, live season included. Season records count completed seasons
  only. League records count every decided game, live season included, like the career line.
  They're computed over all seasons, 2017 included. The old hand-kept Records pages skipped most
  2017 entries, so 6 holders differ from the old site, for example Cesar Vega's 33.72 in 2017
  holds "The Vega". `scripts/check-data.ts` notes each old value. Active only is on by default.
  With it on, a game record counts only games between two active managers, so a record set
  against a retired manager drops out (site owner, 2026-11-07: the @$$-Whooping becomes Luke def.
  Suny). Season and League records count the manager.
  - Luke's additions (2026-11-15), names placeholders until the site owner names them: Riding the
    Pine (most points left on the bench in a game), The Horseshoe "Outperformed season projection"
    and The Black Cat "Underperformed season projection" (both count Odds, 2018–2025, not all-play
    luck), and Asleep at the Wheel (most points left on the bench in a season). The bench ones
    cover 2018 on.
  - Below Zero is most losses since Round 8 (it was fewest wins); ties go to the fewer points
    for. Cesar's 14 in 2017 holds it (Luke 2023 with Active on).
  - The One Hit Wonder (Round 8) replaced Self-Inflicted, which the site owner didn't think much
    of: "a manager started a player who had the lowest projection on their team and resulted as
    the highest scorer on the team". No description (his call). The rule (`oneHitWonders`): that
    week's starter with the team's lowest ESPN projection was its top scorer (ties count). Kickers
    and D/STs are left out: they usually have the lowest projections, and with them in, 31 of the
    34 games would be a kicker or D/ST. Projections of exactly 0 are left out too (ESPN expected the player not
    to play, or, all over 2023 week 1, had none). Ranked by his points; 2018 on (projections).
    62 games through 2026 week 10. Ryan's Taysom Hill holds it (41.52, 2024 week 11). The site
    owner's example, Tre Tucker's 40 in 2025 week 3, can't be one: nobody had him that week (he
    was picked up for week 5). Tucker Kraft's 33.3 for Nigel in 2025 week 8 is one.
  - League records (Round 8; `leagueRecords`, `careerSplits`): The Steamroller "Most wins by more
    than 50 points", The Punching Bag "Most losses by more than 50 points", The Escape Artist "Most
    wins by under 7 points" and Heartbreak Hotel "Most losses by under 7 points", names Luke's
    Round 7 placeholders. Career totals, ties broken by the margins added up (Luke's Round 7
    pick): the smaller total first on the close-game records, the bigger first on the blowout
    records. The detail reads "27-11 in blowouts, by 1,890.6 total · 10 seasons", the margin
    before the seasons so a phone's truncated rows still show it. Through 2025: AJ 27, Jordan 20,
    Kyle 15 (by 48.0 in all, over Abdi's 15 by 61.2) and AJ 16; with Active on, Kaden holds The
    Punching Bag. As one-season records (Round 7) they were AJ 2018, Tom 2018, Jeremy 2019 and
    Madison 2019.
  - The full-card grid is `grid-cols-1` on a phone so a long detail line can't widen the page.
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
  progress, whose decided weeks are fetched weekly since Round 5 (so the season page's Roster IQ
  column and the game records count it live). `lib/bench.ts` also reads the lineup files for
  `lib/champions.ts`, `lib/playcalls.ts` and `lib/roster.ts`.
- Injured starters (`lib/injuries.ts`, the site owner's Round 11, 2026-11-25): ESPN keeps no
  injury reports for past weeks, so an injury is read from its game logs (`games` in the players
  files). A player counts for a team-season if he had started for it that season, then played a
  game while on its roster and missed his NFL team's next two games (`MISSED_IN_A_ROW`; byes
  skipped, so one missed game next to a bye doesn't count). Once per team-season, for the team he
  was on when hurt, whether or not it kept him; benched that week counts too (Kamara, Ammari's 2025).
  D/STs are left out. It counts when the second game is missed (`Injury.week`), which is how the
  live season and the record-break news cut it. A suspension, or an NFL starter benched for a
  backup (2018 Winston, 2025 Mariota after filling in), looks the same and counts; the notes say
  so. Two straight games, not one, is "significant" (Injury Bug's word). Seasons 2018–2025
  average 4.1 to 6.1 a team-season; 2017 has none (`TeamSeason.injuries` null). The IR slot (2025 on, one per team) was the Round 10 idea;
  it counts managers' IR moves, not injuries, so it isn't used.
- Season pages (`lib/seasons.ts`, `components/Bracket.tsx`, Luke 2026-11-15). `/seasons` lists
  every season with champion, runner-up and last place. `/seasons/[year]` has:
  - the podium
  - the standings table (`components/SeasonTable.tsx`): final place, or the current seed while the
    season is on, with a line under the last playoff spot. Round 8 (the site owner, 2026-11-20)
    gave it a switch between stat sets, kept in the URL (`?stats=playcall`, `?stats=odds`); Round 10
    (2026-11-25) made them the manager page's two boxes: Standard (W-L, PF, PA and Rank Δ),
    Playcall (Draft IQ, Roster IQ, Waiver IQ, Trade IQ, in whole points, "–" without the data or,
    for Trade IQ, without a trade) and Odds (Odds, Luck, Streaks W10 or L8, and since Round 11
    Injuries: the count, green below the season's average and red above it, with the average in
    the note under the table; "Odds" is his name for the tab). Round 8's Playcall set was Luck,
    Bench, Trades and Streaks. W-L, PF and PA count every
    game; on a phone PF and PA show whole points, and the Playcall headers wrap to two lines, so the
    four columns fit 375 px. Rank Δ (`rankChange` in `lib/seasons.ts`, Luke's pick): while the season is on, the seed's
    change since the week before (seeds replayed as ESPN seeds them; over the regular season's last
    two weeks once it's over); a finished season, the regular-season seed against the final place
    (a 6 seed who won it all shows ▲5). Every season's moves add up to zero.
  - the playoff bracket: rounds named Quarterfinals, Semifinals, Final by weeks left, in ESPN's
    schedule order, byes shown, the champion starred
  - the pancake ladder (`LOSERS_CONSOLATION_LADDER`)

  `league.bracket` keeps every playoff-week schedule entry, byes and undecided games included.
- Pancake Watch (`pancakeWatch` in `lib/seasons.ts`, `lib/pancake.ts`, `components/PancakeWatch.tsx`,
  home page, only while a season is on). Last place isn't the worst regular-season team: every
  team that misses the playoffs plays the consolation ladder for it (2019's 7 seed and 2018's and
  2021's first teams out finished last). Seeds are ESPN's live `playoffSeed`, which breaks ties
  on total points.
  - The card (Round 6's rule, Round 8's card) names who's in danger of last place, in red with a
    pulsing red light (steady with reduced motion). During the regular season that's the bottom
    of the standings (ESPN's last seed). After it, the bottom game of the ladder's latest week. In
    the ladder's last week ESPN lists the last-place game last (every season 2017–2025; `npm run
    check` tests it), so that game reads "The pancake game: the loser finishes last", and a bye
    there is last place.
  - Opened (Round 8, his mockup): "7 weeks left", then one row per team below the playoff line,
    14th up to 9th: seed, name, regular-season W-L and the chance of finishing last in the final
    standings, which replaced "3 back" and "No playoffs" (he didn't follow "back"). The first row
    (last place now) is bigger and red, as he drew it; since Round 9 its W-L and chance are as
    large as the name (they were much smaller). Since Round 10 the W-L column sits at the card's
    center (his edited screenshot): name and chance take equal columns either side. A dashed rule, "Playoff line: 8. Andrew 5-5
    · 1%", then "Above the line:" with every team above it that can still finish last (default:
    the chances only add up to 100% with them, Kaden 8% at 6-4 on 2026 week 10), and one small
    line ("Miss the top 8 and you play in the pancake ladder, where last place takes the
    pancakes. 4 regular-season weeks left. % is the chance of finishing last, from ESPN's
    projections."). After the regular season: the ladder's teams, most likely first, then the
    ladder. A team that can no longer finish last shows 0% in green; under half a percent shows
    "<1%".
  - The chances (`pancakeOdds`, Luke picked ESPN's projections, 2026-11-20): the rest of the
    season played 10,000 times (`SIMS`) with a seeded generator, so a build gives the same
    numbers for the same data. Each team's score in a week to come is normal around its best
    lineup by ESPN's projections for that week (`data/raw/projections/`, the bench's best-lineup
    rule with projections for points) plus the mean miss, with the spread of the misses:
    `calibration` over every team-week of 2018–2025, the score minus the best projected lineup,
    is −2.0 ± 24.4 (1,800 team-weeks). Without a projection, the team's average score this season.
    The regular season's games left are played and seeded as ESPN does (`regularSeeds`), then the
    pancake ladder; the last game's loser (or a bye there) finishes last. Once ESPN has scheduled
    ladder weeks, those pairings and results are used.
  - The ladder rule (checked against every season 2017–2025, `firstLadder`/`nextLadder`): week
    one pairs the seeds in order (9 v 10, 11 v 12, 13 v 14; an odd count gives the last seed a
    bye). After each week, with its games in ESPN's order, the top game's winner meets the second
    game's winner, each game's loser meets the winner two games down, and the last two games'
    losers meet; a bye counts as a win with no loser. The final week's games give the places in
    order (`ladderPlaces`): the top game's winner finishes highest, the last game's loser last.
  - Safe (green): can't finish last whatever happens. During the regular season that's a team
    that has clinched a playoff spot (fewer teams than there are spots can reach its wins even if
    it loses out); every other team can still miss the playoffs and lose every ladder game. After
    it, every outcome of the ladder's remaining games is played out.
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
  season, so there are no per-season bar charts (considered and rejected). These rules stay for
  the career line and the League records; Round 8's two awards use a point and 84 (above).
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

## Standings UX (the Leaderboard's in Round 9)
- Phone: a sort control (four stats per view; Career Records' Record adds Wins or Losses), an up/down
  toggle, and one line per manager (the Compact switch and the cards went in Round 9).
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
   the record names and the tie-break the same day (recorded above). Round 8 (2026-11-20) is
   built: the four-card home page with the Pancake Watch's chances of finishing last (from ESPN's
   projections, fetched daily) and record-break news; the season pages' Standard/Playcall switch;
   W/L and no PDIFF on the standings; sectioned Records with small cards, The One Hit Wonder,
   most-losses Below Zero and a League tab; the manager page's six-stat row, openable Roster and
   Playcall boxes, reordered Playcall rows, Favorites and Points tabs, and the new Ice in the
   Veins and Dunzo. Luke answered its 4 questions the same day (recorded above). Round 9
   (2026-11-23) is built: the home page as the menu (no nav tabs; Leaderboard, Hall of Mahaan
   Bakaree, Records and Teams boxes; the Mahaan Bakaree card opens the champion's page; home pills
   on the pages 2026 Standings and The Mahaan Bakaree open), the Pancake Watch's last-place row all
   large, a Seasons nav tab, Standings renamed Leaderboard at `/leaderboard`, All-time's Record
   sort by Wins or Losses, no Compact switch on the Leaderboard and Records, the five-stat career
   row, and "Players to Remember" and "Playcalling Analysis". Luke answered its 3 questions the
   same day (recorded above). Round 10 (2026-11-25) is built: the menu boxes above the home cards
   (Standings and Teams first on a phone) and "2026 Season"; the Pancake Watch's W-L centered;
   Standings again at `/standings`, one nav tab with Seasons, its views Career Records, Season
   Averages and Power Rankings, no descriptions under the Standings tabs or the Records title;
   Draft IQ and Waiver IQ (`lib/acquisitions.ts`), Trade IQ, the two boxes Playcalling Analysis
   and Against the Odds, the season pages' Playcall and Odds stats; Waiver Pick, Trade, Drop and
   Fleece of the Year. Open questions for the site owner, through Luke, each built as proposed:
   (1) the second box's name ("Against the Odds"; the season tab says "Odds"); (2) Draft IQ and
   Waiver IQ count points in the starting lineup only, not the bench; (3) Drop of the Year charges
   the team that let a player go with what he then scored for the team that picked him up; (4)
   Trade and Fleece of the Year use a trade's net, so they're its two sides (his Fleece wording
   was the single player sent away who scored most). He also asked about injured starters (Round
   11 counts them from ESPN's game logs instead of the IR slot); and Luke may suggest a schedule
   stat for Against the Odds (points against compared with the league's average, Tough ↔ Easy),
   which the data already supports. Round 11 (2026-11-25, "very very close to completing") is
   built: injured starters from 2018 (`lib/injuries.ts`, the players files' `games`) in the season
   pages' Odds stats, Against the Odds, Injury Bug and The Infirmary; the Standings' order Power
   Rankings, Season Averages, Career Records; Waiver Pick and Drop for RBs, WRs and TEs; every
   player in a Trade (and Fleece) of the Year; Dunzo's opponent and score; Dynasty Manager, Playoff
   Cinderella, Revenge Tour and Comeback Manager; the Season Honors tier and his recategorized
   table; the Records notes folded under a * . Open questions, each built as proposed: (1) Manager
   of the Year counts every game, as he decided in Round 3, though his table says "regular-season
   points" (that would change 2017, 2019, 2021, 2023 and 2025); (2) Ice in the Veins keeps 1.00 or
   less (his table: "less than one point"; only Ryan's 2021 win by exactly 1.00 differs); (3) no
   GOAT award for the fewest injuries (offered in his notes, missing from his table); (4) the
   injury rule (two straight missed NFL games after starting) and its caveats; (5) Comeback
   Manager's reading (missed the playoffs, then the biggest climb in final place); (6) Playoff
   Cinderella read as the season's last playoff seed, which nobody has done (a looser reading,
   say a champion seeded in the bottom half, gives Robel 2021 and Jeremy 2019); (7) The
   Infirmary's name. Next: the domain.

Later, not v1: head-to-head records, photos for the Hall.

Don't overbuild v1. Build the stage in front of you.
