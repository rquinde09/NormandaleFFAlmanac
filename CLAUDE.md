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
- Raw ESPN JSON stays in the repo and is never shipped to the browser. `lib/league.ts` reads
  `data/raw/*.json` and `data/managers.json` at build time and computes everything (standings,
  records, champions). Client components get only derived rows. Python only fetches. There is
  one implementation of the counting rules, in TypeScript.
- `data/managers.json` (hand-edited) maps ESPN owner IDs to people: `slug` (the URL,
  `/teams/<slug>`, matching the old site), `name`, `nickname`, `active`, `espnIds`. Stats
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
- Player lineups (fetched for 2017–2025 on 2026-11-05): views `mMatchupScore` + `mScoreboard`
  with `scoringPeriodId` and an `x-fantasy-filter` on the matchup period return each side's
  `rosterForCurrentScoringPeriod` (whole roster, with `lineupSlotId` and points) for 2018+, and
  only `rosterForMatchupPeriod` for 2017: starters only, every one with `lineupSlotId` 0. 2021
  returns no lineups at all; `mRoster` there gives only the end-of-season roster. In every other
  season, every lineup's starters add up to the team score. `lineupSlotId` 20 = bench, 21 = IR,
  23 = FLEX. `defaultPositionId`: 1 QB, 2 RB, 3 WR, 4 TE, 5 K, 16 D/ST.
- `fetch_seasons.py` drops personal settings, team-private lists and live/projection fields
  (`DROP_KEYS`) before saving, so the repo holds no private data and unchanged days don't commit.

## Scripts and commands
- Node 26 LTS. Run `npm install`, then `npm run build` and `npm start`, or `npm run dev`. npm 11
  blocks esbuild's install script; `tsx` works without it, so leave it blocked.
- `npm run check` (`scripts/check-data.ts`): through 2025, all-time totals must match the Sheet
  copy 23/23, plus the 13 record holders, the championship counts, the old Leaderboard's
  per-season averages and order 14/14, and each championship lineup against the final score. Run it after any change to `lib/league.ts` or
  `lib/standings.ts`.
- Python lives in `.venv` (`python -m venv .venv`, then `.venv/Scripts/python -m pip install -r
  requirements.txt`). `scripts/check_env.py` checks `.env.local` without printing values.
  `scripts/probe.py [season ...]` prints a season summary, with owner IDs cut to 8 characters.
- `scripts/fetch_seasons.py [season ...] [--force]` writes `data/raw/{season}.json`. It skips
  completed seasons that already have a file, and saves only responses that pass checks. Once a
  season's last game is decided, it also fetches that season's weekly lineups (one request per
  week) into `data/raw/lineups/{season}.json`, keeping only each player's ID, name, position,
  slot and points (about 0.9 MB a season). That file is written once; 2021's is saved empty so
  it isn't asked for again. It also writes `data/meta.json` (`updatedAt`, the last time data
  changed), which the footer shows.
- `.github/workflows/fetch-espn.yml` runs the fetch daily at 10:00 UTC, September–January (plus
  manual runs). It commits `data/` only when something changed. Secrets: `ESPN_LEAGUE_ID`,
  `ESPN_S2`, `ESPN_SWID`. Collaborators on a personal repo can add them.

## Site
- Routes: `/` (season status, reigning champion, news), `/standings` (`?view=season|game`),
  `/teams`, `/teams/[slug]`, `/records` (`?view=season`), `/hall-of-mahaan-bakaree` (champions
  computed from final ranks; the nav tab says "Champions"), `/news/[slug]`.
- Old Google Sites URLs redirect in `next.config.ts`: `/home`, `/league-history`, `/leaderboard`,
  `/retired-teams`, `/records/game-records`, `/records/season-records`. `/teams/<name>` and
  `/hall-of-mahaan-bakaree` keep their old paths. The Teams tab stays "Teams" (site owner,
  2026-11-05).
- Standings has three views, defined in `lib/standings.ts`: All-time totals (W, L, PF, PA,
  Seasons, Titles, Trades), Per season averages (W, L, PF, PA per season, Seasons; through 2025
  its numbers match the old Leaderboard page), and Per game averages (Win %, PF, PA, PDIFF per
  game). All three count live. Each ends with Rank Δ: the change in that view's ranking since the
  end of the previous season, counted among the managers shown, so the Active switch renumbers and
  search doesn't. Active only is on by default (`active=0` turns it off). View, sort, direction,
  search and Active live in the URL, updated with `window.history.replaceState` (`lib/url.ts`),
  which Next keeps in sync with `useSearchParams`. Per season and Per game rank only managers with
  `MIN_SEASONS` (3, a placeholder) seasons; shorter careers list after them.
- Manager pages: career card, a year-by-year chart of finished seasons, then one season at a time,
  picked by year or by tapping the chart, newest first. The chart always shows finishing position
  (left axis, 1st at the top; 1st, 2nd and 3rd are gold, silver and bronze dots) and, as a second
  line on the right axis, Wins, PF or PA, chosen with a toggle (the site owner's spec,
  2026-11-05). The season in progress stays off the chart, since half a season's PF flattens the
  rest.
- Champions page (`/hall-of-mahaan-bakaree`): each title expands (`<details>`) to the
  championship game's lineup with the bench, the season's best game (the champion's highest
  score), and the best player (most points while in the starting lineup, playoffs included).
  `lib/champions.ts` computes these from `data/raw/lineups/`. 2017 shows starters by position
  with no bench; 2021 says ESPN has no lineups.
- Records use the old site's 14 names. Game records count every decided game, live season
  included. Season records count completed seasons only. They're computed over all seasons,
  2017 included. The old hand-kept Records pages skipped most 2017 entries, so 6 holders differ
  from the old site, for example Cesar Vega's 33.72 in 2017 holds "The Vega".
  `scripts/check-data.ts` notes each old value. Active only is on by default: a margin record
  belongs to the winner, a game total to either manager, a score to the scorer.
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
- Phone: cards with a sort control (four stats per view) and an up/down toggle.
- Desktop: a table whose name column stays put while the other columns scroll.
- Name search box and an "Active only" switch. Sort and filter state live in the URL.
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
   Next: the domain.

Later, not v1: head-to-head records, standings for each season, photos for the Hall.

Don't overbuild v1. Build the stage in front of you.
