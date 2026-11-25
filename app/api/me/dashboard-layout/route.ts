import { NextResponse } from "next/server";
import { requireActiveProfile } from "@/lib/user-management/auth";
import { viewerFromApiProfile } from "@/lib/dashboard/viewer";
import { getDashboardPrefs, resetLayout, saveLayout, setGetStartedDismissed, setWhatsNewDismissed } from "@/lib/dashboard/layout";

// The signed-in user's dashboard layout (user_preferences.dashboard_preferences.dashboard_layout).
//   GET                                   → { layout, whatsNewDismissed, getStartedDismissed, customized }
//   PUT  { layout }                       → saves (validated against the registry + permissions)
//   POST { action: "reset", mode }        → Standard or Blank preset
//   POST { action: "dismiss_whats_new", id, dismissed? }
//   POST { action: "dismiss_get_started", dismissed? }

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
    return NextResponse.json(await getDashboardPrefs(viewer), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error, "Unable to load your dashboard.");
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const me = await requireActiveProfile(request, body.actionToken);
    const viewer = await viewerFromApiProfile(me);
    if (!body.layout || typeof body.layout !== "object") return NextResponse.json({ error: "layout is required." }, { status: 400 });
    if (JSON.stringify(body.layout).length > 200_000) return NextResponse.json({ error: "Layout is too large." }, { status: 413 });
    const layout = await saveLayout(viewer, body.layout);
    return NextResponse.json({ ok: true, layout });
  } catch (error) {
    return fail(error, "Unable to save your dashboard.");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const me = await requireActiveProfile(request, body.actionToken);
    const action = String(body.action ?? "");
    if (action === "reset") {
      const viewer = await viewerFromApiProfile(me);
      const layout = await resetLayout(viewer, body.mode === "blank" ? "blank" : "standard");
      return NextResponse.json({ ok: true, layout });
    }
    if (action === "dismiss_whats_new") {
      const id = String(body.id ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "id is required." }, { status: 400 });
      const dismissed = await setWhatsNewDismissed(me.id, id, body.dismissed !== false);
      return NextResponse.json({ ok: true, whatsNewDismissed: dismissed });
    }
    if (action === "dismiss_get_started") {
      await setGetStartedDismissed(me.id, body.dismissed !== false);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return fail(error, "Unable to update your dashboard.");
  }
}
