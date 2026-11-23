import { knownBot } from "@/lib/analytics/bots";
import { cleanPath, isMissingRelation, NON_PUBLIC_PATH, rateLimited } from "@/lib/analytics/collect";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Counts AI-crawler / search-bot page hits into analytics_bot_hits. Called
// fire-and-forget by middleware.ts with the crawler's own user agent; the bot is
// re-identified here, so a caller can only ever count a hit for the UA it presents
// (no more than crawling the page with that UA would). Always 204.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const done = () => new Response(null, { status: 204 });
let tableMissingUntil = 0;

export async function POST(request: Request) {
  try {
    if (Date.now() < tableMissingUntil) return done();
    const bot = knownBot(request.headers.get("x-sig-bot-ua") || request.headers.get("user-agent"));
    if (!bot) return done();
    const body = (await request.json().catch(() => null)) as { path?: unknown } | null;
    const path = cleanPath(body?.path);
    if (!path || (NON_PUBLIC_PATH.test(path) && path !== "/")) return done();
    // Generous ceiling per bot so a runaway crawler can't hammer the database.
    if (rateLimited(`bot:${bot.name}`, 600)) return done();

    const { error } = await createSupabaseAdminClient().rpc("analytics_bot_hit", { p_bot: bot.name, p_path: path });
    // Before the migration is applied, back off for 10 minutes instead of failing every crawl.
    if (error && isMissingRelation(error)) tableMissingUntil = Date.now() + 10 * 60 * 1000;
  } catch {
    /* never surface */
  }
  return done();
}
