import type { MetadataRoute } from "next";
import { loadPublicEvents } from "@/lib/booking/data";
import { getLiveJobs } from "@/lib/careers/server";
import { hasJobDetail, jobPath } from "@/lib/careers/shared";
import { getAllPosts } from "@/lib/public-site/posts";
import { abs, STATIC_PAGES } from "@/lib/public-site/seo";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublishedTeam } from "@/lib/team/data";
import { isProtectedPath } from "@/lib/website/protected";

// Rebuilt at most hourly. Every data source fails soft so the sitemap always renders.
export const revalidate = 3600;

async function soft<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/** Published Frontend-Editor (CMS) pages that allow indexing. */
async function cmsPages(): Promise<{ slug: string; updated: string | null }[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("website_pages")
    .select("slug, published_at, no_index")
    .eq("status", "published")
    .is("deleted_at", null)
    .limit(500);
  if (error) throw error;
  return ((data ?? []) as { slug: string; published_at: string | null; no_index: boolean | null }[])
    .filter((r) => !r.no_index && r.slug && !isProtectedPath(r.slug))
    .map((r) => ({ slug: r.slug, updated: r.published_at }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, events, jobs, team, cms] = await Promise.all([
    soft(getAllPosts, []),
    soft(loadPublicEvents, []),
    soft(getLiveJobs, []),
    soft(getPublishedTeam, []),
    soft(cmsPages, []),
  ]);

  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_PAGES.map((p) => ({
    url: abs(p.path),
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));

  for (const p of posts) {
    entries.push({ url: abs(`/resources/${p.slug}`), lastModified: new Date(p.date), changeFrequency: "yearly", priority: 0.6 });
  }
  for (const e of events) {
    entries.push({ url: abs(`/events/${e.slug}`), lastModified: e.updated_at ? new Date(e.updated_at) : now, changeFrequency: "weekly", priority: 0.6 });
  }
  for (const j of jobs) {
    if (!hasJobDetail(j)) continue;
    entries.push({ url: abs(jobPath(j.slug)), lastModified: j.updated_at ? new Date(j.updated_at) : now, changeFrequency: "weekly", priority: 0.5 });
  }
  for (const m of team) {
    entries.push({ url: abs(`/team/${m.slug}`), lastModified: now, changeFrequency: "monthly", priority: 0.6 });
  }

  for (const c of cms) {
    entries.push({ url: abs(`/${c.slug}`), lastModified: c.updated ? new Date(c.updated) : now, changeFrequency: "monthly", priority: 0.5 });
  }

  // De-duplicate (a CMS or static page could share a URL).
  const seen = new Set<string>();
  return entries.filter((e) => (seen.has(e.url) ? false : (seen.add(e.url), true)));
}
