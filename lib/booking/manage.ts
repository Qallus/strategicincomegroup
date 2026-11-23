// Client self-service for bookings: manage links, reschedule, cancel, contact updates and
// "email me my appointments" access links. SERVER ONLY (service-role client, node:crypto).
//
// Tokens: a random 32-byte token goes to the client (link / email / SMS); only its SHA-256
// is stored. Two kinds resolve to a booking:
//   • bookings.manage_token_hash — the permanent link from the confirmation.
//   • booking_access_requests (booking_id set) — a 24-hour grant issued when the client
//     opens a one-hour, single-use "my appointments" email link.
//
// Everything degrades gracefully before 202611210200_booking_self_service.sql is applied:
// lookups return null, the reschedule falls back to a check-then-update.
import { createHash, randomBytes } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { computeSlots, utcToZonedDate } from "./availability";
import {
  hasCalendarClash, isMissingColumnError, loadAvailability, loadBlockingBookings, loadDateOverrides, updateBooking,
} from "./data";
import type { Booking, BookingType } from "./types";

const MINUTE = 60_000;
const TOKEN_RE = /^[A-Za-z0-9_-]{40,64}$/;
const GRANT_HOURS = 24;
const ACCESS_LINK_MINUTES = 60;

export const siteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://strategicincomegroup.com").replace(/\/$/, "");

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const salted = (v: string) => sha256(`${process.env.BOOKING_HASH_SALT || "sig-booking-v1"}:${v}`);
export const emailHash = (email: string) => sha256(email.trim().toLowerCase());

export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: sha256(token) };
}

export const managePath = (token: string) => `/book/manage/${token}`;
export const manageUrl = (token: string) => `${siteUrl()}${managePath(token)}`;
export const isTokenShape = (token: string) => TOKEN_RE.test(token);

/** Missing table / function / column — the self-service migration hasn't run yet. */
export function isMissingSchemaError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return (
    isMissingColumnError(error) ||
    error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST202" || error.code === "42883" ||
    /does not exist|could not find the (table|function)/i.test(error.message ?? "")
  );
}

// ── Host resolution ───────────────────────────────────────────────────────────

/** The planner's dashboard login for a booking page: explicit host, else the linked employee profile. */
export async function resolveHostStaffId(type: Pick<BookingType, "host_staff_id" | "host_slug">): Promise<string | null> {
  if (type.host_staff_id) return type.host_staff_id;
  if (!type.host_slug) return null;
  const { data } = await createSupabaseAdminClient()
    .from("employee_profiles")
    .select("profile_id")
    .eq("slug", type.host_slug)
    .maybeSingle();
  return (data?.profile_id as string | null | undefined) ?? null;
}

// ── Lookup ────────────────────────────────────────────────────────────────────

export type ManagedBooking = {
  booking: Booking;
  type: BookingType;
  /** "permanent" = the confirmation link; "grant" = a 24-hour link from an access email. */
  via: "permanent" | "grant";
};

async function loadType(id: string): Promise<BookingType | null> {
  const { data } = await createSupabaseAdminClient().from("booking_types").select("*").eq("id", id).maybeSingle();
  return (data ?? null) as BookingType | null;
}

