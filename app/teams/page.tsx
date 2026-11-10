import Link from "next/link";
import { Pancakes, PageTitle, SectionLabel, Stars } from "@/components/ui";
import { careerTotals, getLeague, type League } from "@/lib/league";

export const metadata = { title: "Teams" };

type Row = { slug: string; nickname: string; seasons: number; titles: number; lastPlaces: number };

function rows(league: League, active: boolean): Row[] {
  const totals = careerTotals(league);
  return league.managers
    .filter((m) => m.active === active && totals.has(m.slug))
    .map((m) => {
      const t = totals.get(m.slug)!;
      return { slug: m.slug, nickname: m.nickname, seasons: t.seasons, titles: t.titles, lastPlaces: t.lastPlaces };
    })
    .sort((a, b) => a.nickname.localeCompare(b.nickname));
}

// Every active manager fits on one phone screen (two short columns); retired ones stay folded
// below until asked for (the site owner, 2026-11-07).
export default function TeamsPage() {
  const league = getLeague();
  const active = rows(league, true);
  const retired = rows(league, false);
  return (
    <>
      <PageTitle sub="★ title · 🥞 last place">Teams</PageTitle>
      <section>
        <SectionLabel>Active · {active.length}</SectionLabel>
        <Grid rows={active} />
      </section>
      {retired.length > 0 && (
        <details className="group mt-5">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-300 hover:border-zinc-700 [&::-webkit-details-marker]:hidden">
            Retired · {retired.length}
            <span className="text-zinc-500 transition-transform group-open:rotate-180" aria-hidden>
              ▾
            </span>
          </summary>
          <div className="mt-2">
            <Grid rows={retired} />
          </div>
        </details>
      )}
    </>
  );
}

function Grid({ rows }: { rows: Row[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {rows.map((r) => (
        <li key={r.slug}>
          <Link
            href={`/teams/${r.slug}`}
            className="block rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 transition-colors hover:border-zinc-700 sm:px-4 sm:py-3"
          >
            <div className="truncate font-semibold text-zinc-50">
              {r.nickname} <Stars count={r.titles} /> <Pancakes count={r.lastPlaces} />
            </div>
            <div className="text-xs text-zinc-500">
              {r.seasons} season{r.seasons === 1 ? "" : "s"}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
