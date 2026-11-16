"""Download league seasons from ESPN into data/raw/{season}.json, plus for each season:

- data/raw/lineups/{season}.json: each week's lineups, with every player's slot, points and ESPN's
  projection for that week. A finished season's file is written once. While a season is on, each
  week is added once it's decided (and fetched again if ESPN later corrects a score).
- data/raw/drafts/{season}.json: the draft picks, fetched once.
- data/raw/players/{season}.json: every drafted or rostered player's name, position, points over
  the fantasy season's weeks and ESPN's preseason projection. Once a season is over; while it's
  on, again whenever another week is decided.
- data/raw/trades/{season}.json: executed trades with every player in them, read from player
  cards. Once a season is over; while it's on, whenever ESPN's trade count changes.

Usage: .venv/Scripts/python scripts/fetch_seasons.py [season ...] [--force] [--force-extras] [--env FILE]

With no seasons given, fetches every season from 2017 through the current one.
Completed seasons that already have a file are skipped unless --force is given. --force-extras
keeps the season files and fetches the lineup, draft, player and trade files again. --env reads the
cookies from another file instead of .env.local (environment variables still win).
A file is written only if the response passes basic checks, so a failed or empty fetch never
replaces good data.
"""

import datetime
import json
import sys
import time
from pathlib import Path

from requests import RequestException
from espn_api.requests.espn_requests import (
    ESPNAccessDenied,
    ESPNInvalidLeague,
    ESPNUnknownError,
)

from espn_client import (
    endpoint_kind,
    fetch_box_scores,
    fetch_draft,
    fetch_player_cards,
    fetch_player_info,
    fetch_season,
    fetch_trade_transactions,
    load_config,
    season_requests,
)
from check_env import DEFAULT_PATH

FIRST_SEASON = 2017
RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
LINEUP_DIR = RAW_DIR / "lineups"
DRAFT_DIR = RAW_DIR / "drafts"
PLAYER_DIR = RAW_DIR / "players"
TRADE_DIR = RAW_DIR / "trades"
META_PATH = RAW_DIR.parent / "meta.json"  # when the data last changed; the site shows it
BENCH_SLOTS = {20, 21}  # lineupSlotId for bench and IR; every other slot is a starter
DECIDED = ("HOME", "AWAY", "TIE")
ESPN_ERRORS = (ESPNAccessDenied, ESPNInvalidLeague, ESPNUnknownError, RequestException)

# Dropped before saving: personal settings and team-private lists that don't belong in a shared
# repo, and live/projection fields that change all the time and would force a commit on every run.
DROP_KEYS = {
    "notificationSettings",
    "watchList",
    "tradeBlock",
    "draftStrategy",
    "rosterForCurrentScoringPeriod",
    "rosterForMatchupPeriodDelayed",
    "totalProjectedPoints",
    "totalProjectedPointsLive",
    "totalPointsLive",
    "cumulativeScoreLive",
    "winProbability",
    "currentSimulationResults",
}


def current_season(today=None):
    """ESPN's football season year: the 2026 season runs Sep 2026 to Jan 2027."""
    today = today or datetime.date.today()
    return today.year if today.month >= 7 else today.year - 1


def strip(value):
    if isinstance(value, dict):
        return {k: strip(v) for k, v in value.items() if k not in DROP_KEYS}
    if isinstance(value, list):
        return [strip(v) for v in value]
    return value


def keep_member_ids_only(data):
    """The repo is public: drop members' names and ESPN usernames. The site names people from
    managers.json; scripts/probe.py shows ESPN names live when a new manager needs adding."""
    data["members"] = [{"id": m["id"]} for m in data.get("members", [])]
    return data


def problems_with(data, season):
    problems = []
    if data.get("seasonId") != season:
        problems.append(f"seasonId is {data.get('seasonId')}")
    teams = data.get("teams") or []
    size = data.get("settings", {}).get("size")
    if not teams or len(teams) != size:
        problems.append(f"{len(teams)} teams but league size {size}")
    if not data.get("schedule"):
        problems.append("schedule is empty")
    if not data.get("members"):
        problems.append("members list is empty")
    return problems


def real_games(data):
    """Byes (no away side) aren't games"""
    return [g for g in data.get("schedule", []) if g.get("away")]


