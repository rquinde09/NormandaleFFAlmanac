"""Shared ESPN access: loads the league ID and cookies, fetches one season's league data and its
weekly box scores."""

import json
import os

from espn_api.requests.espn_requests import EspnFantasyRequests

from check_env import DEFAULT_PATH, parse

# mMatchup leaves out playoffTierType; mMatchupScore (what espn-api's scoreboard uses) has it
VIEWS = ["mTeam", "mMatchupScore", "mSettings", "mStandings"]
# What espn-api's box_scores() asks for: each matchup's lineups with every player's points
BOX_VIEWS = ["mMatchupScore", "mScoreboard"]
ENV_NAMES = ("ESPN_LEAGUE_ID", "ESPN_S2", "ESPN_SWID")


def load_config(path=DEFAULT_PATH):
    """Environment variables win (GitHub Actions secrets); .env.local (or `path`) fills in locally."""
    values = parse(path) if path.exists() else {}
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


def season_requests(season, league_id, cookies):
    """One requester per season, so the endpoint fallback (see CLAUDE.md) happens only once."""
    return EspnFantasyRequests("nfl", season, league_id, cookies=cookies)


def fetch_box_scores(req, matchup_period, scoring_period):
    """One week's matchups with each side's lineup. Raises espn-api's errors on failure."""
    filters = {"schedule": {"filterMatchupPeriodIds": {"value": [matchup_period]}}}
    return req.league_get(
        params={"view": BOX_VIEWS, "scoringPeriodId": scoring_period},
        headers={"x-fantasy-filter": json.dumps(filters)},
    )


def unwrap(data):
    """leagueHistory answers with a one-item list"""
    return data[0] if isinstance(data, list) else data


def fetch_draft(req):
    return unwrap(req.league_get(params={"view": "mDraftDetail"}))


def _players_filter(season, ids):
    # Every scoring period's stats plus the season rows: 00 = actual, 10 = ESPN's projection
    return {"players": {"filterIds": {"value": ids},
                        "filterStatsForTopScoringPeriodIds": {"value": 25, "additionalValue": [f"00{season}", f"10{season}"]}}}


def fetch_player_info(req, season, ids):
    """Players' weekly and season stats, scored with the league's settings (kona_player_info)"""
    data = req.league_get(params={"view": "kona_player_info"}, headers={"x-fantasy-filter": json.dumps(_players_filter(season, ids))})
    return unwrap(data).get("players", [])


def fetch_trade_transactions(req, scoring_period):
    """One scoring period's trade transactions (mTransactions2). Other teams' TRADE_ACCEPT rows come
    back without players; 2018's executed TRADE_UPHOLD rows have them."""
    filters = {"transactions": {"filterType": {"value": ["TRADE_ACCEPT", "TRADE_UPHOLD"]}}}
    data = req.league_get(params={"view": "mTransactions2", "scoringPeriodId": scoring_period},
                          headers={"x-fantasy-filter": json.dumps(filters)})
    return unwrap(data).get("transactions", []) or []


def fetch_rosters(req, scoring_period):
    """Every team's roster for one scoring period (mRoster), each player with his stats. For a week
    still to come, ESPN carries the current lineup forward and includes its weekly projections."""
    return unwrap(req.league_get(params={"view": ["mRoster"], "scoringPeriodId": scoring_period})).get("teams", [])


def fetch_player_cards(req, season, ids):
    """Player cards (kona_playercard), which list each player's transactions, trades included with
    both teams' players. mTransactions2 leaves other teams' trade legs out."""
    data = req.league_get(params={"view": "kona_playercard"}, headers={"x-fantasy-filter": json.dumps(_players_filter(season, ids))})
    return unwrap(data).get("players", [])
