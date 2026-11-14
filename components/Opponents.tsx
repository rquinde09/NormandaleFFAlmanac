"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, SectionLabel } from "@/components/ui";
import { score } from "@/lib/format";
import type { GameLine, OpponentKey, OpponentLine, Opponents as OpponentsData } from "@/lib/manager";

type Tab = OpponentKey | "best" | "worst";

const TABS: { key: Tab; label: string; about: string }[] = [
  { key: "faced", label: "Faced", about: "Played the most" },
  { key: "easiest", label: "Easiest", about: "Most wins against" },
  { key: "toughest", label: "Toughest", about: "Most losses against" },
  { key: "pf", label: "Most PF", about: "Scored the most points on" },
  { key: "pa", label: "Most PA", about: "Gave up the most points to" },
  { key: "best", label: "Best win", about: "Most points in a win" },
  { key: "worst", label: "Worst loss", about: "Fewest points in a loss" },
];

const KIND_LABEL = { regular: "", playoff: " · playoffs", placement: " · placement", consolation: " · consolation" };

// Head-to-head over every game, all seasons, one tab at a time: an opponent with a ring and just
// their name (the site owner, 2026-11-14), or a single game. The ring's middle holds the number the
// tab picks by: games, wins, losses, or the points over every game against them. Active opponents
// only, with no switch (Round 4).
export function Opponents({ data }: { data: OpponentsData }) {
  const [tab, setTab] = useState<Tab>("faced");
  const about = TABS.find((t) => t.key === tab)!.about;
  const game = tab === "best" ? data.bestWin : tab === "worst" ? data.worstLoss : undefined;
  const o = tab === "best" || tab === "worst" ? undefined : data.picks[tab];

  return (
    <section>
      <SectionLabel>Opponents</SectionLabel>
      <Card>
        {/* Four tabs to a row on a phone, the second row stretched; one row from sm up */}
        <div role="radiogroup" aria-label="Opponent" className="flex flex-wrap gap-0.5 rounded-xl border border-zinc-800 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="radio"
              aria-checked={t.key === tab}
              onClick={() => setTab(t.key)}
              className={`grow basis-[23%] rounded-lg px-1 py-1.5 text-xs font-medium whitespace-nowrap transition-colors sm:basis-0 sm:text-sm ${
                t.key === tab ? "bg-zinc-700 text-zinc-50" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {o ? (
          <Pick o={o} tab={tab as OpponentKey} />
        ) : game ? (
          <OneGame g={game} about={about} />
        ) : (
          <p className="py-8 text-center text-sm text-zinc-500">No games yet.</p>
        )}
      </Card>
    </section>
  );
}

// The red arc is the share of the games (wins on Faced and Easiest, losses on Toughest) or of the
// points in those games (PF or PA)
function Pick({ o, tab }: { o: OpponentLine; tab: OpponentKey }) {
  const winShare = o.games ? (o.w + o.t / 2) / o.games : 0;
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const ring = {
    faced: { share: winShare, value: String(o.games), label: plural(o.games, "game", "games") },
    easiest: { share: winShare, value: String(o.w), label: plural(o.w, "win", "wins") },
    toughest: { share: o.games ? o.l / o.games : 0, value: String(o.l), label: plural(o.l, "loss", "losses") },
    pf: { share: o.pf / (o.pf + o.pa), value: Math.round(o.pf).toLocaleString("en-US"), label: "PF" },
    pa: { share: o.pa / (o.pf + o.pa), value: Math.round(o.pa).toLocaleString("en-US"), label: "PA" },
  }[tab];

  // Nothing else to show, so the ring and the name sit in the middle of the box (Round 4)
  return (
    <div className="mt-4 flex items-center justify-center gap-5">
      <Ring {...ring} />
      <Link href={`/teams/${o.slug}`} className="block min-w-0 truncate text-xl font-semibold text-zinc-50 hover:text-white">
        {o.nickname}
      </Link>
    </div>
  );
}

function OneGame({ g, about }: { g: GameLine; about: string }) {
  return (
    <div className="mt-4 flex items-center gap-5">
      <Ring share={g.pf / (g.pf + g.pa)} value={score(g.pf)} label="PF" />
      <div className="min-w-0 text-sm">
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
function Ring({ share, value, label }: { share: number; value: string; label: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const arc = Math.max(0, Math.min(1, share)) * c;
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#27272a" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="#ef4444" strokeWidth="10" strokeDasharray={`${arc} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tabular-nums text-zinc-50">{value}</span>
        <span className="text-[10px] text-zinc-500">{label}</span>
      </div>
    </div>
  );
}
