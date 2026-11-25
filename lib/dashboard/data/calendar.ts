import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getMyOpenTasks, type MyTask } from "@/lib/project-manager/my-tasks";
import { loadUpcomingBookings } from "@/lib/booking/data";
import type { Booking } from "@/lib/booking/types";
import { wantsFirm } from "@/lib/dashboard/viewer";
import type { DashboardViewer } from "@/lib/dashboard/types";
import { clampInt } from "./util";

export async function loadTasks(viewer: DashboardViewer): Promise<{ tasks: MyTask[]; name: string }> {
  const tasks = await getMyOpenTasks({ id: viewer.id, role: viewer.role, email: viewer.email }).catch(() => []);
  return { tasks, name: viewer.name };
}

export type AppointmentItem = {
  id: string;
  start: string;
  end: string;
  timezone: string;
  invitee: string;
  type: string;
  color: string | null;
  host: string | null;
  notifyEmail: boolean;
  notifySms: boolean;
};

function toAppointment(b: Booking): AppointmentItem {
  const bt = b.booking_type as { name?: string; color?: string | null; host_name?: string | null } | null | undefined;
  return {
    id: b.id,
    start: b.start_at,
    end: b.end_at,
    timezone: b.timezone || "America/Phoenix",
    invitee: b.invitee_name,
    type: bt?.name ?? "Appointment",
    color: bt?.color ?? null,
    host: bt?.host_name ? bt.host_name.split(",")[0] : null,
    notifyEmail: Boolean((b as { notify_email?: boolean }).notify_email),
    notifySms: Boolean((b as { notify_sms?: boolean }).notify_sms),
  };
}

/** The viewer's next appointments; admins with none of their own (or scope=firm) see the firm's. */
export async function loadAppointments(viewer: DashboardViewer, params: Record<string, unknown> = {}) {
  const limit = clampInt(params.limit, 1, 10, 5);
  const firmRequested = viewer.isAdmin && params.scope === "firm";
  let items: Booking[] = [];
  let firmWide = false;
  if (!firmRequested) items = await loadUpcomingBookings({ hostId: viewer.id, limit }).catch(() => []);
  if ((firmRequested || (!items.length && viewer.isAdmin && params.scope !== "mine"))) {
    items = await loadUpcomingBookings({ hostId: null, limit }).catch(() => []);
    firmWide = items.length > 0;
  }
  return { items: items.map(toAppointment), firmWide };
}

export type CalendarItem = {
  id: string;
  kind: "booking" | "event" | "task";
  title: string;
  subtitle: string | null;
  start: string;
  end: string | null;
  allDay: boolean;
  color: string | null;
  href: string;
};

