// Booking pages (planner booking types), their availability and date
// overrides, and the bookings made on them. Reuses lib/booking/data.ts and
// lib/booking/availability.ts. Same access as the dashboard's booking API
// (requireParticipantManager): Super Admin, Admin, Team Member.
//
// Columns added to these tables after this file was written (host_slug,
// office, audience…) pass straight through: any field not in the core list is
// written with a follow-up update, so a new column needs no code change here.
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createBooking, loadAvailability, loadBookingsForType, loadDateOverrides, replaceAvailability, saveBookingType, updateBooking,
} from "@/lib/booking/data";
import { computeSlots, groupSlotsByDate } from "@/lib/booking/availability";
import type { Booking, BookingType } from "@/lib/booking/types";
import { cancelBooking, manageUrl, rescheduleBooking, resolveHostStaffId, rotateManageToken } from "@/lib/booking/manage";
import { notifyBookingChanged } from "@/lib/booking/notify";
import type { Preview } from "./actions";
import { peekRecord, trashRecord } from "./trash";
import {
  anyObj, bool, clamp, ilikeSafe, int, need, num, obj, opt, pickDefined, s, str, strEnum, type Json, type McpTool,
} from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOOKING_STATUSES = ["confirmed", "pending", "canceled", "completed", "no_show"] as const;
const LOCATION_TYPES = ["video", "phone", "in_person", "custom"] as const;

// Fields saveBookingType() knows; everything else in `extra` is passed through.
const TYPE_CORE = [
  "slug", "name", "description", "duration_minutes", "slot_interval_minutes", "buffer_before_minutes", "buffer_after_minutes",
  "location_type", "location_details", "color", "is_active", "is_public", "host_staff_id", "host_name", "timezone",
  "min_notice_hours", "max_advance_days", "price_cents", "currency", "questions", "confirmation_message",
] as const;
// Newer optional columns we advertise in the schema (written only if sent).
const TYPE_OPTIONAL = ["host_slug", "office", "audience"] as const;
const NEVER_WRITE = new Set(["id", "created_at", "updated_at"]);

async function sb() {
  return createSupabaseAdminClient();
}

async function findType(ref: string): Promise<BookingType> {
  const client = await sb();
  const q = UUID.test(ref) ? client.from("booking_types").select("*").eq("id", ref) : client.from("booking_types").select("*").eq("slug", ref);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No booking page matches "${ref}". Use sig_booking_types_list.`);
  return data as unknown as BookingType;
}

async function findBooking(ref: string): Promise<Record<string, unknown>> {
  const client = await sb();
  const q = UUID.test(ref)
    ? client.from("bookings").select("*, booking_type:booking_types(id, name, slug, duration_minutes, timezone)").eq("id", ref)
    : client.from("bookings").select("*, booking_type:booking_types(id, name, slug, duration_minutes, timezone)").eq("reference", ref.toUpperCase());
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No booking matches "${ref}". Use sig_bookings_list.`);
  return data as Record<string, unknown>;
}

/** Write pass-through fields (new columns) after the core save. Never throws: returns a warning instead. */
async function writeExtras(table: string, recordId: string, extras: Json): Promise<string | null> {
  const patch: Json = {};
  for (const [k, v] of Object.entries(extras)) if (!NEVER_WRITE.has(k) && v !== undefined) patch[k] = v;
  if (!Object.keys(patch).length) return null;
  const { error } = await (await sb()).from(table).update(patch).eq("id", recordId);
  return error ? `Saved, but these extra fields were not: ${Object.keys(patch).join(", ")} (${error.message}).` : null;
}

function splitTypeArgs(a: Json) {
  const core = pickDefined(a, TYPE_CORE);
  const extras: Json = { ...pickDefined(a, TYPE_OPTIONAL), ...((a.extra as Json) ?? {}) };
  for (const k of TYPE_CORE) if (k in extras) { core[k] = extras[k]; delete extras[k]; }
  return { core, extras };
}

