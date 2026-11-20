import { NextResponse } from "next/server";
import { getAllPosts } from "@/lib/public-site/posts";
import { teamSearchEntries, type SearchEntry } from "@/lib/public-site/search-index";
import { getPublishedTeam } from "@/lib/team/data";

export const revalidate = 300;

// Articles + the live team roster for the header search dropdown (pages/careers are
// bundled client-side; the bundled static team entries are replaced by these).
export async function GET() {
  const [posts, team] = await Promise.all([getAllPosts(), getPublishedTeam()]);
  const entries: SearchEntry[] = posts.map((p) => {
    const cats = p.categories.map((c) => c.name).join(" ");
    const isRetirement = /^30\d|retire/i.test(cats);
    const isInvesting = /^20\d|invest/i.test(cats);
    return {
      title: p.title,
      description: p.excerpt.slice(0, 120),
      href: `/resources/${p.slug}`,
      category: isRetirement ? "retirement" : isInvesting ? "investing" : "resources",
      icon: "book",
      keywords: `article blog ${cats}`,
    };
  });
  entries.push(...teamSearchEntries(team));
  return NextResponse.json(entries, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } });
}
