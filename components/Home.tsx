"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Bracket } from "@/components/Bracket";
import { HomePills, homeHref, homeTitle, type HomeLinks } from "@/components/HomePills";
import { PancakeWatchView, RedLight, inDanger } from "@/components/PancakeWatch";
import { Bar, Stars } from "@/components/ui";
import type { PancakeWatch, Round } from "@/lib/seasons";

export type HomeData = {
  standings: { season: number; number: number; status: string; share: number };
  champ: { person: string; nickname: string; stars: number; teamName: string; record: string } | null;
  watch: PancakeWatch | null;
  // The off-season: the season just finished, its last place and its pancake ladder
  lastPancake: { season: number; person: string; nickname: string; ladder: Round[] } | null;
  names: Record<string, string>; // slug → first name
  news: { slug: string; title: string; date: string; html: string }[]; // newest first, date already a label
};

type View = "pancake" | "news";
const VIEWS: View[] = ["pancake", "news"];

// The view lives in the URL (?view=pancake or ?view=news). Opening one pushes a history entry, so
// Back returns to the grid.
function open(view: View | null) {
  window.history.pushState(null, "", view ? `/?view=${view}` : "/");
  window.scrollTo({ top: 0 });
}

export function HomeWithParams({ data }: { data: HomeData }) {
  const param = useSearchParams().get("view");
  return <Home data={data} view={VIEWS.find((v) => v === param) ?? null} />;
}

// The site owner's Round 8 home page (2026-11-20): four square cards, two by two on a phone and one
// row on wider screens. Since Round 9 (2026-11-23) the home page is the site's menu: no nav tabs, and
// four smaller boxes for the other pages. Round 10 (2026-11-25) moved the boxes above the cards: all
// four on wider screens; on a phone Standings and Teams, with Records and the Hall below the cards.
// 2026 Season opens the season's page and The Mahaan Bakaree the reigning champion's page; Pancake
// Watch and News open in place. Each shows the other three cards as pills along the top.
export function Home({ data, view }: { data: HomeData; view: View | null }) {
  const name = (slug: string) => data.names[slug] ?? slug;
  const links: HomeLinks = { season: data.standings.season, champ: data.champ?.person ?? null };
  const title = (card: "standings" | "champ" | View) => homeTitle(card, links.season);

  if (view) {
    // Opened: no wider than a column on a big screen
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <HomePills current={view} links={links} />
        <h1 className="text-center text-lg font-semibold tracking-wider text-zinc-400 uppercase">
          {title(view)}
          {view === "pancake" && " 🥞"}
        </h1>
        {view === "pancake" ? <PancakeOpen data={data} name={name} /> : <NewsOpen data={data} />}
      </div>
    );
  }

  const latest = data.news[0];
  return (
    <div className="space-y-3">
      <Menu items={MENU} label="Pages" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Square title={title("standings")} href={homeHref("standings", links)}>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600 text-4xl font-extrabold text-white" aria-hidden>
            N
          </span>
          <span className="mt-2 text-2xl font-semibold text-zinc-200">Season {data.standings.number}</span>
          <span className="mt-0.5 text-[11px] text-zinc-400">{data.standings.status}</span>
          <span className="mt-1.5 w-3/4">
            <Bar value={data.standings.share} />
          </span>
        </Square>

        <Square title={title("champ")} href={homeHref("champ", links)}>
          <span className="text-4xl leading-none" aria-hidden>
            👑
          </span>
          {data.champ ? (
            <>
              <span className="mt-1.5 text-[9px] tracking-widest text-zinc-500 uppercase">Reigning champion</span>
              <span className="text-xl leading-tight font-bold text-zinc-50">
                {data.champ.nickname} <Stars count={data.champ.stars} />
              </span>
              <span className="max-w-full shrink-0 truncate text-xs text-zinc-400 sm:text-sm">{data.champ.teamName}</span>
              <span className="text-sm tabular-nums text-zinc-300">{data.champ.record}</span>
            </>
          ) : (
            <span className="mt-2 text-sm text-zinc-500">No champion yet</span>
          )}
        </Square>

        <Square title={title("pancake")} onClick={() => open("pancake")}>
          <span className="text-[44px] leading-none" aria-hidden>
            🥞
          </span>
          <PancakeCardBody data={data} name={name} />
        </Square>

        <Square title={title("news")} onClick={() => open("news")}>
          <span className="text-[44px] leading-none" aria-hidden>
            📰
          </span>
          {latest ? (
            <>
              <span className="mt-2 line-clamp-2 text-base leading-tight font-semibold text-zinc-50">{latest.title}</span>
              <span className="mt-0.5 text-sm text-zinc-400">{latest.date}</span>
            </>
          ) : (
            <span className="mt-2 text-sm text-zinc-500">No posts yet</span>
          )}
        </Square>
      </div>

      <Menu items={MENU.filter((m) => m.phoneBelow)} label="More pages" phoneOnly />
    </div>
  );
}

