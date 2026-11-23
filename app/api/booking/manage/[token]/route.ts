import { after, NextRequest, NextResponse } from "next/server";
import { BOOKING_SMS_CONSENT_TEXT } from "@/lib/booking/consent";
import { buildIcs } from "@/lib/booking/ics";
import {
  SlotTakenError, cancelBooking, changeState, loadBookingByManageToken, managePath, manageUrl, rescheduleBooking,
  rotateManageToken, slotsForReschedule, updateBookingContact,
} from "@/lib/booking/manage";
import { calendarEventFor, notifyBookingChanged, recordBookingConsent } from "@/lib/booking/notify";

type Ctx = { params: Promise<{ token: string }> };

const notFound = () => NextResponse.json({ message: "This link isn’t valid any more. Request a new one at /book/manage." }, { status: 404 });

// PUBLIC (token-gated): open slots for rescheduling, or the .ics file.
export async function GET(request: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const found = await loadBookingByManageToken(token).catch(() => null);
  if (!found) return notFound();
  const { booking, type } = found;
  const view = request.nextUrl.searchParams.get("view");

  if (view === "ics") {
    const cancelled = booking.status === "canceled";
    const ics = buildIcs(calendarEventFor(booking, type, type.host_name, {
      manageUrl: cancelled ? null : manageUrl(token), method: cancelled ? "CANCEL" : "PUBLISH",
    }));
    return new NextResponse(ics, {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `attachment; filename="SIG-appointment-${booking.reference}.ics"`,
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
      },
    });
  }

  if (view === "slots") {
    const state = changeState(booking, type);
    if (!state.ok) return NextResponse.json({ slots: [], timezone: type.timezone, reason: state.reason });
    try {
      const sp = request.nextUrl.searchParams;
      const slots = await slotsForReschedule(booking, type, sp.get("from") || undefined, sp.get("to") || undefined);
      return NextResponse.json({ slots, timezone: type.timezone, duration_minutes: type.duration_minutes }, { headers: { "cache-control": "no-store" } });
    } catch (e) {
      return NextResponse.json({ message: e instanceof Error ? e.message : "Failed to load slots" }, { status: 500 });
    }
  }
  return NextResponse.json({ message: "Unknown view." }, { status: 400 });
}

// PUBLIC (token-gated): reschedule, cancel, or update contact / notification preferences.
export async function POST(request: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const found = await loadBookingByManageToken(token).catch(() => null);
  if (!found) return notFound();
  const { booking, type, via } = found;
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "");
  const consent = {
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null,
    userAgent: request.headers.get("user-agent") ?? null,
  };

  try {
    if (action === "reschedule") {
      const { booking: moved, previous } = await rescheduleBooking({ booking, type, startIso: String(body?.start_at || ""), by: "client" });
      // A 24-hour grant link becomes a permanent one so the emailed link keeps working.
      const permanent = via === "grant" ? await rotateManageToken(moved.id) : token;
      const link = permanent ? manageUrl(permanent) : null;
      after(async () => {
        try { await notifyBookingChanged({ kind: "rescheduled", booking: moved, type, previous, by: "client", manageUrl: link }); }
        catch (e) { console.error("[booking-manage] reschedule notify failed", moved.reference, e instanceof Error ? e.message : e); }
      });
      return NextResponse.json({
        ok: true, start_at: moved.start_at, end_at: moved.end_at, status: moved.status,
        manage_path: permanent && permanent !== token ? managePath(permanent) : null,
      });
    }

    if (action === "cancel") {
      const cancelled = await cancelBooking({ booking, type, reason: body?.reason ? String(body.reason) : null, by: "client" });
      after(async () => {
        try { await notifyBookingChanged({ kind: "cancelled", booking: cancelled, type, by: "client", reason: cancelled.cancel_reason }); }
        catch (e) { console.error("[booking-manage] cancel notify failed", cancelled.reference, e instanceof Error ? e.message : e); }
      });
      return NextResponse.json({ ok: true, status: "canceled" });
    }

    if (action === "update") {
      if (booking.status === "canceled") throw new Error("This appointment was cancelled.");
      const notifyEmail = body?.notify_email === true;
      const notifySms = body?.notify_sms === true;
      const updated = await updateBookingContact({
        booking,
        phone: body?.invitee_phone === undefined ? undefined : body.invitee_phone ? String(body.invitee_phone) : null,
        notifyEmail, notifySms, smsConsentText: BOOKING_SMS_CONSENT_TEXT, consent,
      });
      const newly = { email: notifyEmail && !booking.notify_email, sms: notifySms && !booking.notify_sms };
      if (newly.email || newly.sms) {
        after(async () => {
          try { await recordBookingConsent(updated, newly, consent); }
          catch (e) { console.error("[booking-manage] consent record failed", e instanceof Error ? e.message : e); }
        });
      }
      return NextResponse.json({ ok: true, invitee_phone: updated.invitee_phone, notify_email: notifyEmail, notify_sms: notifySms });
    }

    return NextResponse.json({ message: "Unknown action." }, { status: 400 });
  } catch (error) {
    if (error instanceof SlotTakenError) return NextResponse.json({ message: error.message }, { status: 409 });
    const msg = error instanceof Error ? error.message : "Something went wrong.";
    return NextResponse.json({ message: msg }, { status: /too close|no longer|cancelled|past/i.test(msg) ? 422 : 400 });
  }
}