def season_complete(data):
    """Every real game decided, playoffs included."""
    real = real_games(data)
    regular_weeks = data["settings"]["scheduleSettings"]["matchupPeriodCount"]
    return (
        bool(real)
        and all(g.get("winner") in DECIDED for g in real)
        and any(g["matchupPeriodId"] > regular_weeks for g in real)
    )


def decided_weeks(data):
    """Matchup periods whose every game is decided"""
    weeks = {}
    for g in real_games(data):
        weeks.setdefault(g["matchupPeriodId"], []).append(g.get("winner") in DECIDED)
    return sorted(w for w, done in weeks.items() if all(done))


def last_scoring_period(data, weeks):
    periods = data["settings"]["scheduleSettings"]["matchupPeriods"]  # {"1": [1], ...}
    return max((max(periods[str(w)]) for w in weeks), default=0)


def write_json(path, data):
    """Stable formatting so an unchanged season produces an identical file (and no commit)."""
    text = json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return False
    tmp = path.with_suffix(".tmp")
    tmp.write_text(text, encoding="utf-8", newline="\n")  # LF on Windows too, matching the repo
    tmp.replace(path)
    return True


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


# ---- Lineups ----

def week_stat(player, scoring_period, source):
    """A player's points for one week: statSourceId 0 = actual, 1 = ESPN's projection
    (statSplitTypeId 1 = one week)"""
    for s in player.get("stats") or []:
        if s.get("statSourceId") == source and s.get("statSplitTypeId") == 1 and s.get("scoringPeriodId") == scoring_period:
            return s.get("appliedTotal")
    return None


def lineup_side(side, scoring_period):
    """Each player's slot, points and projection. 2018+ lists the whole roster, bench included;
    2017 has only the starters (rosterForMatchupPeriod) and no weekly projections."""
    roster = side.get("rosterForCurrentScoringPeriod") or {}
    if not roster.get("entries"):
        roster = side.get("rosterForMatchupPeriod") or {}
    lineup = []
    for e in roster.get("entries") or []:
        pool = e.get("playerPoolEntry") or {}
        player = pool.get("player") or {}
        points = pool.get("appliedStatTotal")
        if not points:  # ESPN shows 0.0 for every 2021 player; the week's stat row may still have it
            points = week_stat(player, scoring_period, 0) or points
        lineup.append({
            "playerId": e.get("playerId") or player.get("id"),
            "fullName": player.get("fullName"),
            "defaultPositionId": player.get("defaultPositionId"),
            "lineupSlotId": e.get("lineupSlotId"),
            "appliedStatTotal": points,
            "projectedTotal": week_stat(player, scoring_period, 1),
        })
    return {"teamId": side["teamId"], "totalPoints": side.get("totalPoints"), "lineup": lineup}


def fetch_week(req, data, matchup_period):
    periods = data["settings"]["scheduleSettings"]["matchupPeriods"]
    weeks = []
    for scoring_period in periods[str(matchup_period)]:
        box = fetch_box_scores(req, matchup_period, scoring_period)
        games = [g for g in box.get("schedule", []) if g.get("matchupPeriodId") == matchup_period and g.get("away")]
        weeks.append({
            "matchupPeriodId": matchup_period,
            "scoringPeriodId": scoring_period,
            "games": [{"home": lineup_side(g["home"], scoring_period), "away": lineup_side(g["away"], scoring_period)} for g in games],
        })
        time.sleep(0.5)  # be gentle with ESPN
    return weeks


def score_changed(week, data):
    """ESPN corrected a score after the lineup was saved (only checked while a season is on)"""
    score = {}
    for g in real_games(data):
        if g["matchupPeriodId"] == week["matchupPeriodId"]:
            for side in (g["home"], g["away"]):
                score[side["teamId"]] = side.get("totalPoints") or 0
    sides = [s for g in week["games"] for s in (g["home"], g["away"]) if s["lineup"]]
    return any(abs((s["totalPoints"] or 0) - score.get(s["teamId"], 0)) > 0.011 for s in sides)


