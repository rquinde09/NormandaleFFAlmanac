"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// The home page's four cards. Pancake Watch and News open in place on the home page; 2026 Season
// (Round 10's name; it was 2026 Standings) and The Mahaan Bakaree open the season's page and the
// reigning champion's page (Round 9). Each
// view shows the other three as pills along the top, so a visitor can move between them (the site
// owner, Round 9, 2026-11-23). The two pages show them only when opened from home, which the link
// marks with ?from=home.
export type HomeCard = "standings" | "champ" | "pancake" | "news";
export type HomeLinks = { season: number; champ: string | null }; // the latest season; the reigning champion's slug

const CARDS: HomeCard[] = ["standings", "champ", "pancake", "news"];

export function homeTitle(card: HomeCard, season: number) {
  return { standings: `${season} Season`, champ: "The Mahaan Bakaree", pancake: "Pancake Watch", news: "News" }[card];
}

export function homeHref(card: HomeCard, links: HomeLinks) {
  if (card === "standings") return `/seasons/${links.season}?from=home`;
  if (card === "champ") return links.champ ? `/teams/${links.champ}?from=home` : "/hall-of-mahaan-bakaree";
  return `/?view=${card}`;
}

const PILL = "flex h-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 px-1.5 text-center text-[10px] leading-tight font-medium tracking-wider text-zinc-400 uppercase hover:border-zinc-700 sm:text-xs";

export function HomePills({ current, links }: { current: HomeCard; links: HomeLinks }) {
  return (
    <div className="mx-auto grid max-w-2xl grid-cols-3 gap-2">
      {CARDS.filter((c) => c !== current).map((c) => (
        <Link key={c} href={homeHref(c, links)} className={PILL}>
          {homeTitle(c, links.season)}
        </Link>
      ))}
    </div>
  );
}

// On the season's page and the champion's page: the pills when opened from home. The static page
// renders without them; they appear once the page reads its URL.
export function FromHomePills(props: { current: HomeCard; links: HomeLinks }) {
  return (
    <Suspense fallback={null}>
      <IfFromHome {...props} />
    </Suspense>
  );
}

function IfFromHome(props: { current: HomeCard; links: HomeLinks }) {
  return useSearchParams().get("from") === "home" ? <HomePills {...props} /> : null;
}
