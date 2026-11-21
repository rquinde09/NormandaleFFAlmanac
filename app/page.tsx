import { Suspense } from "react";
import { Home, HomeWithParams, type HomeData } from "@/components/Home";
import { record } from "@/lib/format";
import { champions, getLeague, latestSeason, managerBySlug, titles } from "@/lib/league";
import { dayLabel, getNews } from "@/lib/news";
import { pancakeWatch, rounds } from "@/lib/seasons";

// The site owner's Round 8 home page (2026-11-20): the season, the reigning champion, the Pancake
// Watch and the news as four cards. The opened Pancake Watch and News live in the URL.
export default function HomePage() {
  const league = getLeague();
  const latest = latestSeason(league);
  const champ = champions(league)[0];
  const inPlayoffs = latest.throughWeek > latest.regularWeeks;
  const finished = league.seasons.filter((s) => s.complete).at(-1);
  const lastTeam = finished && league.teamSeasons.find((t) => t.season === finished.season && t.lastPlace);

  const watch = pancakeWatch(league);
  const data: HomeData = {
    standings: {
      season: latest.season,
      number: league.seasons.length,
      status: latest.complete
        ? "Final"
        : inPlayoffs
          ? `Playoffs · week ${latest.throughWeek} of ${latest.weeks}`
          : `Week ${latest.throughWeek} of ${latest.regularWeeks} complete`,
      share: latest.complete ? 1 : inPlayoffs ? latest.throughWeek / latest.weeks : Math.min(latest.throughWeek / latest.regularWeeks, 1),
    },
    champ: champ
      ? { nickname: managerBySlug(league, champ.person)!.nickname, stars: titles(league, champ.person).length, teamName: champ.teamName, record: record(champ.all) }
      : null,
    watch,
    lastPancake:
      !watch && finished && lastTeam
        ? { season: finished.season, person: lastTeam.person, nickname: managerBySlug(league, lastTeam.person)!.nickname, ladder: rounds(league, finished, "consolation") }
        : null,
    names: Object.fromEntries(league.managers.map((m) => [m.slug, m.nickname])),
    news: getNews().map((p) => ({ slug: p.slug, title: p.title, date: dayLabel(p.date), html: p.html })),
  };

  // The grid renders before the page reads its URL, so the static page shows it without JavaScript
  return (
    <Suspense fallback={<Home data={data} view={null} />}>
      <HomeWithParams data={data} />
    </Suspense>
  );
}
