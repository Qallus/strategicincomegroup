import { NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/user-management/auth";
import { renderCampaignBody, resolveAudience, summarize, type CampaignAudience } from "@/lib/sms/campaigns";
import { smsSegmentCount } from "@/lib/sms/templates";
import { commsError } from "@/lib/twilio/http";

export const dynamic = "force-dynamic";

// Recipient count + a rendered sample, before anything is saved or sent.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    await requireAdminManager(request, body.actionToken);
    const recipients = await resolveAudience((body.audience ?? {}) as CampaignAudience);
    const counts = summarize(recipients);
    const text = String(body.body ?? "");
    const firstEligible = recipients.find((r) => r.status === "queued") ?? null;
    const sample = firstEligible ? renderCampaignBody(text, firstEligible.mergeData) : text;
    return NextResponse.json({
      ...counts,
      sample,
      sampleName: firstEligible?.name ?? null,
      segments: smsSegmentCount(sample),
      recipients: recipients.slice(0, 200).map((r) => ({ name: r.name, phone: r.phone, kind: r.kind, status: r.status, error: r.error })),
    });
  } catch (error) {
    return commsError(error, "Failed to preview audience.", 400);
  }
}