export async function loadBookingByManageToken(token: string): Promise<ManagedBooking | null> {
  if (!isTokenShape(token)) return null;
  const sb = createSupabaseAdminClient();
  const hash = sha256(token);

  const { data, error } = await sb.from("bookings").select("*").eq("manage_token_hash", hash).maybeSingle();
  if (error && !isMissingSchemaError(error)) console.error("[booking-manage] lookup failed", error.message);
  let booking = (data ?? null) as Booking | null;
  let via: ManagedBooking["via"] = "permanent";

  if (!booking && !error) {
    const { data: grant, error: gErr } = await sb
      .from("booking_access_requests")
      .select("booking_id, expires_at")
      .eq("token_hash", hash)
      .not("booking_id", "is", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (gErr && !isMissingSchemaError(gErr)) console.error("[booking-manage] grant lookup failed", gErr.message);
    if (grant?.booking_id) {
      const { data: b } = await sb.from("bookings").select("*").eq("id", grant.booking_id).maybeSingle();
      booking = (b ?? null) as Booking | null;
      via = "grant";
    }
  }
  if (!booking) return null;
  const type = await loadType(booking.booking_type_id);
  if (!type) return null;
  return { booking, type, via };
}

/** Give a booking a fresh permanent manage token (invalidates the previous link). Null before the migration. */
export async function rotateManageToken(bookingId: string): Promise<string | null> {
  const { token, hash } = newToken();
  const { error } = await createSupabaseAdminClient()
    .from("bookings")
    .update({ manage_token_hash: hash, manage_token_created_at: new Date().toISOString() })
    .eq("id", bookingId);
  if (error) {
    if (!isMissingSchemaError(error)) console.error("[booking-manage] token rotate failed", error.message);
    return null;
  }
  return token;
}

// ── Rules ─────────────────────────────────────────────────────────────────────

export type ChangeState =
  | { ok: true; cutoff: string }
  | { ok: false; reason: "canceled" | "past" | "closed" | "too_late"; cutoff: string };

/** Can the client still change this booking online? (Min-notice applies to cancel and reschedule.) */
export function changeState(b: Pick<Booking, "start_at" | "status">, type: Pick<BookingType, "min_notice_hours">, now = new Date()): ChangeState {
  const cutoff = new Date(new Date(b.start_at).getTime() - Math.max(0, type.min_notice_hours || 0) * 60 * MINUTE).toISOString();
  if (b.status === "canceled") return { ok: false, reason: "canceled", cutoff };
  if (new Date(b.start_at) <= now) return { ok: false, reason: "past", cutoff };
  if (b.status === "completed" || b.status === "no_show") return { ok: false, reason: "closed", cutoff };
  if (new Date(cutoff) <= now) return { ok: false, reason: "too_late", cutoff };
  return { ok: true, cutoff };
}

export class SlotTakenError extends Error {
  constructor() { super("That time was just taken. Please pick another slot."); }
}

/** Open slots for moving an existing booking (its own time doesn't block itself). */
export async function slotsForReschedule(booking: Booking, type: BookingType, fromDate?: string, toDate?: string, opts: { ignoreNotice?: boolean } = {}) {
  const today = utcToZonedDate(new Date(), type.timezone || "America/Phoenix");
  const from = fromDate || today;
  const maxTo = new Date(Date.now() + (type.max_advance_days || 60) * 86400000).toISOString().slice(0, 10);
  let to = toDate || maxTo;
  if (to > maxTo) to = maxTo;
  const [rules, overrides, bookings] = await Promise.all([
    loadAvailability(type.id),
    loadDateOverrides(type.id),
    loadBlockingBookings(type, new Date(`${from}T00:00:00Z`).toISOString(), new Date(`${to}T23:59:59Z`).toISOString(), booking.id),
  ]);
  // Staff may book inside the min-notice window; clients may not.
  const slots = computeSlots({ type: opts.ignoreNotice ? { ...type, min_notice_hours: 0 } : type, rules, overrides, bookings, fromDate: from, toDate: to });
  return slots.filter((s) => s.start !== booking.start_at && new Date(s.start).getTime() !== new Date(booking.start_at).getTime());
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export type RescheduleResult = { booking: Booking; previous: { start_at: string; end_at: string } };

/**
 * Move a booking in place (same row, same reference). Clients must pick an open slot
 * (availability + min notice); staff may place it anywhere that doesn't clash.
 * Uses booking_reschedule() (locks + re-checks) when the migration is applied.
 */
export async function rescheduleBooking(opts: {
  booking: Booking; type: BookingType; startIso: string; by: "client" | "staff"; durationMinutes?: number;
}): Promise<RescheduleResult> {
  const { booking, type, by } = opts;
  const start = new Date(opts.startIso);
  if (Number.isNaN(start.getTime())) throw new Error("Invalid start time.");
  if (start.getTime() < Date.now()) throw new Error("That time is in the past.");
  if (booking.status === "canceled") throw new Error("This appointment was cancelled.");
  const minutes = opts.durationMinutes || type.duration_minutes || Math.round((Date.parse(booking.end_at) - Date.parse(booking.start_at)) / MINUTE) || 30;
  const end = new Date(start.getTime() + minutes * MINUTE);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  if (by === "client") {
    const state = changeState(booking, type);
    if (!state.ok) throw new Error(state.reason === "too_late" ? "It's too close to your appointment to change it online. Please call the office." : "This appointment can no longer be changed online.");
    const day = utcToZonedDate(start, type.timezone || "America/Phoenix");
    const open = await slotsForReschedule(booking, type, day, day);
    if (!open.some((s) => new Date(s.start).getTime() === start.getTime())) throw new SlotTakenError();
  }

  const previous = { start_at: booking.start_at, end_at: booking.end_at };
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb.rpc("booking_reschedule", { p_booking_id: booking.id, p_start: startIso, p_end: endIso });
  if (!error) {
    const row = (Array.isArray(data) ? data[0] : data) as Booking | undefined;
    if (row) return { booking: row, previous };
  }
  if (error && /slot_taken/i.test(error.message)) throw new SlotTakenError();
  if (error && /booking_canceled/i.test(error.message)) throw new Error("This appointment was cancelled.");
  if (error && !isMissingSchemaError(error)) throw new Error(error.message);

  // Pre-migration fallback: check, then update.
  if (await hasCalendarClash(type, startIso, endIso, booking.id)) throw new SlotTakenError();
  const status = booking.status === "completed" || booking.status === "no_show" ? booking.status : "confirmed";
  await updateBooking(booking.id, {
    start_at: startIso, end_at: endIso, status,
    rescheduled_at: new Date().toISOString(), ics_sequence: (booking.ics_sequence ?? 0) + 1,
  });
  const { data: fresh } = await sb.from("bookings").select("*").eq("id", booking.id).maybeSingle();
  return { booking: (fresh ?? { ...booking, start_at: startIso, end_at: endIso, status }) as Booking, previous };
}

export async function cancelBooking(opts: { booking: Booking; type: BookingType; reason?: string | null; by: "client" | "staff" }): Promise<Booking> {
  const { booking, type, by } = opts;
  if (booking.status === "canceled") throw new Error("This appointment is already cancelled.");
  if (by === "client") {
    const state = changeState(booking, type);
    if (!state.ok) throw new Error(state.reason === "too_late" ? "It's too close to your appointment to cancel online. Please call the office." : "This appointment can no longer be changed online.");
  }
  const reason = opts.reason ? String(opts.reason).trim().slice(0, 500) || null : null;
  const patch = {
    status: "canceled", cancel_reason: reason, cancelled_at: new Date().toISOString(), cancelled_by: by,
    ics_sequence: (booking.ics_sequence ?? 0) + 1,
  };
  await updateBooking(booking.id, patch);
  return { ...booking, ...patch, status: "canceled", cancelled_by: by } as Booking;
}

/** Contact + notification preferences from the manage page. Both opt-ins stay off unless switched on. */
export async function updateBookingContact(opts: {
  booking: Booking; phone?: string | null; notifyEmail: boolean; notifySms: boolean; smsConsentText: string;
  consent: { ip?: string | null; userAgent?: string | null };
}): Promise<Booking> {
  const { booking } = opts;
  const phone = opts.phone === undefined ? booking.invitee_phone : (opts.phone ? String(opts.phone).trim().slice(0, 40) : null);
  if (phone && phone.replace(/\D/g, "").length < 10) throw new Error("Enter a full phone number, including area code.");
  if (opts.notifySms && !phone) throw new Error("Add a mobile number to get text reminders.");
  if (opts.notifyEmail && !booking.invitee_email) throw new Error("There's no email on this booking.");
  const optedIn = opts.notifyEmail || opts.notifySms;
  const newlyOptedIn = (opts.notifyEmail && !booking.notify_email) || (opts.notifySms && !booking.notify_sms);
  const patch: Record<string, unknown> = {
    invitee_phone: phone,
    notify_email: opts.notifyEmail,
    notify_sms: opts.notifySms,
    sms_consent_text: opts.notifySms ? opts.smsConsentText : null,
  };
  if (newlyOptedIn) {
    patch.notify_consent_at = new Date().toISOString();
    patch.consent_ip = opts.consent.ip ?? null;
    patch.consent_user_agent = opts.consent.userAgent ?? null;
  } else if (!optedIn) {
    patch.notify_consent_at = null;
  }
  await updateBooking(booking.id, patch);
  return { ...booking, ...patch } as Booking;
}

// ── "Email me my appointments" ─────────────────────────────────────────────────

const RATE = { perIpHour: 10, perEmailWindowMinutes: 15, perEmailWindow: 3 };

export type AccessRequestOutcome = "sent" | "no_bookings" | "rate_limited" | "unavailable";

/**
 * Issue a one-hour, single-use link listing the client's appointments. The caller ALWAYS
 * answers the same way regardless of the outcome (no account enumeration).
 */
export async function requestAccessLink(
  emailRaw: string, ip: string | null, send: (to: string, url: string) => Promise<void>,
): Promise<AccessRequestOutcome> {
  const email = emailRaw.trim().toLowerCase();
  const sb = createSupabaseAdminClient();
  const eHash = emailHash(email);
  const ipHash = ip ? salted(ip) : null;
  const now = Date.now();

  // Rate limits (IP per hour, email per 15 minutes). Every attempt is recorded.
  if (ipHash) {
    const { count, error } = await sb
      .from("booking_access_requests")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .is("booking_id", null)
      .gte("created_at", new Date(now - 3600_000).toISOString());
    // HEAD count requests carry no error body, so a missing table can surface with an empty message.
    if (error) {
      if (isMissingSchemaError(error) || !error.message) return "unavailable";
      throw new Error(error.message);
    }
    if ((count ?? 0) >= RATE.perIpHour) return "rate_limited";
  }
  const { count: perEmail, error: eErr } = await sb
    .from("booking_access_requests")
    .select("id", { count: "exact", head: true })
    .eq("email_hash", eHash)
    .is("booking_id", null)
    .gte("created_at", new Date(now - RATE.perEmailWindowMinutes * MINUTE).toISOString());
  if (eErr) {
    if (isMissingSchemaError(eErr) || !eErr.message) return "unavailable";
    throw new Error(eErr.message);
  }
  if ((perEmail ?? 0) >= RATE.perEmailWindow) {
    await sb.from("booking_access_requests").insert({ email_hash: eHash, ip_hash: ipHash, expires_at: new Date(now).toISOString() });
    return "rate_limited";
  }

  const { data: any } = await sb
    .from("bookings")
    .select("id")
    .ilike("invitee_email", email.replace(/[%_\\]/g, "\\$&"))
    .gte("start_at", new Date(now - 90 * 86400000).toISOString())
    .limit(1);
  if (!any || !any.length) {
    await sb.from("booking_access_requests").insert({ email_hash: eHash, ip_hash: ipHash, expires_at: new Date(now).toISOString() });
    return "no_bookings";
  }

  const { token, hash } = newToken();
  const { error } = await sb.from("booking_access_requests").insert({
    email_hash: eHash, token_hash: hash, ip_hash: ipHash, expires_at: new Date(now + ACCESS_LINK_MINUTES * MINUTE).toISOString(),
  });
  if (error) throw new Error(error.message);
  await send(email, `${siteUrl()}/book/manage/list/${token}`);
  return "sent";
}

export type AccessListItem = {
  reference: string; typeName: string; hostName: string | null; start_at: string; end_at: string; timezone: string;
  status: Booking["status"]; locationType: string; manageUrl: string;
};

/** Is an access link still usable? (GET-safe: does not consume it.) */
export async function peekAccessLink(token: string): Promise<"valid" | "used" | "expired" | "invalid"> {
  if (!isTokenShape(token)) return "invalid";
  const { data, error } = await createSupabaseAdminClient()
    .from("booking_access_requests")
    .select("expires_at, used_at")
    .eq("token_hash", sha256(token))
    .is("booking_id", null)
    .maybeSingle();
  if (error || !data) return "invalid";
  if (data.used_at) return "used";
  if (new Date(data.expires_at as string) < new Date()) return "expired";
  return "valid";
}

/**
 * Consume a single-use access link and return the client's upcoming + recent appointments,
 * each with a fresh 24-hour manage link. Consumption is atomic (used_at is null → now).
 */
export async function consumeAccessLink(token: string): Promise<{ ok: true; items: AccessListItem[] } | { ok: false; reason: "used" | "expired" | "invalid" }> {
  if (!isTokenShape(token)) return { ok: false, reason: "invalid" };
  const sb = createSupabaseAdminClient();
  const hash = sha256(token);
  const nowIso = new Date().toISOString();
  const { data: row, error } = await sb
    .from("booking_access_requests")
    .update({ used_at: nowIso })
    .eq("token_hash", hash)
    .is("booking_id", null)
    .is("used_at", null)
    .gt("expires_at", nowIso)
    .select("email_hash")
    .maybeSingle();
  if (error || !row) {
    const state = await peekAccessLink(token);
    return { ok: false, reason: state === "valid" ? "invalid" : state };
  }

  // Find bookings whose email hashes to the requester's (email itself isn't stored on the request).
  const { data: candidates } = await sb
    .from("bookings")
    .select("*, booking_type:booking_types(name, slug, color, host_slug, host_name)")
    .not("invitee_email", "is", null)
    .gte("start_at", new Date(Date.now() - 90 * 86400000).toISOString())
    .order("start_at", { ascending: true })
    .limit(1000);
  const mine = ((candidates ?? []) as Booking[]).filter((b) => b.invitee_email && emailHash(b.invitee_email) === row.email_hash);

  const items: AccessListItem[] = [];
  for (const b of mine.slice(0, 30)) {
    const { token: grant, hash: grantHash } = newToken();
    const { error: gErr } = await sb.from("booking_access_requests").insert({
      email_hash: row.email_hash, token_hash: grantHash, booking_id: b.id, expires_at: new Date(Date.now() + GRANT_HOURS * 3600_000).toISOString(),
    });
    if (gErr) { console.error("[booking-manage] grant insert failed", gErr.message); continue; }
    items.push({
      reference: b.reference, typeName: b.booking_type?.name ?? "Appointment", hostName: b.booking_type?.host_name ?? null,
      start_at: b.start_at, end_at: b.end_at, timezone: b.timezone, status: b.status, locationType: b.location_type,
      manageUrl: managePath(grant),
    });
  }
  return { ok: true, items };
}
