"""Stage 2 probe: read a few seasons from ESPN and summarize what comes back.

Usage: .venv/Scripts/python scripts/probe.py [season ...]   (default: 2025 2017)

Checks that owner IDs come back and that regular-season, playoff and
consolation games can be told apart. Prints summaries only: never cookie
values, and owner IDs only as their first 8 characters. Saves nothing;
downloading raw data is stage 3.
"""

import sys
from collections import Counter

from requests import RequestException
from espn_api.requests.espn_requests import (
    ESPNAccessDenied,
    ESPNInvalidLeague,
    ESPNUnknownError,
)

from espn_client import fetch_season, load_config


def norm(guid):
    return (guid or "").strip().strip("{}").upper()


def short_id(guid):
    return norm(guid)[:8] or "--------"


def team_name(team):
    name = team.get("name") or f"{team.get('location', '')} {team.get('nickname', '')}"
    return name.strip() or "?"


def person(member):
    if not member:
        return "(not in members list)"
    first, last = member.get("firstName", ""), member.get("lastName", "")
    name = f"{first} {last[:1]}." if first or last else ""
    display = member.get("displayName", "")
    return " / ".join(part for part in (name, display) if part) or "?"


def owners_of(team):
    owners = team.get("owners") or []
    if not owners and team.get("primaryOwner"):
        owners = [team["primaryOwner"]]
    return owners


def reg_season_count(data):
    return data.get("settings", {}).get("scheduleSettings", {}).get("matchupPeriodCount", 0)


def is_regular(game, reg_count):
    """Regular season by matchup period; playoffTierType is checked against this separately."""
    return game.get("matchupPeriodId", 0) <= reg_count


def summarize_settings(data):
    settings = data.get("settings", {})
    schedule = settings.get("scheduleSettings", {})
    scoring = settings.get("scoringSettings", {})
    print(f"  league: {settings.get('name')}, size {settings.get('size')}")
    print(f"  regular-season matchup periods: {schedule.get('matchupPeriodCount')}")
    print(
        f"  playoff teams: {schedule.get('playoffTeamCount')}, "
        f"weeks per playoff matchup: {schedule.get('playoffMatchupPeriodLength')}"
    )
    print(
        f"  tie rules: regular {scoring.get('matchupTieRule')}, "
        f"playoff {scoring.get('playoffMatchupTieRule')}"
    )
    print(f"  scoring enhancement: {scoring.get('scoringEnhancementType', 'none')}")
    print(f"  previous seasons ESPN lists: {data.get('status', {}).get('previousSeasons')}")


def summarize_teams(data, my_id):
    members = {norm(m.get("id")): m for m in data.get("members", [])}
    teams = sorted(data.get("teams", []), key=lambda t: t.get("id", 0))
    print(f"  {len(teams)} teams, {len(members)} members")
    for team in teams:
        record = team.get("record", {}).get("overall", {})
        final = team.get("rankCalculatedFinal") or team.get("rankFinal")
        owners = owners_of(team)
        owner_text = "; ".join(
            f"{short_id(o)}{' (you)' if norm(o) == my_id else ''} {person(members.get(norm(o)))}"
            for o in owners
        ) or "NO OWNER ID"
        print(
            f"  #{team.get('id', '?'):>2} {team_name(team)[:26]:<26} "
            f"{record.get('wins')}-{record.get('losses')}-{record.get('ties')} "
            f"PF {record.get('pointsFor', 0):>7.1f}  seed {team.get('playoffSeed')} "
            f"final {final}  | {owner_text}"
        )


def compact(counter):
    return ", ".join(f"{key} x{count}" for key, count in counter.most_common())


def summarize_schedule(data):
    schedule = data.get("schedule", [])
    reg_count = reg_season_count(data)
    by_period = {}
    for game in schedule:
        by_period.setdefault(game.get("matchupPeriodId"), []).append(game)

    print(f"  {len(schedule)} schedule entries")
    print("  period kind     games byes weeks  playoffTierType / winner")
    for period in sorted(by_period, key=lambda p: (p is None, p)):
        games = by_period[period]
        kind = "regular" if period is not None and period <= reg_count else "post"
        byes = sum(1 for g in games if "away" not in g)
        weeks = max(len(g.get("home", {}).get("pointsByScoringPeriod") or {}) for g in games)
        tiers = Counter(g.get("playoffTierType", "MISSING") for g in games)
        winners = Counter(g.get("winner", "MISSING") for g in games)
        print(
            f"  {period!s:>6} {kind:<8} {len(games):>5} {byes:>4} {weeks:>5}  "
            f"{compact(tiers)} / {compact(winners)}"
        )

    mismatched = sum(
        1
        for g in schedule
        if is_regular(g, reg_count) != (g.get("playoffTierType", "MISSING") == "NONE")
    )
    print(
        f"  period <= {reg_count} lines up with playoffTierType NONE: "
        f"{'yes' if not mismatched else f'NO, {mismatched} games disagree'}"
    )
    ties = sum(1 for g in schedule if g.get("winner") == "TIE")
    print(f"  ties in schedule: {ties}")


def check_records(data):
    """Does ESPN's season record equal the regular-season games alone?"""
    computed = {}
    reg_count = reg_season_count(data)
    for game in data.get("schedule", []):
        if not is_regular(game, reg_count) or "away" not in game:
            continue
        for side, label in ((game["home"], "HOME"), (game["away"], "AWAY")):
            w_l_t_pf = computed.setdefault(side["teamId"], [0, 0, 0, 0.0])
            w_l_t_pf[3] += side.get("totalPoints", 0)
            if game.get("winner") == "TIE":
                w_l_t_pf[2] += 1
            elif game.get("winner") == label:
                w_l_t_pf[0] += 1
            elif game.get("winner") in ("HOME", "AWAY"):
                w_l_t_pf[1] += 1

    teams = data.get("teams", [])
    differences = []
    for team in teams:
        record = team.get("record", {}).get("overall", {})
        wins, losses, ties, pf = computed.get(team.get("id"), [0, 0, 0, 0.0])
        espn = (record.get("wins"), record.get("losses"), record.get("ties"))
        if espn != (wins, losses, ties) or abs(record.get("pointsFor", 0) - pf) > 0.01:
            differences.append(
                f"    #{team.get('id')}: ESPN {espn[0]}-{espn[1]}-{espn[2]} PF "
                f"{record.get('pointsFor', 0):.2f} vs regular-season games "
                f"{wins}-{losses}-{ties} PF {pf:.2f}"
            )
    matched = len(teams) - len(differences)
    print(f"  ESPN record = regular-season games only: {matched}/{len(teams)} teams match")
    for line in differences:
        print(line)


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    seasons = [int(arg) for arg in sys.argv[1:]] or [2025, 2017]
    league_id, cookies = load_config()
    my_id = norm(cookies["SWID"])

    failed = False
    for season in seasons:
        print(f"=== {season} ===")
        try:
            data, used, tried = fetch_season(season, league_id, cookies)
        except (ESPNAccessDenied, ESPNInvalidLeague, ESPNUnknownError, RequestException) as e:
            print(f"  FAILED: {type(e).__name__}: {e}")
            failed = True
            continue

        fallback = f" (fell back from {tried})" if used != tried else ""
        print(f"  endpoint: {used}{fallback}; seasonId in response: {data.get('seasonId')}")
        summarize_settings(data)
        summarize_teams(data, my_id)
        summarize_schedule(data)
        check_records(data)
        print()

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
