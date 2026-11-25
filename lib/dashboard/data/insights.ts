import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { wantsFirm } from "@/lib/dashboard/viewer";
import { getDashboardPrefs, getWhatsNewDismissed } from "@/lib/dashboard/layout";
import type { DashboardViewer } from "@/lib/dashboard/types";
import { getSigOverview } from "@/lib/dashboard/overview";
import { getInvitationCounts, getRecentInvitations } from "@/lib/user-management/repository";
import { addDays, arizonaDayStartIso, arizonaToday, eachDay } from "@/lib/analytics/dates";
import { DataForbidden, bucketByDay, clampInt, head, safeCount } from "./util";

function isMissingRelation(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /relation .* does not exist|could not find the table/i.test(error.message ?? "");
}

// ── Charts ────────────────────────────────────────────────────────────────────
export async function loadCharts(viewer: DashboardViewer, params: Record<string, unknown> = {}) {
  if (!viewer.isStaff) throw new DataForbidden();
  const days = clampInt(params.days, 7, 90, 30);
  const firm = wantsFirm(viewer, params);
  const today = arizonaToday();
  const dayList = eachDay(addDays(today, -(days - 1)), today);
  const since = arizonaDayStartIso(dayList[0]);
  const sb = createSupabaseAdminClient();
  const comms = viewer.permissions.includes(PERMISSIONS.MANAGE_PARTICIPANTS);
  const want = (k: string) => params[k] !== false;

  const series: { key: string; label: string; values: number[] }[] = [];
  const jobs: Promise<void>[] = [];
  if (comms && want("calls")) {
    jobs.push(
      (async () => {
        let q = sb.from("calls").select("created_at").gte("created_at", since).limit(10000);
        if (!firm) q = q.eq("handled_by", viewer.id);
        const { data } = await q;
        series.push({ key: "calls", label: "Calls", values: bucketByDay(((data ?? []) as { created_at: string }[]).map((r) => r.created_at), dayList) });
      })(),
    );
  }
  if (comms && want("sms")) {
    jobs.push(
      (async () => {
        let q = sb.from("sms_messages").select("created_at").gte("created_at", since).limit(10000);
        if (!firm) q = q.eq("sent_by", viewer.id);
        const { data } = await q;
        series.push({ key: "sms", label: "Texts", values: bucketByDay(((data ?? []) as { created_at: string }[]).map((r) => r.created_at), dayList) });
      })(),
    );
  }
  if (want("bookings")) {
    jobs.push(
      (async () => {
        let q = sb.from("bookings").select("created_at").gte("created_at", since).limit(10000);
        if (!firm) q = q.eq("host_staff_id", viewer.id);
        const { data } = await q;
        series.push({ key: "bookings", label: "Bookings", values: bucketByDay(((data ?? []) as { created_at: string }[]).map((r) => r.created_at), dayList) });
      })(),
    );
  }
  await Promise.all(jobs);
  const order = ["calls", "sms", "bookings"];
  series.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return { days: dayList, series, firm };
}

// ── Firm at a glance ──────────────────────────────────────────────────────────
export async function loadFirmOverview(viewer: DashboardViewer) {
  if (!viewer.isStaff) throw new DataForbidden();
  const o = await getSigOverview();
  return { ...o, error: viewer.isAdmin ? o.error : null };
}

// ── Invitations ───────────────────────────────────────────────────────────────
export async function loadInvitations(viewer: DashboardViewer) {
  if (!viewer.permissions.includes(PERMISSIONS.MANAGE_USERS)) throw new DataForbidden();
  const [counts, invitations] = await Promise.all([getInvitationCounts(), getRecentInvitations(100)]);
  return { counts, invitations };
}

// ── What's new ────────────────────────────────────────────────────────────────
export type WhatsNewItem = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  link: string | null;
  audience: "everyone" | "staff" | "admins";
  publishedAt: string;
  dismissed: boolean;
};

export async function loadWhatsNew(viewer: DashboardViewer) {
  const audiences = ["everyone", ...(viewer.isStaff ? ["staff"] : []), ...(viewer.isAdmin ? ["admins"] : [])];
  const [res, dismissed] = await Promise.all([
    createSupabaseAdminClient()
      .from("whats_new")
      .select("id, title, body, image_url, link, audience, published_at")
      .in("audience", audiences)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(30),
    getWhatsNewDismissed(viewer.id),
  ]);
  if (res.error) return { items: [] as WhatsNewItem[], canPost: viewer.isSuperAdmin, unavailable: isMissingRelation(res.error) };
  const hidden = new Set(dismissed);
  const items: WhatsNewItem[] = ((res.data ?? []) as { id: string; title: string; body: string; image_url: string | null; link: string | null; audience: WhatsNewItem["audience"]; published_at: string }[]).map((r) => ({
    id: r.id, title: r.title, body: r.body, imageUrl: r.image_url, link: r.link, audience: r.audience, publishedAt: r.published_at, dismissed: hidden.has(r.id),
  }));
  return { items, canPost: viewer.isSuperAdmin, unavailable: false };
}

// ── Get started checklist ─────────────────────────────────────────────────────
export type ChecklistItem = { key: string; label: string; detail: string; done: boolean; href?: string; action?: "wizard" | "post_update" | "customize" };

export async function loadGetStarted(viewer: DashboardViewer) {
  const sb = createSupabaseAdminClient();
  const comms = viewer.permissions.includes(PERMISSIONS.MANAGE_PARTICIPANTS);
  const [profile, bookingTypes, calls, push, posts, prefs] = await Promise.all([
    sb.from("profiles").select("first_name, last_name, avatar_url, phone").eq("id", viewer.id).maybeSingle().then((r) => r.data as { first_name: string | null; last_name: string | null; avatar_url: string | null; phone?: string | null } | null),
    viewer.isStaff ? safeCount(sb.from("booking_types").select("id", head).eq("host_staff_id", viewer.id)) : Promise.resolve(0),
    comms ? safeCount(sb.from("calls").select("id", head).eq("handled_by", viewer.id)) : Promise.resolve(0),
    safeCount(sb.from("push_subscriptions").select("id", head).eq("user_id", viewer.id)),
    viewer.isSuperAdmin ? safeCount(sb.from("whats_new").select("id", head)) : Promise.resolve(0),
    getDashboardPrefs(viewer),
  ]);
  const items: ChecklistItem[] = [
    { key: "profile", label: "Complete your profile", detail: "Add your name and a photo so the team knows it's you.", done: Boolean(profile?.first_name && profile?.last_name && profile?.avatar_url), href: "/dashboard/profile" },
    { key: "dashboard", label: "Make the dashboard yours", detail: "Pick a focus and the cards you want to see.", done: prefs.customized, action: "wizard" },
    { key: "push", label: "Turn on notifications", detail: "Get alerts on this device for messages and bookings.", done: push > 0, href: "/dashboard/preferences" },
  ];
  if (viewer.isStaff) items.splice(1, 0, { key: "booking", label: "Set up a booking page", detail: "Let clients book time with you.", done: bookingTypes > 0, href: "/dashboard/bookings" });
  if (comms) items.push({ key: "call", label: "Place a test call", detail: "Try the browser phone from the dialer.", done: calls > 0, href: "/dashboard/dialer" });
  if (viewer.isSuperAdmin) items.push({ key: "update", label: "Post an update", detail: "Share what's new with the team.", done: posts > 0, action: "post_update" });
  return { items, done: items.filter((i) => i.done).length, total: items.length, dismissed: prefs.getStartedDismissed };
}
