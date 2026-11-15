import Link from "next/link";
import { PancakeWatch } from "@/components/PancakeWatch";
import { Bar, Card, SectionLabel, Stars } from "@/components/ui";
import { record } from "@/lib/format";
import { champions, getLeague, latestSeason, managerBySlug, titles } from "@/lib/league";
import { dayLabel, getNews } from "@/lib/news";
import { pancakeWatch } from "@/lib/seasons";

export default function Home() {
  const league = getLeague();
  const latest = latestSeason(league);
  const seasonNumber = league.seasons.length;
  const champ = champions(league)[0];
  const champManager = champ && managerBySlug(league, champ.person)!;
  const news = getNews();
  const watch = pancakeWatch(league);

  const inPlayoffs = latest.throughWeek > latest.regularWeeks;
  const status = latest.complete
    ? "Final"
    : inPlayoffs
      ? "Playoffs"
      : `Week ${latest.throughWeek} of ${latest.regularWeeks} complete`;

  return (
    <div className="space-y-4">
      {/* Opens this season's standings and brackets */}
      <Link href={`/seasons/${latest.season}`} className="block">
        <Card className="transition-colors hover:border-zinc-700">
          <div className="flex items-baseline justify-between text-sm text-zinc-400">
            <span>
              Season {seasonNumber} · {latest.season}
            </span>
            <span>{status}</span>
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-zinc-50">Normandale Nation</div>
          <p className="mt-1 text-sm text-zinc-400">Hall of records and statistics · {latest.teams} teams</p>
          <div className="mt-4">
            <Bar value={latest.complete ? 1 : Math.min(latest.throughWeek / latest.regularWeeks, 1)} />
          </div>
        </Card>
      </Link>

      {watch && <PancakeWatch watch={watch} name={(slug) => managerBySlug(league, slug)!.nickname} />}

      {champ && (
        <Link href={`/teams/${champ.person}`} className="block">
          <Card className="transition-colors hover:border-zinc-700">
            <SectionLabel>Reigning Mahaan Bakaree Champion (The Great Goat) · {champ.season}</SectionLabel>
            <div className="flex items-baseline justify-between">
              <div className="text-xl font-semibold text-zinc-50">
                {champManager.nickname} <Stars count={titles(league, champ.person).length} />
              </div>
              <div className="text-sm tabular-nums text-zinc-400">{record(champ.all)}</div>
            </div>
            <div className="mt-1 text-sm text-zinc-400">{champ.teamName}</div>
          </Card>
        </Link>
      )}

      <section>
        <SectionLabel>News</SectionLabel>
        {news.length === 0 ? (
          <Card>
            <p className="text-sm text-zinc-400">No posts yet.</p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {news.map((post) => (
              <li key={post.slug}>
                <Link href={`/news/${post.slug}`} className="block">
                  <Card className="transition-colors hover:border-zinc-700">
                    <div className="text-xs text-zinc-500">{dayLabel(post.date)}</div>
                    <div className="mt-1 font-semibold text-zinc-50">{post.title}</div>
                    <p className="mt-1 text-sm text-zinc-400">{post.excerpt}</p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