const goesPublic = (patch: Json, current?: Partial<BookingType>) => {
  const active = patch.is_active ?? current?.is_active ?? true;
  const pub = patch.is_public ?? current?.is_public ?? false;
  const wasLive = !!current && current.is_active && current.is_public;
  return active === true && pub === true && !wasLive;
};

const TYPE_FIELDS = {
  name: str("Name shown to clients, e.g. 'Free Consultation'"),
  slug: str("URL slug (booking page is /book/<slug>); generated from the name if omitted"),
  description: str("Description shown on the booking page"),
  duration_minutes: int("Meeting length in minutes", 5, 480),
  slot_interval_minutes: int("Start-time interval in minutes (default = duration)", 5, 480),
  buffer_before_minutes: int("Buffer before, minutes", 0, 240),
  buffer_after_minutes: int("Buffer after, minutes", 0, 240),
  location_type: strEnum(LOCATION_TYPES, "Where the meeting happens"),
  location_details: str("Address, phone or video link details"),
  color: str("Hex color, e.g. #1e3a8a"),
  is_active: bool("Accepting bookings"),
  is_public: bool("Listed publicly (turning a page public needs confirmation)"),
  host_staff_id: str("Host's profile id"),
  host_name: str("Host display name, e.g. 'Laurie Simons, CFP®'"),
  host_slug: str("Planner slug the page belongs to (/team/<slug>) — if that column exists"),
  office: str("Office name, e.g. 'East Valley Office' — if that column exists"),
  audience: strEnum(["everyone", "new_clients", "clients"], "Who the page is for — if that column exists"),
  timezone: str("IANA timezone (default America/Phoenix)"),
  min_notice_hours: int("Minimum notice in hours", 0, 720),
  max_advance_days: int("How far ahead clients can book, days", 1, 365),
  questions: { type: "array", description: "Intake questions: [{key,label,type(text|textarea|select|phone|email),required,options?}]", items: { type: "object", additionalProperties: true } },
  confirmation_message: str("Message shown after booking"),
  extra: anyObj("Any other booking_types columns to set (pass-through)"),
};

const BOOKING_FIELDS = {
  invitee_name: str("Client name"),
  invitee_email: str("Client email"),
  invitee_phone: str("Client phone"),
  location_details: str("Location / call details"),
  internal_notes: str("Internal notes (not shown to the client)"),
};

function bookingShape(b: Record<string, unknown>) {
  const t = b.booking_type as { name?: string; slug?: string } | null;
  return {
    id: b.id, reference: b.reference, status: b.status, booking_type: t?.name ?? null, booking_type_id: b.booking_type_id,
    invitee_name: b.invitee_name, invitee_email: b.invitee_email, invitee_phone: b.invitee_phone,
    start_at: b.start_at, end_at: b.end_at, timezone: b.timezone, location_type: b.location_type, location_details: b.location_details,
    answers: b.answers, internal_notes: b.internal_notes, cancel_reason: b.cancel_reason, source: b.source, created_at: b.created_at,
  };
}

async function assertNoClash(typeId: string, startIso: string, endIso: string, ignoreId?: string) {
  let q = (await sb()).from("bookings").select("id, reference").eq("booking_type_id", typeId).neq("status", "canceled").lt("start_at", endIso).gt("end_at", startIso);
  if (ignoreId) q = q.neq("id", ignoreId);
  const { data } = await q;
  if (data?.length) throw new Error(`That time overlaps booking ${data.map((d) => d.reference).join(", ")}.`);
}

function endFrom(startIso: string, minutes: number) {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) throw new Error("start_at must be an ISO date/time, e.g. 2026-12-01T16:00:00Z.");
  return { start: start.toISOString(), end: new Date(start.getTime() + minutes * 60_000).toISOString() };
}

