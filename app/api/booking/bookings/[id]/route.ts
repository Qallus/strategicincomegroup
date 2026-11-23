import { after, NextRequest, NextResponse } from "next/server";
import { assertCanManageBooking, requireBookingManager } from "@/lib/booking/access";
import { deleteBooking, updateBooking } from "@/lib/booking/data";
import { SlotTakenError, cancelBooking, manageUrl, rescheduleBooking, rotateManageToken, slotsForReschedule } from "@/lib/booking/manage";
import { notifyBookingChanged } from "@/lib/booking/notify";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Booking, BookingType } from "@/lib/booking/types";

function errStatus(msg: string) {
  return /authentication/i.test(msg) ? 401 : /permission|required/i.test(msg) ? 403 : /taken/i.test(msg) ? 409 : 500;
}

async function loadPair(id: string): Promise<{ booking: Booking; type: BookingType }> {
  const sb = createSupabaseAdminClient();
  const { data: booking } = await sb.from("bookings").select("*").eq("id", id).maybeSingle();
  if (!booking) throw new Error("Booking not found.");
  const { data: type } = await sb.from("booking_types").select("*").eq("id", booking.booking_type_id).maybeSingle();
  if (!type) throw new Error("Booking page not found.");
  return { booking: booking as Booking, type: type as BookingType };
}

// Staff: open slots to move a booking to (ignores the client min-notice window).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const m = await requireBookingManager(request);
    await assertCanManageBooking(m, id);
    const { booking, type } = await loadPair(id);
    const slots = await slotsForReschedule(booking, type, undefined, undefined, { ignoreNotice: true });
    return NextResponse.json({ slots, timezone: type.timezone, duration_minutes: type.duration_minutes });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to load slots";
    return NextResponse.json({ message: msg }, { status: errStatus(msg) });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const m = await requireBookingManager(request, body?.actionToken);
    await assertCanManageBooking(m, id);
    const action = String(body?.action || "");

    if (action === "reschedule") {
      const { booking, type } = await loadPair(id);
      const { booking: moved, previous } = await rescheduleBooking({ booking, type, startIso: String(body?.start_at || ""), by: "staff" });
      const notifyClient = body?.notify_client !== false;
      // Only rotate the client's link when we're going to deliver the new one.
      const willReachClient = notifyClient && ((moved.notify_email && moved.invitee_email) || (moved.notify_sms && moved.invitee_phone));
      const token = willReachClient ? await rotateManageToken(moved.id) : null;
      after(async () => {
        try {
          await notifyBookingChanged({
            kind: "rescheduled", booking: notifyClient ? moved : { ...moved, notify_email: false, notify_sms: false },
            type, previous, by: "staff", manageUrl: token ? manageUrl(token) : null,
          });
        } catch (e) { console.error("[booking] staff reschedule notify failed", moved.reference, e instanceof Error ? e.message : e); }
      });
      return NextResponse.json({ ok: true, booking: moved });
    }

    if (action === "cancel") {
      const { booking, type } = await loadPair(id);
      const cancelled = await cancelBooking({ booking, type, reason: body?.reason ? String(body.reason) : null, by: "staff" });
      const notifyClient = body?.notify_client !== false;
      after(async () => {
        try {
          await notifyBookingChanged({
            kind: "cancelled", booking: notifyClient ? cancelled : { ...cancelled, notify_email: false, notify_sms: false },
            type, by: "staff", reason: cancelled.cancel_reason,
          });
        } catch (e) { console.error("[booking] staff cancel notify failed", cancelled.reference, e instanceof Error ? e.message : e); }
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "reassign") {
      if (!m.isAdmin) throw new Error("Permission required: only a SIG Admin can reassign appointments.");
      await updateBooking(id, { host_staff_id: body?.host_staff_id ? String(body.host_staff_id) : null });
      return NextResponse.json({ ok: true });
    }

    // Plain field update (status, notes, …). Reassigning needs an admin.
    const patch = { ...body };
    if (!m.isAdmin) delete patch.host_staff_id;
    await updateBooking(id, patch);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SlotTakenError) return NextResponse.json({ message: error.message }, { status: 409 });
    const msg = error instanceof Error ? error.message : "Failed to update booking";
    return NextResponse.json({ message: msg }, { status: errStatus(msg) });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const m = await requireBookingManager(request, body?.actionToken);
    await assertCanManageBooking(m, id);
    await deleteBooking(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to delete booking";
    return NextResponse.json({ message: msg }, { status: errStatus(msg) });
  }
}
