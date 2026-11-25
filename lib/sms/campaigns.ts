import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTwilioClient, getTwilioConfig } from "@/lib/twilio/client";
import { getCommunicationSettings, isMissingRelation } from "@/lib/twilio/settings";
import { createCommsAlert } from "@/lib/twilio/alerts";
import { phoneKey, toE164 } from "@/lib/sms/contacts";
import { optedOutPhoneKeys, recordSmsOptOut } from "@/lib/sms/opt-out";
import { appBaseUrl } from "@/lib/twilio/webhook";

/**
 * Bulk SMS campaigns.
 *
 * Lifecycle: draft → (scheduled →) sending → done, or cancelled at any point before done.
 * Recipients are snapshotted when the campaign is created: each row is either `queued`, or
 * already `skipped_opt_out` / `skipped_invalid` so the preview count and the send agree.
 * Consent is checked twice — at snapshot time and again right before each message goes out,
 * so a STOP that arrives mid-campaign is honoured.
 *
 * The queue is drained by processCampaigns(): kicked off right after "Send now" and every
 * minute by scripts/sms-campaign-cron.mjs → POST /api/admin/sms/campaigns/process. Each
 * recipient row is claimed (queued → sending) with a conditional update before it is sent, so
 * overlapping runs never double-send.
 */

export const MIGRATION_HINT = "Bulk SMS needs the communications migration (supabase/migrations/202611250230_communications.sql). Run it in Supabase, then reload.";
export const MAX_CAMPAIGN_RECIPIENTS = 10_000;

export type RecipientKind = "contact" | "participant" | "profile" | "manual";

export type CampaignAudience = {
  /** CRM contacts / leads. Empty tags = every contact of the chosen types. */
  contacts?: { enabled: boolean; types: ("contact" | "lead")[]; tags: string[]; tagMatch: "any" | "all" } | null;
  /** Participant segment built from tags (same model as Tags & Segments). Empty = all participants. */
  segment?: { enabled: boolean; tagIds: string[]; match: "any" | "all" } | null;
  /** Hand-picked people or typed numbers. */
  individuals?: { phone: string; kind?: RecipientKind; id?: string | null; name?: string | null }[];
};

export type ResolvedRecipient = {
  contactId: string | null;
  kind: RecipientKind;
  name: string | null;
  phone: string;
  phoneKey: string;
  mergeData: Record<string, string>;
  status: "queued" | "skipped_opt_out" | "skipped_invalid";
  error: string | null;
};

export type CampaignStatus = "draft" | "scheduled" | "sending" | "done" | "cancelled";
export type RecipientStatus = "queued" | "sending" | "sent" | "delivered" | "failed" | "skipped_opt_out" | "skipped_invalid";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

// ── Merge fields ─────────────────────────────────────────────────────────────

export const CAMPAIGN_MERGE_FIELDS = ["first_name", "last_name", "full_name", "email", "phone", "company"] as const;

/**
 * Renders {first_name}, {{first_name}} and {first_name|there} (fallback when empty).
 * Unknown {words} are left alone so ordinary braces in a message survive.
 */
export function renderCampaignBody(body: string, data: Record<string, string>): string {
  return body
    .replace(/\{\{\s*([a-z0-9_]+)\s*(?:\|([^}]*))?\}\}|\{\s*([a-z0-9_]+)\s*(?:\|([^}]*))?\}/gi, (match, k1, f1, k2, f2) => {
      const key = String(k1 ?? k2).toLowerCase();
      const fallback = (f1 ?? f2 ?? "").trim();
      if (!(key in data)) return match;
      return (data[key] ?? "").trim() || fallback;
    })
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ ([,.!?])/g, "$1");
}

function mergeDataFor(row: { first_name?: string | null; last_name?: string | null; full_name?: string | null; email?: string | null; company?: string | null }, phone: string) {
  const first = (row.first_name ?? "").trim();
  const last = (row.last_name ?? "").trim();
  return {
    first_name: first,
    last_name: last,
    full_name: [first, last].filter(Boolean).join(" ") || (row.full_name ?? "").trim(),
    email: (row.email ?? "").trim(),
    phone,
    company: (row.company ?? "").trim(),
  };
}

