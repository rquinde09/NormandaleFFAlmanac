import Link from "next/link";
import { PageTitle, SectionLabel, Stars } from "@/components/ui";
import { pct, record } from "@/lib/format";
import { allTimeStandings, getLeague, winPct, type CareerRow } from "@/lib/league";

export const metadata = { title: "Teams" };

export default function TeamsPage() {
  const rows = allTimeStandings(getLeague()).sort((a, b) => a.nickname.localeCompare(b.nickname));
  const active = rows.filter((r) => r.active);
  const retired = rows.filter((r) => !r.active);
  return (
    <>
      <PageTitle sub={`${active.length} active managers, ${retired.length} retired`}>Teams</PageTitle>
      <div className="space-y-6">
        <Group label="Active" rows={active} />
        <Group label="Retired" rows={retired} />
      </div>
    </>
  );
}

function Group({ label, rows }: { label: string; rows: CareerRow[] }) {
  return (
    <section>
      <SectionLabel>{label}</SectionLabel>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <li key={r.slug}>
            <Link
              href={`/teams/${r.slug}`}
              className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 transition-colors hover:border-zinc-700"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold text-zinc-50">
                  {r.nickname} <Stars count={r.titles} />
                </div>
                <div className="truncate text-xs text-zinc-500">
                  {r.seasons} season{r.seasons === 1 ? "" : "s"} · #{r.rank} all-time
                </div>
              </div>
              <div className="shrink-0 text-right text-sm tabular-nums">
                <div className="text-zinc-200">{record(r)}</div>
                <div className="text-xs text-zinc-500">{pct(winPct(r))}</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
