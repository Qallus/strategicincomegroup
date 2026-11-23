import type { AttributionPayload } from "@/lib/analytics/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  AvailabilityRule, Booking, BookingManagerData, BookingStats, BookingType,
  DateOverride, EventItem, EventRegistration, IntakeQuestion,
} from "./types";

export function slugify(input: string): string {
  return (
    String(input || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "item"
  );
}

async function ensureUniqueSlug(table: "booking_types" | "events", base: string, ignoreId?: string): Promise<string> {
  const sb = createSupabaseAdminClient();
  const root = slugify(base);
  let candidate = root;
  for (let i = 0; i < 50; i++) {
    const { data } = await sb.from(table).select("id").eq("slug", candidate).maybeSingle();
    if (!data || data.id === ignoreId) return candidate;
    candidate = `${root}-${i + 2}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}

function reference(): string {
  // Short human-friendly booking reference, e.g. SIG-4F9K2.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `SIG-${s}`;
}

const TYPE_COLUMNS = [
  "slug", "name", "description", "duration_minutes", "slot_interval_minutes",
  "buffer_before_minutes", "buffer_after_minutes", "location_type", "location_details",
  "color", "is_active", "is_public", "host_staff_id", "host_name", "timezone",
  "min_notice_hours", "max_advance_days", "price_cents", "currency", "questions", "confirmation_message",
  // SIG (202611190120): public planner page, office and who the page is for.
  "host_slug", "office", "audience",
] as const;

const EVENT_COLUMNS = [
  "slug", "title", "summary", "description", "status", "start_at", "end_at", "timezone",
  "location_type", "location_name", "location_address", "online_url", "cover_image_url",
  "capacity", "registration_required", "registration_closes_at", "price_cents", "currency",
  "host_staff_id", "host_name", "is_public", "custom_fields",
  // SIG (202611190120): the fields strategicincomegroup.com events use.
  "event_type", "series", "speakers", "office", "directions_url", "audience", "waitlist_enabled",
  "allow_guests", "max_party_size", "arrival_note", "meeting_id",
  // SIGCares impact results (202611190130).
  "impact_program", "impact_participants", "impact_meals", "impact_countries", "impact_notes",
] as const;

function pick<T extends string>(payload: Record<string, unknown>, columns: readonly T[]): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of columns) {
    if (key in payload && payload[key] !== undefined) row[key] = payload[key];
  }
  return row;
}

// ── Booking types ───────────────────────────────────────────────────────────────

export async function loadBookingTypes(): Promise<BookingType[]> {
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb.from("booking_types").select("*").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as BookingType[];
}

export async function loadPublicBookingTypes(): Promise<BookingType[]> {
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("booking_types")
    .select("*")
    .eq("is_active", true)
    .eq("is_public", true)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as BookingType[];
}

/** Active public booking pages for one planner (team slug), e.g. /book?planner=laurie-simons. */
export async function loadPublicBookingTypesForPlanner(hostSlug: string): Promise<BookingType[]> {
  return (await loadPublicBookingTypes()).filter((t) => t.host_slug === hostSlug);
}

export async function loadBookingTypeBySlug(slug: string, opts: { publicOnly?: boolean } = {}): Promise<BookingType | null> {
  const sb = createSupabaseAdminClient();
  let q = sb.from("booking_types").select("*").eq("slug", slug);
  if (opts.publicOnly) q = q.eq("is_active", true).eq("is_public", true);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as unknown as BookingType | null;
}

export async function saveBookingType(payload: Record<string, unknown>): Promise<BookingType> {
  const sb = createSupabaseAdminClient();
  const id = payload.id as string | undefined;
  const row = pick(payload, TYPE_COLUMNS);
  if (!Array.isArray(row.questions)) row.questions = [];
  row.slug = await ensureUniqueSlug("booking_types", String(payload.slug || payload.name || "meeting"), id);
  row.updated_at = new Date().toISOString();

  if (id) {
    const { error } = await sb.from("booking_types").update(row).eq("id", id);
    if (error) throw new Error(error.message);
    const t = await loadBookingTypeBySlug(String(row.slug));
    if (!t) throw new Error("Booking type not found after save.");
    return t;
  }
  const { data, error } = await sb.from("booking_types").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  // Seed a sensible weekday 9–5 availability for brand-new types.
  await seedDefaultAvailability(data.id as string);
  return data as unknown as BookingType;
}

export async function deleteBookingType(id: string): Promise<void> {
  const sb = createSupabaseAdminClient();
  const { error } = await sb.from("booking_types").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Availability ──────────────────────────────────────────────────────────────

async function seedDefaultAvailability(bookingTypeId: string): Promise<void> {
  const sb = createSupabaseAdminClient();
  const rows = [1, 2, 3, 4, 5].map((dow) => ({
    booking_type_id: bookingTypeId, day_of_week: dow, start_time: "09:00", end_time: "17:00", is_active: true,
  }));
  await sb.from("booking_availability").insert(rows);
}

export async function loadAvailability(bookingTypeId: string): Promise<AvailabilityRule[]> {
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("booking_availability")
    .select("*")
    .eq("booking_type_id", bookingTypeId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AvailabilityRule[];
}

export async function replaceAvailability(bookingTypeId: string, rules: Partial<AvailabilityRule>[]): Promise<AvailabilityRule[]> {
  const sb = createSupabaseAdminClient();
  await sb.from("booking_availability").delete().eq("booking_type_id", bookingTypeId);
  const clean = rules
    .filter((r) => r.start_time && r.end_time && String(r.start_time) < String(r.end_time))
    .map((r) => ({
      booking_type_id: bookingTypeId,
      day_of_week: Math.max(0, Math.min(6, Number(r.day_of_week) || 0)),
      start_time: String(r.start_time),
      end_time: String(r.end_time),
      is_active: r.is_active !== false,
    }));
  if (clean.length) {
    const { error } = await sb.from("booking_availability").insert(clean);
    if (error) throw new Error(error.message);
  }
  return loadAvailability(bookingTypeId);
}

export async function loadDateOverrides(bookingTypeId: string): Promise<DateOverride[]> {
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("booking_date_overrides")
    .select("*")
    .eq("booking_type_id", bookingTypeId)
    .gte("override_date", new Date().toISOString().slice(0, 10))
    .order("override_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DateOverride[];
}

// ── Bookings ──────────────────────────────────────────────────────────────────

export async function loadBookings(opts: { upcomingOnly?: boolean; limit?: number } = {}): Promise<Booking[]> {
  const sb = createSupabaseAdminClient();
  let q = sb
    .from("bookings")
    .select("*, booking_type:booking_types(name, slug, color, host_slug, host_name)")
    .order("start_at", { ascending: true })
    .limit(opts.limit ?? 500);
  if (opts.upcomingOnly) q = q.gte("end_at", new Date().toISOString());
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Booking[];
}

/**
 * Booking pages that share one planner's calendar: every page on the same planner page
 * (host_slug), so a consultation and a review can never be booked on top of each other.
 */
export async function calendarTypeIds(type: Pick<BookingType, "id" | "host_slug">): Promise<string[]> {
  if (!type.host_slug) return [type.id];
  const { data } = await createSupabaseAdminClient().from("booking_types").select("id").eq("host_slug", type.host_slug);
  const ids = new Set<string>([type.id, ...((data ?? []).map((r) => String(r.id)))]);
  return Array.from(ids);
}

/** Active bookings that block time on this page's planner calendar (optionally excluding one booking). */
export async function loadBlockingBookings(
  type: Pick<BookingType, "id" | "host_slug">, fromIso: string, toIso: string, excludeBookingId?: string,
): Promise<Booking[]> {
  const ids = await calendarTypeIds(type);
  let q = createSupabaseAdminClient()
    .from("bookings")
    .select("id, start_at, end_at, status")
    .in("booking_type_id", ids)
    .neq("status", "canceled")
    .gte("end_at", fromIso)
    .lte("start_at", toIso);
  if (excludeBookingId) q = q.neq("id", excludeBookingId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Booking[];
}

/** True when [start, end) overlaps an active booking on the planner's calendar. */
export async function hasCalendarClash(
  type: Pick<BookingType, "id" | "host_slug">, startIso: string, endIso: string, excludeBookingId?: string,
): Promise<boolean> {
  const ids = await calendarTypeIds(type);
  let q = createSupabaseAdminClient()
    .from("bookings")
    .select("id")
    .in("booking_type_id", ids)
    .neq("status", "canceled")
    .lt("start_at", endIso)
    .gt("end_at", startIso)
    .limit(1);
  if (excludeBookingId) q = q.neq("id", excludeBookingId);
  const { data } = await q;
  return Boolean(data && data.length);
}

export async function loadBookingsForType(bookingTypeId: string, fromIso: string, toIso: string): Promise<Booking[]> {
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("bookings")
    .select("start_at, end_at, status")
    .eq("booking_type_id", bookingTypeId)
    .neq("status", "canceled")
    .gte("end_at", fromIso)
    .lte("start_at", toIso);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Booking[];
}

export async function createBooking(input: {
  booking_type_id: string;
  host_staff_id: string | null;
  invitee_name: string;
  invitee_email?: string | null;
  invitee_phone?: string | null;
  start_at: string;
  end_at: string;
  timezone: string;
  location_type: string;
  location_details?: string | null;
  answers?: Record<string, unknown>;
  source?: string;
  status?: string;
  /** Client notification opt-ins (202611190160). Dropped silently if the columns don't exist yet. */
  notify?: {
    email: boolean;
    sms: boolean;
    sms_consent_text?: string | null;
    consent_ip?: string | null;
    consent_user_agent?: string | null;
  };
  /** Website first/last touch (202611210190). Dropped silently if the columns don't exist yet. */
  attribution?: AttributionPayload;
  /** SHA-256 of the client's manage-link token (202611210200). Dropped silently if the column doesn't exist yet. */
  manage_token_hash?: string | null;
  /** Planner page of the booking type — widens the double-booking guard to the planner's whole calendar. */
  host_slug?: string | null;
}): Promise<Booking> {
  const sb = createSupabaseAdminClient();

  // Double-booking guard: reject if any active booking overlaps this slot on the planner's calendar.
  if (await hasCalendarClash({ id: input.booking_type_id, host_slug: input.host_slug ?? null }, input.start_at, input.end_at)) {
    throw new Error("That time was just taken. Please pick another slot.");
  }

  const row = {
    booking_type_id: input.booking_type_id,
    reference: reference(),
    host_staff_id: input.host_staff_id ?? null,
    invitee_name: input.invitee_name,
    invitee_email: input.invitee_email ?? null,
    invitee_phone: input.invitee_phone ?? null,
    start_at: input.start_at,
    end_at: input.end_at,
    timezone: input.timezone,
    status: input.status ?? "confirmed",
    location_type: input.location_type,
    location_details: input.location_details ?? null,
    answers: input.answers ?? {},
    source: input.source ?? "public",
  };
  const notifyCols = input.notify
    ? {
        notify_email: input.notify.email,
        notify_sms: input.notify.sms,
        notify_consent_at: input.notify.email || input.notify.sms ? new Date().toISOString() : null,
        sms_consent_text: input.notify.sms ? input.notify.sms_consent_text ?? null : null,
        consent_ip: input.notify.email || input.notify.sms ? input.notify.consent_ip ?? null : null,
        consent_user_agent: input.notify.email || input.notify.sms ? input.notify.consent_user_agent ?? null : null,
      }
    : null;

  const attrCols = attributionCols(input.attribution);
  const manageCols = input.manage_token_hash
    ? { manage_token_hash: input.manage_token_hash, manage_token_created_at: new Date().toISOString() }
    : null;
  let { data, error } = await sb.from("bookings").insert({ ...row, ...(notifyCols ?? {}), ...(attrCols ?? {}), ...(manageCols ?? {}) }).select("*").single();
  if (error && manageCols && isMissingColumnError(error)) {
    // 202611210200 hasn't been applied yet — book anyway; the client just won't get a self-service link.
    console.warn("[booking] manage-token columns missing; saving booking without them. Apply 202611210200_booking_self_service.sql.");
    ({ data, error } = await sb.from("bookings").insert({ ...row, ...(notifyCols ?? {}), ...(attrCols ?? {}) }).select("*").single());
  }
  if (error && attrCols && isMissingColumnError(error)) {
    // 202611210190 hasn't been applied yet — book anyway, without the attribution columns.
    console.warn("[booking] attribution columns missing; saving booking without them. Apply 202611210190_analytics.sql.");
    ({ data, error } = await sb.from("bookings").insert(notifyCols ? { ...row, ...notifyCols } : row).select("*").single());
  }
  if (error && notifyCols && isMissingColumnError(error)) {
    // 202611190160 hasn't been applied yet — book anyway, without the opt-in columns.
    console.warn("[booking] notification opt-in columns missing; saving booking without them. Apply 202611190160_booking_notifications.sql.");
    ({ data, error } = await sb.from("bookings").insert(row).select("*").single());
  }
  if (error) throw new Error(error.message);
  return data as unknown as Booking;
}

/** Attribution columns for an insert, or null when there is nothing to store. */
function attributionCols(a: AttributionPayload | undefined) {
  if (!a || !(a.first_touch || a.last_touch || a.landing_path || a.session_id)) return null;
  return { first_touch: a.first_touch, last_touch: a.last_touch, landing_path: a.landing_path, session_id: a.session_id };
}

/** PostgREST / Postgres "column does not exist" (schema cache or undefined_column). */
export function isMissingColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "PGRST204" || error.code === "42703" || /column .* (does not exist|could not find)|Could not find the '.*' column/i.test(error.message ?? "");
}

/** Record which notifications went out. No-op (logged) before 202611190160 is applied. */
export async function recordBookingNotifications(id: string, sent: Record<string, unknown>): Promise<void> {
  const { error } = await createSupabaseAdminClient().from("bookings").update({ notifications_sent: sent }).eq("id", id);
  if (error && !isMissingColumnError(error)) console.error("[booking] could not record notifications_sent", error.message);
}

export async function updateBooking(id: string, patch: Record<string, unknown>): Promise<void> {
  const sb = createSupabaseAdminClient();
  const allowed: Record<string, unknown> = {};
  for (const k of ["status", "internal_notes", "cancel_reason", "start_at", "end_at", "location_details", "invitee_name", "invitee_email", "invitee_phone", "host_staff_id"]) {
    if (k in patch && patch[k] !== undefined) allowed[k] = patch[k];
  }
  // Self-service bookkeeping (202611210200) — retried without these if the columns don't exist yet.
  const extra: Record<string, unknown> = {};
  for (const k of ["cancelled_at", "cancelled_by", "rescheduled_at", "ics_sequence", "notify_email", "notify_sms", "notify_consent_at", "sms_consent_text", "consent_ip", "consent_user_agent"]) {
    if (k in patch && patch[k] !== undefined) extra[k] = patch[k];
  }
  allowed.updated_at = new Date().toISOString();
  let { error } = await sb.from("bookings").update({ ...allowed, ...extra }).eq("id", id);
  if (error && Object.keys(extra).length && isMissingColumnError(error)) {
    console.warn("[booking] self-service columns missing; updating without them. Apply 202611210200_booking_self_service.sql.");
    ({ error } = await sb.from("bookings").update(allowed).eq("id", id));
  }
  if (error) throw new Error(error.message);
}

export async function deleteBooking(id: string): Promise<void> {
  const sb = createSupabaseAdminClient();
  const { error } = await sb.from("bookings").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Events ────────────────────────────────────────────────────────────────────

export async function loadEvents(): Promise<EventItem[]> {
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb.from("events").select("*").order("start_at", { ascending: true });
  if (error) throw new Error(error.message);
  const events = (data ?? []) as unknown as EventItem[];
  return decorateEventCounts(events);
}

export async function loadPublicEvents(): Promise<EventItem[]> {
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("events")
    .select("*")
    .eq("status", "published")
    .eq("is_public", true)
    .gte("start_at", new Date(Date.now() - 86400000).toISOString())
    .order("start_at", { ascending: true });
  if (error) throw new Error(error.message);
  return decorateEventCounts((data ?? []) as unknown as EventItem[]);
}

export async function loadEventBySlug(slug: string, opts: { publicOnly?: boolean } = {}): Promise<EventItem | null> {
  const sb = createSupabaseAdminClient();
  let q = sb.from("events").select("*").eq("slug", slug);
  if (opts.publicOnly) q = q.eq("status", "published").eq("is_public", true);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [decorated] = await decorateEventCounts([data as unknown as EventItem]);
  return decorated;
}

async function decorateEventCounts(events: EventItem[]): Promise<EventItem[]> {
  if (!events.length) return events;
  const sb = createSupabaseAdminClient();
  const ids = events.map((e) => e.id);
  const { data } = await sb
    .from("event_registrations")
    .select("event_id, status, party_size")
    .in("event_id", ids)
    .neq("status", "canceled");
  const reg = new Map<string, number>();
  const wait = new Map<string, number>();
  for (const r of data ?? []) {
    const size = Number(r.party_size) || 1;
    if (r.status === "waitlisted") wait.set(r.event_id, (wait.get(r.event_id) ?? 0) + size);
    else reg.set(r.event_id, (reg.get(r.event_id) ?? 0) + size);
  }
  return events.map((e) => ({ ...e, registered_count: reg.get(e.id) ?? 0, waitlist_count: wait.get(e.id) ?? 0 }));
}

export async function saveEvent(payload: Record<string, unknown>): Promise<EventItem> {
  const sb = createSupabaseAdminClient();
  const id = payload.id as string | undefined;
  const row = pick(payload, EVENT_COLUMNS);
  if (!Array.isArray(row.custom_fields)) row.custom_fields = [];
  if ("speakers" in row && !Array.isArray(row.speakers)) row.speakers = [];
  if ("impact_countries" in row && !Array.isArray(row.impact_countries)) row.impact_countries = [];
  if (row.impact_program === "") row.impact_program = null;
  row.slug = await ensureUniqueSlug("events", String(payload.slug || payload.title || "event"), id);
  if (payload.status === "published") row.published_at = (payload.published_at as string) || new Date().toISOString();
  row.updated_at = new Date().toISOString();

  if (id) {
    const { error } = await sb.from("events").update(row).eq("id", id);
    if (error) throw new Error(error.message);
    const e = await loadEventBySlug(String(row.slug));
    if (!e) throw new Error("Event not found after save.");
    return e;
  }
  const { data, error } = await sb.from("events").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data as unknown as EventItem;
}

export async function deleteEvent(id: string): Promise<void> {
  const sb = createSupabaseAdminClient();
  const { error } = await sb.from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Registrations ──────────────────────────────────────────────────────────────

export async function loadRegistrations(opts: { eventId?: string; limit?: number } = {}): Promise<EventRegistration[]> {
  const sb = createSupabaseAdminClient();
  let q = sb
    .from("event_registrations")
    .select("*, event:events(title, slug)")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 500);
  if (opts.eventId) q = q.eq("event_id", opts.eventId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EventRegistration[];
}

export async function createRegistration(input: {
  event_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  party_size?: number;
  answers?: Record<string, unknown>;
  source?: string;
  /** Website first/last touch (202611210190). Dropped silently if the columns don't exist yet. */
  attribution?: AttributionPayload;
}): Promise<{ registration: EventRegistration; waitlisted: boolean }> {
  const sb = createSupabaseAdminClient();
  const { data: event, error: evErr } = await sb.from("events").select("*").eq("id", input.event_id).maybeSingle();
  if (evErr) throw new Error(evErr.message);
  if (!event) throw new Error("Event not found.");
  if (event.status !== "published") throw new Error("Registration is not open for this event.");
  if (event.registration_closes_at && new Date(event.registration_closes_at) < new Date()) {
    throw new Error("Registration for this event has closed.");
  }

  const maxParty = event.allow_guests === false ? 1 : Number(event.max_party_size) || 50;
  const size = Math.min(maxParty, Math.max(1, Number(input.party_size) || 1));
  let waitlisted = false;
  if (event.capacity != null) {
    const [decorated] = await decorateEventCounts([event as unknown as EventItem]);
    const taken = decorated.registered_count ?? 0;
    if (taken + size > event.capacity) {
      if (event.waitlist_enabled === false) throw new Error("This event is full.");
      waitlisted = true;
    }
  }

  const row = {
    event_id: input.event_id,
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    party_size: size,
    status: waitlisted ? "waitlisted" : "registered",
    answers: input.answers ?? {},
    source: input.source ?? "public",
  };
  const attrCols = attributionCols(input.attribution);
  let { data, error } = await sb.from("event_registrations").insert(attrCols ? { ...row, ...attrCols } : row).select("*").single();
  if (error && attrCols && isMissingColumnError(error)) {
    console.warn("[events] attribution columns missing; saving registration without them. Apply 202611210190_analytics.sql.");
    ({ data, error } = await sb.from("event_registrations").insert(row).select("*").single());
  }
  if (error) throw new Error(error.message);
  return { registration: data as unknown as EventRegistration, waitlisted };
}

export async function updateRegistration(id: string, patch: Record<string, unknown>): Promise<void> {
  const sb = createSupabaseAdminClient();
  const allowed: Record<string, unknown> = {};
  for (const k of ["status", "notes", "party_size", "name", "email", "phone"]) {
    if (k in patch && patch[k] !== undefined) allowed[k] = patch[k];
  }
  allowed.updated_at = new Date().toISOString();
  const { error } = await sb.from("event_registrations").update(allowed).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteRegistration(id: string): Promise<void> {
  const sb = createSupabaseAdminClient();
  const { error } = await sb.from("event_registrations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Dashboard aggregate ──────────────────────────────────────────────────────

/**
 * Dashboard data. Pass `hostId` for a non-admin planner to see only the booking
 * pages, bookings and events they host (see lib/booking/access.ts).
 */
export async function loadBookingManagerData(opts: { hostId?: string } = {}): Promise<BookingManagerData> {
  const [allTypes, allBookings, allEvents, allRegistrations] = await Promise.all([
    loadBookingTypes(),
    loadBookings({ limit: 500 }),
    loadEvents(),
    loadRegistrations({ limit: 500 }),
  ]);
  const { bookingTypes, bookings, events, registrations } = scopeToHost(
    { bookingTypes: allTypes, bookings: allBookings, events: allEvents, registrations: allRegistrations },
    opts.hostId,
  );

  const nowIso = new Date().toISOString();
  const stats: BookingStats = {
    activeTypes: bookingTypes.filter((t) => t.is_active).length,
    upcomingBookings: bookings.filter((b) => b.end_at >= nowIso && b.status !== "canceled").length,
    pendingBookings: bookings.filter((b) => b.status === "pending").length,
    publishedEvents: events.filter((e) => e.status === "published").length,
    totalRegistrations: registrations.filter((r) => r.status !== "canceled").reduce((s, r) => s + (r.party_size || 1), 0),
  };

  return { bookingTypes, bookings, events, registrations, stats };
}

export function scopeToHost<T extends { bookingTypes: BookingType[]; bookings: Booking[]; events: EventItem[]; registrations: EventRegistration[] }>(
  data: T,
  hostId?: string,
): T {
  if (!hostId) return data;
  const bookingTypes = data.bookingTypes.filter((t) => t.host_staff_id === hostId);
  const typeIds = new Set(bookingTypes.map((t) => t.id));
  const events = data.events.filter((e) => e.host_staff_id === hostId);
  const eventIds = new Set(events.map((e) => e.id));
  return {
    ...data,
    bookingTypes,
    bookings: data.bookings.filter((b) => b.host_staff_id === hostId || typeIds.has(b.booking_type_id)),
    events,
    registrations: data.registrations.filter((r) => eventIds.has(r.event_id)),
  };
}

/** Next appointments for a planner (or firm-wide when hostId is null) — dashboard home widget. */
export async function loadUpcomingBookings(opts: { hostId?: string | null; limit?: number } = {}): Promise<Booking[]> {
  let q = createSupabaseAdminClient()
    .from("bookings")
    .select("*, booking_type:booking_types(name, slug, color, host_slug, host_name)")
    .in("status", ["confirmed", "pending"])
    .gte("end_at", new Date().toISOString())
    .order("start_at", { ascending: true })
    .limit(opts.limit ?? 5);
  if (opts.hostId) q = q.eq("host_staff_id", opts.hostId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Booking[];
}

export type PlannerLink = {
  id: string; slug: string; full_name: string | null; account_email: string | null; profile_id: string | null;
  team_group: string | null; booking_type_count: number;
};

/** Employee profiles that host booking pages (or are planners), with their dashboard-login link state. */
export async function loadPlannerLinks(): Promise<PlannerLink[]> {
  const sb = createSupabaseAdminClient();
  const [{ data: eps, error }, { data: types }] = await Promise.all([
    sb.from("employee_profiles").select("id, slug, full_name, account_email, profile_id, team_group").order("sort_order"),
    sb.from("booking_types").select("host_slug"),
  ]);
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const t of types ?? []) if (t.host_slug) counts.set(String(t.host_slug), (counts.get(String(t.host_slug)) ?? 0) + 1);
  return (eps ?? [])
    .map((e) => ({ ...(e as Omit<PlannerLink, "booking_type_count">), booking_type_count: counts.get(String(e.slug)) ?? 0 }))
    .filter((e) => e.booking_type_count > 0 || e.team_group === "planner" || e.team_group === "leadership");
}

/**
 * Link an employee profile (public planner page) to a dashboard login. Also moves the
 * planner's booking pages and FUTURE bookings to that login — the database trigger from
 * 202611210200 does the same; doing it here keeps it working before that migration runs.
 */
export async function linkPlannerProfile(employeeProfileId: string, profileId: string | null): Promise<void> {
  const sb = createSupabaseAdminClient();
  const { data: ep, error } = await sb.from("employee_profiles").select("id, slug, profile_id").eq("id", employeeProfileId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!ep) throw new Error("Employee profile not found.");
  if (profileId) {
    const { data: taken } = await sb.from("employee_profiles").select("id, full_name").eq("profile_id", profileId).neq("id", employeeProfileId).maybeSingle();
    if (taken) throw new Error(`That login is already linked to ${taken.full_name || "another team page"}. Unlink it there first.`);
  }
  const oldProfile = (ep.profile_id as string | null) ?? null;
  const { error: upErr } = await sb.from("employee_profiles").update({ profile_id: profileId }).eq("id", employeeProfileId);
  if (upErr) throw new Error(upErr.message);
  if (!profileId) return;

  const nowIso = new Date().toISOString();
  const { data: types } = await sb.from("booking_types").select("id, host_staff_id").eq("host_slug", ep.slug);
  const typeIds = (types ?? []).map((t) => String(t.id));
  const movable = (types ?? []).filter((t) => !t.host_staff_id || t.host_staff_id === oldProfile).map((t) => String(t.id));
  if (movable.length) await sb.from("booking_types").update({ host_staff_id: profileId, updated_at: nowIso }).in("id", movable);
  if (typeIds.length) {
    let q = sb.from("bookings").update({ host_staff_id: profileId, updated_at: nowIso }).in("booking_type_id", typeIds).gt("start_at", nowIso);
    q = oldProfile ? q.or(`host_staff_id.is.null,host_staff_id.eq.${oldProfile}`) : q.is("host_staff_id", null);
    await q;
  }
}

export type StaffOption = { id: string; display_name: string };
export async function loadStaffOptions(): Promise<StaffOption[]> {
  const sb = createSupabaseAdminClient();
  const { data } = await sb
    .from("profiles")
    .select("id, display_name:full_name")
    .in("status", ["active", "invited"])
    .order("full_name");
  return (data ?? []) as unknown as StaffOption[];
}

export type { IntakeQuestion };
