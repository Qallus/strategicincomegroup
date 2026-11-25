import { NextResponse } from "next/server";
import { requireActiveProfile } from "@/lib/user-management/auth";
import { viewerFromApiProfile } from "@/lib/dashboard/viewer";
import { getFeed, markRead } from "@/lib/notifications/feed";

// The signed-in user's notifications feed.
//   GET  ?limit=10&unread=1&alerts=1&severity=warning|critical
//   POST { action: "mark_read", ids: [] } | { action: "mark_unread", ids: [] } | { action: "mark_all_read" }

export const dynamic = "force-dynamic";

function fail(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = /authentication|profile required/i.test(message) ? 401 : 500;
  return NextResponse.json({ error: status === 401 ? message : fallback }, { status });
}

export async function GET(request: Request) {
  try {
    const me = await requireActiveProfile(request);
    const viewer = await viewerFromApiProfile(me);
    const sp = new URL(request.url).searchParams;
    const severity = sp.get("severity");
    const feed = await getFeed(viewer, {
      limit: Number(sp.get("limit")) || 10,
      unreadOnly: sp.get("unread") === "1",
      alertsOnly: sp.get("alerts") === "1",
      minSeverity: severity === "warning" || severity === "critical" ? severity : undefined,
    });
    return NextResponse.json(feed, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error, "Unable to load notifications.");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const me = await requireActiveProfile(request, body.actionToken);
    const viewer = await viewerFromApiProfile(me);
    const action = String(body.action ?? "");
    const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)) : [];
    if (action === "mark_all_read") return NextResponse.json({ ok: true, updated: await markRead(viewer, "all") });
    if (action === "mark_read" || action === "mark_unread") {
      if (!ids.length) return NextResponse.json({ error: "ids are required." }, { status: 400 });
      return NextResponse.json({ ok: true, updated: await markRead(viewer, ids, action === "mark_read") });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return fail(error, "Unable to update notifications.");
  }
}