/** Bookings, published events and the viewer's task due dates between from and to. */
export async function loadCalendarItems(viewer: DashboardViewer, params: Record<string, unknown> = {}): Promise<{ items: CalendarItem[]; from: string; to: string; firm: boolean }> {
  const now = new Date();
  const month = typeof params.month === "string" && /^\d{4}-\d{2}$/.test(params.month) ? params.month : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [y, m] = month.split("-").map(Number);
  // Pad a week either side so the month grid's leading/trailing days are filled.
  const from = new Date(Date.UTC(y, m - 1, 1) - 7 * 86_400_000).toISOString();
  const to = new Date(Date.UTC(y, m, 1) + 8 * 86_400_000).toISOString();
  const firm = wantsFirm(viewer, params) && params.scope === "firm";
  const sb = createSupabaseAdminClient();

  let bq = sb
    .from("bookings")
    .select("id, start_at, end_at, invitee_name, status, booking_type:booking_types(name, color, host_name)")
    .gte("start_at", from)
    .lt("start_at", to)
    .in("status", ["confirmed", "pending", "completed"])
    .order("start_at", { ascending: true })
    .limit(400);
  if (!firm) bq = bq.eq("host_staff_id", viewer.id);

  const [bookings, events, tasks] = await Promise.all([
    bq.then((r) => (r.error ? [] : (r.data ?? []))),
    sb.from("events").select("id, title, start_at, end_at, status, location_name").gte("start_at", from).lt("start_at", to).eq("status", "published").order("start_at").limit(200).then((r) => (r.error ? [] : (r.data ?? []))),
    getMyOpenTasks({ id: viewer.id, role: viewer.role, email: viewer.email }).catch(() => [] as MyTask[]),
  ]);

  const items: CalendarItem[] = [];
  for (const b of bookings as unknown as { id: string; start_at: string; end_at: string; invitee_name: string; booking_type: { name?: string; color?: string | null; host_name?: string | null } | null }[]) {
    items.push({
      id: `b_${b.id}`, kind: "booking", title: b.invitee_name || "Appointment",
      subtitle: [b.booking_type?.name, firm && b.booking_type?.host_name ? b.booking_type.host_name.split(",")[0] : null].filter(Boolean).join(" · ") || null,
      start: b.start_at, end: b.end_at, allDay: false, color: b.booking_type?.color ?? null, href: "/dashboard/bookings",
    });
  }
  for (const e of events as unknown as { id: string; title: string; start_at: string; end_at: string | null; location_name?: string | null }[]) {
    items.push({ id: `e_${e.id}`, kind: "event", title: e.title, subtitle: e.location_name ?? "Event", start: e.start_at, end: e.end_at, allDay: false, color: null, href: "/dashboard/bookings" });
  }
  for (const t of tasks) {
    if (t.dueDate < from || t.dueDate >= to) continue;
    items.push({ id: `t_${t.id}`, kind: "task", title: t.title, subtitle: t.project, start: t.dueDate, end: null, allDay: true, color: null, href: "/dashboard/project-manager" });
  }
  items.sort((a, b) => a.start.localeCompare(b.start));
  return { items, from, to, firm };
}

export type NextUp = {
  item: (CalendarItem & { startsIn: number }) | null;
  following: CalendarItem[];
};

/** The next booking, event or task due (soonest first). */
export async function loadNextUp(viewer: DashboardViewer): Promise<NextUp> {
  const nowIso = new Date().toISOString();
  const sb = createSupabaseAdminClient();
  const horizon = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const [bookings, events, tasks] = await Promise.all([
    sb
      .from("bookings")
      .select("id, start_at, end_at, invitee_name, booking_type:booking_types(name, color)")
      .eq("host_staff_id", viewer.id)
      .gte("end_at", nowIso)
      .lt("start_at", horizon)
      .in("status", ["confirmed", "pending"])
      .order("start_at")
      .limit(5)
      .then((r) => (r.error ? [] : (r.data ?? []))),
    sb.from("events").select("id, title, start_at, end_at, location_name").gte("start_at", nowIso).lt("start_at", horizon).eq("status", "published").order("start_at").limit(3).then((r) => (r.error ? [] : (r.data ?? []))),
    getMyOpenTasks({ id: viewer.id, role: viewer.role, email: viewer.email }).catch(() => [] as MyTask[]),
  ]);
  const items: CalendarItem[] = [];
  for (const b of bookings as unknown as { id: string; start_at: string; end_at: string; invitee_name: string; booking_type: { name?: string; color?: string | null } | null }[]) {
    items.push({ id: `b_${b.id}`, kind: "booking", title: b.invitee_name || "Appointment", subtitle: b.booking_type?.name ?? "Appointment", start: b.start_at, end: b.end_at, allDay: false, color: b.booking_type?.color ?? null, href: "/dashboard/bookings" });
  }
  for (const e of events as unknown as { id: string; title: string; start_at: string; end_at: string | null; location_name?: string | null }[]) {
    items.push({ id: `e_${e.id}`, kind: "event", title: e.title, subtitle: e.location_name ?? "Event", start: e.start_at, end: e.end_at, allDay: false, color: null, href: "/dashboard/bookings" });
  }
  for (const t of tasks.filter((t) => t.dueDate >= nowIso.slice(0, 10)).slice(0, 5)) {
    items.push({ id: `t_${t.id}`, kind: "task", title: t.title, subtitle: t.project ?? "Task due", start: t.dueDate, end: null, allDay: true, color: null, href: "/dashboard/project-manager" });
  }
  items.sort((a, b) => a.start.localeCompare(b.start));
  const [first, ...rest] = items;
  return { item: first ? { ...first, startsIn: new Date(first.start).getTime() - Date.now() } : null, following: rest.slice(0, 3) };
}
