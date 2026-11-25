import { NextResponse, after } from "next/server";
import { requireAdminManager } from "@/lib/user-management/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createCampaign, processCampaigns, MIGRATION_HINT, type CampaignAudience } from "@/lib/sms/campaigns";
import { isMissingRelation } from "@/lib/twilio/settings";
import { commsError } from "@/lib/twilio/http";

export const dynamic = "force-dynamic";

// Bulk SMS campaigns — Super Admin / Admin only.
export async function GET(request: Request) {
  try {
    await requireAdminManager(request);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("sms_campaigns")
      .select("id, name, body, status, scheduled_at, started_at, completed_at, created_at, created_by, total_count, queued_count, sent_count, delivered_count, failed_count, skipped_count")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      if (isMissingRelation(error)) return NextResponse.json({ campaigns: [], available: false, notice: MIGRATION_HINT });
      throw new Error(error.message);
    }

    // Creator names in one lookup (avoids depending on the FK constraint name).
    const creatorIds = [...new Set((data ?? []).map((c) => c.created_by).filter(Boolean))] as string[];
    const names = new Map<string, string>();
    if (creatorIds.length) {
      const { data: people } = await supabase.from("profiles").select("id, first_name, last_name, full_name").in("id", creatorIds);
      for (const p of people ?? []) names.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || p.full_name || "");
    }

    return NextResponse.json({
      campaigns: (data ?? []).map((c) => ({ ...c, created_by_name: (c.created_by && names.get(c.created_by)) || null })),
      available: true,
    });
  } catch (error) {
    return commsError(error, "Failed to load campaigns.");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const actor = await requireAdminManager(request, body.actionToken);
    const mode = body.mode === "now" || body.mode === "schedule" ? body.mode : "draft";
    const result = await createCampaign({
      name: String(body.name ?? ""),
      body: String(body.body ?? ""),
      audience: (body.audience ?? {}) as CampaignAudience,
      mode,
      scheduledAt: body.scheduledAt ?? null,
      actorId: actor.id,
    });
    // Start sending right away; the cron picks up anything that doesn't finish here.
    if (mode === "now") {
      after(() => processCampaigns({ campaignId: result.id, budgetMs: 55_000 }).then(() => undefined, (e) => console.error("[sms-campaign] kick-off failed", e)));
    }
    return NextResponse.json({ ok: true, campaign: result });
  } catch (error) {
    return commsError(error, "Failed to create campaign.", 400);
  }
}
