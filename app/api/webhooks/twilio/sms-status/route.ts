import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readTwilioWebhook } from "@/lib/twilio/webhook";
import { createCommsAlert } from "@/lib/twilio/alerts";
import { applyCampaignDeliveryStatus } from "@/lib/sms/campaigns";
import { formatPhone } from "@/lib/sms/contacts";

// Delivery status callback for every outbound text (single sends, broadcasts and bulk
// campaigns all set statusCallback to this URL).
export async function POST(request: Request) {
  const intake = await readTwilioWebhook(request);
  if (!intake.ok) return intake.response;
  const { hook } = intake;

  try {
    const messageSid = hook.get("MessageSid");
    const messageStatus = hook.get("MessageStatus");
    const errorCode = hook.get("ErrorCode") || null;
    const errorMessage = hook.get("ErrorMessage") || null;

    if (!messageSid || !messageStatus) return NextResponse.json({ ok: true });

    const supabase = createSupabaseAdminClient();
    const failed = messageStatus === "failed" || messageStatus === "undelivered";

    const update: Record<string, unknown> = { status: messageStatus };
    if (messageStatus === "delivered") update.delivered_at = new Date().toISOString();
    if (errorCode) update.error_code = errorCode;
    if (errorMessage) update.error_message = errorMessage;

    const { data: messages } = await supabase
      .from("sms_messages")
      .update(update)
      .eq("twilio_message_sid", messageSid)
      .select("id, sent_by, conversation_id, body");

    await supabase
      .from("sms_send_logs")
      .update({ status: messageStatus === "delivered" ? "delivered" : failed ? "failed" : "sent" })
      .eq("twilio_message_sid", messageSid);

    // Bulk campaign recipients (no-op when the message wasn't part of one).
    const campaignHit = await applyCampaignDeliveryStatus(messageSid, messageStatus, errorCode, errorMessage);

    // A one-to-one text that didn't arrive: tell whoever sent it. Campaign failures are
    // rolled up per campaign instead of one alert per number.
    if (failed && !campaignHit) {
      const msg = messages?.[0];
      let to = "";
      if (msg?.conversation_id) {
        const { data: conv } = await supabase.from("sms_conversations").select("contact_number, contact_name").eq("id", msg.conversation_id).maybeSingle();
        to = conv?.contact_name || formatPhone(conv?.contact_number);
      }
      await createCommsAlert({
        type: "sms_failed",
        severity: "warning",
        title: `Text to ${to || "a contact"} was not delivered`,
        message: `${errorMessage || "The carrier rejected the message"}${errorCode ? ` (Twilio error ${errorCode})` : ""}.`,
        userIds: [msg?.sent_by as string | undefined],
        metadata: { conversation_id: msg?.conversation_id ?? null, error_code: errorCode, href: "/dashboard/sms" },
        dedupe: { key: "message_sid", value: messageSid },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("SMS status webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}
