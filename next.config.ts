import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Old Google Sites URLs keep working after the domain moves. /teams/<name> paths match already.
  async redirects() {
    return [
      { source: "/home", destination: "/", permanent: true },
      { source: "/league-history", destination: "/leaderboard?view=all", permanent: true },
      // Standings became the Leaderboard in Round 9 (2026-11-23); the query (view, sort) carries over
      { source: "/standings", destination: "/leaderboard", permanent: true },
      { source: "/retired-teams", destination: "/teams", permanent: true },
      { source: "/records/game-records", destination: "/records?view=game", permanent: true },
      { source: "/records/season-records", destination: "/records?view=season", permanent: true },
    ];
  },
};

export default nextConfig;