export function bookingTools(): McpTool[] {
  return [
    // ── Booking pages ──
    {
      name: "sig_booking_types_list",
      title: "List booking pages",
      description: "List the planner booking pages (booking types): name, slug, host, duration, active/public, plus any extra columns such as host_slug and office.",
      risk: "read",
      area: "bookings",
      inputSchema: obj({ active_only: bool("Only active pages"), search: str("Words in name, host or slug") }),
      run: async (a) => {
        let q = (await sb()).from("booking_types").select("*").order("created_at", { ascending: true });
        if (a.active_only === true) q = q.eq("is_active", true);
        const term = ilikeSafe(s(a.search));
        if (term) q = q.or(`name.ilike.%${term}%,host_name.ilike.%${term}%,slug.ilike.%${term}%`);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        return { result: { booking_types: (data ?? []).map((t) => ({ ...t, booking_url: `/book/${t.slug}` })) } };
      },
    },
    {
      name: "sig_booking_type_get",
      title: "Read a booking page",
      description: "One booking page in full, with its weekly availability rules and upcoming date overrides.",
      risk: "read",
      area: "bookings",
      inputSchema: obj({ booking_type: str("Booking type id or slug") }, ["booking_type"]),
      run: async (a) => {
        const t = await findType(need(a, "booking_type"));
        const [rules, overrides] = await Promise.all([loadAvailability(t.id), loadDateOverrides(t.id)]);
        return { result: { ...t, booking_url: `/book/${t.slug}`, availability: rules, date_overrides: overrides } };
      },
    },
    {
      name: "sig_booking_type_create",
      title: "Create a booking page",
      description: "Create a booking page (seeded with Mon–Fri 9–5 availability). It is created NOT public unless is_public=true, which needs confirmation.",
      risk: "write",
      area: "bookings",
      inputSchema: obj(TYPE_FIELDS, ["name"]),
      escalate: async (a) => {
        const { core } = splitTypeArgs(a);
        if (core.is_public !== true || core.is_active === false) return null;
        return { summary: `Create booking page "${s(a.name)}" and make it publicly bookable right away.`, details: { name: s(a.name), host: s(a.host_name) || null }, entity: "booking_type" };
      },
      run: async (a) => {
        const { core, extras } = splitTypeArgs(a);
        if (core.is_public === undefined) core.is_public = false;
        if (!core.timezone) core.timezone = "America/Phoenix";
        const saved = await saveBookingType({ ...core, name: need(a, "name") });
        const warning = await writeExtras("booking_types", saved.id, extras);
        const t = await findType(saved.id);
        return { result: { created: true, ...t, booking_url: `/book/${t.slug}`, warning }, summary: `Created booking page "${t.name}"`, entity: "booking_type", recordId: t.id, after: t };
      },
    },
    {
      name: "sig_booking_type_update",
      title: "Edit a booking page",
      description: "Change a booking page's details. Only the fields you pass change. Making a page public needs confirmation.",
      risk: "write",
      area: "bookings",
      inputSchema: obj({ booking_type: str("Booking type id or slug"), ...TYPE_FIELDS }, ["booking_type"]),
      escalate: async (a) => {
        const current = await findType(need(a, "booking_type"));
        const { core } = splitTypeArgs(a);
        if (!goesPublic(core, current)) return null;
        return { summary: `Make booking page "${current.name}" publicly bookable.`, details: { id: current.id, url: `/book/${current.slug}` }, entity: "booking_type", recordId: current.id };
      },
      run: async (a) => {
        const current = await findType(need(a, "booking_type"));
        const { core, extras } = splitTypeArgs(a);
        // saveBookingType rebuilds slug/questions from the payload, so start from the current row.
        const saved = await saveBookingType({ ...pickDefined(current as unknown as Json, TYPE_CORE), ...core, id: current.id });
        const warning = await writeExtras("booking_types", saved.id, extras);
        const t = await findType(current.id);
        return { result: { updated: true, ...t, booking_url: `/book/${t.slug}`, warning }, summary: `Edited booking page "${t.name}"`, entity: "booking_type", recordId: t.id, before: current, after: t };
      },
    },
    {
      name: "sig_booking_type_delete",
      title: "Delete a booking page",
      description: "Delete a booking page together with its availability, date overrides and bookings (all kept in the trash and restorable with sig_restore). Prefer is_active=false to just stop new bookings. High risk: returns a preview first.",
      risk: "high",
      area: "bookings",
      inputSchema: obj({ booking_type: str("Booking type id or slug") }, ["booking_type"]),
      preview: async (a) => {
        const t = await findType(need(a, "booking_type"));
        const { childCounts } = await peekRecord("booking_type", t.id);
        return {
          summary: `Delete booking page "${t.name}" (/book/${t.slug}) and its ${childCounts.bookings ?? 0} booking(s). Restorable from the trash.`,
          details: { id: t.id, host: t.host_name, ...childCounts }, entity: "booking_type", recordId: t.id,
        };
      },
      execute: async (a, c) => {
        const t = await findType(need(a, "booking_type"));
        const { trashId, label, before } = await trashRecord("booking_type", t.id, c.profile);
        return { result: { deleted: true, label, trash_id: trashId, restore_with: "sig_restore" }, summary: `Deleted booking page "${label}"`, entity: "booking_type", recordId: t.id, before };
      },
    },

    // ── Availability ──
    {
      name: "sig_booking_availability_set",
      title: "Set weekly availability",
      description: "Replace a booking page's weekly availability. rules = [{day_of_week 0=Sun…6=Sat, start_time 'HH:MM', end_time 'HH:MM'}]; several windows per day are fine. An empty list means no availability.",
      risk: "write",
      area: "bookings",
      inputSchema: obj({
        booking_type: str("Booking type id or slug"),
        rules: {
          type: "array",
          description: "Weekly windows",
          items: obj({ day_of_week: int("0=Sunday … 6=Saturday", 0, 6), start_time: str("HH:MM (24h)"), end_time: str("HH:MM (24h)"), is_active: bool("Default true") }, ["day_of_week", "start_time", "end_time"]),
        },
      }, ["booking_type", "rules"]),
      run: async (a) => {
        const t = await findType(need(a, "booking_type"));
        if (!Array.isArray(a.rules)) throw new Error("rules must be a list.");
        const before = await loadAvailability(t.id);
        const after = await replaceAvailability(t.id, a.rules as never[]);
        return { result: { booking_type: t.name, availability: after }, summary: `Set ${after.length} availability window(s) on "${t.name}"`, entity: "booking_type", recordId: t.id, before, after };
      },
    },
    {
      name: "sig_booking_date_override_add",
      title: "Add a date override",
      description: "Block a date (is_available=false, e.g. vacation) or set special hours for one date on a booking page.",
      risk: "write",
      area: "bookings",
      inputSchema: obj({
        booking_type: str("Booking type id or slug"),
        date: str("YYYY-MM-DD"),
        is_available: bool("false = blocked all day (default false)"),
        start_time: str("HH:MM, when is_available=true"),
        end_time: str("HH:MM, when is_available=true"),
        note: str("Reason, e.g. 'Office closed'"),
      }, ["booking_type", "date"]),
      run: async (a) => {
        const t = await findType(need(a, "booking_type"));
        const date = need(a, "date");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date must be YYYY-MM-DD.");
        const available = a.is_available === true;
        if (available && (!opt(a.start_time) || !opt(a.end_time))) throw new Error("Special hours need start_time and end_time.");
        const row = { booking_type_id: t.id, override_date: date, is_available: available, start_time: available ? s(a.start_time) : null, end_time: available ? s(a.end_time) : null, note: opt(a.note) ?? null };
        const { data, error } = await (await sb()).from("booking_date_overrides").insert(row).select("*").single();
        if (error) throw new Error(error.message);
        return { result: { added: true, override: data }, summary: `${available ? "Special hours" : "Blocked"} ${date} on "${t.name}"`, entity: "booking_date_override", recordId: data.id as string, after: data };
      },
    },
    {
      name: "sig_booking_date_override_delete",
      title: "Remove a date override",
      description: "Remove one date override (from sig_booking_type_get). Restorable with sig_restore. High risk: returns a preview first.",
      risk: "high",
      area: "bookings",
      inputSchema: obj({ override_id: str("Date override id") }, ["override_id"]),
      preview: async (a) => {
        const { row } = await peekRecord("booking_date_override", need(a, "override_id"));
        return { summary: `Remove the ${row.is_available ? "special hours" : "blocked day"} on ${row.override_date}.`, details: row, entity: "booking_date_override", recordId: String(row.id) };
      },
      execute: async (a, c) => {
        const out = await trashRecord("booking_date_override", need(a, "override_id"), c.profile);
        return { result: { removed: true, trash_id: out.trashId }, summary: "Removed a booking date override", entity: "booking_date_override", recordId: s(a.override_id), before: out.before };
      },
    },
    {
      name: "sig_booking_open_slots",
      title: "Open booking slots",
      description: "The bookable start times on a booking page between two dates (in the page's timezone), after availability, overrides, notice, buffers and existing bookings.",
      risk: "read",
      area: "bookings",
      inputSchema: obj({ booking_type: str("Booking type id or slug"), from_date: str("YYYY-MM-DD (default today)"), to_date: str("YYYY-MM-DD (default from_date + 7 days)") }, ["booking_type"]),
      run: async (a) => {
        const t = await findType(need(a, "booking_type"));
        const from = opt(a.from_date) ?? new Date().toISOString().slice(0, 10);
        const to = opt(a.to_date) ?? new Date(Date.parse(`${from}T12:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
        const [rules, overrides, bookings] = await Promise.all([
          loadAvailability(t.id), loadDateOverrides(t.id),
          loadBookingsForType(t.id, new Date(Date.parse(`${from}T00:00:00Z`) - 86_400_000).toISOString(), new Date(Date.parse(`${to}T23:59:59Z`) + 86_400_000).toISOString()),
        ]);
        const slots = computeSlots({ type: t, rules, overrides, bookings, fromDate: from, toDate: to });
        return { result: { booking_type: t.name, timezone: t.timezone, days: groupSlotsByDate(slots, t.timezone || "America/Phoenix") } };
      },
    },

    // ── Bookings ──
    {
      name: "sig_bookings_list",
      title: "List bookings",
      description: "List appointments booked on SIG booking pages. Filter by status, booking page, date range or client name/email.",
      risk: "read",
      area: "bookings",
      inputSchema: obj({
        status: strEnum(BOOKING_STATUSES, "Only this status"),
        booking_type: str("Booking type id or slug"),
        from: str("Start on/after (ISO date or date/time; default now)"),
        to: str("Start before (ISO)"),
        include_past: bool("Include past bookings when `from` isn't given"),
        search: str("Client name, email or booking reference"),
        limit: int("Max rows (default 50)"),
      }),
      run: async (a) => {
        let q = (await sb()).from("bookings").select("*, booking_type:booking_types(name, slug)", { count: "exact" }).order("start_at", { ascending: true }).limit(clamp(a.limit, 50, 200));
        if (opt(a.status)) q = q.eq("status", s(a.status));
        if (opt(a.booking_type)) q = q.eq("booking_type_id", (await findType(s(a.booking_type))).id);
        const from = opt(a.from);
        if (from) q = q.gte("start_at", new Date(from).toISOString());
        else if (a.include_past !== true) q = q.gte("end_at", new Date().toISOString());
        if (opt(a.to)) q = q.lt("start_at", new Date(s(a.to)).toISOString());
        const term = ilikeSafe(s(a.search));
        if (term) q = q.or(`invitee_name.ilike.%${term}%,invitee_email.ilike.%${term}%,reference.ilike.%${term}%`);
        const { data, count, error } = await q;
        if (error) throw new Error(error.message);
        return { result: { total: count ?? 0, bookings: (data ?? []).map((b) => bookingShape(b as Record<string, unknown>)) } };
      },
    },
    {
      name: "sig_booking_get",
      title: "Read a booking",
      description: "One booking in full (client details, intake answers, notes) by id or reference (e.g. SIG-4F9K2).",
      risk: "read",
      area: "bookings",
      inputSchema: obj({ booking: str("Booking id or reference") }, ["booking"]),
      run: async (a) => ({ result: bookingShape(await findBooking(need(a, "booking"))) }),
    },
    {
      name: "sig_booking_create",
      title: "Book an appointment",
      description: "Book an appointment on a booking page for a client (staff-entered; no confirmation email is sent). end_at is computed from the page's duration. Refuses overlapping times.",
      risk: "write",
      area: "bookings",
      inputSchema: obj({
        booking_type: str("Booking type id or slug"),
        start_at: str("Start, ISO date/time with offset, e.g. 2026-12-01T09:00:00-07:00"),
        status: strEnum(["confirmed", "pending"], "Default confirmed"),
        location_type: strEnum(LOCATION_TYPES, "Default: the page's location type"),
        answers: anyObj("Intake answers keyed by question key"),
        ...BOOKING_FIELDS,
      }, ["booking_type", "start_at", "invitee_name"]),
      run: async (a, c) => {
        const t = await findType(need(a, "booking_type"));
        const { start, end } = endFrom(need(a, "start_at"), t.duration_minutes || 30);
        await assertNoClash(t.id, start, end);
        const booking = await createBooking({
          booking_type_id: t.id, host_staff_id: await resolveHostStaffId(t).catch(() => t.host_staff_id ?? null), host_slug: t.host_slug ?? null, invitee_name: need(a, "invitee_name"),
          invitee_email: opt(a.invitee_email) ?? null, invitee_phone: opt(a.invitee_phone) ?? null,
          start_at: start, end_at: end, timezone: t.timezone || "America/Phoenix",
          location_type: opt(a.location_type) ?? t.location_type, location_details: opt(a.location_details) ?? t.location_details ?? null,
          answers: (a.answers as Json) ?? {}, source: "mcp", status: opt(a.status) ?? "confirmed",
        });
        if (opt(a.internal_notes)) await updateBooking(booking.id, { internal_notes: s(a.internal_notes) });
        void c;
        return { result: { booked: true, ...bookingShape({ ...booking, booking_type: { name: t.name } } as unknown as Record<string, unknown>) }, summary: `Booked ${booking.invitee_name} on "${t.name}" at ${start}`, entity: "booking", recordId: booking.id, after: booking };
      },
    },
    {
      name: "sig_booking_update",
      title: "Update a booking",
      description: "Change a booking's status (confirmed, pending, completed, no_show), notes or client details. Use sig_booking_cancel to cancel and sig_booking_reschedule to move it.",
      risk: "write",
      area: "bookings",
      inputSchema: obj({ booking: str("Booking id or reference"), status: strEnum(["confirmed", "pending", "completed", "no_show"], "New status"), ...BOOKING_FIELDS }, ["booking"]),
      run: async (a) => {
        const b = await findBooking(need(a, "booking"));
        const patch = pickDefined(a, ["status", ...Object.keys(BOOKING_FIELDS)]);
        if (!Object.keys(patch).length) throw new Error("Nothing to change.");
        await updateBooking(String(b.id), patch);
        const after = await findBooking(String(b.id));
        return { result: { updated: true, ...bookingShape(after) }, summary: `Updated booking ${b.reference} (${Object.keys(patch).join(", ")})`, entity: "booking", recordId: String(b.id), before: b, after };
      },
    },
    {
      name: "sig_booking_cancel",
      title: "Cancel a booking",
      description: "Cancel an appointment (status canceled, with a reason). The slot opens up again. By default nothing is sent; notify=true tells the client (only by the channels they opted into), the planner and the dashboard, with a calendar cancellation.",
      risk: "write",
      area: "bookings",
      inputSchema: obj({ booking: str("Booking id or reference"), reason: str("Why it was canceled"), notify: bool("Send cancellation notifications (default false)") }, ["booking"]),
      run: async (a) => {
        const b = await findBooking(need(a, "booking"));
        if (b.status === "canceled") throw new Error(`Booking ${b.reference} is already canceled.`);
        const type = await findType(String(b.booking_type_id));
        const { booking_type: _bt, ...row } = b;
        const cancelled = await cancelBooking({ booking: row as unknown as Booking, type, reason: opt(a.reason) ?? null, by: "staff" });
        let notified: Record<string, string> | null = null;
        if (a.notify === true) {
          try { notified = await notifyBookingChanged({ kind: "cancelled", booking: cancelled, type, by: "staff", reason: cancelled.cancel_reason }); }
          catch (e) { notified = { error: e instanceof Error ? e.message : "notify failed" }; }
        }
        return { result: { canceled: true, id: b.id, reference: b.reference, notified }, summary: `Canceled booking ${b.reference} (${b.invitee_name})${notified ? " and notified" : ""}`, entity: "booking", recordId: String(b.id), before: { status: b.status }, after: { status: "canceled" } };
      },
    },
    {
      name: "sig_booking_reschedule",
      title: "Reschedule a booking",
      description: "Move a booking to a new start time (same length). Refuses overlaps on the planner's calendar. A canceled booking is reopened. By default nothing is sent; notify=true sends the client (only by the channels they opted into) the new time with a fresh manage link, and tells the planner and dashboard.",
      risk: "write",
      area: "bookings",
      inputSchema: obj({ booking: str("Booking id or reference"), start_at: str("New start, ISO date/time with offset"), duration_minutes: num("Optional new length in minutes"), notify: bool("Send reschedule notifications (default false)") }, ["booking", "start_at"]),
      run: async (a) => {
        const b = await findBooking(need(a, "booking"));
        const oldMinutes = Math.round((Date.parse(String(b.end_at)) - Date.parse(String(b.start_at))) / 60_000) || 30;
        const { start, end } = endFrom(need(a, "start_at"), Number(a.duration_minutes) || oldMinutes);
        await assertNoClash(String(b.booking_type_id), start, end, String(b.id));
        if (b.status === "canceled") {
          // Reopen first (rescheduleBooking refuses canceled bookings).
          await updateBooking(String(b.id), { status: "confirmed", cancelled_at: null, cancelled_by: null });
        }
        const type = await findType(String(b.booking_type_id));
        const { booking_type: _bt, ...row } = b;
        const { booking: moved, previous } = await rescheduleBooking({
          booking: { ...(row as unknown as Booking), status: b.status === "canceled" ? "confirmed" : (b.status as Booking["status"]) },
          type, startIso: start, by: "staff", durationMinutes: Math.round((Date.parse(end) - Date.parse(start)) / 60_000),
        });
        let notified: Record<string, string> | null = null;
        if (a.notify === true) {
          try {
            const reachable = (moved.notify_email && moved.invitee_email) || (moved.notify_sms && moved.invitee_phone);
            const token = reachable ? await rotateManageToken(moved.id) : null;
            notified = await notifyBookingChanged({ kind: "rescheduled", booking: moved, type, previous, by: "staff", manageUrl: token ? manageUrl(token) : null });
          } catch (e) { notified = { error: e instanceof Error ? e.message : "notify failed" }; }
        }
        return { result: { rescheduled: true, id: b.id, reference: b.reference, start_at: moved.start_at, end_at: moved.end_at, notified }, summary: `Rescheduled booking ${b.reference} to ${start}${notified ? " and notified" : ""}`, entity: "booking", recordId: String(b.id), before: { start_at: b.start_at, end_at: b.end_at }, after: { start_at: moved.start_at, end_at: moved.end_at } };
      },
    },
    {
      name: "sig_booking_delete",
      title: "Delete a booking",
      description: "Delete a booking record entirely (kept in the trash; restorable with sig_restore). Usually cancel instead. High risk: returns a preview first.",
      risk: "high",
      area: "bookings",
      inputSchema: obj({ booking: str("Booking id or reference") }, ["booking"]),
      preview: async (a): Promise<Preview> => {
        const b = await findBooking(need(a, "booking"));
        return { summary: `Delete booking ${b.reference} for ${b.invitee_name} at ${b.start_at}. Restorable from the trash.`, details: bookingShape(b), entity: "booking", recordId: String(b.id) };
      },
      execute: async (a, c) => {
        const b = await findBooking(need(a, "booking"));
        const { trashId, label, before } = await trashRecord("booking", String(b.id), c.profile);
        return { result: { deleted: true, label, trash_id: trashId, restore_with: "sig_restore" }, summary: `Deleted booking ${b.reference}`, entity: "booking", recordId: String(b.id), before };
      },
    },
  ];
}
