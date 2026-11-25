import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  SMS_STOP_KEYWORDS,
  SMS_START_KEYWORDS,
  SMS_HELP_KEYWORDS,
  SMS_STOP_REPLY,
  SMS_START_REPLY,
  SMS_HELP_REPLY,
} from "@/lib/sms/constants";
import { getOrCreateConversation } from "@/lib/twilio/sms";
import { recordSmsOptIn, recordSmsOptOut } from "@/lib/sms/opt-out";
import { getCommunicationSettings } from "@/lib/twilio/settings";
import { EMPTY_TWIML, escapeXml, readTwilioWebhook, twimlResponse } from "@/lib/twilio/webhook";

// Inbound SMS (Twilio number / Messaging Service → "A message comes in").
//
// Keywords follow CTIA norms: STOP / START / HELP (and their synonyms) are matched on the whole
// message, case-insensitively, ignoring trailing punctuation. When the Messaging Service has
// Advanced Opt-Out turned on, Twilio sends OptOutType and replies itself — we still record the
// consent change but don't double-reply. Every inbound text, keywords included, is stored in
// the conversation so staff can see why someone stopped hearing from us.
export async function POST(request: Request) {
  const intake = await readTwilioWebhook(request);
  if (!intake.ok) return intake.response;
  const { hook } = intake;

  try {
    const from = hook.get("From");
    const body = hook.get("Body").trim();
    const messageSid = hook.get("MessageSid");
    const optOutType = hook.get("OptOutType").toUpperCase(); // STOP | START | HELP when Advanced Opt-Out is on
    const numMedia = parseInt(hook.get("NumMedia") || "0", 10) || 0;

    const mediaUrls: string[] = [];
    for (let i = 0; i < numMedia; i++) {
      const url = hook.get(`MediaUrl${i}`);
      if (url) mediaUrls.push(url);
    }

    const keyword = body.toUpperCase().replace(/[^A-Z ]/g, "").trim();
    const isStop = optOutType === "STOP" || SMS_STOP_KEYWORDS.includes(keyword) || keyword === "STOP ALL" || keyword === "STOPALL";
    const isStart = !isStop && (optOutType === "START" || SMS_START_KEYWORDS.includes(keyword));
    const isHelp = !isStop && !isStart && (optOutType === "HELP" || SMS_HELP_KEYWORDS.includes(keyword));

    const supabase = createSupabaseAdminClient();
    const now = new Date().toISOString();

    if (from) {
      try {
        const conversationId = await getOrCreateConversation(from);
        const { error: insertError } = await supabase.from("sms_messages").insert({
          conversation_id: conversationId,
          direction: "inbound",
          body: body || (mediaUrls.length ? "[media]" : ""),
          status: "received",
          twilio_message_sid: messageSid || null,
          media_urls: mediaUrls,
          sent_at: now,
        });
        if (insertError) console.error("[sms-webhook] inbound message not stored", insertError.message);

        const { data: conv } = await supabase.from("sms_conversations").select("unread_count").eq("id", conversationId).maybeSingle();
        await supabase
          .from("sms_conversations")
          .update({
            last_message_at: now,
            last_message_preview: (body || "[media]").slice(0, 120),
            unread_count: (Number(conv?.unread_count) || 0) + 1,
            updated_at: now,
          })
          .eq("id", conversationId);
      } catch (err) {
        console.error("[sms-webhook] conversation update failed", err);
      }
    }

    if (isStop || isStart || isHelp) {
      if (isStop) await recordSmsOptOut(from, "keyword_stop");
      if (isStart) await recordSmsOptIn(from, "keyword_start");

      const settings = await getCommunicationSettings();
      // Twilio already answered (Advanced Opt-Out), or replies are switched off.
      if (optOutType || !settings.smsKeywordReplies) return twimlResponse(EMPTY_TWIML);
      const reply = isStop ? SMS_STOP_REPLY : isStart ? SMS_START_REPLY : SMS_HELP_REPLY;
      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(reply)}</Message></Response>`);
    }

    return twimlResponse(EMPTY_TWIML);
  } catch (error) {
    console.error("SMS webhook error:", error);
    return twimlResponse(EMPTY_TWIML);
  }
}
