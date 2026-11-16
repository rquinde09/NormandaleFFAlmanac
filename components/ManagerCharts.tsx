"use client";

import { useEffect, useState } from "react";
import { KEEP } from "@/components/ChartFrame";
import { ManagerPerformance } from "@/components/ManagerPerformance";
import { ManagerPlaycalls } from "@/components/ManagerPlaycalls";
import type { SeasonPoint } from "@/lib/manager";

// Manager Performance and Manager Playcalls share one selected season. The page opens on the season
// in progress (Round 5), or a retired manager's last season. Tapping the selected season again, or
// anywhere outside the charts' points, tabs and the boxes about the selection, clears it (Round 4).
export function ManagerCharts({ seasons }: { seasons: SeasonPoint[] }) {
  const [selected, setSelected] = useState<number | null>(seasons.find((s) => s.live)?.season ?? seasons.at(-1)?.season ?? null);

  useEffect(() => {
    if (selected === null) return;
    const clear = (e: MouseEvent) => {
      if (!(e.target instanceof Element && e.target.closest(`[${KEEP}]`))) setSelected(null);
    };
    document.addEventListener("click", clear);
    return () => document.removeEventListener("click", clear);
  }, [selected]);

  const select = (season: number) => setSelected(season === selected ? null : season);
  return (
    <>
      <ManagerPerformance seasons={seasons} selected={selected} onSelect={select} />
      <ManagerPlaycalls seasons={seasons} selected={selected} onSelect={select} />
    </>
  );
}
