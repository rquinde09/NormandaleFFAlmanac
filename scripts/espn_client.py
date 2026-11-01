"""Shared ESPN access: loads the league ID and cookies, fetches one season's league data."""

import os

from espn_api.requests.espn_requests import EspnFantasyRequests

from check_env import DEFAULT_PATH, parse

# mMatchup leaves out playoffTierType; mMatchupScore (what espn-api's scoreboard uses) has it
VIEWS = ["mTeam", "mMatchupScore", "mSettings", "mStandings"]
ENV_NAMES = ("ESPN_LEAGUE_ID", "ESPN_S2", "ESPN_SWID")


def load_config():
    """Environment variables win (GitHub Actions secrets); .env.local fills in locally."""
    values = parse(DEFAULT_PATH) if DEFAULT_PATH.exists() else {}
    config = {name: (os.environ.get(name) or values.get(name) or "").strip() for name in ENV_NAMES}
    missing = [name for name, value in config.items() if not value]
    if missing:
        raise SystemExit(f"Missing {', '.join(missing)}. Run scripts/check_env.py.")
    league_id = int(config["ESPN_LEAGUE_ID"])
    cookies = {"espn_s2": config["ESPN_S2"], "SWID": config["ESPN_SWID"]}
    return league_id, cookies


def endpoint_kind(req):
    return "leagueHistory" if "/leagueHistory/" in req.LEAGUE_ENDPOINT else "seasons"


def fetch_season(season, league_id, cookies):
    """Returns (data, endpoint used, endpoint tried first). Raises espn-api's errors on failure."""
    req = EspnFantasyRequests("nfl", season, league_id, cookies=cookies)
    tried = endpoint_kind(req)
    data = req.league_get(params={"view": VIEWS})
    return data, endpoint_kind(req), tried