def lineup_problems(lineups, data, complete):
    held = {w["matchupPeriodId"] for w in lineups["weeks"]}
    missing = sorted(set(decided_weeks(data)) - held)
    problems = [f"weeks {missing} missing"] if missing else []
    expected = sum(1 for g in real_games(data) if g["matchupPeriodId"] in held)
    got = sum(len(w["games"]) for w in lineups["weeks"])
    if got != expected:
        problems.append(f"{got} games but the schedule has {expected}")
    sides = [s for w in lineups["weeks"] for g in w["games"] for s in (g["home"], g["away"])]
    listed = [s for s in sides if s["lineup"]]
    if not listed and complete:
        return problems  # leagueHistory gives no lineups (2021 without a 2021 member's cookies); saved empty so it isn't asked again
    if len(listed) < len(sides):
        problems.append(f"{len(sides) - len(listed)} of {len(sides)} lineups are empty")
    started = lambda s: sum(e["appliedStatTotal"] or 0 for e in s["lineup"] if e["lineupSlotId"] not in BENCH_SLOTS)
    off = [s for s in listed if abs(started(s) - (s["totalPoints"] or 0)) > 0.011]
    if off:
        problems.append(f"starters' points don't add up to the team score in {len(off)} lineups")
    return problems


def has_lineups(lineups):
    """2021's lineups, players and trades came from a 2021 member's cookies (the seasons endpoint);
    leagueHistory gives none of them, so a --force-extras run without those cookies must not
    replace them with empty files."""
    return bool(lineups) and any(s["lineup"] for w in lineups["weeks"] for g in w["games"] for s in (g["home"], g["away"]))


def update_lineups(req, season, data, force):
    """Returns True if the file changed. A finished season's full file is never asked for again."""
    path = LINEUP_DIR / f"{season}.json"
    complete = season_complete(data)
    existing = None if force else read_json(path)
    held = {w["matchupPeriodId"]: w for w in (existing or {}).get("weeks", [])}
    decided = decided_weeks(data)
    if existing and complete and set(held) >= set(decided):
        return False
    todo = [w for w in decided if w not in held or (not complete and score_changed(held[w], data))]
    if not todo:
        return False
    for week in todo:
        for fetched in fetch_week(req, data, week):
            held[fetched["matchupPeriodId"]] = fetched
    lineups = {"seasonId": season, "weeks": [held[w] for w in sorted(held)]}
    problems = lineup_problems(lineups, data, complete)
    if problems:
        raise DataProblem("lineups", problems)
    empty = not has_lineups(lineups)
    if empty and has_lineups(read_json(path)):
        print(f"{season} lineups: kept the existing file; this fetch got none")
        return False
    changed = write_json(path, lineups)
    print(f"{season} lineups: {'saved' if changed else 'unchanged'}, weeks {todo[0]}–{todo[-1]}{' (ESPN has none for this season)' if empty else ''}")
    return changed


# ---- Draft, players, trades ----

class DataProblem(Exception):
    def __init__(self, what, problems):
        super().__init__(f"{what}: NOT SAVED, {'; '.join(problems)}")


def update_draft(req, season, force):
    path = DRAFT_DIR / f"{season}.json"
    if path.exists() and not force:
        return False
    detail = fetch_draft(req).get("draftDetail") or {}
    if not detail.get("drafted"):
        print(f"{season} draft: not drafted yet")
        return False
    every = [
        {k: p.get(k) for k in ("overallPickNumber", "roundId", "roundPickNumber", "teamId", "playerId")}
        for p in detail.get("picks") or []
    ]
    # Player -1 is a pick nobody entered (the last round of 2017's offline draft)
    picks = [p for p in every if p["playerId"] != -1]
    if not picks or any(not p["playerId"] or p["teamId"] is None for p in picks):
        raise DataProblem("draft", [f"{len(picks)} picks, some without a player or team"])
    changed = write_json(path, {"seasonId": season, "picks": sorted(picks, key=lambda p: p["overallPickNumber"])})
    empty = f", {len(every) - len(picks)} left empty" if len(every) > len(picks) else ""
    print(f"{season} draft: {'saved' if changed else 'unchanged'} ({len(picks)} picks{empty})")
    return changed


