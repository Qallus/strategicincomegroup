import { NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/user-management/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hangUp, setMonitorMode, type MonitorMode } from "@/lib/twilio/conference";
import { commsError } from "@/lib/twilio/http";

export const dynamic = "force-dynamic";

async function loadSession(id: string, actorId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: session } = await supabase
    .from("call_monitor_sessions")
    .select("id, call_id, mode, monitor_profile_id, monitor_call_sid, conference_sid, conference_name, ended_at")
    .eq("id", id)
    .maybeSingle();
  if (!session) throw new Error("Monitor session not found.");
  if (session.monitor_profile_id !== actorId) throw new Error("Only the admin who started this session can change it.");
  return { supabase, session };
}

/** Switch mode: { mode: "listen" | "whisper" | "barge" }. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json().catch(() => ({}));
    const actor = await requireAdminManager(request, body.actionToken);
    const { id } = await params;
    const mode = body.mode as MonitorMode;
    if (!["listen", "whisper", "barge"].includes(mode)) throw new Error("Unknown mode.");
    const { supabase, session } = await loadSession(id, actor.id);
    if (session.ended_at) throw new Error("This session has ended.");

    if (session.monitor_call_sid) {
      const { data: call } = await supabase.from("calls").select("conference_sid, conference_name, agent_call_sid").eq("id", session.call_id).maybeSingle();
      const conference = call?.conference_sid || session.conference_sid || call?.conference_name || session.conference_name;
      if (!conference) throw new Error("The conference for this call isn't known yet.");
      await setMonitorMode(conference, session.monitor_call_sid, mode, call?.agent_call_sid ?? null);
    }
    await supabase.from("call_monitor_sessions").update({ mode }).eq("id", id);
    return NextResponse.json({ ok: true, mode });
  } catch (error) {
    return commsError(error, "Could not change mode.", 400);
  }
}

/** Leave the call. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdminManager(request, request.headers.get("x-sig-action-token"));
    const { id } = await params;
    const { supabase, session } = await loadSession(id, actor.id);
    if (!session.ended_at) {
      await supabase.from("call_monitor_sessions").update({ ended_at: new Date().toISOString() }).eq("id", id);
      await hangUp(session.monitor_call_sid);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return commsError(error, "Could not end the session.", 400);
  }
}
