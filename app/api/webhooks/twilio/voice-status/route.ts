import { NextResponse, after } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchCallPrice } from "@/lib/twilio/client";
import { alertIfMissed } from "@/lib/twilio/missed-calls";
import { hangUp } from "@/lib/twilio/conference";
import { escapeXml, readTwilioWebhook, twimlResponse } from "@/lib/twilio/webhook";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Call status callback (phone number / TwiML App "Call status changes"), and also the
// `action` of the voicemail <Record>.
export async function POST(request: Request) {
  const intake = await readTwilioWebhook(request);
  if (!intake.ok) return intake.response;
  const { hook } = intake;

  // The voicemail <Record action> posts here when the caller finishes. Twilio expects TwiML
  // back (JSON made it announce "an application error has occurred"), and the call is still
  // in-progress — that must not be mistaken for an agent answering.
  const isRecordAction = Boolean(hook.get("RecordingUrl")) && !hook.get("CallDuration");
  if (isRecordAction) {
    try {
      const callSid = hook.get("CallSid");
      const supabase = createSupabaseAdminClient();
      const { data: call } = await supabase.from("calls").select("id, voicemail_url").eq("twilio_call_sid", callSid).maybeSingle();
      if (call && !call.voicemail_url) {
        await supabase
          .from("calls")
          .update({ voicemail_sid: hook.get("RecordingSid") || null, voicemail_url: `${hook.get("RecordingUrl")}.mp3`, updated_at: new Date().toISOString() })
          .eq("id", call.id);
      }
    } catch (error) {
      console.error("Voicemail action error:", error);
    }
    return twimlResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">${escapeXml("Thank you. Goodbye.")}</Say><Hangup/></Response>`,
    );
  }

  try {
    const callSid = hook.get("CallSid");
    const callStatus = hook.get("CallStatus");
    const duration = hook.get("CallDuration") ? parseInt(hook.get("CallDuration"), 10) : null;

    if (!callSid) return NextResponse.json({ ok: true });

    const supabase = createSupabaseAdminClient();
    const update: Record<string, unknown> = { status: callStatus, updated_at: new Date().toISOString() };
    if (duration !== null && !Number.isNaN(duration)) update.duration_seconds = duration;
    const isTerminal = ["completed", "failed", "no-answer", "busy", "canceled"].includes(callStatus);
    if (isTerminal) {
      update.ended_at = new Date().toISOString();
      // Twilio populates price asynchronously; this often returns null right at
      // call end and gets backfilled later by the calls list endpoint.
      const priceInfo = await fetchCallPrice(callSid);
      if (priceInfo) {
        update.price = priceInfo.price;
        update.price_unit = priceInfo.priceUnit;
      }
    }
    if (callStatus === "in-progress") {
      update.answered_at = new Date().toISOString();
    }

    await supabase.from("calls").update(update).eq("twilio_call_sid", callSid);

    if (isTerminal) {
      // Conference mode: a caller who hangs up while on hold must stop the softphone ringing.
      const { data: leg, error: legError } = await supabase
        .from("calls")
        .select("direction, answered_at, agent_call_sid")
        .eq("twilio_call_sid", callSid)
        .maybeSingle();
      if (!legError && leg?.direction === "inbound" && !leg.answered_at && leg.agent_call_sid) {
        await hangUp(leg.agent_call_sid);
      }

      // Give the recording callback (which proves an answered call) time to land first.
      after(async () => {
        await sleep(20_000);
        await alertIfMissed(callSid).catch((e) => console.error("[missed-call] alert failed", e));
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Voice status webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}