def season_player_ids(season):
    lineups = read_json(LINEUP_DIR / f"{season}.json") or {"weeks": []}
    draft = read_json(DRAFT_DIR / f"{season}.json") or {"picks": []}
    ids = {p["playerId"] for w in lineups["weeks"] for g in w["games"] for s in (g["home"], g["away"]) for p in s["lineup"]}
    ids |= {p["playerId"] for p in draft["picks"]}
    return sorted(i for i in ids if i and i != -1)


def update_players(req, season, data, force):
    path = PLAYER_DIR / f"{season}.json"
    complete = season_complete(data)
    through = last_scoring_period(data, decided_weeks(data))
    existing = None if force else read_json(path)
    if not through or (existing and (complete or existing.get("throughScoringPeriod") == through)):
        return False
    ids = season_player_ids(season)
    found = []
    for i in range(0, len(ids), 50):
        found += fetch_player_info(req, season, ids[i:i + 50])
        time.sleep(0.4)
    players = []
    weekly_any = False
    for wrap in found:
        player = wrap.get("player") or {}
        stats = player.get("stats") or []
        weekly = {s["scoringPeriodId"]: s.get("appliedTotal") or 0 for s in stats
                  if s.get("statSourceId") == 0 and s.get("statSplitTypeId") == 1 and s.get("scoringPeriodId")}
        season_total = next((s.get("appliedTotal") for s in stats if s.get("statSourceId") == 0 and s.get("statSplitTypeId") == 0), None)
        projected = next((s.get("appliedTotal") for s in stats if s.get("statSourceId") == 1 and s.get("statSplitTypeId") == 0), None)
        weekly_any = weekly_any or len(weekly) > 1
        players.append({
            "playerId": wrap.get("id") or player.get("id"),
            "fullName": player.get("fullName"),
            "defaultPositionId": player.get("defaultPositionId"),
            "weeks": sorted(weekly),  # scoring periods with stats, for the check below
            "points": round(sum(v for p, v in weekly.items() if p <= through), 2),
            "seasonTotal": season_total,
            "projected": projected,
        })
    missing = set(ids) - {p["playerId"] for p in players}
    if missing:
        raise DataProblem("players", [f"{len(missing)} of {len(ids)} players not returned"])
    for p in players:
        if not weekly_any:  # leagueHistory seasons give one weekly row at most: use ESPN's season total
            p["points"] = round(p["seasonTotal"] or 0, 2)
        del p["weeks"], p["seasonTotal"]
    out = {"seasonId": season, "throughScoringPeriod": through, "weekly": weekly_any,
           "players": sorted(players, key=lambda p: p["playerId"])}
    if not weekly_any and (read_json(path) or {}).get("weekly"):
        print(f"{season} players: kept the existing file; this fetch got season totals only")
        return False
    changed = write_json(path, out)
    print(f"{season} players: {'saved' if changed else 'unchanged'} ({len(players)}{'' if weekly_any else ', season totals only'})")
    return changed


def trade_counts(data):
    return {t["id"]: (t.get("transactionCounter") or {}).get("trades", 0) for t in data["teams"]}


