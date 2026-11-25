import { NextResponse } from "next/server";
import { requireActiveProfile, requireSuperAdmin } from "@/lib/user-management/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { viewerFromApiProfile } from "@/lib/dashboard/viewer";
import { loadWhatsNew } from "@/lib/dashboard/data/insights";

// What's new updates.
//   GET                                   → items for the viewer's audience (+ their dismissals)
//   POST   { title, body, imageUrl?, link?, audience? }   super admin only
//   DELETE ?id=                           super admin only

export const dynamic = "force-dynamic";

const AUDIENCES = new Set(["everyone", "staff", "admins"]);

function fail(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  if (/authentication|profile required/i.test(message)) return NextResponse.json({ error: message }, { status: 401 });
  if (/permission|super admin/i.test(message)) return NextResponse.json({ error: "Only super admins can post updates." }, { status: 403 });
  if (/relation .* does not exist|could not find the table/i.test(message)) {
    return NextResponse.json({ error: "Run the dashboard migration (202611250220_dashboard.sql) to enable What's new." }, { status: 503 });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

function cleanUrl(v: unknown, { relative = false } = {}): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (relative && s.startsWith("/") && !s.startsWith("//")) return s.slice(0, 1000);
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString().slice(0, 1000) : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const me = await requireActiveProfile(request);
    return NextResponse.json(await loadWhatsNew(await viewerFromApiProfile(me)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error, "Unable to load updates.");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const actor = await requireSuperAdmin(request, body.actionToken);
    const title = String(body.title ?? "").trim().slice(0, 160);
    const text = String(body.body ?? "").trim().slice(0, 5000);
    if (!title) return NextResponse.json({ error: "A title is required." }, { status: 400 });
    const audience = AUDIENCES.has(body.audience) ? body.audience : "everyone";
    const { data, error } = await createSupabaseAdminClient()
      .from("whats_new")
      .insert({ title, body: text, image_url: cleanUrl(body.imageUrl), link: cleanUrl(body.link, { relative: true }), audience, created_by: actor.id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, id: data.id });
  } catch (error) {
    return fail(error, "Unable to post the update.");
  }
}

export async function DELETE(request: Request) {
  try {
    await requireSuperAdmin(request);
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "id is required." }, { status: 400 });
    const { error } = await createSupabaseAdminClient().from("whats_new").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error, "Unable to delete the update.");
  }
}
