import twilio from "twilio";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTwilioClient, getTwilioConfig } from "@/lib/twilio/client";
import { appBaseUrl } from "@/lib/twilio/webhook";

/**
 * Conference mode (communication_settings.voice_conference_mode = true).
 *
 * Every call is placed in its own Twilio Conference named `sig-call-<CallSid of the first
 * leg>`, which is what lets an admin join it as listen / whisper / barge.
 *
 *   Inbound:  caller → greeting → <Conference> (hold music until an agent joins). We then
 *             dial client:sig-agent into the same conference via the Participants API. If the
 *             agent doesn't answer in 20 s the caller is redirected to the same voicemail
 *             prompt the classic flow uses.
 *   Outbound: browser softphone → <Conference> (starts immediately), then we dial the
 *             customer into it. If the customer doesn't answer, the agent leg is hung up.
 *
 * Recording is per conference (mono). Conference / participant events land on
 * /api/webhooks/twilio/conference-status. With the setting OFF none of this runs — the
 * original <Dial> TwiML in lib/twilio/voice.ts is used unchanged.
 */

export const AGENT_IDENTITY = "sig-agent";
export const MONITOR_IDENTITY_PREFIX = "sig-monitor-";
const VOICE = { voice: "Polly.Joanna" } as const;

export const conferenceNameFor = (callSid: string) => `sig-call-${callSid}`;

function urls(callSid: string) {
  const base = appBaseUrl();
  const q = `call_sid=${encodeURIComponent(callSid)}`;
  return {
    recording: `${base}/api/webhooks/twilio/recording?${q}`,
    conferenceStatus: `${base}/api/webhooks/twilio/conference-status?${q}`,
    agentStatus: `${base}/api/webhooks/twilio/conference-status?${q}&leg=agent`,
    customerStatus: `${base}/api/webhooks/twilio/conference-status?${q}&leg=customer`,
    voicemail: `${base}/api/webhooks/twilio/voicemail?${q}`,
  };
}

/** Same voicemail prompt as the classic inbound flow. */
export function buildVoicemailTwiml(): string {
  const base = appBaseUrl();
  const response = new twilio.twiml.VoiceResponse();
  response.say(VOICE, "Sorry, we missed your call. Please leave a message after the tone and we will get back to you.");
  response.record({
    maxLength: 120,
    transcribe: true,
    transcribeCallback: `${base}/api/webhooks/twilio/transcription`,
    action: `${base}/api/webhooks/twilio/voice-status`,
  });
  response.say(VOICE, "Thank you. Goodbye.");
  return response.toString();
}

export function buildInboundConferenceTwiml(callerSid: string): string {
  const u = urls(callerSid);
  const response = new twilio.twiml.VoiceResponse();
  response.say(VOICE, "Thank you for calling. Please hold while we connect you.");
  const dial = response.dial();
  dial.conference(
    {
      startConferenceOnEnter: false,
      endConferenceOnExit: true,
      beep: "false",
      record: "record-from-start",
      recordingStatusCallback: u.recording,
      recordingStatusCallbackMethod: "POST",
      statusCallback: u.conferenceStatus,
      statusCallbackEvent: ["start", "end", "join", "leave"],
    },
    conferenceNameFor(callerSid),
  );
  response.hangup();
  return response.toString();
}

export function buildOutboundConferenceTwiml(agentCallSid: string): string {
  const u = urls(agentCallSid);
  const response = new twilio.twiml.VoiceResponse();
  const dial = response.dial();
  dial.conference(
    {
      startConferenceOnEnter: true,
      endConferenceOnExit: true,
      beep: "false",
      record: "record-from-start",
      recordingStatusCallback: u.recording,
      recordingStatusCallbackMethod: "POST",
      statusCallback: u.conferenceStatus,
      statusCallbackEvent: ["start", "end", "join", "leave"],
    },
    conferenceNameFor(agentCallSid),
  );
  return response.toString();
}

/** Inbound: ring the browser softphone into the caller's conference. */
export async function dialAgentIntoConference(callerSid: string, callerNumber: string) {
  const client = await getTwilioClient();
  const u = urls(callerSid);
  try {
    const participant = await client.conferences(conferenceNameFor(callerSid)).participants.create({
      from: callerNumber || (await getTwilioConfig()).phoneNumber,
      to: `client:${AGENT_IDENTITY}`,
      label: "agent",
      timeout: 20,
      startConferenceOnEnter: true,
      endConferenceOnExit: true,
      beep: "false",
      statusCallback: u.agentStatus,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    });
    await createSupabaseAdminClient().from("calls").update({ agent_call_sid: participant.callSid, updated_at: new Date().toISOString() }).eq("twilio_call_sid", callerSid);
  } catch (error) {
    console.error("[conference] could not ring the agent — sending caller to voicemail", error);
    await sendCallerToVoicemail(callerSid);
  }
}

/** Outbound: dial the customer into the agent's conference. */
export async function dialCustomerIntoConference(agentCallSid: string, to: string) {
  const client = await getTwilioClient();
  const cfg = await getTwilioConfig();
  const u = urls(agentCallSid);
  try {
    await client.conferences(conferenceNameFor(agentCallSid)).participants.create({
      from: cfg.phoneNumber,
      to,
      label: "customer",
      timeout: 30,
      earlyMedia: true,
      endConferenceOnExit: true,
      beep: "false",
      statusCallback: u.customerStatus,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    });
  } catch (error) {
    console.error("[conference] could not dial the customer", error);
    await createSupabaseAdminClient().from("calls").update({ status: "failed", ended_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("twilio_call_sid", agentCallSid);
    await hangUp(agentCallSid);
  }
}

export async function sendCallerToVoicemail(callerSid: string) {
  try {
    const client = await getTwilioClient();
    await client.calls(callerSid).update({ url: urls(callerSid).voicemail, method: "POST" });
  } catch (error) {
    console.error("[conference] voicemail redirect failed", error);
  }
}

export async function hangUp(callSid: string | null | undefined) {
  if (!callSid) return;
  try {
    const client = await getTwilioClient();
    await client.calls(callSid).update({ status: "completed" });
  } catch {
    /* already ended */
  }
}

// ── Monitoring ───────────────────────────────────────────────────────────────

export type MonitorMode = "listen" | "whisper" | "barge";

/** TwiML for the admin's monitor leg (browser client sig-monitor-<profileId>). */
export function buildMonitorTwiml(conferenceName: string, mode: MonitorMode, agentCallSid: string | null): string {
  const response = new twilio.twiml.VoiceResponse();
  const dial = response.dial();
  dial.conference(
    {
      muted: mode === "listen",
      ...(mode === "whisper" && agentCallSid ? { coach: agentCallSid } : {}),
      startConferenceOnEnter: false,
      endConferenceOnExit: false,
      beep: "false",
    },
    conferenceName,
  );
  return response.toString();
}

/** Switch a live monitor leg between listen / whisper / barge. */
export async function setMonitorMode(conferenceSidOrName: string, monitorCallSid: string, mode: MonitorMode, agentCallSid: string | null) {
  const client = await getTwilioClient();
  if (mode === "whisper" && !agentCallSid) throw new Error("Whisper needs the agent's leg, which isn't known for this call yet.");
  await client
    .conferences(conferenceSidOrName)
    .participants(monitorCallSid)
    .update({
      muted: mode === "listen",
      coaching: mode === "whisper",
      ...(mode === "whisper" && agentCallSid ? { callSidToCoach: agentCallSid } : {}),
    });
}
