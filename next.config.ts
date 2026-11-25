import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Old Google Sites URLs keep working after the domain moves. /teams/<name> paths match already.
  async redirects() {
    return [
      { source: "/home", destination: "/", permanent: true },
      { source: "/league-history", destination: "/standings?view=all", permanent: true },
      // The old site's Leaderboard, and Round 9's name for the standings (2026-11-23); Round 10 named
      // them Standings again. The query (view, sort) carries over.
      { source: "/leaderboard", destination: "/standings", permanent: true },
      { source: "/retired-teams", destination: "/teams", permanent: true },
      { source: "/records/game-records", destination: "/records?view=game", permanent: true },
      { source: "/records/season-records", destination: "/records?view=season", permanent: true },
    ];
  },
};

export default nextConfig;