export function isTextablePhone(e164: string) {
  return /^\+[1-9]\d{7,14}$/.test(e164) && (!e164.startsWith("+1") || e164.length === 12);
}

// ── Audience resolution ──────────────────────────────────────────────────────

async function pageAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, cap = MAX_CAMPAIGN_RECIPIENTS): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

type Candidate = {
  contactId: string | null;
  kind: RecipientKind;
  row: Record<string, any>;
  phoneRaw: string;
  /** false = record says no SMS consent. null = unknown (manual number). */
  consent: boolean | null;
  consentNote?: string;
};

async function contactCandidates(supabase: Admin, spec: NonNullable<CampaignAudience["contacts"]>): Promise<Candidate[]> {
  const types = spec.types?.length ? spec.types : ["contact", "lead"];
  const tags = (spec.tags ?? []).filter(Boolean);
  const rows = await pageAll<Record<string, any>>((from, to) => {
    let q = supabase
      .from("contacts")
      .select("id, first_name, last_name, email, phone, company, sms_opt_in, status, tags")
      .in("type", types)
      .neq("status", "archived")
      .not("phone", "is", null)
      .order("created_at", { ascending: true })
      .range(from, to);
    if (tags.length) q = spec.tagMatch === "all" ? q.contains("tags", tags) : q.overlaps("tags", tags);
    return q;
  });
  return rows.map((r) => ({
    contactId: r.id,
    kind: "contact",
    row: r,
    phoneRaw: r.phone,
    // Contacts are opt-in: no recorded consent means we don't text them in bulk.
    consent: r.sms_opt_in === true,
    consentNote: r.sms_opt_in === true ? undefined : "No SMS consent on file for this contact.",
  }));
}

async function segmentCandidates(supabase: Admin, spec: NonNullable<CampaignAudience["segment"]>): Promise<Candidate[]> {
  const tagIds = (spec.tagIds ?? []).filter(Boolean);
  let participantIds: string[] | null = null;
  if (tagIds.length) {
    const links = await pageAll<{ participant_id: string; tag_id: string }>((from, to) =>
      supabase.from("participant_tags").select("participant_id, tag_id").in("tag_id", tagIds).range(from, to),
      50_000,
    );
    const counts = new Map<string, number>();
    for (const l of links) counts.set(l.participant_id, (counts.get(l.participant_id) ?? 0) + 1);
    participantIds = [...counts.entries()].filter(([, n]) => (spec.match === "all" ? n >= tagIds.length : n > 0)).map(([id]) => id);
    if (!participantIds.length) return [];
  }

  const rows: Record<string, any>[] = [];
  if (participantIds) {
    for (let i = 0; i < participantIds.length; i += 300) {
      const { data, error } = await supabase
        .from("participants")
        .select("id, first_name, last_name, email, phone, sms_opt_in")
        .in("id", participantIds.slice(i, i + 300))
        .not("phone", "is", null);
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
    }
  } else {
    rows.push(
      ...(await pageAll<Record<string, any>>((from, to) =>
        supabase.from("participants").select("id, first_name, last_name, email, phone, sms_opt_in").not("phone", "is", null).order("created_at").range(from, to),
      )),
    );
  }
  return rows.map((r) => ({
    contactId: r.id,
    kind: "participant",
    row: r,
    phoneRaw: r.phone,
    consent: r.sms_opt_in !== false,
    consentNote: r.sms_opt_in === false ? "Participant opted out of SMS." : undefined,
  }));
}

