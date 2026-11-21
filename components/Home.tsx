"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Bracket } from "@/components/Bracket";
import { PancakeWatchView, RedLight, inDanger } from "@/components/PancakeWatch";
import { Bar, Stars } from "@/components/ui";
import type { PancakeWatch, Round } from "@/lib/seasons";

export type HomeData = {
  standings: { season: number; number: number; status: string; share: number };
  champ: { nickname: string; stars: number; teamName: string; record: string } | null;
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
// row on wider screens. 2026 Standings opens the season's page and The Mahaan Bakaree the Champions
// page; Pancake Watch and News open in place, with the other three cards as pills along the top.
export function Home({ data, view }: { data: HomeData; view: View | null }) {
  const name = (slug: string) => data.names[slug] ?? slug;
  const titles = { standings: `${data.standings.season} Standings`, champ: "The Mahaan Bakaree", pancake: "Pancake Watch", news: "News" };

  if (view) {
    const other: View = view === "pancake" ? "news" : "pancake";
    // Opened: no wider than a column on a big screen
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Pill href={`/seasons/${data.standings.season}`}>{titles.standings}</Pill>
          <Pill href="/hall-of-mahaan-bakaree">{titles.champ}</Pill>
          <Pill onClick={() => open(other)}>{titles[other]}</Pill>
        </div>
        <h1 className="text-center text-lg font-semibold tracking-wider text-zinc-400 uppercase">
          {titles[view]}
          {view === "pancake" && " 🥞"}
        </h1>
        {view === "pancake" ? <PancakeOpen data={data} name={name} /> : <NewsOpen data={data} />}
      </div>
    );
  }

  const latest = data.news[0];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Square title={titles.standings} href={`/seasons/${data.standings.season}`}>
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600 text-4xl font-extrabold text-white" aria-hidden>
          N
        </span>
        <span className="mt-2 text-2xl font-semibold text-zinc-200">Season {data.standings.number}</span>
        <span className="mt-0.5 text-[11px] text-zinc-400">{data.standings.status}</span>
        <span className="mt-1.5 w-3/4">
          <Bar value={data.standings.share} />
        </span>
      </Square>

      <Square title={titles.champ} href="/hall-of-mahaan-bakaree">
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

      <Square title={titles.pancake} onClick={() => open("pancake")}>
        <span className="text-[44px] leading-none" aria-hidden>
          🥞
        </span>
        <PancakeCardBody data={data} name={name} />
      </Square>

      <Square title={titles.news} onClick={() => open("news")}>
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

const PILL = "flex h-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 px-1.5 text-center text-[10px] leading-tight font-medium tracking-wider text-zinc-400 uppercase hover:border-zinc-700 sm:text-xs";

function Pill({ href, onClick, children }: { href?: string; onClick?: () => void; children: ReactNode }) {
  return href ? (
    <Link href={href} className={PILL}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={PILL}>
      {children}
    </button>
  );
}
