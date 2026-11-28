// The Playcall Review's numbers (the site owner's Round 6, 2026-11-17), in the two groups Round 10
// (2026-11-25) split them into: the manager's decisions, shown in Playcalling Analysis and the season
// pages' Playcall stats, and what the season was expected to bring, in Against the Odds and the Odds
// stats. Each group in his order; Round 11 (2026-11-25) added Injuries to the second. No Node imports,
// so the client components use it directly.
export type ReviewKey = "draft" | "roster" | "waiver" | "trade" | "odds" | "luck" | "streak" | "injuries";
export const DECISIONS: ReviewKey[] = ["draft", "roster", "waiver", "trade"];
export const FATE: ReviewKey[] = ["odds", "luck", "streak", "injuries"];

// How an injury is counted (lib/injuries.ts; the site owner's Round 11, redefined by him on
// 2026-11-27), for every place that explains it
export const INJURIES_COUNTED =
  "Injuries: each time a player missed his NFL team’s game while on the team’s roster (starting lineup, bench or IR). A stretch of missed games counts once for every team that had him during it, and again if he’s hurt again after coming back. A player let go right after his last game counts for that team too if he never played again that season, once the season is over. ESPN keeps no injury reports for past weeks, only whether each player played, so a suspension or a healthy scratch counts too. From 2018.";