async function individualCandidates(supabase: Admin, list: NonNullable<CampaignAudience["individuals"]>): Promise<Candidate[]> {
  const byKind = { profile: [] as string[], participant: [] as string[], contact: [] as string[] };
  for (const i of list) if (i.id && i.kind && i.kind !== "manual") byKind[i.kind].push(i.id);

  const lookup = new Map<string, Record<string, any>>();
  const tables = { profile: "profiles", participant: "participants", contact: "contacts" } as const;
  for (const kind of ["profile", "participant", "contact"] as const) {
    if (!byKind[kind].length) continue;
    const cols = kind === "contact" ? "id, first_name, last_name, email, phone, company, sms_opt_in" : kind === "profile" ? "id, first_name, last_name, full_name, email, phone, sms_opt_in" : "id, first_name, last_name, email, phone, sms_opt_in";
    const { data } = await supabase.from(tables[kind]).select(cols).in("id", byKind[kind].slice(0, 1000));
    for (const r of (data ?? []) as unknown as Record<string, any>[]) lookup.set(`${kind}:${r.id}`, r);
  }

  return list.map((i) => {
    const kind: RecipientKind = i.kind && i.id ? i.kind : "manual";
    const row = (i.id && lookup.get(`${kind}:${i.id}`)) || { first_name: i.name ?? "" };
    const flag = row.sms_opt_in;
    // Explicitly picked people: honour an explicit opt-out; contacts still need consent.
    const consent = kind === "manual" ? null : kind === "contact" ? flag === true : flag !== false;
    return {
      contactId: kind === "manual" ? null : (i.id ?? null),
      kind,
      row,
      phoneRaw: i.phone || row.phone || "",
      consent,
      consentNote: consent === false ? (kind === "contact" ? "No SMS consent on file for this contact." : "Opted out of SMS.") : undefined,
    };
  });
}

export async function resolveAudience(audience: CampaignAudience): Promise<ResolvedRecipient[]> {
  const supabase = createSupabaseAdminClient();
  const candidates: Candidate[] = [];
  if (audience.individuals?.length) candidates.push(...(await individualCandidates(supabase, audience.individuals)));
  if (audience.contacts?.enabled) candidates.push(...(await contactCandidates(supabase, audience.contacts)));
  if (audience.segment?.enabled) candidates.push(...(await segmentCandidates(supabase, audience.segment)));

  // De-duplicate by phone; the first source wins (hand-picked, then contacts, then segment).
  const seen = new Set<string>();
  const unique: (Candidate & { e164: string; key: string })[] = [];
  const invalid: ResolvedRecipient[] = [];
  for (const c of candidates) {
    const e164 = toE164(c.phoneRaw);
    const key = phoneKey(c.phoneRaw);
    const name = [c.row.first_name, c.row.last_name].filter(Boolean).join(" ").trim() || c.row.full_name || null;
    if (!e164 || !isTextablePhone(e164)) {
      invalid.push({ contactId: c.contactId, kind: c.kind, name, phone: c.phoneRaw || "", phoneKey: key, mergeData: mergeDataFor(c.row, c.phoneRaw), status: "skipped_invalid", error: "Not a valid mobile number." });
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...c, e164, key });
  }

  const optedOut = await optedOutPhoneKeys(unique.map((u) => u.key));
  const resolved: ResolvedRecipient[] = unique.map((u) => {
    const name = [u.row.first_name, u.row.last_name].filter(Boolean).join(" ").trim() || u.row.full_name || null;
    const stopped = optedOut.has(u.key);
    const noConsent = u.consent === false;
    return {
      contactId: u.contactId,
      kind: u.kind,
      name,
      phone: u.e164,
      phoneKey: u.key,
      mergeData: mergeDataFor(u.row, u.e164),
      status: stopped || noConsent ? "skipped_opt_out" : "queued",
      error: stopped ? "Replied STOP." : noConsent ? (u.consentNote ?? "No SMS consent.") : null,
    };
  });

  return [...resolved, ...invalid].slice(0, MAX_CAMPAIGN_RECIPIENTS);
}

export function summarize(recipients: ResolvedRecipient[]) {
  return {
    total: recipients.length,
    eligible: recipients.filter((r) => r.status === "queued").length,
    skippedOptOut: recipients.filter((r) => r.status === "skipped_opt_out").length,
    skippedInvalid: recipients.filter((r) => r.status === "skipped_invalid").length,
  };
}

// ── Campaign CRUD ────────────────────────────────────────────────────────────

