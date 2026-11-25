import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { hasAccess, type Access } from "@/lib/dashboard/registry";
import { wantsFirm } from "@/lib/dashboard/viewer";
import type { DashboardViewer } from "@/lib/dashboard/types";
import { countMonitoredSessions, formatTalkTime, isMissedCall, loadCalls, summarizeCalls } from "@/lib/voice/stats";
import { getQuotes, INDEX_FUNDS } from "@/lib/markets/finnhub";
import { countUnread } from "@/lib/notifications/feed";
import { getDmStats } from "@/lib/direct-messages/data";
import { getInvitationCounts } from "@/lib/user-management/repository";
import { getMyOpenTasks } from "@/lib/project-manager/my-tasks";
import { arizonaToday, addDays, arizonaDayStartIso } from "@/lib/analytics/dates";
import { DataBadRequest, DataForbidden, asPeriod, bucketByDay, head, pctDelta, periodRange, safeCount } from "./util";

export type StatResult = {
  value: number | null;
  display: string;
  detail: string;
  /** % change vs the previous period of the same length (null = no baseline). */
  delta?: number | null;
  /** For markets: green when up. For counts the client decides the tone. */
  direction?: "up" | "down" | "flat";
  spark?: number[];
  href?: string;
  /** A state the card should show instead of the number. */
  state?: "connect_markets" | "unavailable";
  scope?: "firm" | "mine";
  periodLabel?: string;
};

const COMMS: Access = PERMISSIONS.MANAGE_PARTICIPANTS;

const METRIC_ACCESS: Record<string, Access> = {
  calls_outbound: COMMS, calls_inbound: COMMS, calls_missed: COMMS, calls_monitored: COMMS, calls_recorded: COMMS,
  sms: COMMS, bookings: "all", calendar: "all", market: "all", dow: "all", nasdaq: "all", sp500: "all",
  notifications: "all", messages: "all", alerts: "all", emails: PERMISSIONS.MANAGE_SETTINGS, files: "staff",
  contacts: "staff", leads: "staff", invitations: PERMISSIONS.MANAGE_USERS, visitors: PERMISSIONS.VIEW_REPORTS,
};

