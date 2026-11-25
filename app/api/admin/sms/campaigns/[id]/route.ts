import { NextResponse, after } from "next/server";
import { requireAdminManager } from "@/lib/user-management/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cancelCampaign, deleteCampaign, launchCampaign, processCampaigns, refreshCampaignCounts } from "@/lib/sms/campaigns";
import { commsError } from "@/lib/twilio/http";

export const dynamic = "force-dynamic";

// One campaign with its recipients (filterable by status, paged).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminManager(request);
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = 100;
    const supabase = createSupabaseAdminClient();

    const { data: campaign, error } = await supabase.from("sms_campaigns").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

    const counts = await refreshCampaignCounts(id);

    let q = supabase
      .from("sms_campaign_recipients")
      .select("id, name, phone, contact_kind, status, error, twilio_sid, sent_at, delivered_at, body_rendered", { count: "exact" })
      .eq("campaign_id", id)
      .order("created_at", { ascending: true })
      .range((page - 1) * limit, page * limit - 1);
    if (status === "skipped") q = q.in("status", ["skipped_opt_out", "skipped_invalid"]);
    else if (status === "sent") q = q.in("status", ["sent", "delivered"]);
    else if (status === "queued") q = q.in("status", ["queued", "sending"]);
    else if (status) q = q.eq("status", status);
    const { data: recipients, count } = await q;

    return NextResponse.json({
      campaign: { ...campaign, ...counts, byStatus: undefined },
      byStatus: counts.byStatus,
      recipients: recipients ?? [],
      total: count ?? 0,
      page,
      limit,
    });
  } catch (error) {
    return commsError(error, "Failed to load campaign.");
  }
}

// { action: "launch" } | { action: "schedule", scheduledAt } | { action: "cancel" }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json().catch(() => ({}));
    await requireAdminManager(request, body.actionToken);
    const { id } = await params;
    if (body.action === "launch") {
      await launchCampaign(id, null);
      after(() => processCampaigns({ campaignId: id, budgetMs: 55_000 }).then(() => undefined, (e) => console.error("[sms-campaign] kick-off failed", e)));
    } else if (body.action === "schedule") {
      const d = new Date(String(body.scheduledAt ?? ""));
      if (Number.isNaN(d.getTime()) || d.getTime() < Date.now() - 60_000) throw new Error("Pick a future date and time.");
      await launchCampaign(id, d.toISOString());
    } else if (body.action === "cancel") {
      await cancelCampaign(id);
    } else {
      throw new Error("Unknown action.");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return commsError(error, "Failed to update campaign.", 400);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminManager(request, request.headers.get("x-sig-action-token"));
    const { id } = await params;
    await deleteCampaign(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return commsError(error, "Failed to delete campaign.", 400);
  }
}