export async function createCampaign(input: {
  name: string;
  body: string;
  audience: CampaignAudience;
  /** "draft" saves for later, "now" starts sending, "schedule" waits for scheduledAt. */
  mode: "draft" | "now" | "schedule";
  scheduledAt?: string | null;
  actorId: string;
}) {
  const supabase = createSupabaseAdminClient();
  const name = input.name.trim().slice(0, 200);
  const body = input.body.trim();
  if (!name) throw new Error("Give the campaign a name.");
  if (!body) throw new Error("Write the message.");
  if (body.length > 1600) throw new Error("Message is too long (1,600 characters max).");
  let scheduledAt: string | null = null;
  if (input.mode === "schedule") {
    const d = input.scheduledAt ? new Date(input.scheduledAt) : null;
    if (!d || Number.isNaN(d.getTime())) throw new Error("Pick a date and time to send.");
    if (d.getTime() < Date.now() - 60_000) throw new Error("The scheduled time is in the past.");
    scheduledAt = d.toISOString();
  }

  const recipients = await resolveAudience(input.audience);
  const counts = summarize(recipients);
  if (!counts.eligible && input.mode !== "draft") throw new Error("No one in this audience can be texted.");

  const { data: campaign, error } = await supabase
    .from("sms_campaigns")
    .insert({
      name,
      body,
      audience: input.audience,
      status: "draft",
      scheduled_at: scheduledAt,
      created_by: input.actorId,
      total_count: counts.total,
      queued_count: counts.eligible,
      skipped_count: counts.skippedOptOut + counts.skippedInvalid,
    })
    .select("id")
    .single();
  if (error) throw new Error(isMissingRelation(error) ? MIGRATION_HINT : error.message);

  for (let i = 0; i < recipients.length; i += 500) {
    const chunk = recipients.slice(i, i + 500).map((r) => ({
      campaign_id: campaign.id,
      contact_id: r.contactId,
      contact_kind: r.kind,
      name: r.name,
      phone: r.phone,
      phone_key: r.phoneKey,
      merge_data: r.mergeData,
      status: r.status,
      error: r.error,
    }));
    const { error: insErr } = await supabase.from("sms_campaign_recipients").insert(chunk);
    if (insErr) {
      await supabase.from("sms_campaigns").delete().eq("id", campaign.id);
      throw new Error(`Could not save recipients: ${insErr.message}`);
    }
  }

  if (input.mode !== "draft") await launchCampaign(campaign.id, input.mode === "schedule" ? scheduledAt : null);
  return { id: campaign.id as string, ...counts };
}

