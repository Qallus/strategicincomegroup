import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/server";
import { runAnalyticsSync } from "@/lib/analytics/server";
import { can, PERMISSIONS } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Analytics cron. Called by Coolify scheduled tasks (scripts/analytics-cron.mjs) with
 * CRON_SECRET, or manually by a signed-in user with View Reports.
 *
 *   ?mode=intraday  (every 15 min)  rebuild today's rollup
 *   ?mode=nightly   (2am Arizona)   rebuild yesterday + today, purge raw data older than 13 months
 *
 * Phase 2+ source syncs (Search Console, Business Profile, Meta, LinkedIn) will run
 * here before the rollup in nightly mode.
 */
async function handle(request: Request) {
  const url = new URL(request.url);
  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const secret = process.env.CRON_SECRET;
  const presented =
    request.headers.get("x-cron-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    (typeof body.secret === "string" ? body.secret : "");

  if (!(secret && presented && presented === secret)) {
    const profile = await getCurrentProfile();
    if (!profile) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!can(profile.role, PERMISSIONS.VIEW_REPORTS)) return NextResponse.json({ error: "You don't have permission to run analytics sync." }, { status: 403 });
  }

  const raw = String(url.searchParams.get("mode") || body.mode || "intraday");
  const mode = raw === "nightly" ? "nightly" : "intraday";
  const result = await runAnalyticsSync(mode);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function POST(request: Request) {
  try {
    return await handle(request);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Analytics sync failed." }, { status: 500 });
  }
}
