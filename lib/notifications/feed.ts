import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DashboardViewer } from "@/lib/dashboard/types";

// Per-user notifications feed (and the Alerts feed — notifications with a severity).
// A user sees rows addressed to them; admins also see firm-wide rows (user_id is null),
// e.g. survey and form notifications from before per-user addressing existed.

export type FeedItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical" | null;
  category: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
};

export type Feed = { items: FeedItem[]; unread: number; alertsReady: boolean };

function isMissingColumn(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === "42703" || error.code === "PGRST204" || /column .* does not exist|schema cache/i.test(error.message ?? "");
}

function scope<T>(q: T, viewer: DashboardViewer): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = q as any;
  return (viewer.isAdmin ? b.or(`user_id.eq.${viewer.id},user_id.is.null`) : b.eq("user_id", viewer.id)) as T;
}

function toItem(r: Record<string, unknown>): FeedItem {
  const meta = (r.metadata && typeof r.metadata === "object" ? r.metadata : {}) as Record<string, unknown>;
  const href = typeof meta.href === "string" && meta.href.startsWith("/") ? meta.href : null;
  return {
    id: String(r.id),
    type: String(r.type ?? ""),
    title: String(r.title ?? ""),
    message: String(r.message ?? ""),
    severity: (r.severity as FeedItem["severity"]) ?? null,
    category: (r.category as string | null) ?? null,
    href,
    read: Boolean(r.read_at),
    createdAt: String(r.created_at),
  };
}

export async function getFeed(viewer: DashboardViewer, opts: { limit?: number; unreadOnly?: boolean; alertsOnly?: boolean; minSeverity?: "warning" | "critical" } = {}): Promise<Feed> {
  const sb = createSupabaseAdminClient();
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
  const cols = "id, type, title, message, metadata, read_at, created_at, severity, category";

  const build = (withAlerts: boolean) => {
    let q = sb.from("notifications").select(withAlerts ? cols : "id, type, title, message, metadata, read_at, created_at").eq("destination", "dashboard");
    q = scope(q, viewer);
    if (opts.unreadOnly) q = q.is("read_at", null);
    if (withAlerts && opts.alertsOnly) q = q.not("severity", "is", null);
    if (withAlerts && opts.minSeverity === "warning") q = q.in("severity", ["warning", "critical"]);
    if (withAlerts && opts.minSeverity === "critical") q = q.eq("severity", "critical");
    // Unread first, newest first.
    return q.order("read_at", { ascending: false, nullsFirst: true }).order("created_at", { ascending: false }).limit(limit);
  };
  const countUnread = (withAlerts: boolean) => {
    let q = sb.from("notifications").select("id", { count: "exact", head: true }).eq("destination", "dashboard").is("read_at", null);
    q = scope(q, viewer);
    if (withAlerts && opts.alertsOnly) q = q.not("severity", "is", null);
    return q;
  };

  let alertsReady = true;
  let [{ data, error }, unread] = await Promise.all([build(true), countUnread(true)]);
  if (error && isMissingColumn(error)) {
    alertsReady = false;
    if (opts.alertsOnly) return { items: [], unread: 0, alertsReady };
    [{ data, error }, unread] = await Promise.all([build(false), countUnread(false)]);
  }
  if (error) throw new Error(error.message);
  return { items: ((data ?? []) as unknown as Record<string, unknown>[]).map(toItem), unread: unread.count ?? 0, alertsReady };
}

export async function countUnread(viewer: DashboardViewer, alertsOnly = false): Promise<number> {
  const sb = createSupabaseAdminClient();
  let q = sb.from("notifications").select("id", { count: "exact", head: true }).eq("destination", "dashboard").is("read_at", null);
  q = scope(q, viewer);
  if (alertsOnly) q = q.not("severity", "is", null);
  const { count, error } = await q;
  if (error) return 0;
  return count ?? 0;
}

export async function markRead(viewer: DashboardViewer, ids: string[] | "all", read = true): Promise<number> {
  const sb = createSupabaseAdminClient();
  let q = sb.from("notifications").update({ read_at: read ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("destination", "dashboard");
  q = scope(q, viewer);
  if (ids === "all") q = q.is("read_at", null);
  else q = q.in("id", ids.slice(0, 200));
  const { data, error } = await q.select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}
