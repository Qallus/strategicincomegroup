import { NextRequest, NextResponse } from "next/server";
import { requestAccessLink } from "@/lib/booking/manage";
import { sendAccessLinkEmail } from "@/lib/booking/notify";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// Same answer for every valid request — never reveals whether an email has appointments.
const GENERIC = "If we have appointments for that email, we’ve sent a link. It works once and expires in 1 hour.";

// PUBLIC: "email me a link to my appointments".
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = String(body?.email || "").trim().slice(0, 254);
  if (!EMAIL_RE.test(email)) return NextResponse.json({ message: "Please enter a valid email address." }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;
  const started = Date.now();
  try {
    const outcome = await requestAccessLink(email, ip, sendAccessLinkEmail);
    if (outcome === "unavailable") console.warn("[booking-manage] access links unavailable — apply 202611210200_booking_self_service.sql");
  } catch (e) {
    console.error("[booking-manage] access request failed", e instanceof Error ? e.message : e);
  }
  // Flatten timing a little so "sent" vs "no bookings" isn't obvious from latency.
  const elapsed = Date.now() - started;
  if (elapsed < 600) await new Promise((r) => setTimeout(r, 600 - elapsed));
  return NextResponse.json({ ok: true, message: GENERIC });
}
