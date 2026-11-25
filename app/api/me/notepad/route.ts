import { NextResponse } from "next/server";
import { requireActiveProfile } from "@/lib/user-management/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// The Notepad widget's personal notes (table user_notepads; RLS = own rows, and every
// query here is additionally filtered by the signed-in user's id).
//   GET  ?id=        → { note } (the given note, else the most recent one, else null)
//   PUT  { id?, title?, body }  → upsert, returns { note }

export const dynamic = "force-dynamic";

const MISSING = /relation .* does not exist|could not find the table|PGRST205|42P01/i;

function fail(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  if (/authentication|profile required/i.test(message)) return NextResponse.json({ error: message }, { status: 401 });
  if (MISSING.test(message)) return NextResponse.json({ error: "Notes need the dashboard migration (202611250220_dashboard.sql).", migrationMissing: true }, { status: 503 });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const me = await requireActiveProfile(request);
    const id = new URL(request.url).searchParams.get("id");
    let q = createSupabaseAdminClient().from("user_notepads").select("id, title, body, updated_at").eq("user_id", me.id);
    q = id && /^[0-9a-f-]{36}$/i.test(id) ? q.eq("id", id) : q.order("updated_at", { ascending: false });
    const { data, error } = await q.limit(1);
    if (error) throw new Error(`${error.code ?? ""} ${error.message}`);
    return NextResponse.json({ note: data?.[0] ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error, "Unable to load your notes.");
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const me = await requireActiveProfile(request, body.actionToken);
    const text = String(body.body ?? "").slice(0, 50000);
    const title = String(body.title ?? "Notes").trim().slice(0, 120) || "Notes";
    const sb = createSupabaseAdminClient();
    const now = new Date().toISOString();
    if (typeof body.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id)) {
      const { data, error } = await sb.from("user_notepads").update({ body: text, title, updated_at: now }).eq("id", body.id).eq("user_id", me.id).select("id, title, body, updated_at").maybeSingle();
      if (error) throw new Error(`${error.code ?? ""} ${error.message}`);
      if (data) return NextResponse.json({ note: data });
    }
    const { data, error } = await sb.from("user_notepads").insert({ user_id: me.id, title, body: text }).select("id, title, body, updated_at").single();
    if (error) throw new Error(`${error.code ?? ""} ${error.message}`);
    return NextResponse.json({ note: data });
  } catch (error) {
    return fail(error, "Unable to save your notes.");
  }
}
