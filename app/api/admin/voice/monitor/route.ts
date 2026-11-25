import { NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/user-management/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCommunicationSettings, isMissingRelation } from "@/lib/twilio/settings";
import { formatPhone, phoneKey, smsDirectoryByPhone } from "@/lib/sms/contacts";
import { commsError } from "@/lib/twilio/http";

export const dynamic = "force-dynamic";

const LIVE_WINDOW_MS = 4 * 60 * 60 * 1000;
const TERMINAL = ["completed", "failed", "no-answer", "busy", "canceled"];

/**
 * Live calls + open monitor sessions (Super Admin / Admin). Also `monitoredToday`, the
 * number of monitor sessions started since midnight UTC (for the "Monitored" stat).
 */
export async function GET(request: Request) {
  try {
    await requireAdminManager(request);
    const supabase = createSupabaseAdminClient();
    const settings = await getCommunicationSettings({ fresh: true });
    const since = new Date(Date.now() - LIVE_WINDOW_MS).toISOString();

    const base = "id, twilio_call_sid, direction, from_number, to_number, status, started_at, answered_at, created_at";
    let live = await supabase
      .from("calls")
      .select(`${base}, conference_name, conference_sid, agent_call_sid`)
      .is("ended_at", null)
      .gte("created_at", since)
      .not("status", "in", `(${TERMINAL.join(",")})`)
      .order("created_at", { ascending: false })
      .limit(50);
    let available = true;
    if (live.error && isMissingRelation(live.error)) {
      available = false;
      live = (await supabase
        .from("calls")
        .select(base)
        .is("ended_at", null)
        .gte("created_at", since)
        .not("status", "in", `(${TERMINAL.join(",")})`)
        .order("created_at", { ascending: false })
        .limit(50)) as typeof live;
    }
    if (live.error) throw live.error;

    const directory = await smsDirectoryByPhone().catch(() => new Map());
    const calls = (live.data ?? []).map((c: Record<string, any>) => {
      const number = c.direction === "inbound" ? c.from_number : c.to_number;
      const match = directory.get(phoneKey(number));
      return {
        id: c.id,
        direction: c.direction,
        number,
        numberDisplay: formatPhone(number),
        contactName: match?.name ?? null,
        status: c.status,
        startedAt: c.started_at ?? c.created_at,
        answeredAt: c.answered_at,
        monitorable: Boolean(settings.voiceConferenceMode && c.conference_name && c.answered_at),
        hasConference: Boolean(c.conference_name),
      };
    });

    let sessions: Record<string, any>[] = [];
    let monitoredToday = 0;
    if (available) {
      const midnight = new Date();
      midnight.setUTCHours(0, 0, 0, 0);
      const [open, today] = await Promise.all([
        supabase.from("call_monitor_sessions").select("id, call_id, mode, monitor_profile_id, started_at, monitor_call_sid").is("ended_at", null).gte("started_at", since),
        supabase.from("call_monitor_sessions").select("id", { count: "exact", head: true }).gte("started_at", midnight.toISOString()),
      ]);
      sessions = open.data ?? [];
      monitoredToday = today.count ?? 0;
    }

    return NextResponse.json({ conferenceMode: settings.voiceConferenceMode, available, calls, sessions, monitoredToday });
  } catch (error) {
    return commsError(error, "Failed to load live calls.");
  }
}

/** Start a monitor session: { callId, mode }. The browser then dials in with { monitorSession }. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const actor = await requireAdminManager(request, body.actionToken);
    const mode = ["listen", "whisper", "barge"].includes(body.mode) ? body.mode : "listen";
    const callId = String(body.callId ?? "");
    const settings = await getCommunicationSettings({ fresh: true });
    if (!settings.voiceConferenceMode) throw new Error("Turn on Conference mode (Dialer → Settings) to monitor calls.");

    const supabase = createSupabaseAdminClient();
    const { data: call, error } = await supabase
      .from("calls")
      .select("id, conference_name, conference_sid, agent_call_sid, ended_at, answered_at")
      .eq("id", callId)
      .maybeSingle();
    if (error) throw new Error(isMissingRelation(error) ? "Run the communications migration first." : error.message);
    if (!call || call.ended_at) throw new Error("That call has ended.");
    if (!call.conference_name) throw new Error("This call started before Conference mode was on, so it can't be monitored.");
    if (!call.answered_at) throw new Error("Wait until the call is answered.");
    if (mode === "whisper" && !call.agent_call_sid) throw new Error("Whisper isn't available for this call yet. Try Listen.");

    const { data: session, error: insErr } = await supabase
      .from("call_monitor_sessions")
      .insert({ call_id: call.id, conference_sid: call.conference_sid, conference_name: call.conference_name, monitor_profile_id: actor.id, mode })
      .select("id, mode")
      .single();
    if (insErr) throw new Error(insErr.message);
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    return commsError(error, "Could not start monitoring.", 400);
  }
}
