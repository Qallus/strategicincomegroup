// Server-only queries for the Analytics dashboard and the analytics cron.
// Every read fails soft: before 202611210190_analytics.sql is applied (or if a query
// errors) the dashboard gets empty data plus `missing: true` and shows an empty state.
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formTypeLabel } from "@/lib/forms/types";
import { isMissingRelation } from "./collect";
import { addDays, arizonaDayStartIso, arizonaToday, type ResolvedRange } from "./dates";
import { channelLabel, type Channel } from "./types";
import { credentialPresence } from "@/lib/credentials/server";

// ── Report (analytics_report jsonb) ─────────────────────────────────────────

export type Totals = {
  views: number;
  visitors: number;
  sessions: number;
  engaged_sessions: number;
  engaged_ms: number;
  leads: number;
  bookings: number;
  registrations: number;
  conversions: number;
  days_with_data: number;
};

export type ChannelRow = Omit<Totals, "days_with_data"> & { channel: Channel };
export type TrendRow = { day: string; channel: Channel | "*"; visitors: number; views: number; sessions: number; engaged_sessions: number; conversions: number };
export type PageRow = { path: string; views: number; visitors: number; sessions: number; engaged_sessions: number; engaged_ms: number; conversions: number };

export type Report = {
  totals: Totals;
  channels: ChannelRow[];
  trend: TrendRow[];
  pages: PageRow[];
  campaigns: { campaign: string; source: string; medium: string; channel: Channel; sessions: number; views: number }[];
  campaign_conversions: { campaign: string; conversions: number }[];
  ai_sources: { source: string; sessions: number; visitors: number; views: number }[];
  ai_pages: { path: string; source: string; sessions: number; views: number }[];
  referrers: { host: string; channel: Channel; sessions: number; views: number }[];
  clicks: { event: string; clicks: number }[];
  outbound: { target: string; clicks: number }[];
  devices: { device: string; sessions: number }[];
  page_engagement: { path: string; avg_scroll: number; avg_engaged_ms: number; samples: number }[];
  bots: { bot: string; hits: number; pages: number; last_seen_at: string }[];
  bot_pages: { path: string; hits: number; bots: number; bot_names: string }[];
  bot_trend: { day: string; bot: string; hits: number }[];
  last_event_at: string | null;
  last_rollup_at: string | null;
};

export const EMPTY_TOTALS: Totals = {
  views: 0,
  visitors: 0,
  sessions: 0,
  engaged_sessions: 0,
  engaged_ms: 0,
  leads: 0,
  bookings: 0,
  registrations: 0,
  conversions: 0,
  days_with_data: 0,
};

export function emptyReport(): Report {
  return {
    totals: { ...EMPTY_TOTALS },
    channels: [],
    trend: [],
    pages: [],
    campaigns: [],
    campaign_conversions: [],
    ai_sources: [],
    ai_pages: [],
    referrers: [],
    clicks: [],
    outbound: [],
    devices: [],
    page_engagement: [],
    bots: [],
    bot_pages: [],
    bot_trend: [],
    last_event_at: null,
    last_rollup_at: null,
  };
}

function normalizeReport(raw: unknown): Report {
  const base = emptyReport();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const out = { ...base } as Record<string, unknown>;
  for (const k of Object.keys(base) as (keyof Report)[]) {
    if (k === "totals") {
      const t = (r.totals ?? {}) as Record<string, unknown>;
      out.totals = Object.fromEntries(Object.keys(EMPTY_TOTALS).map((key) => [key, Number(t[key] ?? 0) || 0]));
    } else if (Array.isArray(base[k])) {
      out[k] = Array.isArray(r[k]) ? r[k] : [];
    } else {
      out[k] = (r[k] as string | null) ?? null;
    }
  }
  return out as Report;
}

export type ReportResult = { current: Report; previous: Report | null; missing: boolean; error: string | null };

