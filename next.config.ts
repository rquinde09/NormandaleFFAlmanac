import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Old Google Sites URLs keep working after the domain moves. /teams/<name> paths match already.
  async redirects() {
    return [
      { source: "/home", destination: "/", permanent: true },
      { source: "/league-history", destination: "/standings", permanent: true },
      { source: "/leaderboard", destination: "/standings", permanent: true },
      { source: "/records/game-records", destination: "/records?view=game", permanent: true },
      { source: "/records/season-records", destination: "/records?view=season", permanent: true },
    ];
  },
};

export default nextConfig;