def update_trades(req, season, data, force):
    path = TRADE_DIR / f"{season}.json"
    complete = season_complete(data)
    counts = trade_counts(data)
    expected = sum(counts.values()) // 2
    existing = None if force else read_json(path)
    if existing and (complete or len(existing["trades"]) == expected or not existing["available"]):
        return False
    trades = {}  # by the trade's players, so one trade seen twice counts once

    def add(t):
        legs = [x for x in t.get("items") or [] if x.get("type") == "TRADE"]
        if t.get("type") not in ("TRADE_ACCEPT", "TRADE_UPHOLD") or t.get("status") != "EXECUTED" or not legs:
            return
        legs = sorted(({"playerId": x["playerId"], "fromTeamId": x["fromTeamId"], "toTeamId": x["toTeamId"]} for x in legs),
                      key=lambda x: (x["fromTeamId"], x["playerId"]))
        key = json.dumps(legs)
        if key not in trades:
            trades[key] = {"id": t.get("relatedTransactionId") or t.get("id"), "scoringPeriodId": t.get("scoringPeriodId"),
                           "processDate": t.get("processDate"), "legs": legs}

    if expected:
        # Player cards list every executed trade from 2019 on. 2018's are executed TRADE_UPHOLDs,
        # which only the transactions view returns, one scoring period at a time.
        ids = season_player_ids(season)
        for i in range(0, len(ids), 40):
            for wrap in fetch_player_cards(req, season, ids[i:i + 40]):
                for t in wrap.get("transactions") or (wrap.get("player") or {}).get("transactions") or []:
                    add(t)
            time.sleep(0.4)
        if len(trades) < expected and endpoint_kind(req) != "leagueHistory":
            for period in range(0, last_scoring_period(data, decided_weeks(data)) + 1):
                for t in fetch_trade_transactions(req, period):
                    add(t)
                time.sleep(0.3)
    # leagueHistory seasons (2017; 2021 without a 2021 member's cookies) return player cards
    # without transactions
    available = bool(trades) or not expected or endpoint_kind(req) != "leagueHistory"
    if not available and (read_json(path) or {}).get("available"):
        print(f"{season} trades: kept the existing file; this fetch got no trade details")
        return False
    found = {}
    for t in trades.values():
        for team in {x for leg in t["legs"] for x in (leg["fromTeamId"], leg["toTeamId"])}:
            found[team] = found.get(team, 0) + 1
    off = {team: (n, found.get(team, 0)) for team, n in counts.items() if n != found.get(team, 0)}
    if available and off:
        message = f"per-team trades differ from ESPN's counts (team: ESPN, found) {off}"
        if complete:
            raise DataProblem("trades", [message])
        print(f"{season} trades: note, {message}; saved anyway while the season is on")
    out = {"seasonId": season, "available": available,
           "trades": sorted(trades.values(), key=lambda t: (t["scoringPeriodId"] or 0, t["processDate"] or 0, t["id"]))}
    changed = write_json(path, out)
    print(f"{season} trades: {'saved' if changed else 'unchanged'} ({len(trades)} of {expected}{'' if available else ', ESPN has no trade details for this season'})")
    return changed


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    args = sys.argv[1:]
    force = "--force" in args
    force_extras = force or "--force-extras" in args
    env_path = DEFAULT_PATH
    if "--env" in args:
        env_path = Path(args[args.index("--env") + 1]).resolve()
        args = [a for i, a in enumerate(args) if a != "--env" and (i == 0 or args[i - 1] != "--env")]
    current = current_season()
    seasons = [int(a) for a in args if not a.startswith("--")] or list(range(FIRST_SEASON, current + 1))
    league_id, cookies = load_config(env_path)
    for d in (LINEUP_DIR, DRAFT_DIR, PLAYER_DIR, TRADE_DIR):
        d.mkdir(parents=True, exist_ok=True)

    failed = False
    any_changed = False
    for season in seasons:
        path = RAW_DIR / f"{season}.json"
        if season < current and path.exists() and not force:
            print(f"{season}: kept existing file (completed season)")
            data = json.loads(path.read_text(encoding="utf-8"))
        else:
            try:
                data, used, tried = fetch_season(season, league_id, cookies)
            except ESPN_ERRORS as e:
                print(f"{season}: FAILED: {type(e).__name__}: {e}")
                failed = True
                continue
            data = keep_member_ids_only(strip(data))
            problems = problems_with(data, season)
            if problems:
                print(f"{season}: NOT SAVED, {'; '.join(problems)}")
                failed = True
                continue
            changed = write_json(path, data)
            any_changed = any_changed or changed
            fallback = f", fell back from {tried}" if used != tried else ""
            print(f"{season}: {'saved' if changed else 'unchanged'} ({used} endpoint{fallback})")

        # Lineups first: the player and trade files read their player IDs from them
        req = season_requests(season, league_id, cookies)
        for update in (
            lambda: update_lineups(req, season, data, force_extras),
            lambda: update_draft(req, season, force_extras),
            lambda: update_players(req, season, data, force_extras),
            lambda: update_trades(req, season, data, force_extras),
        ):
            try:
                any_changed = update() or any_changed
            except ESPN_ERRORS as e:
                print(f"{season}: FAILED: {type(e).__name__}: {e}")
                failed = True
            except DataProblem as e:
                print(f"{season} {e}")
                failed = True

    if any_changed or not META_PATH.exists():
        now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)
        write_json(META_PATH, {"updatedAt": now.isoformat().replace("+00:00", "Z")})
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
