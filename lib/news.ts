// League news: one Markdown file per post in content/news, edited on GitHub's website.
// Frontmatter: title (required), date (YYYY-MM-DD, required), excerpt (optional).
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

const NEWS_DIR = path.join(process.cwd(), "content", "news");

export type Post = { slug: string; title: string; date: string; excerpt: string; html: string };

function plainText(markdown: string) {
  const paragraph = markdown.trim().split(/\n\s*\n/)[0] ?? "";
  const text = paragraph.replace(/[#*_>`\[\]]|\(.*?\)/g, "").replace(/\s+/g, " ").trim();
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

export function getNews(): Post[] {
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
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
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
