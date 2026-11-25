import { NextResponse } from "next/server";
import { requireActiveProfile } from "@/lib/user-management/auth";
import { viewerFromApiProfile } from "@/lib/dashboard/viewer";
import { runDataRequests } from "@/lib/dashboard/data";
import type { WidgetDataRequest } from "@/lib/dashboard/types";

// Batched widget data. Each key is permission-checked by its loader; a forbidden key comes
// back as { ok: false, status: 403 } inside the batch, and the whole response is 403 when
// every requested key was forbidden.
//   GET  ?keys=stat,weather&params={"stat":{"metric":"calls_missed"}}   (id = key)
//   POST { requests: [{ id, key, params }] }                             (used by the widgets)

export const dynamic = "force-dynamic";

function respond(results: Record<string, { ok: boolean; status?: number }>) {
  const values = Object.values(results);
  const allForbidden = values.length > 0 && values.every((r) => !r.ok && r.status === 403);
  return NextResponse.json({ results }, { status: allForbidden ? 403 : 200, headers: { "Cache-Control": "no-store" } });
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to load dashboard data.";
  const status = /authentication|profile required/i.test(message) ? 401 : 500;
  return NextResponse.json({ error: status === 401 ? message : "Unable to load dashboard data." }, { status });
}

export async function GET(request: Request) {
  try {
    const me = await requireActiveProfile(request);
    const viewer = await viewerFromApiProfile(me);
    const sp = new URL(request.url).searchParams;
    const keys = (sp.get("keys") ?? "").split(",").map((k) => k.trim()).filter(Boolean).slice(0, 30);
    if (!keys.length) return NextResponse.json({ error: "keys is required." }, { status: 400 });
    let params: Record<string, Record<string, unknown>> = {};
    try {
      params = JSON.parse(sp.get("params") || "{}");
    } catch {
      return NextResponse.json({ error: "params must be JSON." }, { status: 400 });
    }
    const requests: WidgetDataRequest[] = keys.map((key) => ({ id: key, key, params: params?.[key] ?? {} }));
    return respond(await runDataRequests(viewer, requests));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const me = await requireActiveProfile(request, body.actionToken);
    const viewer = await viewerFromApiProfile(me);
    const requests = Array.isArray(body.requests) ? (body.requests as WidgetDataRequest[]) : [];
    if (!requests.length) return NextResponse.json({ error: "requests is required." }, { status: 400 });
    return respond(await runDataRequests(viewer, requests));
  } catch (error) {
    return fail(error);
  }
}