export async function launchCampaign(id: string, scheduledAt: string | null) {
  const supabase = createSupabaseAdminClient();
  const { data: c } = await supabase.from("sms_campaigns").select("status").eq("id", id).maybeSingle();
  if (!c) throw new Error("Campaign not found.");
  if (!["draft", "scheduled"].includes(c.status)) throw new Error(`This campaign is already ${c.status}.`);
  const now = new Date().toISOString();
  const patch = scheduledAt
    ? { status: "scheduled", scheduled_at: scheduledAt, updated_at: now }
    : { status: "sending", started_at: now, scheduled_at: null, updated_at: now };
  const { error } = await supabase.from("sms_campaigns").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function cancelCampaign(id: string) {
  const supabase = createSupabaseAdminClient();
  const { data: c } = await supabase.from("sms_campaigns").select("status").eq("id", id).maybeSingle();
  if (!c) throw new Error("Campaign not found.");
  if (["done", "cancelled"].includes(c.status)) throw new Error(`This campaign is already ${c.status}.`);
  await supabase.from("sms_campaigns").update({ status: "cancelled", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
  await refreshCampaignCounts(id);
}

export async function deleteCampaign(id: string) {
  const supabase = createSupabaseAdminClient();
  const { data: c } = await supabase.from("sms_campaigns").select("status").eq("id", id).maybeSingle();
  if (!c) throw new Error("Campaign not found.");
  if (c.status === "sending") throw new Error("Cancel the campaign before deleting it.");
  const { count } = await supabase.from("sms_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", id).in("status", ["sent", "delivered", "failed"]);
  if ((count ?? 0) > 0) throw new Error("Messages from this campaign already went out — it can be cancelled but not deleted.");
  await supabase.from("sms_campaigns").delete().eq("id", id);
}

export async function refreshCampaignCounts(id: string) {
  const supabase = createSupabaseAdminClient();
  const statuses: RecipientStatus[] = ["queued", "sending", "sent", "delivered", "failed", "skipped_opt_out", "skipped_invalid"];
  const results = await Promise.all(
    statuses.map((s) => supabase.from("sms_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("status", s)),
  );
  const n = Object.fromEntries(statuses.map((s, i) => [s, results[i].count ?? 0])) as Record<RecipientStatus, number>;
  const counts = {
    total_count: statuses.reduce((sum, s) => sum + n[s], 0),
    queued_count: n.queued + n.sending,
    sent_count: n.sent + n.delivered,
    delivered_count: n.delivered,
    failed_count: n.failed,
    skipped_count: n.skipped_opt_out + n.skipped_invalid,
  };
  await supabase.from("sms_campaigns").update({ ...counts, updated_at: new Date().toISOString() }).eq("id", id);
  return { ...counts, byStatus: n };
}

// ── Queue processing ─────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Conversation id per phone for the sender number, created on demand. */
async function conversationResolver(supabase: Admin, twilioNumber: string) {
  const { data } = await supabase.from("sms_conversations").select("id, contact_number").eq("twilio_number", twilioNumber).limit(10_000);
  const byKey = new Map<string, string>();
  for (const c of data ?? []) if (!byKey.has(phoneKey(c.contact_number))) byKey.set(phoneKey(c.contact_number), c.id as string);
  return async (phone: string, name: string | null) => {
    const key = phoneKey(phone);
    const hit = byKey.get(key);
    if (hit) return hit;
    const { data: created } = await supabase
      .from("sms_conversations")
      .insert({ twilio_number: twilioNumber, contact_number: toE164(phone) || phone, contact_name: name })
      .select("id")
      .maybeSingle();
    if (created?.id) byKey.set(key, created.id as string);
    return (created?.id as string) ?? null;
  };
}

export type ProcessSummary = { campaigns: number; sent: number; failed: number; skipped: number; finished: string[]; stoppedForTime: boolean };

export async function processCampaigns({ budgetMs = 50_000, campaignId }: { budgetMs?: number; campaignId?: string } = {}): Promise<ProcessSummary> {
  const started = Date.now();
  const supabase = createSupabaseAdminClient();
  const summary: ProcessSummary = { campaigns: 0, sent: 0, failed: 0, skipped: 0, finished: [], stoppedForTime: false };

  // Scheduled campaigns whose time has come start sending.
  const nowIso = new Date().toISOString();
  const promote = await supabase
    .from("sms_campaigns")
    .update({ status: "sending", started_at: nowIso, updated_at: nowIso })
    .eq("status", "scheduled")
    .lte("scheduled_at", nowIso)
    .select("id");
  if (promote.error) {
    if (isMissingRelation(promote.error)) return summary;
    throw new Error(promote.error.message);
  }

  let q = supabase.from("sms_campaigns").select("id, name, body, created_by").eq("status", "sending").order("started_at", { ascending: true }).limit(20);
  if (campaignId) q = q.eq("id", campaignId);
  const { data: campaigns } = await q;
  if (!campaigns?.length) return summary;

  const settings = await getCommunicationSettings({ fresh: true });
  const gapMs = Math.max(20, Math.round(1000 / (settings.smsMessagesPerSecond || 1)));
  const cfg = await getTwilioConfig();
  const client = await getTwilioClient();
  const sender = cfg.messagingServiceSid ? { messagingServiceSid: cfg.messagingServiceSid } : { from: cfg.phoneNumber };
  const base = appBaseUrl();
  const statusCallback = base ? `${base}/api/webhooks/twilio/sms-status` : undefined;
  const conversationFor = await conversationResolver(supabase, cfg.phoneNumber);

  for (const campaign of campaigns) {
    summary.campaigns++;
    let lastSend = 0;

    for (;;) {
      if (Date.now() - started > budgetMs) {
        summary.stoppedForTime = true;
        break;
      }
      // Stop promptly if someone hit Cancel.
      const { data: live } = await supabase.from("sms_campaigns").select("status").eq("id", campaign.id).maybeSingle();
      if (live?.status !== "sending") break;

      const { data: batch } = await supabase
        .from("sms_campaign_recipients")
        .select("id, phone, phone_key, name, merge_data")
        .eq("campaign_id", campaign.id)
        .eq("status", "queued")
        .order("created_at", { ascending: true })
        .limit(25);

      if (!batch?.length) {
        await finalizeCampaign(campaign.id, campaign.name, campaign.created_by);
        summary.finished.push(campaign.id);
        break;
      }

      const stopped = await optedOutPhoneKeys(batch.map((b) => b.phone_key ?? phoneKey(b.phone)));

      for (const r of batch) {
        if (Date.now() - started > budgetMs) {
          summary.stoppedForTime = true;
          break;
        }
        // Claim the row; if another runner got it first, skip.
        const { data: claimed } = await supabase
          .from("sms_campaign_recipients")
          .update({ status: "sending", updated_at: new Date().toISOString() })
          .eq("id", r.id)
          .eq("status", "queued")
          .select("id");
        if (!claimed?.length) continue;

        if (stopped.has(r.phone_key ?? phoneKey(r.phone))) {
          await supabase.from("sms_campaign_recipients").update({ status: "skipped_opt_out", error: "Replied STOP.", updated_at: new Date().toISOString() }).eq("id", r.id);
          summary.skipped++;
          continue;
        }

        const text = renderCampaignBody(campaign.body, (r.merge_data ?? {}) as Record<string, string>);
        const wait = gapMs - (Date.now() - lastSend);
        if (wait > 0) await sleep(wait);
        lastSend = Date.now();

        try {
          const msg = await client.messages.create({ ...sender, to: r.phone, body: text, ...(statusCallback ? { statusCallback } : {}) });
          const sentAt = new Date().toISOString();
          await supabase
            .from("sms_campaign_recipients")
            .update({ status: "sent", twilio_sid: msg.sid, body_rendered: text, sent_at: sentAt, error: null, updated_at: sentAt })
            .eq("id", r.id);
          summary.sent++;

          // Mirror into the SMS inbox so replies land in context.
          const conversationId = await conversationFor(r.phone, r.name ?? null);
          if (conversationId) {
            await supabase.from("sms_messages").insert({
              conversation_id: conversationId,
              direction: "outbound",
              body: text,
              status: ["queued", "accepted", "sending", "sent"].includes(msg.status) ? (msg.status === "sent" ? "sent" : "queued") : "queued",
              twilio_message_sid: msg.sid,
              sent_by: campaign.created_by ?? null,
              sent_at: sentAt,
            });
            await supabase.from("sms_conversations").update({ last_message_at: sentAt, last_message_preview: text.slice(0, 120), updated_at: sentAt }).eq("id", conversationId);
          }
        } catch (err) {
          const e = err as { code?: number; message?: string };
          const code = Number(e.code ?? 0);
          // 21610: recipient replied STOP at the carrier level. 21211/21614: not a valid mobile number.
          const status: RecipientStatus = code === 21610 ? "skipped_opt_out" : code === 21211 || code === 21614 ? "skipped_invalid" : "failed";
          if (code === 21610) await recordSmsOptOut(r.phone, "keyword_stop");
          await supabase
            .from("sms_campaign_recipients")
            .update({ status, body_rendered: text, error: `${e.message ?? "Send failed"}${code ? ` (Twilio ${code})` : ""}`.slice(0, 500), updated_at: new Date().toISOString() })
            .eq("id", r.id);
          if (status === "failed") summary.failed++;
          else summary.skipped++;
        }
      }
      await refreshCampaignCounts(campaign.id);
    }
    if (summary.stoppedForTime) break;
  }

  return summary;
}

async function finalizeCampaign(id: string, name: string, createdBy: string | null) {
  const supabase = createSupabaseAdminClient();
  // Rows left in 'sending' mean a runner died mid-send. Twilio may or may not have the
  // message, so we never resend them automatically.
  const stale = new Date(Date.now() - 10 * 60_000).toISOString();
  await supabase
    .from("sms_campaign_recipients")
    .update({ status: "failed", error: "Interrupted while sending — not retried to avoid a duplicate text.", updated_at: new Date().toISOString() })
    .eq("campaign_id", id)
    .eq("status", "sending")
    .lt("updated_at", stale);
  const { count: inFlight } = await supabase.from("sms_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "sending");
  if ((inFlight ?? 0) > 0) return; // another runner is still working on it

  const now = new Date().toISOString();
  const { data: done } = await supabase.from("sms_campaigns").update({ status: "done", completed_at: now, updated_at: now }).eq("id", id).eq("status", "sending").select("id");
  const counts = await refreshCampaignCounts(id);
  if (!done?.length) return;

  if (counts.failed_count > 0) {
    const attempted = counts.sent_count + counts.failed_count;
    const severe = attempted > 0 && counts.failed_count / attempted >= 0.5;
    await createCommsAlert({
      type: "sms_campaign_failed",
      severity: severe ? "critical" : "warning",
      title: `Bulk SMS "${name}": ${counts.failed_count} of ${attempted} failed`,
      message: severe
        ? "Most messages in this campaign failed. Check the Messaging Service / A2P registration on the Credentials page before sending again."
        : "Some messages in this campaign could not be sent. Open the campaign to see which numbers and why.",
      userIds: [createdBy],
      metadata: { href: `/dashboard/sms?campaign=${id}` },
      dedupe: { key: "campaign_id", value: id },
    });
  }
}

/** Status callback → campaign recipient. Returns true if the SID belonged to a campaign. */
export async function applyCampaignDeliveryStatus(sid: string, twilioStatus: string, errorCode: string | null, errorMessage: string | null): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data: rows, error } = await supabase.from("sms_campaign_recipients").select("id, campaign_id, status").eq("twilio_sid", sid).limit(1);
  if (error || !rows?.length) return false;
  const row = rows[0];
  const now = new Date().toISOString();

  let next: RecipientStatus | null = null;
  if (twilioStatus === "delivered") next = "delivered";
  else if (twilioStatus === "failed" || twilioStatus === "undelivered") next = "failed";
  else if (twilioStatus === "sent" && (row.status === "sending" || row.status === "queued")) next = "sent";
  if (!next || next === row.status) return true;
  if (row.status === "delivered" && next !== "failed") return true;

  await supabase
    .from("sms_campaign_recipients")
    .update({
      status: next,
      ...(next === "delivered" ? { delivered_at: now } : {}),
      ...(next === "failed" ? { error: `${errorMessage || "Not delivered"}${errorCode ? ` (Twilio ${errorCode})` : ""}`.slice(0, 500) } : {}),
      updated_at: now,
    })
    .eq("id", row.id);

  const { data: campaign } = await supabase.from("sms_campaigns").select("id, name, status, created_by, updated_at").eq("id", row.campaign_id).maybeSingle();
  if (!campaign) return true;
  // Counts are refreshed by the queue runner while sending; afterwards keep them current here,
  // at most every few seconds.
  if (campaign.status !== "sending" && Date.now() - new Date(campaign.updated_at).getTime() > 3_000) {
    const counts = await refreshCampaignCounts(campaign.id);
    if (next === "failed" && campaign.status === "done") {
      await createCommsAlert({
        type: "sms_campaign_failed",
        severity: "warning",
        title: `Bulk SMS "${campaign.name}": delivery failures`,
        message: `${counts.failed_count} message${counts.failed_count === 1 ? "" : "s"} could not be delivered by the carrier.`,
        userIds: [campaign.created_by],
        metadata: { href: `/dashboard/sms?campaign=${campaign.id}` },
        dedupe: { key: "campaign_delivery", value: campaign.id },
      });
    }
  }
  return true;
}
