import { after, NextRequest, NextResponse } from "next/server";
import { createBooking, loadBookingTypeBySlug } from "@/lib/booking/data";
import { BOOKING_SMS_CONSENT_TEXT } from "@/lib/booking/consent";
import { notifyBookingCreated } from "@/lib/booking/notify";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// PUBLIC: create a booking against a published booking type.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const slug = String(body?.slug || "");
    const start_at = String(body?.start_at || "");
    const name = String(body?.invitee_name || "").trim();
    if (!slug || !start_at || !name) throw new Error("Name and a selected time are required.");

    const type = await loadBookingTypeBySlug(slug, { publicOnly: true });
    if (!type) return NextResponse.json({ message: "Booking type not found." }, { status: 404 });

    const start = new Date(start_at);
    if (Number.isNaN(start.getTime())) throw new Error("Invalid start time.");
    if (start.getTime() < Date.now()) throw new Error("That time is in the past.");
    const end = new Date(start.getTime() + type.duration_minutes * 60000);

    const email = body?.invitee_email ? String(body.invitee_email).trim() : null;
    const phone = body?.invitee_phone ? String(body.invitee_phone).trim() : null;
    if (email && !EMAIL_RE.test(email)) throw new Error("Please enter a valid email address.");

    // Notification opt-ins — both OFF unless the client switched them on. SMS needs a phone.
    const notify = {
      email: body?.notify_email === true && Boolean(email),
      sms: body?.notify_sms === true && Boolean(phone && phone.replace(/\D/g, "").length >= 10),
    };
    if (body?.notify_sms === true && !notify.sms) throw new Error("Add a mobile number to get text reminders.");

    const consent = {
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null,
      userAgent: request.headers.get("user-agent") ?? null,
    };

    const booking = await createBooking({
      booking_type_id: type.id,
      host_staff_id: type.host_staff_id,
      invitee_name: name,
      invitee_email: email,
      invitee_phone: phone,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      timezone: type.timezone,
      location_type: type.location_type,
      location_details: type.location_details,
      answers: body?.answers && typeof body.answers === "object" ? body.answers : {},
      source: "public",
      notify: {
        email: notify.email,
        sms: notify.sms,
        sms_consent_text: notify.sms ? BOOKING_SMS_CONSENT_TEXT : null,
        consent_ip: consent.ip,
        consent_user_agent: consent.userAgent,
      },
    });

    // Fire notifications after the response so the client never waits on SMTP/Twilio,
    // and a delivery failure can never fail the booking.
    after(async () => {
      try {
        await notifyBookingCreated({ booking, type, notify, consent });
      } catch (e) {
        console.error("[booking] notifications failed", booking.reference, e instanceof Error ? e.message : e);
      }
    });

    return NextResponse.json({
      ok: true,
      id: booking.id,
      reference: booking.reference,
      confirmation_message: type.confirmation_message,
      start_at: booking.start_at,
      end_at: booking.end_at,
      timezone: booking.timezone,
      notify,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Booking failed";
    // 409 for slot clashes so the client can refresh availability.
    const status = /just taken|in the past/i.test(msg) ? 409 : 400;
    return NextResponse.json({ message: msg }, { status });
  }
}
