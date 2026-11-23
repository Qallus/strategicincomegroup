import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { siteUrl } from "@/lib/public-site/seo";

// Public pages are open to search engines and AI assistants (SIG wants to be found
// and cited); the dashboard, API and editor preview are not. The preview host is
// closed entirely so it never competes with the live site.

const PRIVATE = ["/dashboard", "/api/", "/website-preview", "/auth/", "/oauth/", "/login", "/accept-invite", "/reset-password", "/two-factor", "/access-restricted", "/book/manage"];

// AI crawlers SIG explicitly welcomes (search + citation agents and training crawlers).
const AI_AGENTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended"];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = ((await headers()).get("x-forwarded-host") || (await headers()).get("host") || "").split(",")[0].trim().toLowerCase();
  if (host.startsWith("preview.")) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  const base = siteUrl();
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: AI_AGENTS, allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
