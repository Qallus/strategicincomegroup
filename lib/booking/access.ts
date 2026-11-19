import { requireParticipantManager } from "@/lib/user-management/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ROLES } from "@/lib/rbac/roles";

/**
 * Who can manage which booking pages and events.
 *
 * - Super Admin / Admin ("SIG Admin"): everything.
 * - Team members (planners, until Phase 1.3 adds an `advisor` role): only the
 *   booking pages, bookings and events where they are the host
 *   (`host_staff_id` = their profile id). Anything they create is assigned to them.
 */
export type BookingManager = { profileId: string; role: string; isAdmin: boolean };

export async function requireBookingManager(request: Request, actionToken?: string | null): Promise<BookingManager> {
  const profile = await requireParticipantManager(request, actionToken);
  const role = String(profile.role);
  return { profileId: String(profile.id), role, isAdmin: role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN };
}

export function isBookingAdminRole(role: string | null | undefined) {
  return role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN;
}

async function hostOf(table: "booking_types" | "events", id: string): Promise<string | null | undefined> {
  const sb = createSupabaseAdminClient();
  const { data } = await sb.from(table).select("host_staff_id").eq("id", id).maybeSingle();
  return data ? ((data.host_staff_id as string | null) ?? null) : undefined;
}

function deny(): never {
  throw new Error("Permission required: you can only manage your own booking pages and events.");
}

export async function assertCanManageType(m: BookingManager, typeId: string) {
  if (m.isAdmin) return;
  if ((await hostOf("booking_types", typeId)) !== m.profileId) deny();
}

export async function assertCanManageEvent(m: BookingManager, eventId: string) {
  if (m.isAdmin) return;
  if ((await hostOf("events", eventId)) !== m.profileId) deny();
}

export async function assertCanManageBooking(m: BookingManager, bookingId: string) {
  if (m.isAdmin) return;
  const sb = createSupabaseAdminClient();
  const { data } = await sb.from("bookings").select("host_staff_id, booking_type_id").eq("id", bookingId).maybeSingle();
  if (!data) deny();
  if (data.host_staff_id === m.profileId) return;
  await assertCanManageType(m, String(data.booking_type_id));
}

export async function assertCanManageRegistration(m: BookingManager, registrationId: string) {
  if (m.isAdmin) return;
  const sb = createSupabaseAdminClient();
  const { data } = await sb.from("event_registrations").select("event_id").eq("id", registrationId).maybeSingle();
  if (!data) deny();
  await assertCanManageEvent(m, String(data.event_id));
}

/** Non-admins can't reassign a page or event to someone else. */
export function scopePayload(m: BookingManager, payload: Record<string, unknown>) {
  if (!m.isAdmin) payload.host_staff_id = m.profileId;
  return payload;
}
