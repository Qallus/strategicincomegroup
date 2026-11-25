import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hangUp, sendCallerToVoicemail } from "@/lib/twilio/conference";
import { readTwilioWebhook } from "@/lib/twilio/webhook";

// Conference mode only. Receives two kinds of callbacks:
//   * conference events (conference-start/end, participant-join/leave) from the <Conference> noun
//   * call-progress events for the legs we dial in via the Participants API (?leg=agent|customer)
// `call_sid` in the query is always the first leg (the calls row's twilio_call_sid).
const UNANSWERED = ["no-answer", "busy", "failed", "canceled"];

export async function POST(request: Request) {
  const intake = await readTwilioWebhook(request);
  if (!intake.ok) return intake.response;
  const { hook } = intake;

  try {
    const callSid = hook.url.searchParams.get("call_sid") ?? "";
    const leg = hook.url.searchParams.get("leg");
    if (!callSid) return NextResponse.json({ ok: true });

    const supabase = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const { data: call } = await supabase
      .from("calls")
      .select("id, answered_at, ended_at, agent_call_sid")
      .eq("twilio_call_sid", callSid)
      .maybeSingle();
    if (!call) return NextResponse.json({ ok: true });

    // ── Legs we dialled ──
    if (leg === "agent" || leg === "customer") {
      const status = hook.get("CallStatus");
      if (status === "in-progress" || status === "answered") {
        await supabase
          .from("calls")
          .update({
            status: "in-progress",
            ...(call.answered_at ? {} : { answered_at: now }),
            ...(leg === "agent" ? { agent_call_sid: hook.get("CallSid") || call.agent_call_sid } : {}),
            updated_at: now,
          })
          .eq("id", call.id);
      } else if (UNANSWERED.includes(status) && !call.answered_at) {
        if (leg === "agent") {
          // Nobody picked up — same voicemail as the classic flow.
          await sendCallerToVoicemail(callSid);
        } else {
          await supabase.from("calls").update({ status, ended_at: now, updated_at: now }).eq("id", call.id);
          await hangUp(call.agent_call_sid ?? callSid);
        }
      }
      return NextResponse.json({ ok: true });
    }

    // ── Conference events ──
    const event = hook.get("StatusCallbackEvent");
    const conferenceSid = hook.get("ConferenceSid");
    if (event === "conference-start" && conferenceSid) {
      await supabase.from("calls").update({ conference_sid: conferenceSid, updated_at: now }).eq("id", call.id);
      await supabase.from("call_monitor_sessions").update({ conference_sid: conferenceSid }).eq("call_id", call.id).is("conference_sid", null);
    } else if (event === "conference-end") {
      await supabase.from("call_monitor_sessions").update({ ended_at: now }).eq("call_id", call.id).is("ended_at", null);
    } else if (event === "participant-leave") {
      const leftSid = hook.get("CallSid");
      if (leftSid) await supabase.from("call_monitor_sessions").update({ ended_at: now }).eq("monitor_call_sid", leftSid).is("ended_at", null);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Conference status webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}
