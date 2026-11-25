import { NextResponse } from "next/server";
import { requireAdminManager, requireSuperAdmin } from "@/lib/user-management/auth";
import { getCommunicationSettings, updateCommunicationSettings } from "@/lib/twilio/settings";
import { getTwilioConfig } from "@/lib/twilio/client";
import { appBaseUrl, twilioSignatureBypassed } from "@/lib/twilio/webhook";
import { commsError } from "@/lib/twilio/http";

export const dynamic = "force-dynamic";

// Dialer + SMS settings. Read: admins. Change: Super Admin only.
export async function GET(request: Request) {
  try {
    const actor = await requireAdminManager(request);
    const [settings, cfg] = await Promise.all([getCommunicationSettings({ fresh: true }), getTwilioConfig()]);
    const base = appBaseUrl();
    return NextResponse.json({
      settings,
      canEdit: actor.role === "super_admin",
      sender: { messagingService: Boolean(cfg.messagingServiceSid), phoneNumber: cfg.phoneNumber },
      signatureBypassed: twilioSignatureBypassed(),
      webhooks: base
        ? {
            voice: `${base}/api/webhooks/twilio/voice`,
            voiceStatus: `${base}/api/webhooks/twilio/voice-status`,
            sms: `${base}/api/webhooks/twilio/sms`,
            smsStatus: `${base}/api/webhooks/twilio/sms-status`,
          }
        : null,
    });
  } catch (error) {
    return commsError(error, "Failed to load settings.");
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const actor = await requireSuperAdmin(request, body.actionToken);
    const settings = await updateCommunicationSettings(
      {
        autoTranscribe: typeof body.autoTranscribe === "boolean" ? body.autoTranscribe : undefined,
        voiceConferenceMode: typeof body.voiceConferenceMode === "boolean" ? body.voiceConferenceMode : undefined,
        smsKeywordReplies: typeof body.smsKeywordReplies === "boolean" ? body.smsKeywordReplies : undefined,
        smsMessagesPerSecond: body.smsMessagesPerSecond !== undefined ? Number(body.smsMessagesPerSecond) : undefined,
      },
      actor.id,
    );
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return commsError(error, "Failed to save settings.", 400);
  }
}
