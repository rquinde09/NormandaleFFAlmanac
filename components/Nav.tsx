"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

// Seasons after Records (the site owner, Round 9, 2026-11-23)
const LINKS = [
  { href: "/", label: "Home" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/teams", label: "Teams" },
  { href: "/records", label: "Records" },
  { href: "/seasons", label: "Seasons" },
  { href: "/hall-of-mahaan-bakaree", label: "Champions" },
];

// The home page's grid is the menu, so it shows no tabs (Round 9). They come back once a card opens
// in place (?view=) and on every other page. The static page renders without the URL's query, so
// the fallback goes by the path alone.
export function Nav() {
  return (
    <Suspense fallback={<Tabs view={null} />}>
      <NavWithParams />
    </Suspense>
  );
}

function NavWithParams() {
  return <Tabs view={useSearchParams().get("view")} />;
}

function Tabs({ view }: { view: string | null }) {
  const pathname = usePathname();
  if (pathname === "/" && !view) return null;
  return (
    <div className="mt-2 md:mt-0">
      {/* All six fit a 375px phone at 12px with tight padding (370px of 375); a narrower screen
          scrolls them sideways */}
      <nav className="no-scrollbar -mx-4 flex justify-between overflow-x-auto px-2 sm:mx-0 sm:justify-start sm:gap-1 sm:px-0">
        {LINKS.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`shrink-0 rounded-lg px-1 py-1.5 text-[12px] font-medium transition-colors sm:px-2.5 sm:text-sm ${
                active ? "bg-zinc-800 text-zinc-50" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
