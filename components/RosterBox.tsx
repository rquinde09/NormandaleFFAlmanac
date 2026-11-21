"use client";

import { useState, type ReactNode } from "react";
import { keep } from "@/components/ChartFrame";
import type { SeasonPoint } from "@/lib/manager";
import type { RosterKey, RosterPlayer } from "@/lib/roster";

// The Roster box (the site owner's Round 5, inspired by Luke): four of the selected season's
// players side by side, the title above, the name and the stat below. Since Round 8 (2026-11-20) it
// opens and closes from its title line, shut at first, and stays as it is when another season is
// selected. "Inconsistent" is Luke's pick over "Most Hated" (2026-11-15).
const TILES: { key: RosterKey; title: string; about: string }[] = [
  { key: "best", title: "Best Player", about: "Most points in his starting lineup" },
  { key: "drafted", title: "Best Drafted", about: "Most points by one of his draft picks, wherever he played" },
  { key: "inconsistent", title: "Inconsistent", about: "Furthest below ESPN's weekly projections in his starting lineup" },
  { key: "franchise", title: "Franchise Player", about: "Started the most weeks" },
];

export function RosterBox({ point, open, onToggle }: { point: SeasonPoint; open: boolean; onToggle: () => void }) {
  const { picks, missing } = point.roster;
  return (
    <div className="mt-4 border-t border-zinc-800 pt-3" {...keep}>
      <Toggle open={open} onToggle={onToggle}>
        {point.season} roster{point.live ? " so far" : ""}
      </Toggle>
      {open && (
        <>
      <ul className="mt-2 grid grid-cols-4 gap-2">
        {TILES.map((t) => (
          <li key={t.key} className="min-w-0 text-center" title={t.about}>
            <div className="flex h-6 items-end justify-center text-[10px] leading-tight font-medium tracking-wide text-zinc-500 uppercase">{t.title}</div>
            <Tile player={picks[t.key]} />
          </li>
        ))}
      </ul>
      {missing && <p className="mt-2 text-xs text-zinc-500">{missing}</p>}
        </>
      )}
    </div>
  );
}

// The title line that opens and closes a box under the chart (Round 8)
export function Toggle({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between gap-2 py-0.5 text-left text-xs font-medium text-zinc-300 hover:text-zinc-100">
      <span>{children}</span>
      <span className={`text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
        ▾
      </span>
    </button>
  );
}

function Tile({ player }: { player: RosterPlayer | null }) {
  if (!player) {
    return (
      <>
        <div className="mx-auto mt-1.5 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800/60 text-zinc-600">–</div>
        <div className="mt-1 text-xs text-zinc-600">None</div>
      </>
    );
  }
  return (
    <>
      <Photo player={player} />
      <div className="mt-1 line-clamp-2 text-xs leading-tight font-semibold break-words text-zinc-100">{player.name}</div>
      <div className="mt-0.5 text-xs tabular-nums text-zinc-300">{player.stat}</div>
      {player.note && <div className="text-[10px] text-zinc-500">{player.note}</div>}
    </>
  );
}

// ESPN's proTeamId → the abbreviation in its logo URLs, for D/STs (player ID −16000 − proTeamId)
const TEAMS: Record<number, string> = {
  1: "atl", 2: "buf", 3: "chi", 4: "cin", 5: "cle", 6: "dal", 7: "den", 8: "det", 9: "gb", 10: "ten", 11: "ind",
  12: "kc", 13: "lv", 14: "lar", 15: "mia", 16: "min", 17: "ne", 18: "no", 19: "nyg", 20: "nyj", 21: "phi", 22: "ari",
  23: "pit", 24: "lac", 25: "sf", 26: "sea", 27: "tb", 28: "wsh", 29: "car", 30: "jax", 33: "bal", 34: "hou",
};

// Headshots load from ESPN's image CDN in the visitor's browser (Luke, 2026-11-15); nothing is
// stored in the repo. Initials stand in when one fails to load.
function photoUrl(id: number) {
  if (id < 0) {
    const team = TEAMS[-id - 16000];
    return team ? `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/${team}.png&w=88&h=88` : null;
  }
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${id}.png&w=120&h=88`;
}

function Photo({ player }: { player: RosterPlayer }) {
  const [failed, setFailed] = useState(false);
  const src = photoUrl(player.playerId);
  const initials = player.name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <div className="relative mx-auto mt-1.5 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-xs font-semibold text-zinc-400">
      {!src || failed ? (
        initials
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- a plain hotlink; no Next image optimization wanted
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={`h-full w-full ${player.playerId < 0 ? "object-contain p-1" : "object-cover object-top"}`}
        />
      )}
    </div>
  );
}
