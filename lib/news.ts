// League news: one Markdown file per post in content/news, edited on GitHub's website, plus a post
// for every record broken (lib/recordNews.ts, Round 8).
// Frontmatter: title (required), date (YYYY-MM-DD, required), excerpt (optional).
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import { getLeague } from "@/lib/league";
import { recordPosts } from "@/lib/recordNews";

const NEWS_DIR = path.join(process.cwd(), "content", "news");

// `record`: a record-break post, made from the data
export type Post = { slug: string; title: string; date: string; excerpt: string; html: string; record: boolean };

function plainText(markdown: string) {
  const paragraph = markdown.trim().split(/\n\s*\n/)[0] ?? "";
  const text = paragraph.replace(/[#*_>`\[\]]|\(.*?\)/g, "").replace(/\s+/g, " ").trim();
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

function written(): Post[] {
  if (!fs.existsSync(NEWS_DIR)) return [];
  return fs
    .readdirSync(NEWS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const { data, content } = matter(fs.readFileSync(path.join(NEWS_DIR, file), "utf8"));
      // YAML turns a bare 2026-11-01 into a Date; keep just the day
      const date = data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date ?? "");
      return {
        slug: file.replace(/\.md$/, ""),
        title: String(data.title ?? file),
        date,
        excerpt: String(data.excerpt ?? plainText(content)),
        html: marked.parse(content, { async: false }),
        record: false,
      };
    });
}

let cached: Post[] | null = null;

// Newest first. On the same day a written post comes before record posts.
export function getNews(): Post[] {
  if (cached) return cached;
  const records = recordPosts(getLeague()).map((p) => ({ slug: p.slug, title: p.title, date: p.date, excerpt: p.excerpt, html: p.html, record: true }));
  cached = [...written(), ...records].sort((a, b) => b.date.localeCompare(a.date) || Number(a.record) - Number(b.record));
  return cached;
}

// Post dates are calendar days, so format them without shifting time zones
export function dayLabel(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
