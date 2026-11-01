"""Check .env.local for the ESPN settings without printing any secret values.

Usage: python scripts/check_env.py [path-to-env-file]

Reports only the shape of each value (length, format), never the value itself,
so it is safe to run where the output is visible.
"""

import re
import sys
from pathlib import Path

DEFAULT_PATH = Path(__file__).resolve().parent.parent / ".env.local"
GUID = r"[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}"


def parse(path):
    values = {}
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, _, value = stripped.partition("=")
        values[key.strip()] = value
    return values


def common_problems(raw):
    """Problems any of the three values can have. Returns (cleaned value, problems)."""
    problems = []
    value = raw
    if value != value.strip():
        problems.append("has spaces before or after it")
        value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        problems.append("is wrapped in quotes; remove them")
        value = value[1:-1]
    if re.search(r"\s", value):
        problems.append("contains spaces or line breaks inside it")
    return value, problems


def check_league_id(value):
    if "leagueId" in value or "http" in value:
        return ["looks like part of a URL; keep only the number after leagueId="]
    if not value.isdigit():
        return ["should be digits only"]
    return []


def check_s2(value):
    problems = []
    if value.lower().startswith("espn_s2"):
        problems.append("starts with the cookie name; keep only the value")
    if len(value) < 100:
        problems.append(f"is only {len(value)} characters; the copy was probably cut off")
    if "%" not in value and re.search(r"[+/=]", value):
        problems.append(
            'looks URL-decoded (has + / = but no %); recopy with "Show URL-decoded" unchecked'
        )
    return problems


def check_swid(value):
    if re.fullmatch(r"\{" + GUID + r"\}", value):
        return []
    if re.fullmatch(GUID, value):
        return ["is missing its curly braces { }; include them"]
    if re.fullmatch(r"%7B" + GUID + r"%7D", value, re.IGNORECASE):
        return ["has URL-encoded braces; replace %7B with { and %7D with }"]
    return ["should look like {XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}"]


def describe(name, value):
    if name == "ESPN_LEAGUE_ID":
        return f"{len(value)} digits"
    if name == "ESPN_S2":
        return f"{len(value)} characters"
    return "{GUID} format"


CHECKS = {
    "ESPN_LEAGUE_ID": check_league_id,
    "ESPN_S2": check_s2,
    "ESPN_SWID": check_swid,
}


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PATH
    if not path.exists():
        print(f"{path} not found. Copy .env.example to .env.local first.")
        return 1

    values = parse(path)
    failed = False
    for name, check in CHECKS.items():
        raw = values.get(name)
        if raw is None:
            print(f"{name}: MISSING (no line for it)")
            failed = True
            continue
        if not raw.strip():
            print(f"{name}: not filled in yet")
            failed = True
            continue
        value, problems = common_problems(raw)
        problems += check(value)
        if problems:
            failed = True
            for problem in problems:
                print(f"{name}: PROBLEM - {problem}")
        else:
            print(f"{name}: OK ({describe(name, value)})")

    print()
    if failed:
        print("Fix the lines above in .env.local, save, and run this again.")
        return 1
    print("All three look right. The real test is a live call to ESPN (stage 2).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
