// The Playcall Review's numbers (the site owner's Round 6, 2026-11-17), in the two groups Round 10
// (2026-11-25) split them into: the manager's decisions, shown in Playcalling Analysis and the season
// pages' Playcall stats, and what the season was expected to bring, in Against the Odds and the Odds
// stats. Each group in his order. No Node imports, so the client components use it directly.
export type ReviewKey = "draft" | "roster" | "waiver" | "trade" | "odds" | "luck" | "streak";
export const DECISIONS: ReviewKey[] = ["draft", "roster", "waiver", "trade"];
export const FATE: ReviewKey[] = ["odds", "luck", "streak"];
