#!/usr/bin/env node
// Snapshot the published WordPress posts from strategicincomegroup.com into
// lib/public-site/content/wp-posts.json so the Resources archive renders real
// articles before the Phase 7 import moves them into the blog_posts table.
//
//   node scripts/snapshot-wp-posts.mjs
//
// The HTML is sanitised for our theme: <style>/<script>, inline styles, classes,
// comments and event handlers are stripped so posts follow light/dark mode via
// the `prose` styles instead of the hard-coded WordPress colours.

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const SITE = "https://strategicincomegroup.com";
const OUT = path.join(process.cwd(), "lib", "public-site", "content", "wp-posts.json");

const decode = (s = "") =>
  s
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8220;|&ldquo;/g, "“")
    .replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&#8230;|&hellip;/g, "…")
    .replace(/&#038;|&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

const text = (html = "") => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

function sanitize(html = "") {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(style|script|noscript|form|button|input|select|textarea)[\s\S]*?<\/\1>/gi, "")
    .replace(/<(input|link|meta)[^>]*>/gi, "")
    .replace(/<iframe[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/iframe>/gi, (m, src) =>
      /youtube\.com|youtube-nocookie\.com|player\.vimeo\.com/.test(src)
        ? `<iframe src="${src}" loading="lazy" allowfullscreen title="Embedded video"></iframe>`
        : "",
    )
    .replace(/\s(style|class|id|width|height|align|bgcolor|border|cellpadding|cellspacing|data-[\w-]+|on\w+)="[^"]*"/gi, "")
    .replace(/\s(style|class|id|on\w+)='[^']*'/gi, "")
    .replace(/<a\s+([^>]*?)href="(https?:\/\/[^"]+)"([^>]*)>/gi, (m, a, href, b) =>
      href.startsWith(SITE)
        ? `<a href="${href.replace(SITE, "").replace(/^\/(?!resources|team|contact|services)([\w-]+)\/$/, "/resources/$1")}">`
        : `<a href="${href}" target="_blank" rel="noopener noreferrer">`,
    )
    .replace(/<(div|span|section|article|header|footer|main|aside)[^>]*>/gi, "")
    .replace(/<\/(div|span|section|article|header|footer|main|aside)>/gi, "")
    .replace(/<p>\s*(&nbsp;)?\s*<\/p>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function main() {
  const [postsRes, catsRes] = await Promise.all([
    fetch(`${SITE}/wp-json/wp/v2/posts?per_page=100&_embed=wp:featuredmedia`),
    fetch(`${SITE}/wp-json/wp/v2/categories?per_page=100`),
  ]);
  if (!postsRes.ok) throw new Error(`posts: HTTP ${postsRes.status}`);
  const posts = await postsRes.json();
  const cats = new Map((await catsRes.json()).map((c) => [c.id, { name: decode(c.name), slug: c.slug }]));

  const out = posts.map((p) => {
    const html = sanitize(p.content?.rendered);
    const words = text(html).split(" ").filter(Boolean).length;
    return {
      slug: p.slug,
      title: decode(p.title?.rendered),
      date: p.date,
      excerpt: text(p.excerpt?.rendered).replace(/\s*\[?…\]?\s*$/, "…"),
      categories: (p.categories ?? [])
        .map((id) => cats.get(id))
        .filter((c) => c && c.slug !== "uncategorized"),
      image: p._embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? null,
      readingMinutes: Math.max(1, Math.round(words / 230)),
      html,
    };
  });

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote ${out.length} posts to ${path.relative(process.cwd(), OUT)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
