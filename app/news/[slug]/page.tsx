import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { dayLabel, getNews } from "@/lib/news";

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getNews().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  return { title: getNews().find((p) => p.slug === slug)?.title };
}

export default async function NewsPost({ params }: Params) {
  const { slug } = await params;
  const post = getNews().find((p) => p.slug === slug);
  if (!post) notFound();
  return (
    <article>
      <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Home
      </Link>
      <Card className="mt-3">
        <div className="text-xs text-zinc-500">{dayLabel(post.date)}</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-50">{post.title}</h1>
        {/* Posts come from the repo, written by league admins */}
        <div className="prose-news mt-2" dangerouslySetInnerHTML={{ __html: post.html }} />
      </Card>
    </article>
  );
}
