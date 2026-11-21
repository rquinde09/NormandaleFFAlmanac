"use client";

import Link from "next/link";
import { useState } from "react";
import { Segmented } from "@/components/Segmented";
import { Card, SectionLabel } from "@/components/ui";
import { score } from "@/lib/format";
import type { GameLine, OpponentKey, OpponentLine, Opponents as OpponentsData } from "@/lib/manager";

type Tab = "favorites" | "points" | "best" | "worst";

// The site owner's Round 8 tabs (2026-11-20): Favorites holds Faced, Easiest and Toughest; Points
// holds Most PF and Most PA
const TABS: { value: Tab; label: string }[] = [
  { value: "favorites", label: "Favorites" },
  { value: "points", label: "Points" },
  { value: "best", label: "Best win" },
  { value: "worst", label: "Worst loss" },
];

const PICKS: Record<"favorites" | "points", { key: OpponentKey; label: string }[]> = {
  favorites: [
    { key: "faced", label: "Faced" },
    { key: "easiest", label: "Easiest" },
    { key: "toughest", label: "Toughest" },
  ],
  points: [
    { key: "pf", label: "Most PF" },
    { key: "pa", label: "Most PA" },
  ],
};

const KIND_LABEL = { regular: "", playoff: " · playoffs", placement: " · placement", consolation: " · consolation" };

// Head-to-head over every game, all seasons, against active opponents only (Round 4). Favorites and
// Points show small rings side by side, each with its label above and the opponent's name below;
// Best win and Worst loss show the game. Every tab is the same height.
export function Opponents({ data }: { data: OpponentsData }) {
  const [tab, setTab] = useState<Tab>("favorites");
  const game = tab === "best" ? data.bestWin : tab === "worst" ? data.worstLoss : undefined;

  return (
    <section>
      <SectionLabel>Opponents</SectionLabel>
      <Card>
        <Segmented label="Opponent" options={TABS} value={tab} onChange={setTab} small />
        {tab === "favorites" || tab === "points" ? (
          <div className={`${STACK} flex-row items-center gap-1`}>
            {PICKS[tab].map((p) => {
              const o = data.picks[p.key];
              return (
                <div key={p.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span className="text-sm text-zinc-400">{p.label}</span>
                  {o ? <Pick o={o} pick={p.key} /> : <span className="py-8 text-sm text-zinc-500">–</span>}
                </div>
              );
            })}
          </div>
        ) : game ? (
          <OneGame g={game} about={tab === "best" ? "Most points in a win" : "Fewest points in a loss"} />
        ) : (
          <p className={`${STACK} text-sm text-zinc-500`}>No games yet.</p>
        )}
      </Card>
    </section>
  );
}

// The red arc is the share of the games (wins on Faced and Easiest, losses on Toughest) or of the
// points in those games (PF or PA)
function Pick({ o, pick }: { o: OpponentLine; pick: OpponentKey }) {
  const winShare = o.games ? (o.w + o.t / 2) / o.games : 0;
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const ring = {
    faced: { share: winShare, value: String(o.games), label: plural(o.games, "game", "games") },
    easiest: { share: winShare, value: String(o.w), label: plural(o.w, "win", "wins") },
    toughest: { share: o.games ? o.l / o.games : 0, value: String(o.l), label: plural(o.l, "loss", "losses") },
    pf: { share: o.pf / (o.pf + o.pa), value: Math.round(o.pf).toLocaleString("en-US"), label: "PF" },
    pa: { share: o.pa / (o.pf + o.pa), value: Math.round(o.pa).toLocaleString("en-US"), label: "PA" },
  }[pick];
  return (
    <>
      <Ring {...ring} small />
      <Link href={`/teams/${o.slug}`} className="block max-w-full truncate text-lg font-semibold text-zinc-50 hover:text-white">
        {o.nickname}
      </Link>
    </>
  );
}

// Every tab's content: centered, and the same height so switching tabs doesn't move the page
const STACK = "mt-4 flex min-h-56 flex-col items-center justify-center gap-2 text-center";

function OneGame({ g, about }: { g: GameLine; about: string }) {
  return (
    <div className={STACK}>
      <Ring share={g.pf / (g.pf + g.pa)} value={score(g.pf)} label="PF" />
      <div className="max-w-full min-w-0 text-sm">
        <div className="text-xs text-zinc-500">{about}</div>
        <Link href={`/teams/${g.opponentSlug}`} className="block truncate text-xl font-semibold text-zinc-50 hover:text-white">
          vs {g.opponent}
        </Link>
        <div className="mt-1 tabular-nums text-zinc-300">
          {score(g.pf)}–{score(g.pa)}
        </div>
        <div className="text-zinc-500">
          {g.season} week {g.week}
          {KIND_LABEL[g.kind]}
        </div>
      </div>
    </div>
  );
}

// A ring meter: the red arc is the share (wins, or the points named in the middle) of the whole.
function Ring({ share, value, label, small = false }: { share: number; value: string; label: string; small?: boolean }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const arc = Math.max(0, Math.min(1, share)) * c;
  return (
    <div className={`relative shrink-0 ${small ? "h-24 w-24" : "h-28 w-28"}`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#27272a" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="#ef4444" strokeWidth="10" strokeDasharray={`${arc} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-bold tabular-nums text-zinc-50 ${small ? "text-base" : "text-lg"}`}>{value}</span>
        <span className="text-[10px] text-zinc-500">{label}</span>
      </div>
    </div>
  );
}