const fmt = (n: number) => n.toLocaleString("en-US");
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function loadStat(viewer: DashboardViewer, params: Record<string, unknown> = {}): Promise<StatResult> {
  const metric = String(params.metric ?? "");
  const access = METRIC_ACCESS[metric];
  if (!access) throw new DataBadRequest("Unknown stat.");
  if (!hasAccess(viewer, access)) throw new DataForbidden();

  const sb = createSupabaseAdminClient();
  const range = periodRange(asPeriod(params.period));
  const firm = wantsFirm(viewer, params);
  const scope: "firm" | "mine" = firm ? "firm" : "mine";
  const base = { scope, periodLabel: range.label };

  // ── Calls ──
  if (metric.startsWith("calls_")) {
    const handledBy = firm ? null : viewer.id;
    if (metric === "calls_monitored") {
      const [cur, prev] = await Promise.all([
        countMonitoredSessions({ since: range.since, monitorId: handledBy }),
        countMonitoredSessions({ since: range.prevSince, until: range.prevUntil, monitorId: handledBy }),
      ]);
      return { ...base, value: cur, display: fmt(cur), detail: `Listen, whisper or barge · ${range.label}`, delta: pctDelta(cur, prev), href: "/dashboard/dialer" };
    }
    const [calls, prevCalls] = await Promise.all([
      loadCalls({ since: range.since, handledBy }),
      loadCalls({ since: range.prevSince, until: range.prevUntil, handledBy }),
    ]);
    const s = summarizeCalls(calls);
    const p = summarizeCalls(prevCalls);
    const pick = {
      calls_outbound: { v: s.outbound, pv: p.outbound, rows: calls.filter((c) => c.direction === "outbound"), detail: `${formatTalkTime(calls.filter((c) => c.direction === "outbound").reduce((t, c) => t + (c.duration_seconds ?? 0), 0))} talk time` },
      calls_inbound: { v: s.inbound, pv: p.inbound, rows: calls.filter((c) => c.direction === "inbound"), detail: `${s.missed} missed · ${range.label}` },
      calls_missed: { v: s.missed, pv: p.missed, rows: calls.filter(isMissedCall), detail: `${s.voicemails} voicemail${s.voicemails === 1 ? "" : "s"} · ${range.label}` },
      calls_recorded: { v: s.recorded, pv: p.recorded, rows: calls.filter((c) => c.recording_url), detail: `${formatTalkTime(s.talkTimeSeconds)} total talk time` },
    }[metric as "calls_outbound" | "calls_inbound" | "calls_missed" | "calls_recorded"];
    return { ...base, value: pick.v, display: fmt(pick.v), detail: pick.detail, delta: pctDelta(pick.v, pick.pv), spark: bucketByDay(pick.rows.map((c) => c.created_at), range.days), href: "/dashboard/dialer" };
  }

  // ── SMS ──
  if (metric === "sms") {
    const q = (since: string, until: string | null, direction?: "inbound" | "outbound") => {
      let x = sb.from("sms_messages").select("created_at").gte("created_at", since).limit(5000);
      if (until) x = x.lt("created_at", until);
      if (direction) x = x.eq("direction", direction);
      if (!firm) x = x.eq("sent_by", viewer.id);
      return x;
    };
    const [cur, prev] = await Promise.all([q(range.since, null), q(range.prevSince, range.prevUntil)]);
    const rows = (cur.data ?? []) as { created_at: string }[];
    const v = rows.length;
    let detail = firm ? `Sent and received · ${range.label}` : `Sent by you · ${range.label}`;
    if (firm) {
      const out = await safeCount(sb.from("sms_messages").select("id", head).gte("created_at", range.since).eq("direction", "outbound"));
      detail = `${fmt(out)} sent · ${fmt(Math.max(0, v - out))} received`;
    }
    return { ...base, value: v, display: fmt(v), detail, delta: pctDelta(v, (prev.data ?? []).length), spark: bucketByDay(rows.map((r) => r.created_at), range.days), href: "/dashboard/sms" };
  }

  // ── Bookings ──
  if (metric === "bookings") {
    const q = (since: string, until: string | null) => {
      let x = sb.from("bookings").select("created_at").gte("created_at", since).limit(5000);
      if (until) x = x.lt("created_at", until);
      if (!firm) x = x.eq("host_staff_id", viewer.id);
      return x;
    };
    let upcomingQ = sb.from("bookings").select("id", head).gte("start_at", new Date().toISOString()).in("status", ["confirmed", "pending"]);
    if (!firm) upcomingQ = upcomingQ.eq("host_staff_id", viewer.id);
    const [cur, prev, upcoming] = await Promise.all([q(range.since, null), q(range.prevSince, range.prevUntil), safeCount(upcomingQ)]);
    const rows = (cur.data ?? []) as { created_at: string }[];
    return { ...base, value: rows.length, display: fmt(rows.length), detail: `${fmt(upcoming)} upcoming`, delta: pctDelta(rows.length, (prev.data ?? []).length), spark: bucketByDay(rows.map((r) => r.created_at), range.days), href: "/dashboard/bookings" };
  }

  // ── Calendar (this week) ──
  if (metric === "calendar") {
    const today = arizonaToday();
    const weekEnd = arizonaDayStartIso(addDays(today, 7));
    const nowIso = new Date().toISOString();
    let bq = sb.from("bookings").select("id", head).gte("start_at", nowIso).lt("start_at", weekEnd).in("status", ["confirmed", "pending"]);
    if (!firm) bq = bq.eq("host_staff_id", viewer.id);
    const eq = sb.from("events").select("id", head).gte("start_at", nowIso).lt("start_at", weekEnd).eq("status", "published");
    const [appts, events, tasks] = await Promise.all([
      safeCount(bq),
      safeCount(eq),
      getMyOpenTasks({ id: viewer.id, role: viewer.role, email: viewer.email }).catch(() => []),
    ]);
    const weekTasks = tasks.filter((t) => t.dueDate && t.dueDate < weekEnd).length;
    const total = appts + events + weekTasks;
    return { ...base, periodLabel: "next 7 days", value: total, display: fmt(total), detail: `${appts} appt · ${events} event${events === 1 ? "" : "s"} · ${weekTasks} task${weekTasks === 1 ? "" : "s"}`, href: "/dashboard/bookings" };
  }

  // ── Markets ──
  if (metric === "market" || metric === "dow" || metric === "nasdaq" || metric === "sp500") {
    const m = await getQuotes();
    if (!m.configured) return { value: null, display: "—", detail: "Connect a market data key", state: "connect_markets" };
    const symbol = metric === "market" ? "SPY" : INDEX_FUNDS.find((f) => f.key === metric)!.symbol;
    const q = m.quotes.find((x) => x.symbol === symbol);
    if (!q) return { value: null, display: "—", detail: m.error ?? "Quote unavailable", state: "unavailable" };
    const direction = q.changePercent > 0.005 ? "up" : q.changePercent < -0.005 ? "down" : "flat";
    if (metric === "market") {
      const word = direction === "up" ? "Up" : direction === "down" ? "Down" : "Flat";
      return { value: q.changePercent, display: `${word} ${Math.abs(q.changePercent).toFixed(2)}%`, detail: `S&P 500 (SPY) ${money(q.price)} · ${m.open ? "Market open" : "Market closed"}`, delta: q.changePercent, direction };
    }
    return { value: q.price, display: money(q.price), detail: `${q.change >= 0 ? "+" : ""}${q.change.toFixed(2)} today · ${m.open ? "Open" : "Closed"}`, delta: q.changePercent, direction };
  }

  // ── Personal counters ──
  if (metric === "notifications") {
    const n = await countUnread(viewer);
    return { value: n, display: fmt(n), detail: n ? "Unread" : "All caught up" };
  }
  if (metric === "alerts") {
    const n = await countUnread(viewer, true);
    return { value: n, display: fmt(n), detail: n ? "Unread alerts" : "No open alerts" };
  }
  if (metric === "messages") {
    const dm = await getDmStats(viewer.id).catch(() => ({ unread: 0, activeConversations: 0, awaitingReply: 0 }));
    return { value: dm.unread, display: fmt(dm.unread), detail: dm.awaitingReply ? `${dm.awaitingReply} awaiting your reply` : `${dm.activeConversations} open conversation${dm.activeConversations === 1 ? "" : "s"}`, href: "/dashboard/direct-messages" };
  }

  // ── Firm counters ──
  if (metric === "emails") {
    const q = (since: string, until: string | null, status?: string) => {
      let x = sb.from("email_send_logs").select("id", head).gte("created_at", since);
      if (until) x = x.lt("created_at", until);
      if (status) x = x.eq("status", status);
      if (!firm) x = x.eq("sent_by", viewer.id);
      return x;
    };
    const [cur, prev, failed] = await Promise.all([safeCount(q(range.since, null)), safeCount(q(range.prevSince, range.prevUntil)), safeCount(q(range.since, null, "failed"))]);
    return { ...base, value: cur, display: fmt(cur), detail: failed ? `${failed} failed · ${range.label}` : `Sent · ${range.label}`, delta: pctDelta(cur, prev), href: "/dashboard/emails" };
  }
  if (metric === "files") {
    const [total, added] = await Promise.all([
      safeCount(sb.from("media_assets").select("id", head)),
      safeCount(sb.from("media_assets").select("id", head).gte("created_at", range.since)),
    ]);
    return { value: total, display: fmt(total), detail: `${fmt(added)} added ${range.label}`, href: "/dashboard/media-studio", periodLabel: range.label };
  }
  if (metric === "contacts" || metric === "leads") {
    const type = metric === "contacts" ? "contact" : "lead";
    const [n, recent] = await Promise.all([
      safeCount(sb.from("contacts").select("id", head).eq("type", type).neq("status", "archived")),
      safeCount(sb.from("contacts").select("id", head).eq("type", type).gte("created_at", periodRange("30d").since)),
    ]);
    return { value: n, display: fmt(n), detail: `${fmt(recent)} new in 30 days`, href: "/dashboard/contacts" };
  }
  if (metric === "invitations") {
    const c = await getInvitationCounts().catch(() => ({ sent: 0, pending: 0, accepted: 0, total: 0 }));
    return { value: c.pending, display: fmt(c.pending), detail: `${fmt(c.accepted)} accepted of ${fmt(c.sent)} sent`, href: "/dashboard/user-management" };
  }
  if (metric === "visitors") {
    const q = (fromDay: string, toDay: string) =>
      sb.from("analytics_daily").select("day, visitors").eq("path", "*").eq("channel", "*").gte("day", fromDay).lte("day", toDay).limit(400);
    const first = range.days[0] ?? arizonaToday();
    const startDay = range.period === "today" ? arizonaToday() : first;
    const spanDays = Math.max(1, Math.round((new Date(arizonaToday()).getTime() - new Date(startDay).getTime()) / 86_400_000) + 1);
    const prevTo = addDays(startDay, -1);
    const prevFrom = addDays(prevTo, -(spanDays - 1));
    const [cur, prev] = await Promise.all([q(startDay, arizonaToday()), q(prevFrom, prevTo)]);
    if (cur.error) return { value: null, display: "—", detail: "Analytics not set up yet", state: "unavailable" };
    const rows = (cur.data ?? []) as { day: string; visitors: number }[];
    const v = rows.reduce((t, r) => t + (r.visitors ?? 0), 0);
    const pv = ((prev.data ?? []) as { visitors: number }[]).reduce((t, r) => t + (r.visitors ?? 0), 0);
    const byDay = new Map(rows.map((r) => [r.day, r.visitors ?? 0]));
    return { value: v, display: fmt(v), detail: `Unique visitors · ${range.label}`, delta: pctDelta(v, pv), spark: range.days.map((d) => byDay.get(d) ?? 0), href: "/dashboard/analytics", periodLabel: range.label };
  }

  throw new DataBadRequest("Unknown stat.");
}
