import { NextResponse } from "next/server";
import { requireAdminManager } from "@/lib/user-management/auth";
import { processCampaigns } from "@/lib/sms/campaigns";
import { commsError } from "@/lib/twilio/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Drains the bulk SMS queue (scheduled campaigns that are due, and campaigns mid-send).
 * Called every minute by a Coolify scheduled task (`node scripts/sms-campaign-cron.mjs`)
 * with CRON_SECRET, or manually by an admin session.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const secret = process.env.CRON_SECRET;
    const presented =
      request.headers.get("x-cron-secret") ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
      (typeof body.secret === "string" ? body.secret : "");

    if (!(secret && presented && presented === secret)) {
      await requireAdminManager(request, body.actionToken);
    }

    const budgetMs = Math.min(55_000, Math.max(5_000, Number(body.budgetMs ?? 50_000) || 50_000));
    const result = await processCampaigns({ budgetMs, campaignId: typeof body.campaignId === "string" ? body.campaignId : undefined });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return commsError(error, "Unable to process SMS campaigns.");
  }
}
