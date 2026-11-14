"use client";

import { useState } from "react";
import { Segmented } from "@/components/Segmented";
import { Card, SectionLabel } from "@/components/ui";
import type { Achievement, Tier } from "@/lib/manager";

const TIERS: { value: Tier; label: string }[] = [
  { value: "goat", label: "GOAT Tier" },
  { value: "pancake", label: "Pancake Tier" },
];

// Two tiers behind tabs, and a tap on an icon says what it means (the site owner, 2026-11-14).
// Earned once in any season lights the icon; otherwise it stays greyed out, so its shape still shows.
export function Achievements({ list }: { list: Achievement[] }) {
  const [tier, setTier] = useState<Tier>("goat");
  const [open, setOpen] = useState<string | null>(null);
  const shown = list.filter((a) => a.tier === tier);
  const picked = shown.find((a) => a.key === open);

  return (
    <section>
      <SectionLabel>Achievements</SectionLabel>
      <Card>
        <Segmented
          label="Tier"
          options={TIERS}
          value={tier}
          onChange={(t) => {
            setTier(t);
            setOpen(null);
          }}
        />
        <ul className="mt-4 grid grid-cols-4 gap-x-2 gap-y-4">
          {shown.map((a) => (
            <li key={a.key}>
              <button
                onClick={() => setOpen(open === a.key ? null : a.key)}
                aria-expanded={open === a.key}
                aria-controls="achievement-detail"
                className={`flex w-full flex-col items-center rounded-xl px-0.5 py-1.5 text-center transition-colors ${
                  open === a.key ? "bg-zinc-800" : "hover:bg-zinc-800/50"
                }`}
              >
                <span className={`text-3xl leading-none ${a.earned ? "" : "opacity-20 grayscale"}`} aria-hidden>
                  {a.icon}
                </span>
                <span className={`mt-1.5 text-[11px] leading-tight font-medium ${a.earned ? "text-zinc-200" : "text-zinc-600"}`}>
                  {a.title}
                </span>
                <span className="sr-only">{a.earned ? "earned" : "not earned"}</span>
                {a.earned && a.note && <span className="mt-0.5 text-[10px] leading-tight tabular-nums text-zinc-500">{a.note}</span>}
              </button>
            </li>
          ))}
        </ul>

        <div id="achievement-detail" aria-live="polite">
          {picked && (
            <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-sm">
              <div>
                <span className="font-semibold text-zinc-50">{picked.title}:</span> <span className="text-zinc-300">{picked.detail}</span>
              </div>
              {picked.fine && <div className="mt-0.5 text-xs text-zinc-500">{picked.fine}</div>}
              <div className="mt-1 text-xs text-zinc-400">
                {picked.seasons.length
                  ? picked.seasons.map((s) => (s.extra ? `${s.season} (${s.extra})` : String(s.season))).join(", ")
                  : "Not earned yet"}
              </div>
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}
