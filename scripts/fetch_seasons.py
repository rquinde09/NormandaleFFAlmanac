"""Download league seasons from ESPN into data/raw/{season}.json, and each finished season's
weekly lineups into data/raw/lineups/{season}.json.

Usage: .venv/Scripts/python scripts/fetch_seasons.py [season ...] [--force]

With no seasons given, fetches every season from 2017 through the current one.
Completed seasons that already have a file are skipped unless --force is given.
Lineups are fetched once, when a season's last game is decided (about 17 requests).
A file is written only if the response passes basic checks, so a failed or
empty fetch never replaces good data.
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

from espn_client import fetch_box_scores, fetch_season, load_config, season_requests

FIRST_SEASON = 2017
RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
LINEUP_DIR = RAW_DIR / "lineups"
META_PATH = RAW_DIR.parent / "meta.json"  # when the data last changed; the site shows it
BENCH_SLOTS = {20, 21}  # lineupSlotId for bench and IR; every other slot is a starter
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


def season_complete(data):
    """Every real game decided, playoffs included. Byes (no away side) aren't games."""
    real = [g for g in data.get("schedule", []) if g.get("away")]
    regular_weeks = data["settings"]["scheduleSettings"]["matchupPeriodCount"]
    return (
        bool(real)
        and all(g.get("winner") in ("HOME", "AWAY", "TIE") for g in real)
        and any(g["matchupPeriodId"] > regular_weeks for g in real)
    )


def lineup_side(side):
    """Each player's slot and points. 2018+ lists the whole roster, bench included; 2017 has only
    the starters (rosterForMatchupPeriod)."""
    roster = side.get("rosterForCurrentScoringPeriod") or {}
    if not roster.get("entries"):
        roster = side.get("rosterForMatchupPeriod") or {}
    lineup = []
    for e in roster.get("entries") or []:
        pool = e.get("playerPoolEntry") or {}
        player = pool.get("player") or {}
        lineup.append({
            "playerId": e.get("playerId") or player.get("id"),
            "fullName": player.get("fullName"),
            "defaultPositionId": player.get("defaultPositionId"),
            "lineupSlotId": e.get("lineupSlotId"),
            "appliedStatTotal": pool.get("appliedStatTotal"),
        })
    return {"teamId": side["teamId"], "totalPoints": side.get("totalPoints"), "lineup": lineup}


def fetch_lineups(season, data, league_id, cookies):
    req = season_requests(season, league_id, cookies)
    periods = data["settings"]["scheduleSettings"]["matchupPeriods"]  # {"1": [1], ...}
    weeks = []
    for matchup_period in sorted({g["matchupPeriodId"] for g in data["schedule"]}):
        for scoring_period in periods[str(matchup_period)]:
            box = fetch_box_scores(req, matchup_period, scoring_period)
            games = [g for g in box.get("schedule", []) if g.get("matchupPeriodId") == matchup_period and g.get("away")]
            weeks.append({
                "matchupPeriodId": matchup_period,
                "scoringPeriodId": scoring_period,
                "games": [{"home": lineup_side(g["home"]), "away": lineup_side(g["away"])} for g in games],
            })
            time.sleep(0.5)  # be gentle with ESPN
    return {"seasonId": season, "weeks": weeks}


def lineup_problems(lineups, data):
    expected = sum(1 for g in data["schedule"] if g.get("away"))
    got = sum(len(w["games"]) for w in lineups["weeks"])
    problems = [] if got == expected else [f"{got} games but the schedule has {expected}"]
    sides = [s for w in lineups["weeks"] for g in w["games"] for s in (g["home"], g["away"])]
    listed = [s for s in sides if s["lineup"]]
    if not listed:
        return problems  # ESPN keeps no lineups for some seasons (2021); saved empty so it isn't asked again
    if len(listed) < len(sides):
        problems.append(f"{len(sides) - len(listed)} of {len(sides)} lineups are empty")
    started = lambda s: sum(e["appliedStatTotal"] or 0 for e in s["lineup"] if e["lineupSlotId"] not in BENCH_SLOTS)
    off = [s for s in listed if abs(started(s) - (s["totalPoints"] or 0)) > 0.011]
    if off:
        problems.append(f"starters' points don't add up to the team score in {len(off)} lineups")
    return problems


def write_json(path, data):
    """Stable formatting so an unchanged season produces an identical file (and no commit)."""
    text = json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return False
    tmp = path.with_suffix(".tmp")
    tmp.write_text(text, encoding="utf-8", newline="\n")  # LF on Windows too, matching the repo
    tmp.replace(path)
    return True


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    args = sys.argv[1:]
    force = "--force" in args
    current = current_season()
    seasons = [int(a) for a in args if a != "--force"] or list(range(FIRST_SEASON, current + 1))
    league_id, cookies = load_config()
    LINEUP_DIR.mkdir(parents=True, exist_ok=True)

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

        lineup_path = LINEUP_DIR / f"{season}.json"
        if not season_complete(data) or (lineup_path.exists() and not force):
            continue
        try:
            lineups = fetch_lineups(season, data, league_id, cookies)
        except ESPN_ERRORS as e:
            print(f"{season} lineups: FAILED: {type(e).__name__}: {e}")
            failed = True
            continue
        problems = lineup_problems(lineups, data)
        if problems:
            print(f"{season} lineups: NOT SAVED, {'; '.join(problems)}")
            failed = True
            continue
        changed = write_json(lineup_path, lineups)
        any_changed = any_changed or changed
        empty = not any(s["lineup"] for w in lineups["weeks"] for g in w["games"] for s in (g["home"], g["away"]))
        print(f"{season} lineups: {'saved' if changed else 'unchanged'}{' (ESPN has none for this season)' if empty else ''}")

    if any_changed or not META_PATH.exists():
        now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)
        write_json(META_PATH, {"updatedAt": now.isoformat().replace("+00:00", "Z")})
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
