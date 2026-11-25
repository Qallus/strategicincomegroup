import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createCommsAlert } from "@/lib/twilio/alerts";
import { formatPhone, resolveSmsContact } from "@/lib/sms/contacts";

/**
 * A call is missed if Twilio reported no-answer/busy, or an inbound call ended without ever
 * being answered (rang out to voicemail). Same rule the dialer page uses.
 */
export function isMissedCall(c: { status?: string | null; direction?: string | null; answered_at?: string | null; ended_at?: string | null }) {
  return c.status === "no-answer" || c.status === "busy" || (c.direction === "inbound" && !c.answered_at && !!c.ended_at);
}

/**
 * Raise a "missed call" alert once the call has settled. Called (after a short delay) from the
 * voice status callback — the recording callback that proves an answered call can arrive a few
 * seconds after "completed", so we re-read the row before deciding.
 */
export async function alertIfMissed(callSid: string) {
  const supabase = createSupabaseAdminClient();
  const { data: call } = await supabase
    .from("calls")
    .select("id, direction, status, answered_at, ended_at, recording_sid, voicemail_url, from_number, handled_by")
    .eq("twilio_call_sid", callSid)
    .maybeSingle();
  if (!call || call.direction !== "inbound") return;
  if (!isMissedCall(call) || call.recording_sid) return;

  let who = formatPhone(call.from_number);
  try {
    const contact = await resolveSmsContact(call.from_number);
    if (contact?.name) who = `${contact.name} (${formatPhone(call.from_number)})`;
  } catch {
    /* number only */
  }

  await createCommsAlert({
    type: "missed_call",
    severity: "warning",
    title: `Missed call from ${who}`,
    message: call.voicemail_url ? "They left a voicemail — play it from the Dialer." : "No voicemail was left. Call them back from the Dialer.",
    // The handling agent if we know them; otherwise every admin.
    userIds: [call.handled_by],
    metadata: { href: "/dashboard/dialer", from_number: call.from_number },
    dedupe: { key: "call_id", value: call.id },
  });
}
