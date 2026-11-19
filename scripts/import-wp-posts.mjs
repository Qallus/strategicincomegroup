#!/usr/bin/env node
// Import the WordPress article snapshot into the dashboard's blog tables so every
// post can be edited, unpublished or deleted from Dashboard → Content → Blog Posts.
//
//   node scripts/import-wp-posts.mjs --dry-run   # show what would change
//   node scripts/import-wp-posts.mjs             # import (idempotent: skips slugs that exist)
//   node scripts/import-wp-posts.mjs --replace-mjg-categories
//                                                # also delete the MJG fork's 3 unused categories
//
// Reads lib/public-site/content/wp-posts.json (refresh it with scripts/snapshot-wp-posts.mjs).
// Uses DATABASE_URL from .env.local. Runs in one transaction.

import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const DRY = process.argv.includes("--dry-run");
const DROP_MJG = process.argv.includes("--replace-mjg-categories");
const MJG_CATEGORIES = ["stewardship-blueprint", "created-for-more", "faith-and-work"];

// Same cleanup the public site applies at render time (lib/public-site/posts.ts → cleanPostHtml).
function cleanPostHtml(html) {
  return html
    .replace(/<h2>\s*Schedule Online\s*<\/h2>\s*<p>\s*Meet with a Certified[^<]*<\/p>/gi, "")
    .replace(/<a\s[^>]*href="[^"]*fluent-booking[^"]*"[^>]*>[\s\S]*?<\/a>/gi, "")
    .replace(/<img[^>]*(?:Round-Compressed|white-background|Head-Shot|Profile-Photo)[^>]*>[^<]*/gi, "")
    .replace(/<p>\s*Prefer to call\?[\s\S]*?<\/p>/gi, "")
    .replace(/(\s*\n){3,}/g, "\n\n");
}

const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set in .env.local");
  const posts = JSON.parse(readFileSync(path.join(process.cwd(), "lib/public-site/content/wp-posts.json"), "utf8"));
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const existing = new Set((await client.query("select slug from public.blog_posts")).rows.map((r) => r.slug));
  const todo = posts.filter((p) => !existing.has(p.slug));
  const categories = new Map();
  for (const p of posts) for (const c of p.categories) categories.set(c.slug, c.name);

  console.log(`${posts.length} posts in snapshot · ${existing.size} already in blog_posts · ${todo.length} to import`);
  console.log(`${categories.size} categories: ${[...categories.values()].join(" | ")}`);
  if (DROP_MJG) console.log(`Will delete unused MJG categories: ${MJG_CATEGORIES.join(", ")}`);
  if (DRY) {
    await client.end();
    console.log("Dry run — nothing written.");
    return;
  }

  try {
    await client.query("begin");
    const catId = new Map();
    for (const [slug, name] of categories) {
      const { rows } = await client.query(
        `insert into public.blog_post_categories (name, slug) values ($1, $2)
         on conflict (slug) do update set name = excluded.name, updated_at = now()
         returning id`,
        [name, slug],
      );
      catId.set(slug, rows[0].id);
    }

    for (const p of todo) {
      const html = cleanPostHtml(p.html);
      const primary = p.categories[0]?.slug;
      const { rows } = await client.query(
        `insert into public.blog_posts
           (title, slug, excerpt, content_html, content_text, author_name, category_id, featured_image_url,
            status, publish_at, deployed_at, metadata, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'published',$9,$9,$10,$9,now())
         on conflict (slug) do nothing
         returning id`,
        [
          p.title, p.slug, p.excerpt, html, text(html), "Strategic Income Group", primary ? catId.get(primary) : null, p.image,
          new Date(p.date).toISOString(),
          JSON.stringify({ source: "wordpress", wp_categories: p.categories.map((c) => c.slug), imported_at: new Date().toISOString() }),
        ],
      );
      // Extra WordPress categories become tags so nothing is lost.
      if (rows[0] && p.categories.length > 1) {
        for (const c of p.categories.slice(1)) {
          const tag = await client.query(
            `insert into public.blog_post_tags (name, slug) values ($1, $2)
             on conflict (slug) do update set name = excluded.name returning id`,
            [c.name, c.slug],
          );
          await client.query(`insert into public.blog_post_tag_links (post_id, tag_id) values ($1, $2) on conflict do nothing`, [rows[0].id, tag.rows[0].id]);
        }
      }
    }

    if (DROP_MJG) {
      await client.query(
        `delete from public.blog_post_categories c
          where c.slug = any($1) and not exists (select 1 from public.blog_posts p where p.category_id = c.id)`,
        [MJG_CATEGORIES],
      );
    }
    await client.query("commit");
    console.log(`Imported ${todo.length} posts.`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
