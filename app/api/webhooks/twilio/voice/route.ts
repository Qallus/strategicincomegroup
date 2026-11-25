import { after } from "next/server";
import twilio from "twilio";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildInboundCallTwiml, buildOutboundCallTwiml } from "@/lib/twilio/voice";
import { getCommunicationSettings } from "@/lib/twilio/settings";
import {
  MONITOR_IDENTITY_PREFIX,
  buildInboundConferenceTwiml,
  buildMonitorTwiml,
  buildOutboundConferenceTwiml,
  conferenceNameFor,
  dialAgentIntoConference,
  dialCustomerIntoConference,
  type MonitorMode,
} from "@/lib/twilio/conference";
import { readTwilioWebhook, twimlResponse } from "@/lib/twilio/webhook";

// Voice webhook — the phone number's "A call comes in" URL and the TwiML App's Voice URL.
//
// Three paths:
//   1. Monitor leg: an admin's browser (client:sig-monitor-<profile>) joining a live call.
//   2. Conference mode ON: the call is placed in a per-call Twilio Conference.
//   3. Conference mode OFF (default): the original <Dial> flow, unchanged.
export async function POST(request: Request) {
  const intake = await readTwilioWebhook(request, { reject: "twiml" });
  if (!intake.ok) return intake.response;
  const { hook } = intake;

  try {
    const callSid = hook.get("CallSid");
    const from = hook.get("From");
    const to = hook.get("To");
    const direction = hook.get("Direction") || "inbound";
    const monitorSession = hook.get("monitorSession");

    if (monitorSession && from.startsWith(`client:${MONITOR_IDENTITY_PREFIX}`)) {
      return twimlResponse(await monitorTwiml(monitorSession, from, callSid));
    }

    const settings = await getCommunicationSettings();
    const conference = settings.voiceConferenceMode;

    // Outbound calls from the browser client: Direction=outbound-api, From=client:identity
    const isOutbound = direction === "outbound-api" || from.startsWith("client:");
    if (isOutbound) {
      const supabase = createSupabaseAdminClient();
      await supabase.from("calls").insert({
        twilio_call_sid: callSid,
        direction: "outbound",
        from_number: from,
        to_number: to,
        status: "initiated",
        started_at: new Date().toISOString(),
      });
      if (conference && to) {
        await supabase.from("calls").update({ conference_name: conferenceNameFor(callSid), agent_call_sid: callSid }).eq("twilio_call_sid", callSid);
        after(() => dialCustomerIntoConference(callSid, to));
        return twimlResponse(buildOutboundConferenceTwiml(callSid));
      }
      const twiml = await buildOutboundCallTwiml(to);
      return twimlResponse(twiml);
    }

    // Inbound call from external caller
    const supabase = createSupabaseAdminClient();

    const { data: participant } = await supabase
      .from("participants")
      .select("id")
      .or(`phone.eq.${from},phone.eq.+${from.replace(/\D/g, "")}`)
      .maybeSingle();

    const { data: profile } = !participant
      ? await supabase
          .from("profiles")
          .select("id")
          .or(`phone.eq.${from},phone.eq.+${from.replace(/\D/g, "")}`)
          .maybeSingle()
      : { data: null };

    await supabase.from("calls").insert({
      twilio_call_sid: callSid,
      direction: "inbound",
      from_number: from,
      to_number: to,
      status: "ringing",
      participant_id: participant?.id ?? null,
      profile_id: profile?.id ?? null,
      started_at: new Date().toISOString(),
    });

    if (conference) {
      await supabase.from("calls").update({ conference_name: conferenceNameFor(callSid) }).eq("twilio_call_sid", callSid);
      after(() => dialAgentIntoConference(callSid, from));
      return twimlResponse(buildInboundConferenceTwiml(callSid));
    }

    const twiml = await buildInboundCallTwiml(from);
    return twimlResponse(twiml);
  } catch (error) {
    console.error("Voice webhook error:", error);
    const resp = new twilio.twiml.VoiceResponse();
    resp.say("We are experiencing technical difficulties. Please try again later.");
    return twimlResponse(resp.toString());
  }
}

/** An admin joining a live conference. The session row was created by /api/admin/voice/monitor. */
async function monitorTwiml(sessionId: string, from: string, monitorCallSid: string): Promise<string> {
  const reject = () => {
    const r = new twilio.twiml.VoiceResponse();
    r.say("This monitoring session is no longer available.");
    r.hangup();
    return r.toString();
  };
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return reject();

  const supabase = createSupabaseAdminClient();
  const { data: session } = await supabase
    .from("call_monitor_sessions")
    .select("id, call_id, mode, monitor_profile_id, monitor_call_sid, started_at, ended_at, conference_name")
    .eq("id", sessionId)
    .maybeSingle();
  // The session must be fresh, unused, still open, and belong to the identity dialling in.
  const fresh = session && Date.now() - new Date(session.started_at).getTime() < 2 * 60_000;
  if (!session || session.ended_at || session.monitor_call_sid || !fresh || from !== `client:${MONITOR_IDENTITY_PREFIX}${session.monitor_profile_id}`) {
    return reject();
  }

  const { data: call } = await supabase.from("calls").select("conference_name, conference_sid, agent_call_sid, ended_at").eq("id", session.call_id).maybeSingle();
  if (!call?.conference_name || call.ended_at) return reject();

  await supabase
    .from("call_monitor_sessions")
    .update({ monitor_call_sid: monitorCallSid, conference_sid: call.conference_sid ?? null, conference_name: call.conference_name })
    .eq("id", session.id);

  return buildMonitorTwiml(call.conference_name, session.mode as MonitorMode, call.agent_call_sid ?? null);
}
