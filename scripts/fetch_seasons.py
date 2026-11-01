"""Download league seasons from ESPN into data/raw/{season}.json.

Usage: .venv/Scripts/python scripts/fetch_seasons.py [season ...] [--force]

With no seasons given, fetches every season from 2017 through the current one.
Completed seasons that already have a file are skipped unless --force is given.
A season is written only if the response passes basic checks, so a failed or
empty fetch never replaces good data.
"""

import datetime
import json
import sys
from pathlib import Path

from requests import RequestException
from espn_api.requests.espn_requests import (
    ESPNAccessDenied,
    ESPNInvalidLeague,
    ESPNUnknownError,
)

from espn_client import fetch_season, load_config

FIRST_SEASON = 2017
RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
META_PATH = RAW_DIR.parent / "meta.json"  # when the data last changed; the site shows it

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
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    failed = False
    any_changed = False
    for season in seasons:
        path = RAW_DIR / f"{season}.json"
        if season < current and path.exists() and not force:
            print(f"{season}: kept existing file (completed season)")
            continue
        try:
            data, used, tried = fetch_season(season, league_id, cookies)
        except (ESPNAccessDenied, ESPNInvalidLeague, ESPNUnknownError, RequestException) as e:
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

    if any_changed or not META_PATH.exists():
        now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)
        write_json(META_PATH, {"updatedAt": now.isoformat().replace("+00:00", "Z")})
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