async function fetchReport(from: string, to: string): Promise<{ report: Report; missing: boolean; error: string | null }> {
  try {
    const { data, error } = await createSupabaseAdminClient().rpc("analytics_report", { p_from: from, p_to: to });
    if (error) {
      return { report: emptyReport(), missing: isMissingRelation(error), error: isMissingRelation(error) ? null : error.message };
    }
    return { report: normalizeReport(data), missing: false, error: null };
  } catch (e) {
    return { report: emptyReport(), missing: false, error: e instanceof Error ? e.message : "Analytics unavailable." };
  }
}

export async function getReport(range: ResolvedRange): Promise<ReportResult> {
  const [cur, prev] = await Promise.all([fetchReport(range.from, range.to), range.compare ? fetchReport(range.prevFrom, range.prevTo) : Promise.resolve(null)]);
  return { current: cur.report, previous: prev?.report ?? null, missing: cur.missing, error: cur.error };
}

/** Percentage change, or null when there is no baseline. */
export function delta(cur: number, prev: number | null | undefined): number | null {
  if (prev == null || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

// ── Conversions (raw tables) ───────────────────────────────────────────────

export type Conversion = {
  id: string;
  kind: "lead" | "booking" | "registration" | "card_lead";
  type: string; // form type / booking page / event / card
  detail: string; // subject, planner, event title
  channel: string;
  source: string | null;
  campaign: string | null;
  landing_path: string | null;
  created_at: string;
};

type Touchish = { channel?: string; source?: string | null; campaign?: string | null } | null;

/** Select with attribution columns; if they don't exist yet, select without them. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any;
async function selectSoft<T>(
  table: string,
  withAttr: string,
  without: string,
  build: (q: AnyQuery) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>,
): Promise<{ rows: T[]; error: string | null }> {
  const sb = createSupabaseAdminClient();
  try {
    let res = await build(sb.from(table).select(withAttr));
    if (res.error && /column|PGRST204|42703/i.test(`${res.error.code} ${res.error.message}`)) res = await build(sb.from(table).select(without));
    if (res.error) return { rows: [], error: isMissingRelation(res.error) ? null : res.error.message ?? "Query failed" };
    return { rows: (res.data ?? []) as T[], error: null };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : "Query failed" };
  }
}

export async function getConversions(range: ResolvedRange, limit = 1000): Promise<{ rows: Conversion[]; error: string | null }> {
  const fromIso = arizonaDayStartIso(range.from);
  const toIso = arizonaDayStartIso(addDays(range.to, 1));
  const window = (q: AnyQuery) =>
    q.gte("created_at", fromIso).lt("created_at", toIso).order("created_at", { ascending: false }).limit(limit);

  const [forms, bookings, regs, cards] = await Promise.all([
    selectSoft<{ id: string; form_type: string; subject: string | null; created_at: string; last_touch?: Touchish; landing_path?: string | null; deleted_at: string | null }>(
      "form_submissions",
      "id, form_type, subject, created_at, deleted_at, last_touch, landing_path",
      "id, form_type, subject, created_at, deleted_at",
      (q: AnyQuery) => window(q.is("deleted_at", null)),
    ),
    selectSoft<{ id: string; created_at: string; source: string | null; last_touch?: Touchish; landing_path?: string | null; booking_type: { name: string; host_name: string | null } | null }>(
      "bookings",
      "id, created_at, source, last_touch, landing_path, booking_type:booking_types(name, host_name)",
      "id, created_at, source, booking_type:booking_types(name, host_name)",
      (q: AnyQuery) => window(q.neq("source", "mcp")),
    ),
    selectSoft<{ id: string; created_at: string; status: string; last_touch?: Touchish; landing_path?: string | null; event: { title: string } | null }>(
      "event_registrations",
      "id, created_at, status, last_touch, landing_path, event:events(title)",
      "id, created_at, status, event:events(title)",
      (q: AnyQuery) => window(q),
    ),
    selectSoft<{ id: string; created_at: string; card_id: string }>(
      "business_card_leads",
      "id, created_at, card_id",
      "id, created_at, card_id",
      (q: AnyQuery) => window(q),
    ),
  ]);

  const t = (x: Touchish | undefined) => ({ channel: x?.channel ?? "direct", source: x?.source ?? null, campaign: x?.campaign ?? null });
  const rows: Conversion[] = [
    ...forms.rows.map((r) => ({ id: r.id, kind: "lead" as const, type: formTypeLabel(r.form_type), detail: r.subject ?? "", ...t(r.last_touch), landing_path: r.landing_path ?? null, created_at: r.created_at })),
    ...bookings.rows.map((r) => ({
      id: r.id,
      kind: "booking" as const,
      type: r.booking_type?.name ?? "Booking",
      detail: r.booking_type?.host_name ?? "",
      ...t(r.last_touch),
      landing_path: r.landing_path ?? null,
      created_at: r.created_at,
    })),
    ...regs.rows.map((r) => ({ id: r.id, kind: "registration" as const, type: r.event?.title ?? "Event", detail: r.status, ...t(r.last_touch), landing_path: r.landing_path ?? null, created_at: r.created_at })),
    ...cards.rows.map((r) => ({ id: r.id, kind: "card_lead" as const, type: "Business card lead", detail: "", channel: "business_card", source: "business_card", campaign: null, landing_path: "/c", created_at: r.created_at })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));

  const error = [forms.error, bookings.error, regs.error, cards.error].filter(Boolean).join("; ") || null;
  return { rows, error };
}

export const CONVERSION_KIND_LABELS: Record<Conversion["kind"], string> = {
  lead: "Lead",
  booking: "Booking",
  registration: "Event sign-up",
  card_lead: "Card lead",
};

/** Count rows by a key, sorted descending. */
export function countBy<T>(rows: T[], key: (r: T) => string): { key: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].map(([k, count]) => ({ key: k, count })).sort((a, b) => b.count - a.count);
}

export function conversionsCsv(rows: Conversion[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    // Neutralise spreadsheet formulas, then quote.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const head = ["created_at", "kind", "type", "detail", "channel", "source", "campaign", "landing_path"];
  const lines = rows.map((r) =>
    [r.created_at, CONVERSION_KIND_LABELS[r.kind], r.type, r.detail, channelLabel(r.channel), r.source, r.campaign, r.landing_path].map(esc).join(","),
  );
  return [head.join(","), ...lines].join("\r\n");
}

// ── MCP connector usage ────────────────────────────────────────────────────

export type McpUsage = { total: number; failures: number; clients: { key: string; count: number }[]; tools: { key: string; count: number }[]; error: string | null; missing: boolean };

export async function getMcpUsage(range: ResolvedRange): Promise<McpUsage> {
  try {
    const { data, error } = await createSupabaseAdminClient()
      .from("mcp_audit_log")
      .select("tool, client_name, client_kind, success")
      .gte("created_at", arizonaDayStartIso(range.from))
      .lt("created_at", arizonaDayStartIso(addDays(range.to, 1)))
      .limit(5000);
    if (error) return { total: 0, failures: 0, clients: [], tools: [], error: isMissingRelation(error) ? null : error.message, missing: isMissingRelation(error) };
    const rows = (data ?? []) as { tool: string; client_name: string | null; client_kind: string | null; success: boolean | null }[];
    return {
      total: rows.length,
      failures: rows.filter((r) => r.success === false).length,
      clients: countBy(rows, (r) => r.client_name || r.client_kind || "Unknown client"),
      tools: countBy(rows, (r) => r.tool).slice(0, 15),
      error: null,
      missing: false,
    };
  } catch (e) {
    return { total: 0, failures: 0, clients: [], tools: [], error: e instanceof Error ? e.message : "Unavailable", missing: false };
  }
}

// ── Email & SMS (what exists before Phase 3) ────────────────────────────────

export type Messaging = {
  email: { sent: number; failed: number; skipped: number; queued: number };
  sms: { delivered: number; sent: number; failed: number; inbound: number };
  error: string | null;
};

export async function getMessaging(range: ResolvedRange): Promise<Messaging> {
  const sb = createSupabaseAdminClient();
  const fromIso = arizonaDayStartIso(range.from);
  const toIso = arizonaDayStartIso(addDays(range.to, 1));
  const errors: string[] = [];
  const head = { count: "exact" as const, head: true };
  async function count(q: PromiseLike<{ count: number | null; error: { message: string; code?: string } | null }>) {
    try {
      const { count: n, error } = await q;
      if (error && !isMissingRelation(error)) errors.push(error.message);
      return n ?? 0;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "failed");
      return 0;
    }
  }
  const email = (status: string) => count(sb.from("email_send_logs").select("id", head).eq("status", status).gte("created_at", fromIso).lt("created_at", toIso));
  const sms = (statuses: string[], direction = "outbound") =>
    count(sb.from("sms_messages").select("id", head).eq("direction", direction).in("status", statuses).gte("created_at", fromIso).lt("created_at", toIso));
  const [sent, failed, skipped, queued, delivered, smsSent, smsFailed, inbound] = await Promise.all([
    email("sent"),
    email("failed"),
    email("skipped"),
    email("queued"),
    sms(["delivered", "read"]),
    sms(["sent", "accepted", "queued", "sending", "scheduled"]),
    sms(["failed", "undelivered", "canceled"]),
    sms(["received", "receiving"], "inbound"),
  ]);
  return { email: { sent, failed, skipped, queued }, sms: { delivered, sent: smsSent, failed: smsFailed, inbound }, error: errors[0] ?? null };
}

// ── Connections ─────────────────────────────────────────────────────────────

export type ConnectionStatus = "live" | "waiting" | "needs_setup" | "error";

export type Connection = {
  key: string;
  name: string;
  phase: number;
  status: ConnectionStatus;
  detail: string;
  lastSync: string | null;
  steps: string[];
};


export async function getConnections(): Promise<{ connections: Connection[]; migrationMissing: boolean }> {
  const sb = createSupabaseAdminClient();
  // Dashboard Credentials first, then Coolify env vars: Connections and the Credentials page agree.
  const has = await credentialPresence();
  let migrationMissing = false;
  let lastEvent: string | null = null;
  let lastBot: string | null = null;
  const runs = new Map<string, { status: string; finished_at: string | null; started_at: string; error: string | null }>();

  try {
    const [ev, bot, sync] = await Promise.all([
      sb.from("analytics_events").select("occurred_at").order("occurred_at", { ascending: false }).limit(1),
      sb.from("analytics_bot_hits").select("last_seen_at").order("last_seen_at", { ascending: false }).limit(1),
      sb.from("analytics_sync_runs").select("source, status, started_at, finished_at, error").order("started_at", { ascending: false }).limit(200),
    ]);
    if (ev.error && isMissingRelation(ev.error)) migrationMissing = true;
    lastEvent = (ev.data?.[0] as { occurred_at?: string } | undefined)?.occurred_at ?? null;
    lastBot = (bot.data?.[0] as { last_seen_at?: string } | undefined)?.last_seen_at ?? null;
    for (const r of (sync.data ?? []) as { source: string; status: string; started_at: string; finished_at: string | null; error: string | null }[]) {
      if (!runs.has(r.source)) runs.set(r.source, r);
    }
  } catch {
    migrationMissing = true;
  }

  const rollup = runs.get("rollup");
  const fp: ConnectionStatus = migrationMissing ? "needs_setup" : lastEvent ? "live" : "waiting";
  const connections: Connection[] = [
    {
      key: "website",
      name: "Website tracker (first-party)",
      phase: 1,
      status: fp,
      detail: migrationMissing
        ? "Apply the analytics migration to start collecting."
        : lastEvent
          ? "Collecting page views, engagement and clicks."
          : "Ready — waiting for the first visit on the live site.",
      lastSync: lastEvent,
      steps: migrationMissing ? ["Run supabase/migrations/202611210190_analytics.sql in the Supabase SQL editor.", "Set ANALYTICS_IP_SALT (any long random string) in Coolify."] : has("ANALYTICS_IP_SALT") ? [] : ["Set ANALYTICS_IP_SALT (any long random string) in Coolify so visitor hashes stay stable across restarts."],
    },
    {
      key: "bots",
      name: "AI crawler & search bot log",
      phase: 1,
      status: migrationMissing ? "needs_setup" : lastBot ? "live" : "waiting",
      detail: lastBot ? "Logging GPTBot, ClaudeBot, PerplexityBot, Googlebot and others." : "Ready — waiting for the first crawler visit.",
      lastSync: lastBot,
      steps: migrationMissing ? ["Run the analytics migration."] : [],
    },
    {
      key: "rollup",
      name: "Daily rollups (cron)",
      phase: 1,
      status: migrationMissing ? "needs_setup" : !has("CRON_SECRET") ? "needs_setup" : rollup ? (rollup.status === "error" ? "error" : "live") : "waiting",
      detail: rollup?.status === "error" ? `Last run failed: ${rollup.error ?? "unknown error"}` : rollup ? "Rebuilding today every 15 minutes and yesterday nightly." : "Waiting for the first scheduled run.",
      lastSync: rollup?.finished_at ?? rollup?.started_at ?? null,
      steps: [
        ...(has("CRON_SECRET") ? [] : ["Set CRON_SECRET in Coolify."]),
        ...(rollup ? [] : ["Add the two Coolify scheduled tasks in docs/DEPLOY_COOLIFY.md (analytics-cron intraday + nightly)."]),
      ],
    },
    {
      key: "conversions",
      name: "Conversion attribution",
      phase: 1,
      status: migrationMissing ? "needs_setup" : "live",
      detail: "Contact, newsletter, booking and event forms record first and last touch.",
      lastSync: null,
      steps: migrationMissing ? ["Run the analytics migration (adds first_touch / last_touch columns)."] : [],
    },
    {
      key: "business_cards",
      name: "Business cards",
      phase: 1,
      status: "live",
      detail: "Card views, scans, taps and leads from the existing card tracking.",
      lastSync: null,
      steps: [],
    },
    {
      key: "mcp",
      name: "AI connectors (MCP)",
      phase: 1,
      status: "live",
      detail: "Claude / ChatGPT connector usage from the MCP audit log.",
      lastSync: null,
      steps: [],
    },
    {
      key: "search_console",
      name: "Google Search Console",
      phase: 2,
      status: has("GOOGLE_SA_JSON", "GSC_SITE_URL") ? (runs.get("search_console") ? "live" : "waiting") : "needs_setup",
      detail: "Search queries, clicks, impressions, CTR and average position.",
      lastSync: runs.get("search_console")?.finished_at ?? null,
      steps: [
        "Verify strategicincomegroup.com in Google Search Console (DNS TXT record).",
        "Create a Google Cloud service account and add it as a user on the Search Console property.",
        "Put the service account JSON in GOOGLE_SA_JSON and the property in GSC_SITE_URL (Coolify).",
      ],
    },
    {
      key: "business_profile",
      name: "Google Business Profile",
      phase: 2,
      status: has("GOOGLE_SA_JSON", "GBP_LOCATION_ID") ? (runs.get("business_profile") ? "live" : "waiting") : "needs_setup",
      detail: "Map and search views, calls, direction requests and website clicks.",
      lastSync: runs.get("business_profile")?.finished_at ?? null,
      steps: [
        "Request Business Profile API access from Google (approval can take days to weeks).",
        "Add the same service account as a manager on both office listings.",
        "Set GBP_LOCATION_ID in Coolify.",
      ],
    },
    {
      key: "resend",
      name: "Email events (Resend)",
      phase: 3,
      status: has("RESEND_WEBHOOK_SECRET") ? (runs.get("resend") ? "live" : "waiting") : "needs_setup",
      detail: "Delivered, opened (estimated), clicked, bounced and spam complaints.",
      lastSync: null,
      steps: ["Create a Resend webhook pointing at /api/webhooks/resend.", "Put its signing secret in RESEND_WEBHOOK_SECRET (Coolify)."],
    },
    {
      key: "short_links",
      name: "SMS & email short links",
      phase: 3,
      status: "needs_setup",
      detail: "SIG short links (/r/code) that count clicks from texts, emails and posts.",
      lastSync: null,
      steps: ["Ships with Phase 3 — nothing for SIG to provide."],
    },
    {
      key: "meta",
      name: "Facebook & Instagram (Meta)",
      phase: 4,
      status: has("META_APP_ID", "META_APP_SECRET") ? "waiting" : "needs_setup",
      detail: "Followers, reach, impressions and engagement per account and post.",
      lastSync: runs.get("meta")?.finished_at ?? null,
      steps: ["Create a Meta Business app and connect the SIG Facebook Page and Instagram account.", "Grant page admin access, then set the META_* variables in Coolify."],
    },
    {
      key: "linkedin",
      name: "LinkedIn",
      phase: 4,
      status: has("LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET") ? "waiting" : "needs_setup",
      detail: "Company page followers and post engagement.",
      lastSync: runs.get("linkedin")?.finished_at ?? null,
      steps: ["Create a LinkedIn app and apply for the Community Management API (review takes weeks).", "Set the LINKEDIN_* variables in Coolify."],
    },
    {
      key: "siggy",
      name: "Siggy question log",
      phase: 4,
      status: "needs_setup",
      detail: "What visitors ask Siggy, and which questions have no answer yet.",
      lastSync: null,
      steps: ["Ships with Phase 4 — nothing for SIG to provide."],
    },
  ];
  return { connections, migrationMissing };
}

// ── Cron: rollup + retention ────────────────────────────────────────────────

export type SyncResult = { ok: boolean; mode: "nightly" | "intraday"; days: { day: string; rows: number }[]; purged: number | null; error: string | null; migrationMissing: boolean };

export async function runAnalyticsSync(mode: "nightly" | "intraday"): Promise<SyncResult> {
  const sb = createSupabaseAdminClient();
  const today = arizonaToday();
  const days = mode === "nightly" ? [addDays(today, -1), today] : [today];
  const result: SyncResult = { ok: true, mode, days: [], purged: null, error: null, migrationMissing: false };

  let runId: string | null = null;
  const started = await sb.from("analytics_sync_runs").insert({ source: "rollup", mode, status: "running" }).select("id").single();
  if (started.error) {
    if (isMissingRelation(started.error)) {
      return { ...result, ok: true, migrationMissing: true, error: "Analytics tables not found — apply 202611210190_analytics.sql. Nothing to do." };
    }
  } else {
    runId = (started.data as { id: string }).id;
  }

  try {
    for (const day of days) {
      const { data, error } = await sb.rpc("analytics_rollup", { p_day: day });
      if (error) throw new Error(error.message);
      result.days.push({ day, rows: Number(data ?? 0) });
    }
    if (mode === "nightly") {
      const { data, error } = await sb.rpc("analytics_purge", { p_months: 13 });
      if (error) throw new Error(error.message);
      result.purged = Number(data ?? 0);
    }
  } catch (e) {
    result.ok = false;
    result.error = e instanceof Error ? e.message : "Rollup failed";
  }

  if (runId) {
    await sb
      .from("analytics_sync_runs")
      .update({
        status: result.ok ? "ok" : "error",
        finished_at: new Date().toISOString(),
        row_count: result.days.reduce((s, d) => s + d.rows, 0),
        error: result.error?.slice(0, 2000) ?? null,
        details: { days: result.days, purged: result.purged },
      })
      .eq("id", runId);
  }
  if (!result.ok) {
    // Alerts feed: one unread alert per mode at a time (de-duplicated for 12 hours).
    const { raiseAlert } = await import("@/lib/notifications/alerts");
    await raiseAlert({
      severity: "warning",
      category: "analytics",
      title: `Analytics ${mode} sync failed`,
      message: result.error ?? "The rollup did not finish.",
      audience: "admins",
      href: "/dashboard/analytics/connections",
      dedupeKey: `analytics_sync_${mode}`,
      dedupeHours: 12,
    });
  }
  return result;
}
