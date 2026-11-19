import { cache } from "react";
import { getPublishedPostBySlug, getPublishedPosts } from "@/lib/content/blog";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import snapshot from "./content/wp-posts.json";

/**
 * Resources (blog) data for the public site.
 *
 * Posts published from the dashboard (blog_posts) come first; the WordPress
 * snapshot (scripts/snapshot-wp-posts.mjs) fills in the archive until the
 * Phase 7 import moves those posts into the database. A dashboard post with
 * the same slug always wins over the snapshot copy.
 */

export type PublicPost = {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  categories: { name: string; slug: string }[];
  image: string | null;
  readingMinutes: number;
  html: string;
  author?: string | null;
};

type SnapshotPost = Omit<PublicPost, "author">;

/**
 * Strip the WordPress-era planner booking blocks (round headshots + FluentBooking
 * "Book with …" links, and the "Schedule Online" card grid) from article HTML.
 * The post page renders the native SIG booking section instead (PostBookingCta).
 */
export function cleanPostHtml(html: string): string {
  return html
    .replace(/<h2>\s*Schedule Online\s*<\/h2>\s*<p>\s*Meet with a Certified[^<]*<\/p>/gi, "")
    .replace(/<a\s[^>]*href="[^"]*fluent-booking[^"]*"[^>]*>[\s\S]*?<\/a>/gi, "")
    .replace(/<img[^>]*(?:Round-Compressed|white-background|Head-Shot|Profile-Photo)[^>]*>[^<]*/gi, "")
    .replace(/<p>\s*Prefer to call\?[\s\S]*?<\/p>/gi, "")
    .replace(/(\s*\n){3,}/g, "\n\n");
}

const SNAPSHOT = (snapshot as SnapshotPost[]).map((p) => ({ ...p, html: cleanPostHtml(p.html) }));

type DbPost = {
  slug: string;
  title: string;
  excerpt: string | null;
  content_html: string | null;
  content_text: string | null;
  featured_image_url: string | null;
  publish_at: string | null;
  created_at: string;
  author_name: string | null;
  category: { name: string; slug: string } | null;
};

function fromDb(p: DbPost): PublicPost {
  const text = p.content_text || (p.content_html ?? "").replace(/<[^>]+>/g, " ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return {
    slug: p.slug,
    title: p.title,
    date: p.publish_at ?? p.created_at,
    excerpt: p.excerpt || text.trim().slice(0, 220) + (text.length > 220 ? "…" : ""),
    categories: p.category ? [p.category] : [],
    image: p.featured_image_url,
    readingMinutes: Math.max(1, Math.round(words / 230)),
    html: cleanPostHtml(p.content_html ?? ""),
    author: p.author_name,
  };
}

/**
 * Once scripts/import-wp-posts.mjs has run, the dashboard owns every article and the
 * snapshot must not resurface posts that were deleted, hidden or archived there.
 */
const wordpressImported = cache(async (): Promise<boolean> => {
  try {
    const { count } = await createSupabaseAdminClient()
      .from("blog_posts")
      .select("id", { count: "exact", head: true })
      .eq("metadata->>source", "wordpress");
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
});

export const getAllPosts = cache(async (): Promise<PublicPost[]> => {
  let db: PublicPost[] = [];
  try {
    db = ((await getPublishedPosts()) as DbPost[]).map(fromDb);
  } catch {
    // Database unavailable (local preview without keys) — the snapshot still renders.
  }
  if (await wordpressImported()) return db.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const seen = new Set(db.map((p) => p.slug));
  return [...db, ...SNAPSHOT.filter((p) => !seen.has(p.slug))].sort((a, b) => +new Date(b.date) - +new Date(a.date));
});

export const getPost = cache(async (slug: string): Promise<PublicPost | null> => {
  try {
    const row = (await getPublishedPostBySlug(slug)) as DbPost | null;
    if (row) return fromDb(row);
  } catch {
    /* fall through to the snapshot */
  }
  if (await wordpressImported()) return null;
  return SNAPSHOT.find((p) => p.slug === slug) ?? null;
});

export async function getCategories() {
  const posts = await getAllPosts();
  const counts = new Map<string, { name: string; slug: string; count: number }>();
  for (const p of posts) {
    for (const c of p.categories) {
      const cur = counts.get(c.slug) ?? { ...c, count: 0 };
      cur.count += 1;
      counts.set(c.slug, cur);
    }
  }
  return [...counts.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

export function formatPostDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Phoenix" });
}