// The rest of the site, in place of the nav tabs (Round 9): the site owner's three boxes plus Teams
// (Luke's pick), renamed and reordered in Round 10. On a phone the last two sit below the cards.
type MenuItem = { href: string; label: string; icon: string; phoneBelow?: boolean };
const MENU: MenuItem[] = [
  { href: "/standings", label: "Standings", icon: "📊" },
  { href: "/teams", label: "Teams", icon: "👥" },
  { href: "/records", label: "Records", icon: "📜", phoneBelow: true },
  { href: "/hall-of-mahaan-bakaree", label: "Hall of Mahaan Bakaree", icon: "🏆", phoneBelow: true },
];

// Rows as tall as three lines of text, since "Hall of Mahaan Bakaree" takes three on a phone
function Menu({ items, label, phoneOnly = false }: { items: MenuItem[]; label: string; phoneOnly?: boolean }) {
  return (
    <nav aria-label={label} className={`grid grid-cols-2 gap-3 md:grid-cols-4 ${phoneOnly ? "md:hidden" : ""}`}>
      {items.map((m) => (
        <Link
          key={m.href}
          href={m.href}
          className={`min-h-[4.5rem] items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-3.5 py-3 transition-colors hover:border-zinc-700 md:min-h-16 ${
            m.phoneBelow && !phoneOnly ? "hidden md:flex" : "flex"
          }`}
        >
          <span className="text-2xl leading-none" aria-hidden>
            {m.icon}
          </span>
          <span className="text-xs leading-tight font-semibold tracking-wider text-zinc-200 uppercase sm:text-sm">{m.label}</span>
        </Link>
      ))}
    </nav>
  );
}

// Who's in danger of last place, or, in the off-season, the season's last place
function PancakeCardBody({ data, name }: { data: HomeData; name: (slug: string) => string }) {
  if (!data.watch) {
    return data.lastPancake ? (
      <>
        <span className="mt-2 text-2xl font-bold text-orange-300">{data.lastPancake.nickname}</span>
        <span className="text-[11px] text-zinc-400">{data.lastPancake.season} last place</span>
      </>
    ) : (
      <span className="mt-2 text-sm text-zinc-500">No season yet</span>
    );
  }
  const danger = inDanger(data.watch, name);
  return (
    <>
      {danger.people.length > 0 && (
        <span className="mt-2 flex max-w-full items-center gap-2">
          <RedLight />
          <span className="truncate text-2xl font-bold text-red-500">{danger.people.join(" vs ")}</span>
        </span>
      )}
      <span className="mt-0.5 text-[11px] leading-tight text-zinc-400">{danger.note}</span>
    </>
  );
}

function PancakeOpen({ data, name }: { data: HomeData; name: (slug: string) => string }) {
  if (data.watch) return <PancakeWatchView watch={data.watch} name={name} />;
  const last = data.lastPancake;
  if (!last) return <p className="text-center text-sm text-zinc-500">No season yet.</p>;
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900 px-4 py-5 sm:px-6">
      <p className="text-center text-zinc-300">
        {last.season}&apos;s pancakes went to <span className="font-semibold text-orange-300">{last.nickname} 🥞</span>
      </p>
      <p className="mt-1 text-center text-xs text-zinc-500">The watch starts again with the {last.season + 1} season.</p>
      {last.ladder.length > 0 && (
        <div className="mt-4">
          <Bracket rounds={last.ladder} name={name} mark={{ person: last.person, icon: "🥞" }} />
        </div>
      )}
    </div>
  );
}

// Every post in full, newest first
function NewsOpen({ data }: { data: HomeData }) {
  if (!data.news.length) return <p className="text-center text-sm text-zinc-500">No posts yet.</p>;
  return (
    <ul className="space-y-4">
      {data.news.map((post) => (
        <li key={post.slug} className="rounded-3xl border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="text-xs text-zinc-500">{post.date}</div>
          <Link href={`/news/${post.slug}`} className="mt-1 block text-lg font-semibold text-zinc-50 hover:text-white">
            {post.title}
          </Link>
          {/* Posts come from the repo, written by league admins, or from the data */}
          <div className="prose-news text-sm" dangerouslySetInnerHTML={{ __html: post.html }} />
        </li>
      ))}
    </ul>
  );
}

// Square unless the content needs more room; a row's two cards share its height
const SQUARE = "flex aspect-square w-full flex-col items-center rounded-3xl border border-zinc-800 bg-zinc-900 px-2.5 pt-3.5 pb-3 text-center transition-colors hover:border-zinc-700 sm:pt-5";

// A home card: its title along the top, the rest centered below
function Square({ title, href, onClick, children }: { title: string; href?: string; onClick?: () => void; children: ReactNode }) {
  const inner = (
    <>
      <span className="text-[11px] leading-tight font-medium tracking-wide whitespace-nowrap text-zinc-400 uppercase sm:text-sm sm:tracking-wider">{title}</span>
      <span className="flex w-full flex-1 flex-col items-center justify-center">{children}</span>
    </>
  );
  return href ? (
    <Link href={href} className={SQUARE}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={SQUARE}>
      {inner}
    </button>
  );
}
